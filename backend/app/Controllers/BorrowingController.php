<?php
require_once __DIR__ . '/BaseController.php';

class BorrowingController extends BaseController {

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
        $branch             = $this->getUserBranch();

        if (!$profileId || empty($items)) {
            $this->jsonResponse(['success' => false, 'error' => 'Profile ID and Items are required.'], 400);
        }

        $pdo = cjcDatabaseConnection();

        // Enforce branch-patient isolation for Basic Education Clinic
        if (!$this->isSuperAdmin()) {
            if ($branch === 'Basic Education Clinic' || $branch === 'BED Clinic') {
                $pStmt = $pdo->prepare("SELECT id, profile_type, sub_type, college_dept FROM profiles WHERE id = ?");
                $pStmt->execute([$profileId]);
                $prof = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($prof) {
                    $isBed = ($prof['profile_type'] === 'student' && ($prof['sub_type'] === 'BED' || $prof['college_dept'] === 'Basic Education' || stripos($prof['college_dept'] ?? '', 'BED') !== false))
                          || ($prof['profile_type'] === 'employee' && ($prof['college_dept'] === 'Basic Education' || stripos($prof['college_dept'] ?? '', 'BED') !== false))
                          || ($prof['profile_type'] === 'guest' && ($prof['sub_type'] === 'BED' || $prof['college_dept'] === 'Basic Education'));
                    if (!$isBed) {
                        $this->jsonResponse(['success' => false, 'error' => 'Only Basic Education students and employees can borrow in Basic Education Clinic.'], 403);
                    }
                }
            } else if (in_array($branch, ['College Clinic', 'Power Campus Clinic'])) {
                $pStmt = $pdo->prepare("SELECT id, profile_type, sub_type, college_dept FROM profiles WHERE id = ?");
                $pStmt->execute([$profileId]);
                $prof = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($prof) {
                    $isBed = ($prof['profile_type'] === 'student' && ($prof['sub_type'] === 'BED' || $prof['college_dept'] === 'Basic Education' || stripos($prof['college_dept'] ?? '', 'BED') !== false))
                          || ($prof['profile_type'] === 'employee' && ($prof['college_dept'] === 'Basic Education' || stripos($prof['college_dept'] ?? '', 'BED') !== false))
                          || ($prof['profile_type'] === 'guest' && ($prof['sub_type'] === 'BED' || $prof['college_dept'] === 'Basic Education'));
                    if ($isBed) {
                        $this->jsonResponse(['success' => false, 'error' => 'Basic Education students and employees must borrow through Basic Education Clinic.'], 403);
                    }
                }
            }
        }

        try {
            $pdo->beginTransaction();

            // 1. Create the main borrowing record
            $releasedBy = $_SESSION['cjc_user']['id'] ?? null;
            $stmt = $pdo->prepare("INSERT INTO borrowings (profile_id, purpose, expected_return_date, released_by, status, clinic_branch) VALUES (?, ?, ?, ?, 'active', ?)");
            $stmt->execute([$profileId, $purpose, $expectedReturnDate, $releasedBy, $branch]);
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

                // ALL items in a borrowing session start as 'borrowed' until returned/reconciled
                $status = 'borrowed';
                $stockReserved = ($type === 'equipment') ? 1 : 0;

                // FEFO stock deduction for BOTH equipment and supply
                // Prefers current clinic branch first, then fallbacks to any active non-depleted batch
                $batchStmt = $pdo->prepare("
                    SELECT id, stock_remaining
                    FROM inventory_batches
                    WHERE item_id = :item_id AND stock_remaining > 0
                      AND (expired_on >= CURDATE() OR expired_on IS NULL)
                    ORDER BY (clinic_branch = :branch) DESC, expired_on ASC, date_arrived ASC
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
                    $logNote = ($type === 'supply') ? 'Supply Checked Out for Borrowing' : 'Equipment Checked Out — Reserved';
                    $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'dispense', ?, ?, ?, ?)")
                        ->execute([$batch['id'], -$consumed, $logNote, $profileId, $_SESSION['cjc_user']['id']]);

                    $remainingToDeduct -= $consumed;
                }

