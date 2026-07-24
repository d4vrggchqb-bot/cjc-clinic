<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class BorrowingController {
    
    public function submitForm() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $profileId = $input['profile_id'] ?? null;
        $purpose = $input['purpose'] ?? '';
        $expectedReturnDate = !empty($input['expected_return_date']) ? $input['expected_return_date'] : null;
        $items = $input['items'] ?? []; // Array of ['inventory_item_id', 'quantity', 'item_type', 'branch']
        
        if (!$profileId || empty($items)) {
            $this->jsonResponse(['success' => false, 'error' => 'Profile ID and Items are required.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();
            
            // 1. Create the main borrowing record
            $stmt = $pdo->prepare("INSERT INTO borrowings (profile_id, purpose, expected_return_date, status) VALUES (?, ?, ?, 'active')");
            $stmt->execute([$profileId, $purpose, $expectedReturnDate]);
            $borrowingId = $pdo->lastInsertId();
            
            // 2. Process each item
            foreach ($items as $item) {
                $itemId = $item['inventory_item_id'];
                $quantity = (int)$item['quantity'];
                $type = $item['item_type']; // 'equipment' or 'supply'
                $branch = $item['branch'] ?? ($_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic');
                
                $status = ($type === 'supply') ? 'dispensed' : 'borrowed';
                
                // Insert into borrowed_items
                $itemStmt = $pdo->prepare("INSERT INTO borrowed_items (borrowing_id, inventory_item_id, quantity, item_type, status) VALUES (?, ?, ?, ?, ?)");
                $itemStmt->execute([$borrowingId, $itemId, $quantity, $type, $status]);
                
                // If it's a consumable supply, we permanently dispense it (reduce stock)
                if ($type === 'supply') {
                    // Smart Dispense logic (FEFO)
                    $batchStmt = $pdo->prepare("
                        SELECT id, stock_remaining 
                        FROM inventory_batches 
                        WHERE item_id = :item_id AND clinic_branch = :branch AND stock_remaining > 0 
                          AND (expired_on >= CURDATE() OR expired_on IS NULL)
                        ORDER BY expired_on ASC, date_arrived ASC
                    ");
                    $batchStmt->execute(['item_id' => $itemId, 'branch' => $branch]);
                    $batches = $batchStmt->fetchAll();
                    
                    $remainingToDispense = $quantity;
                    foreach ($batches as $batch) {
                        if ($remainingToDispense <= 0) break;
                        
                        $available = (int)$batch['stock_remaining'];
                        $consumed = min($available, $remainingToDispense);
                        $newStock = $available - $consumed;
                        
                        // Update batch
                        $updateStmt = $pdo->prepare("UPDATE inventory_batches SET stock_remaining = :stock, status = IF(:stock2=0, 'depleted', 'active') WHERE id = :id");
                        $updateStmt->execute(['stock' => $newStock, 'stock2' => $newStock, 'id' => $batch['id']]);
                        
                        // Log deduction
                        $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'dispense', ?, 'Student/Employee Borrowing', ?, ?)");
                        $logStmt->execute([$batch['id'], -$consumed, $profileId, $_SESSION['cjc_user']['id']]);
                        
                        $remainingToDispense -= $consumed;
                    }
                    
                    if ($remainingToDispense > 0) {
                        throw new Exception("Insufficient stock for item ID $itemId in $branch.");
                    }
                }
                // If it's equipment, we just track it in borrowed_items (badge logic per user request), we don't deduct permanent stock.
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true, 'borrowing_id' => $borrowingId]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getProfileBorrowings() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        
        $profileId = $_GET['profile_id'] ?? null;
        if (!$profileId) $this->jsonResponse(['error' => 'Profile ID required'], 400);
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            SELECT b.id, b.purpose, b.expected_return_date, b.status, b.created_at, b.returned_at,
                   bi.id as item_id, bi.quantity, bi.item_type, bi.status as item_status,
                   i.generic_name, i.brand_name
            FROM borrowings b
            JOIN borrowed_items bi ON b.id = bi.borrowing_id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            WHERE b.profile_id = ?
            ORDER BY b.created_at DESC
        ");
        $stmt->execute([$profileId]);
        
        // Group by borrowing ID
        $borrowings = [];
        foreach ($stmt->fetchAll() as $row) {
            $bId = $row['id'];
            if (!isset($borrowings[$bId])) {
                $borrowings[$bId] = [
                    'id' => $bId,
                    'purpose' => $row['purpose'],
                    'expected_return_date' => $row['expected_return_date'],
                    'status' => $row['status'],
                    'created_at' => $row['created_at'],
                    'returned_at' => $row['returned_at'],
                    'items' => []
                ];
            }
            $borrowings[$bId]['items'][] = [
                'item_id' => $row['item_id'],
                'name' => $row['brand_name'] ? "{$row['brand_name']} ({$row['generic_name']})" : $row['generic_name'],
                'quantity' => $row['quantity'],
                'item_type' => $row['item_type'],
                'status' => $row['item_status']
            ];
        }
        
        $this->jsonResponse(['borrowings' => array_values($borrowings)]);
    }

    public function getCheckedOutEquipment() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->query("
            SELECT bi.id as borrowed_item_id, bi.quantity, b.created_at as item_created,
                   b.id as borrowing_id, b.purpose, b.expected_return_date, b.created_at,
                   p.first_name, p.last_name, p.course, p.year_level, p.profile_type,
                   i.generic_name, i.brand_name, i.id as inventory_item_id
            FROM borrowed_items bi
            JOIN borrowings b ON bi.borrowing_id = b.id
            JOIN profiles p ON b.profile_id = p.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            WHERE bi.item_type = 'equipment' AND bi.status = 'borrowed'
            ORDER BY b.created_at ASC
        ");
        
        $this->jsonResponse(['checked_out' => $stmt->fetchAll()]);
    }

    public function getRecentHistory() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->query("
            SELECT b.id as borrowing_id, b.purpose, b.created_at,
                   p.first_name, p.last_name, p.course, p.year_level, p.profile_type,
                   bi.item_type, bi.status, bi.quantity,
                   i.generic_name, i.brand_name
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            ORDER BY b.created_at DESC
            LIMIT 100
        ");
        
        // Group by borrowing
        $history = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $bId = $row['borrowing_id'];
            if (!isset($history[$bId])) {
                $history[$bId] = [
                    'id' => $bId,
                    'purpose' => $row['purpose'],
                    'created_at' => $row['created_at'],
                    'first_name' => $row['first_name'],
                    'last_name' => $row['last_name'],
                    'profile_type' => $row['profile_type'],
                    'course' => $row['course'],
                    'items' => []
                ];
            }
            $history[$bId]['items'][] = [
                'generic_name' => $row['generic_name'],
                'brand_name' => $row['brand_name'],
                'quantity' => $row['quantity'],
                'item_type' => $row['item_type'],
                'status' => $row['status']
            ];
        }
        
        $this->jsonResponse(['history' => array_values($history)]);
    }

    public function returnEquipment() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $borrowedItemId = $input['borrowed_item_id'] ?? null;
        
        if (!$borrowedItemId) $this->jsonResponse(['success' => false, 'error' => 'Borrowed Item ID required'], 400);
        
        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();
            
            // Mark item as returned
            $stmt = $pdo->prepare("UPDATE borrowed_items SET status = 'returned' WHERE id = ?");
            $stmt->execute([$borrowedItemId]);
            
            // Check if all items for this borrowing are returned/dispensed
            // If so, mark the main borrowing as returned
            $chkStmt = $pdo->prepare("
                SELECT b.id, 
                       (SELECT COUNT(*) FROM borrowed_items WHERE borrowing_id = b.id AND status = 'borrowed') as pending_count
                FROM borrowed_items bi
                JOIN borrowings b ON bi.borrowing_id = b.id
                WHERE bi.id = ?
            ");
            $chkStmt->execute([$borrowedItemId]);
            $res = $chkStmt->fetch();
            
            if ($res && $res['pending_count'] == 0) {
                $updStmt = $pdo->prepare("UPDATE borrowings SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE id = ?");
                $updStmt->execute([$res['id']]);
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
