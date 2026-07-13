<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class InventoryController {
    
    // --- CATALOG ITEMS ---
    public function getItems() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        
        $stmt = $pdo->query("SELECT * FROM inventory_items ORDER BY generic_name ASC");
        $items = $stmt->fetchAll();
        $this->jsonResponse(['items' => $items]);
    }

    public function addItem() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("INSERT INTO inventory_items (category, brand_name, generic_name, dosage, alert_threshold) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['category'] ?? 'medicine',
            $input['brand_name'] ?? null,
            $input['generic_name'] ?? '',
            $input['dosage'] ?? null,
            $input['alert_threshold'] ?? 20
        ]);
        $this->jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
    }

    // --- BATCHES ---
    public function getBatches() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        
        $branch = $_GET['branch'] ?? 'all';
        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        }

        $params = [];
        $where = "WHERE b.stock_remaining > 0";
        if ($branch !== 'all') {
            $where .= " AND b.clinic_branch = :branch";
            $params['branch'] = $branch;
        }

        $stmt = $pdo->prepare("
            SELECT b.*, i.generic_name, i.brand_name, i.category, i.dosage
            FROM inventory_batches b
            JOIN inventory_items i ON b.item_id = i.id
            $where
            ORDER BY b.expired_on ASC, b.date_arrived ASC
        ");
        $stmt->execute($params);
        $this->jsonResponse(['batches' => $stmt->fetchAll()]);
    }

    public function addBatch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $pdo = cjcDatabaseConnection();
        
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO inventory_batches (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, expired_on) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['item_id'],
                $input['clinic_branch'],
                $input['batch_number'] ?? null,
                $input['stock_remaining'],
                $input['date_arrived'] ?? date('Y-m-d'),
                $input['expired_on'] ?? null
            ]);
            $batchId = $pdo->lastInsertId();

            $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, processed_by) VALUES (?, 'restock', ?, ?)");
            $logStmt->execute([$batchId, $input['stock_remaining'], $_SESSION['cjc_user']['id']]);

            $pdo->commit();
            $this->jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // --- SMART DISPENSE (FEFO/FIFO) ---
    public function dispense() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Doctor', 'Nurse']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $itemId = (int)($input['item_id'] ?? 0);
        $branch = trim($input['clinic_branch'] ?? '');
        $quantity = (int)($input['quantity'] ?? 0);
        $disposedTo = trim($input['disposed_to'] ?? '');
        
        if (!$itemId || !$branch || $quantity <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid parameters.'], 400);
        }
        
        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();
            
            // Fetch active batches sorted by FEFO (expiration) then FIFO (arrival)
            $stmt = $pdo->prepare("
                SELECT id, stock_remaining, expired_on 
                FROM inventory_batches 
                WHERE item_id = :item_id AND clinic_branch = :branch AND stock_remaining > 0 
                  AND (expired_on >= CURDATE() OR expired_on IS NULL)
                ORDER BY expired_on ASC, date_arrived ASC
            ");
            $stmt->execute(['item_id' => $itemId, 'branch' => $branch]);
            $batches = $stmt->fetchAll();
            
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
                $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, processed_by) VALUES (?, 'dispense', ?, ?, ?)");
                $logStmt->execute([$batch['id'], -$consumed, $disposedTo, $_SESSION['cjc_user']['id']]);
                
                $remainingToDispense -= $consumed;
            }
            
            if ($remainingToDispense > 0) {
                $pdo->rollBack();
                $this->jsonResponse(['success' => false, 'message' => "Insufficient stock in $branch. Short by $remainingToDispense units."], 400);
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => "Successfully dispensed {$quantity} units using FEFO logic."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => 'Database error.'], 500);
        }
    }

    public function getLowStock() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        $stmt = $pdo->prepare("
            SELECT i.id, i.category, i.generic_name, i.brand_name, i.dosage, IFNULL(SUM(b.stock_remaining), 0) as total_stock, i.alert_threshold
            FROM inventory_items i
            LEFT JOIN inventory_batches b ON i.id = b.item_id AND b.clinic_branch = :branch
            GROUP BY i.id
            HAVING total_stock <= i.alert_threshold
        ");
        $stmt->execute(['branch' => $branch]);
        $this->jsonResponse(['low_stock' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    public function getPurchases() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->query("SELECT * FROM purchase_requests ORDER BY requested_date DESC");
        $this->jsonResponse(['purchases' => $stmt->fetchAll()]);
    }

    public function addPurchase() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            INSERT INTO purchase_requests 
            (category, generic_name, brand_name, dosage, clinic_branch, supplier, quantity_ordered, expected_delivery_date, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([
            $input['category'] ?? 'medicine',
            $input['generic_name'],
            $input['brand_name'] ?? null,
            $input['dosage'] ?? null,
            $input['clinic_branch'],
            $input['supplier'] ?? null,
            $input['quantity_ordered'] ?? 1,
            $input['expected_delivery_date'] ?? null
        ]);
        $this->jsonResponse(['success' => true]);
    }

    public function updatePurchase() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $pdo = cjcDatabaseConnection();
        $status = $input['status'];
        $id = $input['id'];
        
        try {
            $pdo->beginTransaction();
            
            // If marking as delivered, integrate with catalog and batches
            if ($status === 'delivered') {
                $actualQty = (int)($input['actual_quantity'] ?? 0);
                $expiry = $input['expiry_date'] ?? null;
                $batchNum = $input['batch_number'] ?? null;
                
                // Fetch PO details
                $poStmt = $pdo->prepare("SELECT * FROM purchase_requests WHERE id = ?");
                $poStmt->execute([$id]);
                $po = $poStmt->fetch();
                
                if (!$po) throw new Exception("Purchase Order not found.");
                
                // 1. Check if item exists in catalog, if not create it
                $itemStmt = $pdo->prepare("SELECT id FROM inventory_items WHERE generic_name = ? AND category = ?");
                $itemStmt->execute([$po['generic_name'], $po['category']]);
                $item = $itemStmt->fetch();
                $itemId = $item['id'] ?? null;
                
                if (!$itemId) {
                    $insertItem = $pdo->prepare("INSERT INTO inventory_items (category, brand_name, generic_name, dosage) VALUES (?, ?, ?, ?)");
                    $insertItem->execute([$po['category'], $po['brand_name'], $po['generic_name'], $po['dosage']]);
                    $itemId = $pdo->lastInsertId();
                }
                
                // 2. Add as new batch
                $insertBatch = $pdo->prepare("
                    INSERT INTO inventory_batches (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, expired_on) 
                    VALUES (?, ?, ?, ?, CURDATE(), ?)
                ");
                $insertBatch->execute([$itemId, $po['clinic_branch'], $batchNum, $actualQty, $expiry]);
                $batchId = $pdo->lastInsertId();
                
                // 3. Log restock
                $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, processed_by) VALUES (?, 'restock', ?, ?)");
                $logStmt->execute([$batchId, $actualQty, $_SESSION['cjc_user']['id']]);
                
                // Update PO status with actual delivery date
                $updatePo = $pdo->prepare("UPDATE purchase_requests SET status = 'delivered', actual_delivery_date = CURDATE() WHERE id = ?");
                $updatePo->execute([$id]);
            } else {
                $stmt = $pdo->prepare("UPDATE purchase_requests SET status = ? WHERE id = ?");
                $stmt->execute([$status, $id]);
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getLogs() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branchFilter = "";
        $params = [];
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branchFilter = " WHERE b.clinic_branch = ? ";
            $params[] = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        }

        $stmt = $pdo->prepare("
            SELECT l.*, b.batch_number, b.clinic_branch, i.generic_name, i.category, u.name as processor_name
            FROM inventory_logs l
            JOIN inventory_batches b ON l.batch_id = b.id
            JOIN inventory_items i ON b.item_id = i.id
            LEFT JOIN users u ON l.processed_by = u.id
            $branchFilter
            ORDER BY l.created_at DESC
            LIMIT 200
        ");
        $stmt->execute($params);
        $this->jsonResponse(['logs' => $stmt->fetchAll()]);
    }

    public function editBatch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $pdo = cjcDatabaseConnection();
        
        try {
            $pdo->beginTransaction();
            
            // Get current batch
            $stmt = $pdo->prepare("SELECT * FROM inventory_batches WHERE id = ?");
            $stmt->execute([$input['batch_id']]);
            $oldBatch = $stmt->fetch();
            if (!$oldBatch) throw new Exception("Batch not found.");
            
            $newStock = (int)$input['stock_remaining'];
            $diff = $newStock - (int)$oldBatch['stock_remaining'];
            
            // Update batch
            $upd = $pdo->prepare("UPDATE inventory_batches SET batch_number = ?, date_arrived = ?, expired_on = ?, stock_remaining = ?, status = IF(?=0, 'depleted', 'active') WHERE id = ?");
            $upd->execute([
                $input['batch_number'], 
                $input['date_arrived'], 
                $input['expired_on'] ?: null, 
                $newStock, 
                $newStock,
                $input['batch_id']
            ]);
            
            // Log if stock changed
            if ($diff !== 0) {
                $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, processed_by) VALUES (?, 'adjust', ?, ?)");
                $logStmt->execute([$input['batch_id'], $diff, $_SESSION['cjc_user']['id']]);
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    public function getNextBatchNumber() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $genericName = $_GET['generic_name'] ?? '';
        $category = $_GET['category'] ?? '';
        
        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as cnt 
            FROM inventory_batches b
            JOIN inventory_items i ON b.item_id = i.id
            WHERE i.generic_name = ? AND i.category = ?
        ");
        $stmt->execute([$genericName, $category]);
        $result = $stmt->fetch();
        $count = (int)($result['cnt'] ?? 0);
        
        $nextNumber = str_pad($count + 1, 3, '0', STR_PAD_LEFT);
        $this->jsonResponse(['suggested_batch' => "BATCH-$nextNumber"]);
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