                if ($remainingToDeduct > 0) {
                    throw new Exception("Insufficient stock available for this item.");
                }

                // Insert into borrowed_items as 'borrowed'
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
     * Get SQL condition to scope borrowings and borrowers by clinic branch domain.
     */
    private function getBranchFilter(): string {
        $branch = $this->getUserBranch();

        if ($this->isSuperAdmin()) {
            $requestedBranch = trim($_GET['branch'] ?? '');
            if (!empty($requestedBranch) && $requestedBranch !== 'All Branches') {
                $branch = $requestedBranch;
            } else {
                return "";
            }
        }

        if ($branch === 'Basic Education Clinic' || $branch === 'BED Clinic') {
            return " AND (
                (
                    (p.profile_type = 'student' AND (p.sub_type = 'BED' OR p.college_dept = 'Basic Education' OR p.college_dept LIKE '%BED%'))
                    OR (p.profile_type = 'employee' AND (p.college_dept = 'Basic Education' OR p.college_dept LIKE '%BED%'))
                    OR (p.profile_type = 'guest' AND (p.sub_type = 'BED' OR p.college_dept = 'Basic Education' OR p.college_dept LIKE '%BED%'))
                )
                AND (b.clinic_branch IN ('Basic Education Clinic', 'BED Clinic') OR b.clinic_branch IS NULL)
            )";
        } else if ($branch === 'Power Campus Clinic') {
            return " AND (b.clinic_branch = 'Power Campus Clinic')";
        } else {
            // College Clinic (default)
            return " AND (
                (
                    (p.profile_type = 'student' AND (p.sub_type != 'BED' OR p.sub_type IS NULL))
                    OR (p.profile_type = 'employee' AND (p.college_dept != 'Basic Education' OR p.college_dept IS NULL) AND (p.college_dept NOT LIKE '%BED%' OR p.college_dept IS NULL))
                    OR (p.profile_type = 'guest' AND (p.sub_type != 'BED' OR p.sub_type IS NULL))
                )
                AND (b.clinic_branch NOT IN ('Basic Education Clinic', 'BED Clinic') OR b.clinic_branch IS NULL)
            )";
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
        $branchFilter = $this->getBranchFilter();

