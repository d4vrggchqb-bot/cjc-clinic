<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class BorrowingController {

    /**
     * Submit a new borrowing request.
     * - Supplies: permanently dispensed (FEFO stock deduction) immediately.
     * - Equipment: stock reserved (deducted) and released/adjusted on return.
     */
    public function submitForm() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $profileId          = $input['profile_id'] ?? null;
        $purpose            = $input['purpose'] ?? '';
        $expectedReturnDate = !empty($input['expected_return_date']) ? $input['expected_return_date'] : null;
        $items              = $input['items'] ?? [];
        $branch             = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';

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

            // Auto-generate booking reference code (e.g. EQ-2026-00042)
            $bookingCode = 'EQ-' . date('Y') . '-' . str_pad($borrowingId, 5, '0', STR_PAD_LEFT);
            $pdo->prepare("UPDATE borrowings SET booking_code = ? WHERE id = ?")->execute([$bookingCode, $borrowingId]);

            // 2. Process each item
            foreach ($items as $item) {
                $itemId   = $item['inventory_item_id'];
                $quantity = (int)$item['quantity'];
                $type     = $item['item_type']; // 'equipment' or 'supply'
                $itemBranch = $item['branch'] ?? $branch;

                // Both supplies AND equipment now deduct stock on checkout
                $status = ($type === 'supply') ? 'dispensed' : 'borrowed';
                $stockReserved = 0;

                // FEFO stock deduction for BOTH equipment and supply
                $batchStmt = $pdo->prepare("
                    SELECT id, stock_remaining
                    FROM inventory_batches
                    WHERE item_id = :item_id AND clinic_branch = :branch AND stock_remaining > 0
                      AND (expired_on >= CURDATE() OR expired_on IS NULL)
                    ORDER BY expired_on ASC, date_arrived ASC
                ");
                $batchStmt->execute(['item_id' => $itemId, 'branch' => $itemBranch]);
                $batches = $batchStmt->fetchAll();

                $remainingToDeduct = $quantity;
                foreach ($batches as $batch) {
                    if ($remainingToDeduct <= 0) break;

                    $available = (int)$batch['stock_remaining'];
                    $consumed  = min($available, $remainingToDeduct);
                    $newStock  = $available - $consumed;

                    $pdo->prepare("UPDATE inventory_batches SET stock_remaining = :stock, status = IF(:stock2=0,'depleted','active') WHERE id = :id")
                        ->execute(['stock' => $newStock, 'stock2' => $newStock, 'id' => $batch['id']]);

                    // Log the deduction
                    $logAction = ($type === 'supply') ? 'dispense' : 'dispense';
                    $logNote   = ($type === 'supply') ? 'Student/Employee Borrowing (Supply)' : 'Equipment Checked Out — Reserved';
                    $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, ?, ?, ?, ?, ?)")
                        ->execute([$batch['id'], $logAction, -$consumed, $logNote, $profileId, $_SESSION['cjc_user']['id']]);

                    $remainingToDeduct -= $consumed;
                }

                if ($remainingToDeduct > 0) {
                    throw new Exception("Insufficient stock for item ID $itemId in $itemBranch.");
                }

                $stockReserved = ($type === 'equipment') ? 1 : 0;

                // Insert into borrowed_items
                $pdo->prepare("INSERT INTO borrowed_items (borrowing_id, inventory_item_id, quantity, item_type, status, stock_reserved) VALUES (?, ?, ?, ?, ?, ?)")
                    ->execute([$borrowingId, $itemId, $quantity, $type, $status, $stockReserved]);
            }

            $pdo->commit();
            $this->jsonResponse([
                'success'      => true,
                'borrowing_id' => $borrowingId,
                'booking_code' => $bookingCode
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get all currently checked-out borrowings (grouped by borrowing session).
     * Includes overdue flag.
     */
    public function getCheckedOutEquipment() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();

        $pdo = cjcDatabaseConnection();

        // Get all active borrowings that still have at least one 'borrowed' item
        $stmt = $pdo->query("
            SELECT
                b.id AS borrowing_id,
                b.booking_code,
                b.purpose,
                b.expected_return_date,
                b.created_at,
                p.id AS profile_id,
                p.first_name,
                p.last_name,
                p.course,
                p.year_level,
                p.profile_type,
                p.department,
                bi.id AS borrowed_item_id,
                bi.quantity,
                bi.item_type,
                bi.status AS item_status,
                i.id AS inventory_item_id,
                i.generic_name,
                i.brand_name,
                i.category
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            WHERE b.status = 'active'
              AND bi.status = 'borrowed'
            ORDER BY b.created_at ASC
        ");

        // Group by borrowing
        $borrowings = [];
        $now = new DateTime();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $bId = $row['borrowing_id'];
            if (!isset($borrowings[$bId])) {
                $dueDate = $row['expected_return_date'] ? new DateTime($row['expected_return_date']) : null;
                $isOverdue = $dueDate && $dueDate < $now;
                $isDueSoon = $dueDate && !$isOverdue && ($dueDate->getTimestamp() - $now->getTimestamp()) < 86400; // within 24h

                $borrowings[$bId] = [
                    'borrowing_id'         => $bId,
                    'booking_code'         => $row['booking_code'] ?: ('EQ-' . date('Y') . '-' . str_pad($bId, 5, '0', STR_PAD_LEFT)),
                    'purpose'              => $row['purpose'],
                    'expected_return_date' => $row['expected_return_date'],
                    'created_at'           => $row['created_at'],
                    'is_overdue'           => $isOverdue,
                    'is_due_soon'          => $isDueSoon,
                    'profile_id'           => $row['profile_id'],
                    'first_name'           => $row['first_name'],
                    'last_name'            => $row['last_name'],
                    'course'               => $row['course'],
                    'year_level'           => $row['year_level'],
                    'profile_type'         => $row['profile_type'],
                    'department'           => $row['department'],
                    'items'                => []
                ];
            }
            $borrowings[$bId]['items'][] = [
                'borrowed_item_id'   => $row['borrowed_item_id'],
                'inventory_item_id'  => $row['inventory_item_id'],
                'generic_name'       => $row['generic_name'],
                'brand_name'         => $row['brand_name'],
                'category'           => $row['category'],
                'quantity'           => $row['quantity'],
                'item_type'          => $row['item_type'],
                'status'             => $row['item_status'],
            ];
        }

        $this->jsonResponse(['checked_out' => array_values($borrowings)]);
    }

    /**
     * Get full detail of a single borrowing (all items and statuses).
     */
    public function getBorrowingDetail() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();

        $borrowingId = $_GET['borrowing_id'] ?? null;
        if (!$borrowingId) $this->jsonResponse(['error' => 'borrowing_id required'], 400);

        $pdo  = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            SELECT
                b.id AS borrowing_id,
                b.booking_code,
                b.purpose,
                b.status AS borrowing_status,
                b.expected_return_date,
                b.created_at,
                b.returned_at,
                p.first_name,
                p.last_name,
                p.course,
                p.year_level,
                p.profile_type,
                p.department,
                bi.id AS borrowed_item_id,
                bi.quantity,
                bi.item_type,
                bi.status AS item_status,
                bi.stock_reserved,
                i.id AS inventory_item_id,
                i.generic_name,
                i.brand_name,
                i.category,
                bir.quantity_returned,
                bir.quantity_consumed,
                bir.returned_at AS item_returned_at
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            LEFT JOIN borrowed_item_returns bir ON bir.borrowed_item_id = bi.id
            WHERE b.id = ?
            ORDER BY bi.id ASC
        ");
        $stmt->execute([$borrowingId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            $this->jsonResponse(['error' => 'Borrowing not found'], 404);
        }

        $now     = new DateTime();
        $first   = $rows[0];
        $dueDate = $first['expected_return_date'] ? new DateTime($first['expected_return_date']) : null;

        $detail = [
            'borrowing_id'         => $first['borrowing_id'],
            'booking_code'         => $first['booking_code'] ?: ('EQ-' . date('Y') . '-' . str_pad($first['borrowing_id'], 5, '0', STR_PAD_LEFT)),
            'purpose'              => $first['purpose'],
            'borrowing_status'     => $first['borrowing_status'],
            'expected_return_date' => $first['expected_return_date'],
            'created_at'           => $first['created_at'],
            'returned_at'          => $first['returned_at'],
            'is_overdue'           => $dueDate && $dueDate < $now,
            'first_name'           => $first['first_name'],
            'last_name'            => $first['last_name'],
            'course'               => $first['course'],
            'year_level'           => $first['year_level'],
            'profile_type'         => $first['profile_type'],
            'department'           => $first['department'],
            'items'                => []
        ];

        foreach ($rows as $row) {
            $detail['items'][] = [
                'borrowed_item_id'  => $row['borrowed_item_id'],
                'inventory_item_id' => $row['inventory_item_id'],
                'generic_name'      => $row['generic_name'],
                'brand_name'        => $row['brand_name'],
                'category'          => $row['category'],
                'quantity'          => (int)$row['quantity'],
                'item_type'         => $row['item_type'],
                'status'            => $row['item_status'],
                'stock_reserved'    => (bool)$row['stock_reserved'],
                'quantity_returned' => $row['quantity_returned'] !== null ? (int)$row['quantity_returned'] : null,
                'quantity_consumed' => $row['quantity_consumed'] !== null ? (int)$row['quantity_consumed'] : null,
                'item_returned_at'  => $row['item_returned_at'],
            ];
        }

        $this->jsonResponse(['borrowing' => $detail]);
    }

    /**
     * Process return with per-item reconciliation.
     * Accepts: { borrowing_id, notes, items: [{ borrowed_item_id, quantity_returned, quantity_consumed }] }
     *
     * For equipment items:
     *   - quantity_returned → add back stock (restock log)
     *   - quantity_consumed → permanently consumed/lost, log as dispense (already deducted, so no extra action needed)
     * For supply items:
     *   - Already permanently deducted — just record the reconciliation entry
     */
    public function returnBorrowing() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();

        $input      = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $borrowingId = $input['borrowing_id'] ?? null;
        $items      = $input['items'] ?? [];
        $globalNotes = $input['notes'] ?? null;
        $branch     = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        $userId     = $_SESSION['cjc_user']['id'] ?? null;

        if (!$borrowingId || empty($items)) {
            $this->jsonResponse(['success' => false, 'error' => 'borrowing_id and items are required'], 400);
        }

        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();

            foreach ($items as $item) {
                $biId            = $item['borrowed_item_id'];
                $qtyReturned     = max(0, (int)($item['quantity_returned'] ?? 0));
                $qtyConsumed     = max(0, (int)($item['quantity_consumed'] ?? 0));
                $itemNotes       = $item['notes'] ?? $globalNotes;

                // Fetch the borrowed item
                $biStmt = $pdo->prepare("
                    SELECT bi.*, b.profile_id, i.id AS inventory_item_id
                    FROM borrowed_items bi
                    JOIN borrowings b ON bi.borrowing_id = b.id
                    JOIN inventory_items i ON bi.inventory_item_id = i.id
                    WHERE bi.id = ?
                ");
                $biStmt->execute([$biId]);
                $bi = $biStmt->fetch(PDO::FETCH_ASSOC);

                if (!$bi || $bi['status'] === 'returned' || $bi['status'] === 'dispensed') {
                    continue; // Already processed
                }

                $itemType     = $bi['item_type'];
                $inventoryId  = $bi['inventory_item_id'];
                $profileId    = $bi['profile_id'];

                // For equipment: restore the returned quantity to inventory (LIFO batch — add to most recent non-depleted batch)
                if ($itemType === 'equipment' && $qtyReturned > 0) {
                    // Find best batch to restore to (most recent active, or create a restock log entry)
                    $batchStmt = $pdo->prepare("
                        SELECT id FROM inventory_batches
                        WHERE item_id = ? AND clinic_branch = ? AND status != 'expired'
                        ORDER BY date_arrived DESC, id DESC LIMIT 1
                    ");
                    $batchStmt->execute([$inventoryId, $branch]);
                    $restoreBatch = $batchStmt->fetch(PDO::FETCH_ASSOC);

                    if ($restoreBatch) {
                        $pdo->prepare("UPDATE inventory_batches SET stock_remaining = stock_remaining + ?, status = 'active' WHERE id = ?")
                            ->execute([$qtyReturned, $restoreBatch['id']]);

                        $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'restock', ?, ?, ?, ?)")
                            ->execute([$restoreBatch['id'], $qtyReturned, 'Equipment Returned from Borrowing', $profileId, $userId]);
                    }
                }

                // Record reconciliation entry
                $pdo->prepare("INSERT INTO borrowed_item_returns (borrowed_item_id, quantity_returned, quantity_consumed, notes, processed_by) VALUES (?, ?, ?, ?, ?)")
                    ->execute([$biId, $qtyReturned, $qtyConsumed, $itemNotes, $userId]);

                // Mark this item as returned
                $pdo->prepare("UPDATE borrowed_items SET status = 'returned' WHERE id = ?")
                    ->execute([$biId]);
            }

            // Check if ALL items in this borrowing are now settled (returned or dispensed)
            $pendingStmt = $pdo->prepare("
                SELECT COUNT(*) FROM borrowed_items
                WHERE borrowing_id = ? AND status = 'borrowed'
            ");
            $pendingStmt->execute([$borrowingId]);
            $pendingCount = (int)$pendingStmt->fetchColumn();

            if ($pendingCount === 0) {
                $pdo->prepare("UPDATE borrowings SET status = 'returned', returned_at = CURRENT_TIMESTAMP WHERE id = ?")
                    ->execute([$borrowingId]);
            }

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'fully_returned' => $pendingCount === 0]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get recent booking history (all borrowings, grouped by session).
     */
    public function getRecentHistory() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();

        $pdo  = cjcDatabaseConnection();
        $stmt = $pdo->query("
            SELECT b.id AS borrowing_id, b.booking_code, b.purpose, b.created_at, b.status AS borrowing_status,
                   b.expected_return_date, b.returned_at,
                   p.first_name, p.last_name, p.course, p.year_level, p.profile_type,
                   bi.item_type, bi.status, bi.quantity,
                   i.generic_name, i.brand_name, i.category
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            ORDER BY b.created_at DESC
            LIMIT 200
        ");

        $history = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $bId = $row['borrowing_id'];
            if (!isset($history[$bId])) {
                $history[$bId] = [
                    'id'                   => $bId,
                    'booking_code'         => $row['booking_code'] ?: ('EQ-' . date('Y') . '-' . str_pad($bId, 5, '0', STR_PAD_LEFT)),
                    'purpose'              => $row['purpose'],
                    'created_at'           => $row['created_at'],
                    'borrowing_status'     => $row['borrowing_status'],
                    'expected_return_date' => $row['expected_return_date'],
                    'returned_at'          => $row['returned_at'],
                    'first_name'           => $row['first_name'],
                    'last_name'            => $row['last_name'],
                    'profile_type'         => $row['profile_type'],
                    'course'               => $row['course'],
                    'year_level'           => $row['year_level'],
                    'items'                => []
                ];
            }
            $history[$bId]['items'][] = [
                'generic_name' => $row['generic_name'],
                'brand_name'   => $row['brand_name'],
                'category'     => $row['category'],
                'quantity'     => $row['quantity'],
                'item_type'    => $row['item_type'],
                'status'       => $row['status']
            ];
        }

        $this->jsonResponse(['history' => array_values($history)]);
    }

    /**
     * Profile borrowing history (for patient view modal).
     */
    public function getProfileBorrowings() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();

        $profileId = $_GET['profile_id'] ?? null;
        if (!$profileId) $this->jsonResponse(['error' => 'Profile ID required'], 400);

        $pdo  = cjcDatabaseConnection();
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

        $borrowings = [];
        foreach ($stmt->fetchAll() as $row) {
            $bId = $row['id'];
            if (!isset($borrowings[$bId])) {
                $borrowings[$bId] = [
                    'id'                   => $bId,
                    'purpose'              => $row['purpose'],
                    'expected_return_date' => $row['expected_return_date'],
                    'status'               => $row['status'],
                    'created_at'           => $row['created_at'],
                    'returned_at'          => $row['returned_at'],
                    'items'                => []
                ];
            }
            $borrowings[$bId]['items'][] = [
                'item_id'   => $row['item_id'],
                'name'      => $row['brand_name'] ? "{$row['brand_name']} ({$row['generic_name']})" : $row['generic_name'],
                'quantity'  => $row['quantity'],
                'item_type' => $row['item_type'],
                'status'    => $row['item_status']
            ];
        }

        $this->jsonResponse(['borrowings' => array_values($borrowings)]);
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