        // Get all active borrowings that still have at least one 'borrowed' item
        $stmt = $pdo->query("
            SELECT
                b.id AS borrowing_id,
                b.booking_code,
                b.purpose,
                b.clinic_branch,
                b.expected_return_date,
                b.created_at,
                p.id AS profile_id,
                p.first_name,
                p.last_name,
                p.course,
                p.year_level,
                p.profile_type,
                p.college_dept AS department,
                COALESCE(u_rel.name, u_rel.username) AS released_by_name,
                bi.id AS borrowed_item_id,
                bi.quantity,
                bi.item_type,
                bi.status AS item_status,
                bi.condition_status,
                bi.settlement_action,
                bi.settlement_notes,
                bi.charge_amount,
                i.id AS inventory_item_id,
                i.generic_name,
                i.brand_name,
                i.category
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            LEFT JOIN users u_rel ON b.released_by = u_rel.id
            WHERE b.status = 'active'
              AND bi.status = 'borrowed'
              {$branchFilter}
            ORDER BY b.created_at DESC
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
                    'clinic_branch'        => $row['clinic_branch'],
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
                    'released_by_name'     => $row['released_by_name'],
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
                'condition_status'   => $row['condition_status'] ?? 'good',
                'settlement_action'  => $row['settlement_action'] ?? 'none',
                'settlement_notes'   => $row['settlement_notes'],
                'charge_amount'      => (float)($row['charge_amount'] ?? 0),
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
                b.clinic_branch,
                b.status AS borrowing_status,
                b.expected_return_date,
                b.created_at,
                b.returned_at,
                p.first_name,
                p.last_name,
                p.course,
                p.year_level,
                p.profile_type,
                p.college_dept AS department,
                COALESCE(u_rel.name, u_rel.username) AS released_by_name,
                COALESCE(u_ret.name, u_ret.username) AS returned_to_name,
                bi.id AS borrowed_item_id,
                bi.quantity,
                bi.item_type,
                bi.status AS item_status,
                bi.stock_reserved,
                bi.condition_status,
                bi.settlement_action,
                bi.settlement_notes,
                bi.charge_amount,
                bi.settled_at,
                i.id AS inventory_item_id,
                i.generic_name,
                i.brand_name,
                i.category,
                bir.quantity_returned,
                bir.quantity_consumed,
                bir.notes AS return_notes,
                bir.condition_status AS return_condition_status,
                bir.settlement_action AS return_settlement_action,
                bir.settlement_notes AS return_settlement_notes,
                bir.charge_amount AS return_charge_amount,
                bir.returned_at AS item_returned_at
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            LEFT JOIN users u_rel ON b.released_by = u_rel.id
            LEFT JOIN borrowed_item_returns bir ON bir.borrowed_item_id = bi.id
            LEFT JOIN users u_ret ON bir.processed_by = u_ret.id
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
            'clinic_branch'        => $first['clinic_branch'],
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
            'released_by_name'     => $first['released_by_name'],
            'returned_to_name'     => $first['returned_to_name'],
            'items'                => []
        ];

        foreach ($rows as $row) {
            $detail['items'][] = [
                'borrowed_item_id'   => $row['borrowed_item_id'],
                'inventory_item_id'  => $row['inventory_item_id'],
                'generic_name'       => $row['generic_name'],
                'brand_name'         => $row['brand_name'],
                'category'           => $row['category'],
                'quantity'           => (int)$row['quantity'],
                'item_type'          => $row['item_type'],
                'status'             => $row['item_status'],
                'stock_reserved'     => (bool)$row['stock_reserved'],
                'quantity_returned'  => $row['quantity_returned'] !== null ? (int)$row['quantity_returned'] : null,
                'quantity_consumed'  => $row['quantity_consumed'] !== null ? (int)$row['quantity_consumed'] : null,
                'condition_status'   => $row['return_condition_status'] ?: ($row['condition_status'] ?? 'good'),
                'settlement_action'  => $row['return_settlement_action'] ?: ($row['settlement_action'] ?? 'none'),
                'settlement_notes'   => $row['return_settlement_notes'] ?: $row['settlement_notes'],
                'charge_amount'      => (float)($row['return_charge_amount'] !== null ? $row['return_charge_amount'] : ($row['charge_amount'] ?? 0)),
                'settled_at'         => $row['settled_at'],
                'return_notes'       => $row['return_notes'],
                'item_returned_at'   => $row['item_returned_at'],
            ];
        }

        $this->jsonResponse(['borrowing' => $detail]);
    }

    /**
     * Process return with per-item reconciliation and condition/damage check.
     * Accepts: { borrowing_id, notes, items: [{ borrowed_item_id, quantity_returned, quantity_consumed, condition_status, settlement_action, settlement_notes, charge_amount }] }
     */
    public function returnBorrowing() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();

        $input       = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $borrowingId = $input['borrowing_id'] ?? null;
        $items       = $input['items'] ?? [];
        $globalNotes = $input['notes'] ?? null;
        $branch      = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        $userId      = $_SESSION['cjc_user']['id'] ?? null;

        if (!$borrowingId || empty($items)) {
            $this->jsonResponse(['success' => false, 'error' => 'borrowing_id and items are required'], 400);
        }

        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();

            foreach ($items as $item) {
                $biId             = $item['borrowed_item_id'];
                $qtyReturned      = max(0, (int)($item['quantity_returned'] ?? 0));
                $qtyConsumed      = max(0, (int)($item['quantity_consumed'] ?? 0));
                $conditionStatus  = $item['condition_status'] ?? 'good';
                $settlementAction = $item['settlement_action'] ?? 'none';
                $settlementNotes  = !empty($item['settlement_notes']) ? trim($item['settlement_notes']) : null;
                $chargeAmount     = !empty($item['charge_amount']) ? (float)$item['charge_amount'] : 0.00;
                $itemNotes        = $item['notes'] ?? $globalNotes;

                if (!in_array($conditionStatus, ['good', 'damaged', 'lost'])) {
                    $conditionStatus = 'good';
                }
                if (!in_array($settlementAction, ['none', 'to_replace', 'to_pay', 'replaced', 'paid'])) {
                    $settlementAction = 'none';
                }

                if ($conditionStatus === 'good') {
                    $settlementAction = 'none';
                } elseif ($settlementAction === 'none') {
                    $settlementAction = 'to_replace';
                }

                // Fetch the borrowed item
                $biStmt = $pdo->prepare("
                    SELECT bi.*, b.profile_id, b.clinic_branch AS borrowing_branch, i.id AS inventory_item_id, i.generic_name, i.brand_name
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

                $itemType        = $bi['item_type'];
                $inventoryId     = $bi['inventory_item_id'];
                $profileId       = $bi['profile_id'];
                $effectiveBranch = !empty($bi['borrowing_branch']) ? $bi['borrowing_branch'] : $branch;

                // Restock rule:
                // Equipment: ONLY restock if condition is 'good' OR replaced on the spot
                // Supplies: restock returned unused supplies
                $shouldRestock = false;
                $restockQty    = 0;

                if ($itemType === 'equipment') {
                    if ($conditionStatus === 'good' && $qtyReturned > 0) {
                        $shouldRestock = true;
                        $restockQty = $qtyReturned;
                    } elseif (($conditionStatus === 'damaged' || $conditionStatus === 'lost') && $settlementAction === 'replaced') {
                        $shouldRestock = true;
                        $restockQty = max(1, (int)$bi['quantity']);
                    }
                } else {
                    if ($qtyReturned > 0) {
                        $shouldRestock = true;
                        $restockQty = $qtyReturned;
                    }
                }

                if ($shouldRestock && $restockQty > 0) {
                    $batchStmt = $pdo->prepare("
                        SELECT id FROM inventory_batches
                        WHERE item_id = ? AND clinic_branch = ?
                        ORDER BY status = 'active' DESC, date_arrived DESC, id DESC LIMIT 1
                    ");
                    $batchStmt->execute([$inventoryId, $effectiveBranch]);
                    $restoreBatch = $batchStmt->fetch(PDO::FETCH_ASSOC);

                    if (!$restoreBatch) {
                        $batchStmt = $pdo->prepare("
                            SELECT id FROM inventory_batches
                            WHERE item_id = ?
                            ORDER BY (clinic_branch = ?) DESC, status = 'active' DESC, date_arrived DESC, id DESC LIMIT 1
                        ");
                        $batchStmt->execute([$inventoryId, $effectiveBranch]);
                        $restoreBatch = $batchStmt->fetch(PDO::FETCH_ASSOC);
                    }

                    if (!$restoreBatch) {
                        $createBatch = $pdo->prepare("INSERT INTO inventory_batches (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, status) VALUES (?, ?, ?, 0, CURDATE(), 'active')");
                        $createBatch->execute([$inventoryId, $effectiveBranch, 'RET-' . date('Ymd')]);
                        $restoreBatch = ['id' => $pdo->lastInsertId()];
                    }

                    if ($restoreBatch) {
                        $pdo->prepare("UPDATE inventory_batches SET stock_remaining = stock_remaining + ?, status = 'active' WHERE id = ?")
                            ->execute([$restockQty, $restoreBatch['id']]);

                        $logMsg = ucfirst($itemType) . " Returned (Restocked: {$restockQty})";
                        if ($settlementAction === 'replaced') {
                            $logMsg .= " — Replacement unit accepted for {$conditionStatus} equipment";
                        }
                        $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'restock', ?, ?, ?, ?)")
                            ->execute([$restoreBatch['id'], $restockQty, $logMsg, $profileId, $userId]);
                    }
                } elseif ($itemType === 'equipment' && in_array($conditionStatus, ['damaged', 'lost'])) {
                    // Not restocked to usable inventory. Log damage or loss
                    $bStmt = $pdo->prepare("SELECT id FROM inventory_batches WHERE item_id = ? ORDER BY id DESC LIMIT 1");
                    $bStmt->execute([$inventoryId]);
                    $anyBatch = $bStmt->fetch(PDO::FETCH_ASSOC);
                    $bId = $anyBatch ? $anyBatch['id'] : null;

                    if ($bId) {
                        $actionLabel = strtoupper($conditionStatus);
                        $settleDesc = match($settlementAction) {
                            'to_replace' => 'To Replace (Ilisan)',
                            'to_pay'     => 'To Pay (Bayaran)',
                            'paid'       => 'Paid / Reimbursed on the Spot',
                            default      => $settlementAction
                        };
                        $auditDesc = "Equipment {$actionLabel} from Borrowing. Settlement: {$settleDesc}. Notes: " . ($settlementNotes ?: ($itemNotes ?: 'None'));
                        if ($chargeAmount > 0) {
                            $auditDesc .= " (Amount: ₱" . number_format($chargeAmount, 2) . ")";
                        }
                        $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'dispose', 0, ?, ?, ?)")
                            ->execute([$bId, $auditDesc, $profileId, $userId]);
                    }
                }

                // Record reconciliation entry
                $pdo->prepare("
                    INSERT INTO borrowed_item_returns 
                    (borrowed_item_id, quantity_returned, quantity_consumed, notes, condition_status, settlement_action, settlement_notes, charge_amount, processed_by) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    $biId, $qtyReturned, $qtyConsumed, $itemNotes, 
                    $conditionStatus, $settlementAction, $settlementNotes, $chargeAmount, $userId
                ]);

                // Update borrowed_items status and condition/settlement tracking
                $isSettledOnSpot = in_array($settlementAction, ['none', 'replaced', 'paid']);
                $pdo->prepare("
                    UPDATE borrowed_items 
                    SET status = 'returned',
                        condition_status = ?,
                        settlement_action = ?,
                        settlement_notes = ?,
                        charge_amount = ?,
                        settled_at = IF(?, CURRENT_TIMESTAMP, NULL),
                        settled_by = IF(?, ?, NULL)
                    WHERE id = ?
                ")->execute([
                    $conditionStatus,
                    $settlementAction,
                    $settlementNotes,
                    $chargeAmount,
                    $isSettledOnSpot ? 1 : 0,
                    $isSettledOnSpot ? 1 : 0,
                    $userId,
                    $biId
                ]);
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
     * Resolve pending settlement (e.g. mark item as replaced or paid).
     * Accepts: { borrowed_item_id, settlement_action: 'replaced'|'paid', settlement_notes, charge_amount, restock_now: boolean }
     */
    public function updateSettlement() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();

        $input            = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $biId             = $input['borrowed_item_id'] ?? null;
        $settlementAction = $input['settlement_action'] ?? null;
        $settlementNotes  = trim($input['settlement_notes'] ?? '');
        $chargeAmount     = isset($input['charge_amount']) ? (float)$input['charge_amount'] : null;
        $restockNow       = !empty($input['restock_now']);
        $branch           = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        $userId           = $_SESSION['cjc_user']['id'] ?? null;

        if (!$biId || !in_array($settlementAction, ['replaced', 'paid', 'to_replace', 'to_pay'])) {
            $this->jsonResponse(['success' => false, 'error' => 'Invalid parameters'], 400);
        }

        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();

            $biStmt = $pdo->prepare("
                SELECT bi.*, b.profile_id, b.clinic_branch AS borrowing_branch, i.id AS inventory_item_id, i.generic_name, i.brand_name
                FROM borrowed_items bi
                JOIN borrowings b ON bi.borrowing_id = b.id
                JOIN inventory_items i ON bi.inventory_item_id = i.id
                WHERE bi.id = ?
            ");
            $biStmt->execute([$biId]);
            $bi = $biStmt->fetch(PDO::FETCH_ASSOC);

            if (!$bi) {
                throw new Exception("Borrowed item record not found.");
            }

            $effectiveBranch = !empty($bi['borrowing_branch']) ? $bi['borrowing_branch'] : $branch;
            $inventoryId     = $bi['inventory_item_id'];
            $profileId       = $bi['profile_id'];

            // If replacement is confirmed and should be restocked into inventory
            if ($settlementAction === 'replaced' && $restockNow) {
                $batchStmt = $pdo->prepare("
                    SELECT id FROM inventory_batches
                    WHERE item_id = ? AND clinic_branch = ?
                    ORDER BY status = 'active' DESC, date_arrived DESC, id DESC LIMIT 1
                ");
                $batchStmt->execute([$inventoryId, $effectiveBranch]);
                $batch = $batchStmt->fetch(PDO::FETCH_ASSOC);

                if (!$batch) {
                    $createBatch = $pdo->prepare("INSERT INTO inventory_batches (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, status) VALUES (?, ?, ?, 0, CURDATE(), 'active')");
                    $createBatch->execute([$inventoryId, $effectiveBranch, 'REP-' . date('Ymd')]);
                    $batch = ['id' => $pdo->lastInsertId()];
                }

                $qtyToAdd = max(1, (int)$bi['quantity']);
                $pdo->prepare("UPDATE inventory_batches SET stock_remaining = stock_remaining + ?, status = 'active' WHERE id = ?")
                    ->execute([$qtyToAdd, $batch['id']]);

                $logMsg = "Replacement Restock: {$qtyToAdd} unit(s) accepted for settled equipment ({$settlementNotes})";
                $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'restock', ?, ?, ?, ?)")
                    ->execute([$batch['id'], $qtyToAdd, $logMsg, $profileId, $userId]);
            }

            // Update borrowed_items
            $pdo->prepare("
                UPDATE borrowed_items
                SET settlement_action = ?,
                    settlement_notes = COALESCE(NULLIF(?, ''), settlement_notes),
                    charge_amount = COALESCE(?, charge_amount),
                    settled_at = IF(? IN ('replaced', 'paid'), CURRENT_TIMESTAMP, NULL),
                    settled_by = IF(? IN ('replaced', 'paid'), ?, NULL)
                WHERE id = ?
            ")->execute([
                $settlementAction,
                $settlementNotes,
                $chargeAmount,
                $settlementAction,
                $settlementAction,
                $userId,
                $biId
            ]);

            // Also update borrowed_item_returns if exists
            $pdo->prepare("
                UPDATE borrowed_item_returns
                SET settlement_action = ?,
                    settlement_notes = COALESCE(NULLIF(?, ''), settlement_notes),
                    charge_amount = COALESCE(?, charge_amount)
                WHERE borrowed_item_id = ?
                ORDER BY id DESC LIMIT 1
            ")->execute([
                $settlementAction,
                $settlementNotes,
                $chargeAmount,
                $biId
            ]);

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => 'Settlement updated successfully.']);
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
        $branchFilter = $this->getBranchFilter();

        $stmt = $pdo->query("
            SELECT b.id AS borrowing_id, b.booking_code, b.purpose, b.created_at, b.status AS borrowing_status,
                   b.expected_return_date, b.returned_at, b.clinic_branch,
                   p.first_name, p.last_name, p.course, p.year_level, p.profile_type, p.college_dept AS department,
                   COALESCE(u_rel.name, u_rel.username) AS released_by_name,
                   COALESCE(u_ret.name, u_ret.username) AS returned_to_name,
                   bi.id AS borrowed_item_id, bi.item_type, bi.status AS item_status, bi.quantity,
                   bi.condition_status, bi.settlement_action, bi.settlement_notes, bi.charge_amount, bi.settled_at,
                   i.generic_name, i.brand_name, i.category,
                   bir.quantity_returned, bir.quantity_consumed, bir.notes AS return_notes,
                   bir.condition_status AS return_condition_status,
                   bir.settlement_action AS return_settlement_action,
                   bir.settlement_notes AS return_settlement_notes,
                   bir.charge_amount AS return_charge_amount,
                   bir.returned_at AS item_returned_at
            FROM borrowings b
            JOIN profiles p ON b.profile_id = p.id
            JOIN borrowed_items bi ON bi.borrowing_id = b.id
            JOIN inventory_items i ON bi.inventory_item_id = i.id
            LEFT JOIN users u_rel ON b.released_by = u_rel.id
            LEFT JOIN borrowed_item_returns bir ON bir.borrowed_item_id = bi.id
            LEFT JOIN users u_ret ON bir.processed_by = u_ret.id
            WHERE 1=1 {$branchFilter}
            ORDER BY b.created_at DESC
            LIMIT 200
        ");

        $history = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $bId = $row['borrowing_id'];
            if (!isset($history[$bId])) {
                $history[$bId] = [
                    'id'                   => $bId,
                    'borrowing_id'         => $bId,
                    'booking_code'         => $row['booking_code'] ?: ('EQ-' . date('Y') . '-' . str_pad($bId, 5, '0', STR_PAD_LEFT)),
                    'purpose'              => $row['purpose'],
                    'clinic_branch'        => $row['clinic_branch'],
                    'created_at'           => $row['created_at'],
                    'borrowing_status'     => $row['borrowing_status'],
                    'expected_return_date' => $row['expected_return_date'],
                    'returned_at'          => $row['returned_at'],
                    'first_name'           => $row['first_name'],
                    'last_name'            => $row['last_name'],
                    'profile_type'         => $row['profile_type'],
                    'course'               => $row['course'],
                    'year_level'           => $row['year_level'],
                    'department'           => $row['department'],
                    'released_by_name'     => $row['released_by_name'],
                    'returned_to_name'     => $row['returned_to_name'],
                    'items'                => []
                ];
            }
            $history[$bId]['items'][] = [
                'borrowed_item_id'   => $row['borrowed_item_id'],
                'generic_name'       => $row['generic_name'],
                'brand_name'         => $row['brand_name'],
                'category'           => $row['category'],
                'quantity'           => (int)$row['quantity'],
                'item_type'          => $row['item_type'],
                'status'             => $row['item_status'],
                'condition_status'   => $row['return_condition_status'] ?: ($row['condition_status'] ?? 'good'),
                'settlement_action'  => $row['return_settlement_action'] ?: ($row['settlement_action'] ?? 'none'),
                'settlement_notes'   => $row['return_settlement_notes'] ?: $row['settlement_notes'],
                'charge_amount'      => (float)($row['return_charge_amount'] !== null ? $row['return_charge_amount'] : ($row['charge_amount'] ?? 0)),
                'settled_at'         => $row['settled_at'],
                'quantity_returned'  => $row['quantity_returned'] !== null ? (int)$row['quantity_returned'] : null,
                'quantity_consumed'  => $row['quantity_consumed'] !== null ? (int)$row['quantity_consumed'] : null,
                'item_returned_at'   => $row['item_returned_at']
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
}
