<?php
require_once __DIR__ . '/BaseController.php';

class InventoryController extends BaseController {
    
    /**
     * Disallow Superadmin from performing write transactions in Inventory.
     * Superadmin is restricted to viewing stocks and generating reports.
     */
    private function forbidSuperAdminTransactions(): void {
        if ($this->isSuperAdmin()) {
            $this->jsonResponse([
                'success' => false,
                'error' => 'Superadmin has view and reporting permissions only. Inventory transactions (dispensing, restocking, transfers, disposal) are restricted to Clinic staff.'
            ], 403);
        }
    }

    // --- CATALOG ITEMS ---
    public function getItems() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $branch = $this->isSuperAdmin() ? ($_GET['branch'] ?? 'all') : $this->getUserBranch();
        
        if ($branch === 'all' || $branch === 'All Branches') {
            $stmt = $pdo->prepare("
                SELECT i.*, 
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as remaining_stock,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as total_stock,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.main_stock ELSE 0 END), 0) as main_stock,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.drawer_stock ELSE 0 END), 0) as drawer_stock,
                       GREATEST(
                         COALESCE(SUM(b.stock_remaining), 0),
                         COALESCE(
                           (SELECT SUM(l.quantity_changed) 
                            FROM inventory_logs l 
                            JOIN inventory_batches b2 ON l.batch_id = b2.id 
                            WHERE b2.item_id = i.id AND l.action_type = 'restock'), 0
                         )
                       ) as overall_stock,
                       (SELECT file_url FROM equipment_calibrations WHERE item_id = i.id AND file_url IS NOT NULL ORDER BY id DESC LIMIT 1) as latest_cert_url,
                       (SELECT filename FROM equipment_calibrations WHERE item_id = i.id AND file_url IS NOT NULL ORDER BY id DESC LIMIT 1) as latest_cert_filename,
                       (SELECT cert_type FROM equipment_calibrations WHERE item_id = i.id ORDER BY id DESC LIMIT 1) as latest_cert_type,
                       (SELECT calibrated_by FROM equipment_calibrations WHERE item_id = i.id ORDER BY id DESC LIMIT 1) as latest_calibrated_by,
                       (SELECT COUNT(*) FROM equipment_calibrations WHERE item_id = i.id) as cert_count
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id
                GROUP BY i.id 
                ORDER BY i.generic_name ASC
            ");
            $stmt->execute();
        } else {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $stmt = $pdo->prepare("
                SELECT i.*, 
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as remaining_stock,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as total_stock,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.main_stock ELSE 0 END), 0) as main_stock,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.drawer_stock ELSE 0 END), 0) as drawer_stock,
                       GREATEST(
                         COALESCE(SUM(b.stock_remaining), 0),
                         COALESCE(
                           (SELECT SUM(l.quantity_changed) 
                            FROM inventory_logs l 
                            JOIN inventory_batches b2 ON l.batch_id = b2.id 
                            WHERE b2.item_id = i.id AND l.action_type = 'restock' AND (b2.clinic_branch = ? OR b2.clinic_branch = ?)), 0
                         )
                       ) as overall_stock,
                       (SELECT file_url FROM equipment_calibrations WHERE item_id = i.id AND file_url IS NOT NULL ORDER BY id DESC LIMIT 1) as latest_cert_url,
                       (SELECT filename FROM equipment_calibrations WHERE item_id = i.id AND file_url IS NOT NULL ORDER BY id DESC LIMIT 1) as latest_cert_filename,
                       (SELECT cert_type FROM equipment_calibrations WHERE item_id = i.id ORDER BY id DESC LIMIT 1) as latest_cert_type,
                       (SELECT calibrated_by FROM equipment_calibrations WHERE item_id = i.id ORDER BY id DESC LIMIT 1) as latest_calibrated_by,
                       (SELECT COUNT(*) FROM equipment_calibrations WHERE item_id = i.id) as cert_count
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id AND (b.clinic_branch = ? OR b.clinic_branch = ?)
                GROUP BY i.id 
                ORDER BY i.generic_name ASC
            ");
            $stmt->execute([$branch, $branchAlt, $branch, $branchAlt]);
        }

        $items = $stmt->fetchAll();
        $this->jsonResponse(['items' => $items]);
    }

    public function addItem() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Staff']);
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        if (empty(trim($input['generic_name'] ?? ''))) {
            $this->jsonResponse(['success' => false, 'error' => 'Generic name is required.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("INSERT INTO inventory_items (category, brand_name, generic_name, dosage, formulation, serial_no, model_no, supplier, unit, alert_threshold, date_acquired, date_purchased, last_calibrated, calibration_due, calibration_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['category'] ?? 'medicine',
            $input['brand_name'] ?? null,
            $input['generic_name'] ?? '',
            $input['dosage'] ?? null,
            $input['formulation'] ?? null,
            $input['serial_no'] ?? null,
            $input['model_no'] ?? null,
            $input['supplier'] ?? null,
            $input['unit'] ?? null,
            $input['alert_threshold'] ?? 20,
            !empty($input['date_acquired']) ? $input['date_acquired'] : null,
            !empty($input['date_purchased']) ? $input['date_purchased'] : null,
            !empty($input['last_calibrated']) ? $input['last_calibrated'] : null,
            !empty($input['calibration_due']) ? $input['calibration_due'] : null,
            $input['calibration_notes'] ?? null
        ]);
        $this->jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
    }

    public function updateItem() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Staff']);
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) $this->jsonResponse(['success' => false, 'error' => 'Invalid item ID'], 400);

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            UPDATE inventory_items 
            SET category = ?, brand_name = ?, generic_name = ?, dosage = ?, formulation = ?,
                serial_no = ?, model_no = ?, supplier = ?, unit = ?,
                alert_threshold = ?, date_acquired = ?, date_purchased = ?,
                last_calibrated = ?, calibration_due = ?, calibration_notes = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $input['category'] ?? 'medicine',
            $input['brand_name'] ?? null,
            $input['generic_name'] ?? '',
            $input['dosage'] ?? null,
            $input['formulation'] ?? null,
            $input['serial_no'] ?? null,
            $input['model_no'] ?? null,
            $input['supplier'] ?? null,
            $input['unit'] ?? null,
            $input['alert_threshold'] ?? 20,
            !empty($input['date_acquired']) ? $input['date_acquired'] : null,
            !empty($input['date_purchased']) ? $input['date_purchased'] : null,
            !empty($input['last_calibrated']) ? $input['last_calibrated'] : null,
            !empty($input['calibration_due']) ? $input['calibration_due'] : null,
            $input['calibration_notes'] ?? null,
            $id
        ]);
        $this->jsonResponse(['success' => true]);
    }

    public function returnMedicine() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $itemId = (int)($input['item_id'] ?? 0);
        $returnQty = (int)($input['quantity'] ?? 1);
        $profileId = !empty($input['profile_id']) ? (int)$input['profile_id'] : null;
        $patientName = trim($input['patient_name'] ?? 'Patient');
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : ($input['clinic_branch'] ?? $this->getUserBranch());

        if ($itemId <= 0 || $returnQty <= 0) {
            $this->jsonResponse(['success' => false, 'error' => 'Invalid item or return quantity'], 400);
        }

        $pdo = cjcDatabaseConnection();

        try {
            $pdo->beginTransaction();

            // Find an active batch for this item and branch
            $batchStmt = $pdo->prepare("SELECT id, stock_remaining FROM inventory_batches WHERE item_id = ? AND clinic_branch = ? AND status = 'active' ORDER BY id ASC LIMIT 1");
            $batchStmt->execute([$itemId, $branch]);
            $batch = $batchStmt->fetch(PDO::FETCH_ASSOC);

            if (!$batch) {
                // Create a new active batch for returns
                $createBatch = $pdo->prepare("INSERT INTO inventory_batches (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, status) VALUES (?, ?, ?, ?, CURDATE(), 'active')");
                $createBatch->execute([$itemId, $branch, 'RET-' . date('Ymd'), $returnQty]);
                $batchId = $pdo->lastInsertId();
            } else {
                $batchId = $batch['id'];
                // Increase stock
                $updateStock = $pdo->prepare("UPDATE inventory_batches SET stock_remaining = stock_remaining + ? WHERE id = ?");
                $updateStock->execute([$returnQty, $batchId]);
            }

            // Log return action
            $currentUser = cjcCurrentUser();
            $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'restock', ?, ?, ?, ?)");
            $logStmt->execute([
                $batchId,
                $returnQty,
                'Returned by ' . $patientName,
                $profileId,
                $currentUser['id'] ?? null
            ]);

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => 'Medicine returned successfully and inventory stock updated.']);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Return Medicine Error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'error' => 'Database error'], 500);
        }
    }

    // --- BATCHES ---
    public function getBatches() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        
        $branch = $this->isSuperAdmin() ? ($_GET['branch'] ?? 'all') : $this->getUserBranch();
        $includeAll = isset($_GET['include_all']) ? (int)$_GET['include_all'] : 1;

        $params = [];
        $whereClauses = [];
        
        if ($includeAll !== 1) {
            $whereClauses[] = "b.stock_remaining > 0";
        }
        
        if ($branch !== 'all' && $branch !== 'All Branches') {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $whereClauses[] = "(b.clinic_branch = :branch OR b.clinic_branch = :branchAlt)";
            $params['branch'] = $branch;
            $params['branchAlt'] = $branchAlt;
        }

        $whereSql = count($whereClauses) > 0 ? "WHERE " . implode(" AND ", $whereClauses) : "";

        $stmt = $pdo->prepare("
            SELECT b.*, i.generic_name, i.brand_name, i.category, i.dosage, i.formulation,
                   COALESCE(b.lot_number, b.batch_number) as lot_number,
                   DATEDIFF(b.expired_on, CURDATE()) as days_until_expiration,
                   COALESCE((SELECT SUM(ABS(l.quantity_changed)) FROM inventory_logs l WHERE l.batch_id = b.id AND l.action_type = 'dispense'), 0) as dispensed_qty,
                   COALESCE((SELECT SUM(ABS(l.quantity_changed)) FROM inventory_logs l WHERE l.batch_id = b.id AND l.action_type = 'dispose'), 0) as disposed_qty,
                   COALESCE((SELECT SUM(l.quantity_changed) FROM inventory_logs l WHERE l.batch_id = b.id AND l.action_type = 'restock'), b.stock_remaining) as initial_restock
            FROM inventory_batches b
            JOIN inventory_items i ON b.item_id = i.id
            $whereSql
            ORDER BY FIELD(b.status, 'active', 'expired', 'depleted'), b.expired_on ASC, b.date_arrived ASC
        ");
        $stmt->execute($params);
        $rawBatches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $batches = array_map(function($batch) {
            $dispensed = (int)$batch['dispensed_qty'];
            $disposed = (int)$batch['disposed_qty'];
            $rem = (int)$batch['stock_remaining'];
            $restock = (int)$batch['initial_restock'];
            $initialStock = max($restock, $rem + $dispensed + $disposed);
            
            $batch['dispensed_qty'] = $dispensed;
            $batch['disposed_qty'] = $disposed;
            $batch['initial_stock'] = $initialStock;
            return $batch;
        }, $rawBatches);

        $this->jsonResponse(['batches' => $batches]);
    }

    public function getBatchDetails() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $batchId = (int)($_GET['batch_id'] ?? $_GET['id'] ?? 0);
        if ($batchId <= 0) {
            $this->jsonResponse(['success' => false, 'error' => 'Invalid batch ID'], 400);
        }

        $stmt = $pdo->prepare("
            SELECT b.*, i.generic_name, i.brand_name, i.category, i.dosage, i.formulation, i.alert_threshold
            FROM inventory_batches b
            JOIN inventory_items i ON b.item_id = i.id
            WHERE b.id = ?
        ");
        $stmt->execute([$batchId]);
        $batch = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$batch) {
            $this->jsonResponse(['success' => false, 'error' => 'Batch not found'], 404);
        }

        $logStmt = $pdo->prepare("
            SELECT l.*, u.name as processor_name, CONCAT(p.first_name, ' ', p.last_name) as patient_name
            FROM inventory_logs l
            LEFT JOIN users u ON l.processed_by = u.id
            LEFT JOIN profiles p ON l.profile_id = p.id
            WHERE l.batch_id = ?
            ORDER BY l.created_at DESC
        ");
        $logStmt->execute([$batchId]);
        $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);

        $dispensedQty = 0;
        $disposedQty = 0;
        $restockQty = 0;

        foreach ($logs as $l) {
            $qty = abs((int)$l['quantity_changed']);
            if ($l['action_type'] === 'dispense') {
                $dispensedQty += $qty;
            } elseif ($l['action_type'] === 'dispose') {
                $disposedQty += $qty;
            } elseif ($l['action_type'] === 'restock') {
                $restockQty += (int)$l['quantity_changed'];
            }
        }

        $initialStock = max($restockQty, (int)$batch['stock_remaining'] + $dispensedQty + $disposedQty);

        $this->jsonResponse([
            'success' => true,
            'batch' => $batch,
            'summary' => [
                'initial_stock' => $initialStock,
                'dispensed_qty' => $dispensedQty,
                'disposed_qty' => $disposedQty,
                'remaining_stock' => (int)$batch['stock_remaining']
            ],
            'logs' => $logs
        ]);
    }

    public function disposeBatch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $batchId = (int)($input['batch_id'] ?? 0);
        $disposeQty = (int)($input['quantity'] ?? 0);
        $reason = trim($input['reason'] ?? 'Expired / Unconsumed Disposal');
        $disposedTo = trim($input['disposed_to'] ?? $reason);
        $location = trim($input['location'] ?? 'main');

        if ($batchId <= 0 || $disposeQty <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid parameters for disposal.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("SELECT * FROM inventory_batches WHERE id = ?");
            $stmt->execute([$batchId]);
            $batch = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$batch) {
                throw new Exception("Batch not found.");
            }

            if (!$this->isSuperAdmin() && $batch['clinic_branch'] !== $this->getUserBranch()) {
                throw new Exception("You do not have permission to dispose stock for other clinic branches.");
            }

            $currentStock = (int)$batch['stock_remaining'];
            $currentMain = (int)$batch['main_stock'];
            $currentDrawer = (int)$batch['drawer_stock'];

            if ($location === 'drawer') {
                if ($disposeQty > $currentDrawer) {
                    throw new Exception("Cannot dispose {$disposeQty} units from Drawer. Available drawer stock is {$currentDrawer}.");
                }
                $newDrawer = $currentDrawer - $disposeQty;
                $newMain = $currentMain;
            } else {
                if ($disposeQty > $currentMain) {
                    throw new Exception("Cannot dispose {$disposeQty} units from Main Stock. Available main stock is {$currentMain}.");
                }
                $newMain = $currentMain - $disposeQty;
                $newDrawer = $currentDrawer;
            }

            $newStock = $newMain + $newDrawer;
            $newStatus = ($newStock === 0) ? 'depleted' : $batch['status'];

            $upd = $pdo->prepare("UPDATE inventory_batches SET main_stock = ?, drawer_stock = ?, stock_remaining = ?, status = ? WHERE id = ?");
            $upd->execute([$newMain, $newDrawer, $newStock, $newStatus, $batchId]);

            $logStmt = $pdo->prepare("
                INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, source_location, disposed_to, processed_by) 
                VALUES (?, 'dispose', ?, ?, ?, ?)
            ");
            $logStmt->execute([$batchId, -$disposeQty, $location, $disposedTo, $_SESSION['cjc_user']['id']]);

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => "Successfully disposed {$disposeQty} unit(s) from {$location} stock."]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function addBatch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $pdo = cjcDatabaseConnection();
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : (!empty($input['clinic_branch']) ? $input['clinic_branch'] : $this->getUserBranch());
        
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO inventory_batches 
                (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, expired_on, last_calibrated, calibration_due, calibration_notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $input['item_id'],
                $branch,
                $input['batch_number'] ?? null,
                $input['stock_remaining'],
                $input['date_arrived'] ?? date('Y-m-d'),
                $input['expired_on'] ?? null,
                !empty($input['last_calibrated']) ? $input['last_calibrated'] : null,
                !empty($input['calibration_due']) ? $input['calibration_due'] : null,
                $input['calibration_notes'] ?? null
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
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $itemId = (int)($input['item_id'] ?? 0);
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : (trim($input['clinic_branch'] ?? '') ?: $this->getUserBranch());
        $quantity = (int)($input['quantity'] ?? 0);
        $disposedTo = trim($input['disposed_to'] ?? '');
        
        if (!$itemId || !$branch || $quantity <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid parameters.'], 400);
        }
        
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        try {
            $pdo->beginTransaction();
            $remainingToDispense = $quantity;

            // Pass 1: Deduct from Drawer Inventory first (FEFO: earliest expiration, unexpired only)
            $dStmt = $pdo->prepare("
                SELECT id, stock_remaining, COALESCE(drawer_stock, 0) as drawer_stock, COALESCE(main_stock, 0) as main_stock 
                FROM inventory_batches 
                WHERE item_id = :item_id AND clinic_branch = :branch AND drawer_stock > 0 
                  AND (expired_on >= CURDATE() OR expired_on IS NULL)
                ORDER BY expired_on ASC, date_arrived ASC
            ");
            $dStmt->execute(['item_id' => $itemId, 'branch' => $branch]);
            $drawerBatches = $dStmt->fetchAll();

            foreach ($drawerBatches as $batch) {
                if ($remainingToDispense <= 0) break;
                
                $curDrawer = (int)$batch['drawer_stock'];
                $curMain = (int)$batch['main_stock'];
                $consumed = min($curDrawer, $remainingToDispense);
                
                $newDrawer = $curDrawer - $consumed;
                $newStock = $newDrawer + $curMain;
                
                $uStmt = $pdo->prepare("UPDATE inventory_batches SET drawer_stock = :dstock, stock_remaining = :stock, status = IF(:stock2=0, 'depleted', 'active') WHERE id = :id");
                $uStmt->execute(['dstock' => $newDrawer, 'stock' => $newStock, 'stock2' => $newStock, 'id' => $batch['id']]);
                
                $lStmt = $pdo->prepare("
                    INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, source_location, disposed_to, profile_id, processed_by) 
                    VALUES (?, 'dispense', ?, 'drawer', ?, NULL, ?)
                ");
                $lStmt->execute([$batch['id'], -$consumed, $disposedTo, $_SESSION['cjc_user']['id']]);
                
                $remainingToDispense -= $consumed;
            }

            // Pass 2: Overflow to Main Stockroom (FEFO) if drawer depleted / not enough
            if ($remainingToDispense > 0) {
                $mStmt = $pdo->prepare("
                    SELECT id, stock_remaining, COALESCE(drawer_stock, 0) as drawer_stock, COALESCE(main_stock, 0) as main_stock 
                    FROM inventory_batches 
                    WHERE item_id = :item_id AND clinic_branch = :branch AND main_stock > 0 
                      AND (expired_on >= CURDATE() OR expired_on IS NULL)
                    ORDER BY expired_on ASC, date_arrived ASC
                ");
                $mStmt->execute(['item_id' => $itemId, 'branch' => $branch]);
                $mainBatches = $mStmt->fetchAll();

                foreach ($mainBatches as $batch) {
                    if ($remainingToDispense <= 0) break;

                    $curDrawer = (int)$batch['drawer_stock'];
                    $curMain = (int)$batch['main_stock'];
                    $consumed = min($curMain, $remainingToDispense);

                    $newMain = $curMain - $consumed;
                    $newStock = $curDrawer + $newMain;

                    $uStmt = $pdo->prepare("UPDATE inventory_batches SET main_stock = :mstock, stock_remaining = :stock, status = IF(:stock2=0, 'depleted', 'active') WHERE id = :id");
                    $uStmt->execute(['mstock' => $newMain, 'stock' => $newStock, 'stock2' => $newStock, 'id' => $batch['id']]);

                    $lStmt = $pdo->prepare("
                        INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, source_location, disposed_to, profile_id, processed_by) 
                        VALUES (?, 'dispense', ?, 'main', ?, NULL, ?)
                    ");
                    $lStmt->execute([$batch['id'], -$consumed, $disposedTo . ' (Main Stock Overflow - Drawer Depleted)', $_SESSION['cjc_user']['id']]);

                    $remainingToDispense -= $consumed;
                }
            }
            
            if ($remainingToDispense > 0) {
                $pdo->rollBack();
                $this->jsonResponse(['success' => false, 'message' => "Insufficient unexpired stock in $branch. Short by $remainingToDispense units."], 400);
            }
            
            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => "Successfully dispensed {$quantity} units using Drawer-first FEFO logic."]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function getLowStock() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : ($_GET['branch'] ?? $this->getUserBranch());
        $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
        $stmt = $pdo->prepare("
            SELECT i.id, i.category, i.generic_name, i.brand_name, i.dosage, i.formulation, IFNULL(SUM(b.stock_remaining), 0) as total_stock, i.alert_threshold
            FROM inventory_items i
            LEFT JOIN inventory_batches b ON i.id = b.item_id AND (b.clinic_branch = :branch OR b.clinic_branch = :branchAlt)
            GROUP BY i.id
            HAVING total_stock <= i.alert_threshold
        ");
        $stmt->execute(['branch' => $branch, 'branchAlt' => $branchAlt]);
        $this->jsonResponse(['low_stock' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    public function getPurchases() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        if (!$this->isSuperAdmin()) {
            $branch = $this->getUserBranch();
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $stmt = $pdo->prepare("SELECT * FROM purchase_requests WHERE (clinic_branch = ? OR clinic_branch = ?) ORDER BY requested_date DESC");
            $stmt->execute([$branch, $branchAlt]);
        } else {
            $branch = $_GET['branch'] ?? 'all';
            if ($branch !== 'all' && $branch !== 'All Branches') {
                $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
                $stmt = $pdo->prepare("SELECT * FROM purchase_requests WHERE (clinic_branch = ? OR clinic_branch = ?) ORDER BY requested_date DESC");
                $stmt->execute([$branch, $branchAlt]);
            } else {
                $stmt = $pdo->query("SELECT * FROM purchase_requests ORDER BY requested_date DESC");
            }
        }
        $this->jsonResponse(['purchases' => $stmt->fetchAll()]);
    }

    public function addPurchase() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : (!empty($input['clinic_branch']) ? $input['clinic_branch'] : $this->getUserBranch());
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
            $branch,
            $input['supplier'] ?? null,
            $input['quantity_ordered'] ?? 1,
            $input['expected_delivery_date'] ?? null
        ]);
        $this->jsonResponse(['success' => true]);
    }

    public function updatePurchase() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        $this->forbidSuperAdminTransactions();
        
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
        $branchFilter = "";
        $params = [];
        if (!$this->isSuperAdmin()) {
            $branch = $this->getUserBranch();
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $branchFilter = " WHERE (b.clinic_branch = ? OR b.clinic_branch = ?) ";
            $params[] = $branch;
            $params[] = $branchAlt;
        } else if (!empty($_GET['branch']) && $_GET['branch'] !== 'all' && $_GET['branch'] !== 'All Branches') {
            $branch = $_GET['branch'];
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $branchFilter = " WHERE (b.clinic_branch = ? OR b.clinic_branch = ?) ";
            $params[] = $branch;
            $params[] = $branchAlt;
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
        $this->forbidSuperAdminTransactions();
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
            $upd = $pdo->prepare("
                UPDATE inventory_batches 
                SET batch_number = ?, date_arrived = ?, expired_on = ?, stock_remaining = ?, 
                    last_calibrated = ?, calibration_due = ?, calibration_notes = ?,
                    status = IF(?=0, 'depleted', 'active') 
                WHERE id = ?
            ");
            $upd->execute([
                $input['batch_number'], 
                $input['date_arrived'], 
                $input['expired_on'] ?: null, 
                $newStock, 
                !empty($input['last_calibrated']) ? $input['last_calibrated'] : null,
                !empty($input['calibration_due']) ? $input['calibration_due'] : null,
                $input['calibration_notes'] ?? null,
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

    // --- PREDICTIVE INVENTORY ALERTS (AI / PYTHON) ---
    public function predictive_alerts() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branch = $this->getUserBranch();
        if ($userRole === 'Superadmin') {
            $branch = $_GET['branch'] ?? 'All Branches';
        }

        $itemsData = [];

        $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);

        // 1. Get current stock for all items in this branch
        if ($branch !== 'All Branches') {
            $stockStmt = $pdo->prepare("
                SELECT i.id as item_id, i.generic_name as name, 
                       COALESCE(SUM(CASE WHEN (b.clinic_branch = ? OR b.clinic_branch = ?) AND b.status = 'active' THEN b.stock_remaining ELSE 0 END), 0) as current_stock
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id AND (b.clinic_branch = ? OR b.clinic_branch = ?)
                GROUP BY i.id
            ");
            $stockStmt->execute([$branch, $branchAlt, $branch, $branchAlt]);
        } else {
            $stockStmt = $pdo->query("
                SELECT i.id as item_id, i.generic_name as name, 
                       COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.stock_remaining ELSE 0 END), 0) as current_stock
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id
                GROUP BY i.id
            ");
        }

        while ($row = $stockStmt->fetch(PDO::FETCH_ASSOC)) {
            $itemsData[$row['item_id']] = [
                'item_id' => (int)$row['item_id'],
                'name' => $row['name'],
                'current_stock' => (int)$row['current_stock'],
                'daily_history' => []
            ];
        }

        // 2. Get daily dispensing history for the last 30 days for this branch
        if ($branch !== 'All Branches') {
            $historyStmt = $pdo->prepare("
                SELECT b.item_id, DATE(l.created_at) as date, SUM(ABS(l.quantity_changed)) as dispensed
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                WHERE l.action_type = 'dispense' 
                  AND (b.clinic_branch = ? OR b.clinic_branch = ?)
                  AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY b.item_id, DATE(l.created_at)
                ORDER BY DATE(l.created_at) ASC
            ");
            $historyStmt->execute([$branch, $branchAlt]);
        } else {
            $historyStmt = $pdo->query("
                SELECT b.item_id, DATE(l.created_at) as date, SUM(ABS(l.quantity_changed)) as dispensed
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                WHERE l.action_type = 'dispense' 
                  AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY b.item_id, DATE(l.created_at)
                ORDER BY DATE(l.created_at) ASC
            ");
        }

        while ($row = $historyStmt->fetch(PDO::FETCH_ASSOC)) {
            $itemId = (int)$row['item_id'];
            if (isset($itemsData[$itemId])) {
                $itemsData[$itemId]['daily_history'][] = [
                    'date' => $row['date'],
                    'dispensed' => (int)$row['dispensed']
                ];
            }
        }

        // 3. Prepare JSON for Python
        $payload = json_encode(['items' => array_values($itemsData)]);

        // 4. Call Python Script
        $scriptPath = realpath(__DIR__ . '/../../scripts/predict_inventory.py');
        if (!$scriptPath) {
            $this->jsonResponse(['error' => 'Predictive script not found.'], 500);
        }

        $cmd = escapeshellcmd("python") . " " . escapeshellarg($scriptPath);
        $process = proc_open($cmd, [
            0 => ["pipe", "r"], // stdin
            1 => ["pipe", "w"], // stdout
            2 => ["pipe", "w"]  // stderr
        ], $pipes);

        if (is_resource($process)) {
            fwrite($pipes[0], $payload);
            fclose($pipes[0]);

            $output = stream_get_contents($pipes[1]);
            fclose($pipes[1]);

            $error = stream_get_contents($pipes[2]);
            fclose($pipes[2]);

            proc_close($process);

            $result = json_decode($output, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($result['predictions'])) {
                $this->jsonResponse(['success' => true, 'predictions' => $result['predictions']]);
            } else {
                $this->jsonResponse(['error' => 'Failed to parse AI predictions', 'details' => $error ?: $output], 500);
            }
        } else {
            $this->jsonResponse(['error' => 'Failed to execute Python AI model'], 500);
        }
    }

    // --- EQUIPMENT CALIBRATION CERTIFICATES ---
    public function getCalibrations() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $itemId = (int)($_GET['item_id'] ?? 0);
        if ($itemId <= 0) $this->jsonResponse(['success' => false, 'error' => 'Invalid item ID'], 400);

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            SELECT c.*, b.batch_number, b.clinic_branch 
            FROM equipment_calibrations c
            LEFT JOIN inventory_batches b ON c.batch_id = b.id
            WHERE c.item_id = ? 
            ORDER BY c.id DESC
        ");
        $stmt->execute([$itemId]);
        $calibrations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->jsonResponse(['success' => true, 'calibrations' => $calibrations]);
    }

    public function uploadCalibration() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();

        $itemId = (int)($_POST['item_id'] ?? 0);
        $batchId = !empty($_POST['batch_id']) ? (int)$_POST['batch_id'] : null;
        $calibratedBy = trim($_POST['calibrated_by'] ?? '');
        $certNumber = trim($_POST['cert_number'] ?? '');
        $calibrationDate = trim($_POST['calibration_date'] ?? date('Y-m-d'));
        $dueDate = !empty($_POST['due_date']) ? trim($_POST['due_date']) : null;
        $notes = trim($_POST['notes'] ?? '');
        $serialNo = trim($_POST['serial_no'] ?? '');

        if ($itemId <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid equipment item ID.'], 400);
        }

        if (!isset($_FILES['cert_file']) || $_FILES['cert_file']['error'] !== UPLOAD_ERR_OK) {
            $this->jsonResponse(['success' => false, 'message' => 'Valid calibration certificate file is required.'], 400);
        }

        $file = $_FILES['cert_file'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
        if (!in_array($ext, $allowedExts)) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid file format. Allowed: PDF, JPG, PNG, DOC.'], 400);
        }

        $uploadDir = realpath(CJC_UPLOAD_DIR);
        if ($uploadDir === false || !is_dir($uploadDir)) {
            @mkdir(CJC_UPLOAD_DIR, 0777, true);
            $uploadDir = realpath(CJC_UPLOAD_DIR);
        }

        $storedFilename = 'calib_' . $itemId . '_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.' . $ext;
        $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $storedFilename;

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            $this->jsonResponse(['success' => false, 'message' => 'Failed to store uploaded file.'], 500);
        }

        $fileUrl = 'api/download.php?file=' . urlencode($storedFilename);
        $currentUser = cjcCurrentUser();

        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO equipment_calibrations 
                (item_id, batch_id, cert_type, calibrated_by, cert_number, serial_no, calibration_date, due_date, file_url, filename, uploaded_by, notes)
                VALUES (?, ?, 'external_upload', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $itemId,
                $batchId,
                $calibratedBy ?: 'External Calibrator',
                $certNumber ?: null,
                $serialNo ?: null,
                $calibrationDate,
                $dueDate,
                $fileUrl,
                $file['name'],
                $currentUser['name'] ?? 'Staff',
                $notes
            ]);
            $calibId = $pdo->lastInsertId();

            if ($batchId) {
                $updBatch = $pdo->prepare("
                    UPDATE inventory_batches 
                    SET last_calibrated = ?, calibration_due = ?, calibration_notes = ?
                    WHERE id = ?
                ");
                $updBatch->execute([$calibrationDate, $dueDate, $notes, $batchId]);
            }

            $updItem = $pdo->prepare("
                UPDATE inventory_items 
                SET last_calibrated = ?, calibration_due = ?, calibration_notes = ?
                WHERE id = ?
            ");
            $updItem->execute([
                $calibrationDate,
                $dueDate,
                $notes ?: ("Uploaded cert: " . ($certNumber ? "#$certNumber" : $file['name'])),
                $itemId
            ]);

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => 'Calibration certificate uploaded successfully.', 'id' => $calibId, 'file_url' => $fileUrl]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function recordCalibration() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $itemId = (int)($input['item_id'] ?? 0);
        $batchId = !empty($input['batch_id']) ? (int)$input['batch_id'] : null;
        $calibratedBy = trim($input['calibrated_by'] ?? '');
        $certNumber = trim($input['cert_number'] ?? '');
        $calibrationDate = trim($input['calibration_date'] ?? date('Y-m-d'));
        $dueDate = !empty($input['due_date']) ? trim($input['due_date']) : null;
        $notes = trim($input['notes'] ?? '');

        if ($itemId <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid equipment item ID.'], 400);
        }

        $currentUser = cjcCurrentUser();
        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO equipment_calibrations 
                (item_id, batch_id, cert_type, calibrated_by, cert_number, calibration_date, due_date, file_url, filename, uploaded_by, notes)
                VALUES (?, ?, 'internal_generated', ?, ?, ?, ?, NULL, NULL, ?, ?)
            ");
            $stmt->execute([
                $itemId,
                $batchId,
                $calibratedBy ?: ($currentUser['name'] ?? 'CJC Clinic Staff'),
                $certNumber ?: ('CAL-' . date('Y') . '-' . str_pad($itemId, 5, '0', STR_PAD_LEFT)),
                $calibrationDate,
                $dueDate,
                $currentUser['name'] ?? 'Staff',
                $notes
            ]);
            $calibId = $pdo->lastInsertId();

            if ($batchId) {
                $updBatch = $pdo->prepare("
                    UPDATE inventory_batches 
                    SET last_calibrated = ?, calibration_due = ?, calibration_notes = ?
                    WHERE id = ?
                ");
                $updBatch->execute([$calibrationDate, $dueDate, $notes, $batchId]);
            }

            $updItem = $pdo->prepare("
                UPDATE inventory_items 
                SET last_calibrated = ?, calibration_due = ?, calibration_notes = ?
                WHERE id = ?
            ");
            $updItem->execute([
                $calibrationDate,
                $dueDate,
                $notes,
                $itemId
            ]);


            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => 'CJC Calibration certificate recorded successfully.', 'id' => $calibId]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function deleteCalibration() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Staff']);
        $this->forbidSuperAdminTransactions();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) $this->jsonResponse(['success' => false, 'message' => 'Invalid calibration ID.'], 400);

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("SELECT * FROM equipment_calibrations WHERE id = ?");
        $stmt->execute([$id]);
        $calib = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$calib) {
            $this->jsonResponse(['success' => false, 'message' => 'Calibration record not found.'], 404);
        }

        if (!empty($calib['file_url'])) {
            parse_str(parse_url($calib['file_url'], PHP_URL_QUERY) ?? '', $query);
            $storedFile = basename($query['file'] ?? '');
            if (!empty($storedFile)) {
                $filePath = realpath(CJC_UPLOAD_DIR . DIRECTORY_SEPARATOR . $storedFile);
                if ($filePath && file_exists($filePath)) {
                    @unlink($filePath);
                }
            }
        }

        $del = $pdo->prepare("DELETE FROM equipment_calibrations WHERE id = ?");
        $del->execute([$id]);

        $this->jsonResponse(['success' => true, 'message' => 'Calibration record deleted successfully.']);
    }

    public function exportEquipment() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : ($_GET['branch'] ?? 'all');
        if ($branch === 'all' || $branch === 'All Branches') {
            $stmt = $pdo->prepare("
                SELECT i.id, i.generic_name, i.brand_name, i.formulation, i.serial_no, i.model_no,
                       i.supplier, i.unit, i.date_acquired, i.date_purchased, i.calibration_notes,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as qty,
                       (SELECT ec.serial_no FROM equipment_calibrations ec WHERE ec.item_id = i.id AND ec.serial_no IS NOT NULL ORDER BY ec.id DESC LIMIT 1) as latest_calib_serial,
                       i.last_calibrated, i.calibration_due
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id
                WHERE i.category = 'equipment'
                GROUP BY i.id
                ORDER BY i.generic_name ASC
            ");
            $stmt->execute();
        } else {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $stmt = $pdo->prepare("
                SELECT i.id, i.generic_name, i.brand_name, i.formulation, i.serial_no, i.model_no,
                       i.supplier, i.unit, i.date_acquired, i.date_purchased, i.calibration_notes,
                       COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as qty,
                       (SELECT ec.serial_no FROM equipment_calibrations ec WHERE ec.item_id = i.id AND ec.serial_no IS NOT NULL ORDER BY ec.id DESC LIMIT 1) as latest_calib_serial,
                       i.last_calibrated, i.calibration_due
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id AND (b.clinic_branch = ? OR b.clinic_branch = ?)
                WHERE i.category = 'equipment'
                GROUP BY i.id
                ORDER BY i.generic_name ASC
            ");
            $stmt->execute([$branch, $branchAlt]);
        }
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->jsonResponse(['success' => true, 'items' => $items]);
    }

    public function exportMedicine() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : ($_GET['branch'] ?? 'all');
        if ($branch === 'all' || $branch === 'All Branches') {
            $stmt = $pdo->prepare("
                SELECT i.id, i.generic_name, i.brand_name, i.dosage, i.formulation,
                       COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.stock_remaining ELSE 0 END), 0) as quantity,
                       MIN(CASE WHEN b.status = 'active' AND b.stock_remaining > 0 THEN b.expired_on ELSE NULL END) as earliest_expiry
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id
                WHERE i.category IN ('medicine', 'supply')
                GROUP BY i.id
                ORDER BY i.generic_name ASC
            ");
            $stmt->execute();
        } else {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $stmt = $pdo->prepare("
                SELECT i.id, i.generic_name, i.brand_name, i.dosage, i.formulation,
                       COALESCE(SUM(CASE WHEN b.status = 'active' THEN b.stock_remaining ELSE 0 END), 0) as quantity,
                       MIN(CASE WHEN b.status = 'active' AND b.stock_remaining > 0 THEN b.expired_on ELSE NULL END) as earliest_expiry
                FROM inventory_items i
                LEFT JOIN inventory_batches b ON i.id = b.item_id AND (b.clinic_branch = ? OR b.clinic_branch = ?)
                WHERE i.category IN ('medicine', 'supply')
                GROUP BY i.id
                ORDER BY i.generic_name ASC
            ");
            $stmt->execute([$branch, $branchAlt]);
        }
        $rawItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $today = new DateTime();
        $threeMonths = (new DateTime())->modify('+3 months');

        $items = array_map(function($item) use ($today, $threeMonths) {
            $remarks = 'Dispense ready';
            if (!empty($item['earliest_expiry'])) {
                $expDate = new DateTime($item['earliest_expiry']);
                if ($expDate <= $threeMonths) {
                    $remarks = 'Dispense ready; Will expire ' . $expDate->format('F d, Y');
                }
            }
            $item['remarks'] = $remarks;
            return $item;
        }, $rawItems);

        $this->jsonResponse(['success' => true, 'items' => $items]);
    }

    public function exportCalibrationRegister() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        if (!$this->isSuperAdmin()) {
            $branch = $this->getUserBranch();
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $stmt = $pdo->prepare("
                SELECT ec.id, ec.calibration_date, ec.created_at,
                       i.generic_name as equipment_name,
                       COALESCE(ec.serial_no, i.serial_no) as serial_no,
                       ec.cert_number, ec.notes, ec.calibrated_by,
                       b.clinic_branch
                FROM equipment_calibrations ec
                JOIN inventory_items i ON ec.item_id = i.id
                LEFT JOIN inventory_batches b ON ec.batch_id = b.id
                WHERE ec.cert_type = 'external_upload' AND (b.clinic_branch = ? OR b.clinic_branch = ? OR b.clinic_branch IS NULL)
                ORDER BY ec.calibration_date DESC, ec.created_at DESC
            ");
            $stmt->execute([$branch, $branchAlt]);
        } else {
            $stmt = $pdo->prepare("
                SELECT ec.id, ec.calibration_date, ec.created_at,
                       i.generic_name as equipment_name,
                       COALESCE(ec.serial_no, i.serial_no) as serial_no,
                       ec.cert_number, ec.notes, ec.calibrated_by,
                       b.clinic_branch
                FROM equipment_calibrations ec
                JOIN inventory_items i ON ec.item_id = i.id
                LEFT JOIN inventory_batches b ON ec.batch_id = b.id
                WHERE ec.cert_type = 'external_upload'
                ORDER BY ec.calibration_date DESC, ec.created_at DESC
            ");
            $stmt->execute();
        }
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->jsonResponse(['success' => true, 'records' => $records]);
    }

    public function getInventoryReport() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        session_write_close();
        $pdo = cjcDatabaseConnection();

        $currentUser = cjcCurrentUser();
        $isSuperAdmin = $this->isSuperAdmin();
        $userBranch = $this->getUserBranch();

        // Enforce user branch strictly for non-superadmins:
        if (!$isSuperAdmin) {
            $branch = $userBranch;
        } else {
            $requestedBranch = trim($_GET['branch'] ?? '');
            if (empty($requestedBranch) || $requestedBranch === 'all' || $requestedBranch === 'All Branches') {
                $branch = 'all';
            } else {
                $branch = $requestedBranch;
            }
        }

        $category = trim($_GET['category'] ?? 'all');
        $status = trim($_GET['status'] ?? 'all');
        $startDate = trim($_GET['start_date'] ?? '');
        $endDate = trim($_GET['end_date'] ?? '');
        $semester = trim($_GET['semester'] ?? 'all');
        $schoolYear = trim($_GET['school_year'] ?? 'all');
        $search = trim($_GET['search'] ?? '');

        // 1. Build Item Query
        $itemWhere = ["1=1"];
        $itemParams = [];

        if ($category !== 'all' && in_array($category, ['medicine', 'supply', 'equipment'])) {
            $itemWhere[] = "i.category = :category";
            $itemParams['category'] = $category;
        }

        if (!empty($search)) {
            $itemWhere[] = "(i.generic_name LIKE :search OR i.brand_name LIKE :search OR i.model_no LIKE :search OR i.serial_no LIKE :search OR i.supplier LIKE :search)";
            $itemParams['search'] = "%$search%";
        }

        $itemWhereSql = implode(' AND ', $itemWhere);

        $itemStmt = $pdo->prepare("
            SELECT i.*,
                   (SELECT ec.serial_no FROM equipment_calibrations ec WHERE ec.item_id = i.id AND ec.serial_no IS NOT NULL AND ec.serial_no != '' ORDER BY ec.id DESC LIMIT 1) as latest_calib_serial
            FROM inventory_items i
            WHERE $itemWhereSql
            ORDER BY FIELD(i.category, 'medicine', 'supply', 'equipment'), i.generic_name ASC
        ");
        $itemStmt->execute($itemParams);
        $rawItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. Build Batch Query
        $batchWhere = ["1=1"];
        $batchParams = [];

        if ($branch !== 'all') {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $batchWhere[] = "(b.clinic_branch = :branch OR b.clinic_branch = :branchAlt)";
            $batchParams['branch'] = $branch;
            $batchParams['branchAlt'] = $branchAlt;
        }

        if ($semester !== 'all' && !empty($semester)) {
            if (stripos($semester, '1st') !== false) {
                $batchWhere[] = "(b.restock_semester LIKE '%1st%')";
            } elseif (stripos($semester, '2nd') !== false) {
                $batchWhere[] = "(b.restock_semester LIKE '%2nd%')";
            } elseif (stripos($semester, 'summer') !== false) {
                $batchWhere[] = "(b.restock_semester LIKE '%summer%')";
            } else {
                $batchWhere[] = "b.restock_semester = :semester";
                $batchParams['semester'] = $semester;
            }
        }

        if ($schoolYear !== 'all' && !empty($schoolYear)) {
            $batchWhere[] = "b.school_year = :school_year";
            $batchParams['school_year'] = $schoolYear;
        }

        if (!empty($startDate) && !empty($endDate)) {
            $batchWhere[] = "(
                b.date_arrived BETWEEN :start_date1 AND :end_date1 
                OR DATE(b.created_at) BETWEEN :start_date2 AND :end_date2
                OR (b.expired_on IS NOT NULL AND b.expired_on BETWEEN :start_date3 AND :end_date3)
            )";
            $batchParams['start_date1'] = $startDate;
            $batchParams['end_date1'] = $endDate;
            $batchParams['start_date2'] = $startDate;
            $batchParams['end_date2'] = $endDate;
            $batchParams['start_date3'] = $startDate;
            $batchParams['end_date3'] = $endDate;
        }

        $batchWhereSql = implode(' AND ', $batchWhere);

        $batchStmt = $pdo->prepare("
            SELECT b.*,
                   COALESCE(b.lot_number, b.batch_number) as lot_number,
                   DATEDIFF(b.expired_on, CURDATE()) as days_until_expiration
            FROM inventory_batches b
            WHERE $batchWhereSql
            ORDER BY b.expired_on ASC, b.date_arrived ASC
        ");
        $batchStmt->execute($batchParams);
        $rawBatches = $batchStmt->fetchAll(PDO::FETCH_ASSOC);

        $batchesByItem = [];
        foreach ($rawBatches as $b) {
            $batchesByItem[$b['item_id']][] = $b;
        }

        $items = [];
        $batchesFlat = [];
        $equipmentFlat = [];

        $totalDrawer = 0;
        $totalMain = 0;
        $totalCombined = 0;
        $expiringCount = 0;
        $expiredCount = 0;
        $drawerLowCount = 0;

        $itemCounter = 1;
        $batchCounter = 1;
        $equipCounter = 1;

        $today = date('Y-m-d');
        $threeMonthsFromNow = date('Y-m-d', strtotime('+90 days'));

        foreach ($rawItems as $item) {
            $itemBatches = $batchesByItem[$item['id']] ?? [];

            $drawerStock = 0;
            $mainStock = 0;
            $totalStock = 0;
            $earliestExpiry = null;
            $hasExpiredBatch = false;
            $hasExpiringSoonBatch = false;

            foreach ($itemBatches as $b) {
                if ($b['status'] !== 'depleted') {
                    $d = (int)$b['drawer_stock'];
                    $m = (int)$b['main_stock'];
                    $tot = (int)$b['stock_remaining'];
                    if ($tot <= 0 && ($d > 0 || $m > 0)) {
                        $tot = $d + $m;
                    }
                    $drawerStock += $d;
                    $mainStock += $m;
                    $totalStock += $tot;

                    if (!empty($b['expired_on'])) {
                        if ($b['expired_on'] < $today) {
                            $hasExpiredBatch = true;
                        } elseif ($b['expired_on'] <= $threeMonthsFromNow) {
                            $hasExpiringSoonBatch = true;
                        }
                        if (empty($earliestExpiry) || $b['expired_on'] < $earliestExpiry) {
                            $earliestExpiry = $b['expired_on'];
                        }
                    }
                }
            }

            // Determine status
            $computedStatus = 'in_stock';
            $statusLabel = 'In Stock';

            if ($totalStock <= 0) {
                $computedStatus = 'depleted';
                $statusLabel = 'Out of Stock';
            } elseif ($hasExpiredBatch) {
                $computedStatus = 'expired';
                $statusLabel = 'Has Expired Stock';
            } elseif ($hasExpiringSoonBatch) {
                $computedStatus = 'expiring_soon';
                $statusLabel = 'Expiring Soon';
            } elseif ($drawerStock == 0 && $mainStock > 0) {
                $computedStatus = 'drawer_depleted';
                $statusLabel = 'Drawer Empty';
            } elseif ($drawerStock <= (int)$item['alert_threshold']) {
                $computedStatus = 'drawer_low';
                $statusLabel = 'Drawer Low';
            }

            // Apply Status Filter if specified
            if ($status !== 'all') {
                if ($status === 'in_stock' && $totalStock <= 0) continue;
                if ($status === 'depleted' && $totalStock > 0) continue;
                if ($status === 'expired' && !$hasExpiredBatch) continue;
                if ($status === 'expiring_soon' && !$hasExpiringSoonBatch) continue;
                if ($status === 'drawer_low' && !($drawerStock == 0 || $drawerStock <= (int)$item['alert_threshold'])) continue;
            }

            // Aggregate metrics
            $totalDrawer += $drawerStock;
            $totalMain += $mainStock;
            $totalCombined += $totalStock;
            if ($hasExpiringSoonBatch) $expiringCount++;
            if ($hasExpiredBatch) $expiredCount++;
            if ($drawerStock <= (int)$item['alert_threshold'] || $drawerStock == 0) $drawerLowCount++;

            $item['drawer_stock'] = $drawerStock;
            $item['main_stock'] = $mainStock;
            $item['total_stock'] = $totalStock;
            $item['earliest_expiry'] = $earliestExpiry;
            $item['computed_status'] = $computedStatus;
            $item['status_label'] = $statusLabel;
            $item['batches'] = $itemBatches;
            $item['item_no'] = $itemCounter++;

            $items[] = $item;

            // Generate Flat Batch rows for SCR-9.5 (Medicine/Supplies Register)
            if (in_array($item['category'], ['medicine', 'supply'])) {
                if (!empty($itemBatches)) {
                    foreach ($itemBatches as $b) {
                        $bRem = (int)$b['stock_remaining'];
                        $bDraw = (int)$b['drawer_stock'];
                        $bMain = (int)$b['main_stock'];
                        if ($bRem <= 0 && ($bDraw > 0 || $bMain > 0)) $bRem = $bDraw + $bMain;

                        $bExpired = !empty($b['expired_on']) && $b['expired_on'] < $today;
                        $bExpiring = !empty($b['expired_on']) && $b['expired_on'] <= $threeMonthsFromNow && !$bExpired;

                        $bRemarks = 'In Stock / Dispense Ready';
                        if ($bRem <= 0) {
                            $bRemarks = 'Depleted';
                        } elseif ($bExpired) {
                            $bRemarks = 'Expired on ' . date('M d, Y', strtotime($b['expired_on']));
                        } elseif ($bExpiring) {
                            $bRemarks = 'Expiring soon (' . date('M d, Y', strtotime($b['expired_on'])) . ')';
                        }

                        $expiryFormatted = !empty($b['expired_on']) ? date('m/Y', strtotime($b['expired_on'])) : 'N/A';
                        $medName = trim($item['generic_name'] . (!empty($item['brand_name']) ? " ({$item['brand_name']})" : ""));

                        $batchesFlat[] = [
                            'item_no' => $batchCounter++,
                            'item_id' => $item['id'],
                            'batch_id' => $b['id'],
                            'medicine_name' => $medName,
                            'generic_name' => $item['generic_name'],
                            'brand_name' => $item['brand_name'],
                            'dosage' => $item['dosage'] ?? '',
                            'formulation' => $item['formulation'] ?? '',
                            'category' => $item['category'],
                            'quantity' => $bRem,
                            'unit' => $item['unit'] ?? 'pcs',
                            'quantity_str' => $bRem . ' ' . ($item['unit'] ?? 'pcs'),
                            'drawer_stock' => $bDraw,
                            'main_stock' => $bMain,
                            'batch_number' => $b['batch_number'],
                            'lot_number' => $b['lot_number'] ?? $b['batch_number'],
                            'expiry_date' => $expiryFormatted,
                            'expiry_date_full' => $b['expired_on'],
                            'date_arrived' => $b['date_arrived'],
                            'status' => $b['status'],
                            'remarks' => $bRemarks,
                            'branch' => $b['clinic_branch']
                        ];
                    }
                } else {
                    $medName = trim($item['generic_name'] . (!empty($item['brand_name']) ? " ({$item['brand_name']})" : ""));
                    $batchesFlat[] = [
                        'item_no' => $batchCounter++,
                        'item_id' => $item['id'],
                        'batch_id' => null,
                        'medicine_name' => $medName,
                        'generic_name' => $item['generic_name'],
                        'brand_name' => $item['brand_name'],
                        'dosage' => $item['dosage'] ?? '',
                        'formulation' => $item['formulation'] ?? '',
                        'category' => $item['category'],
                        'quantity' => 0,
                        'unit' => $item['unit'] ?? 'pcs',
                        'quantity_str' => '0 ' . ($item['unit'] ?? 'pcs'),
                        'drawer_stock' => 0,
                        'main_stock' => 0,
                        'batch_number' => 'N/A',
                        'lot_number' => 'N/A',
                        'expiry_date' => 'N/A',
                        'expiry_date_full' => null,
                        'date_arrived' => null,
                        'status' => 'depleted',
                        'remarks' => 'No active batches / Out of stock',
                        'branch' => $branch
                    ];
                }
            }

            // Generate Equipment rows for Equipment Register (Matching Physical Inventory Form)
            if ($item['category'] === 'equipment') {
                $desc = !empty($item['generic_name']) ? trim($item['generic_name']) : (!empty($item['brand_name']) ? trim($item['brand_name']) : 'Clinic Equipment');

                $equipRemarks = 'Excellent Condition';
                if (!empty($item['calibration_notes'])) {
                    $equipRemarks = $item['calibration_notes'];
                } elseif (!empty($item['last_calibrated'])) {
                    $equipRemarks = 'Calibrated (' . date('F Y', strtotime($item['last_calibrated'])) . ')';
                    if (!empty($item['calibration_due'])) {
                        $equipRemarks .= ' [Due: ' . date('M Y', strtotime($item['calibration_due'])) . ']';
                    }
                }

                $serialVal = !empty($item['serial_no']) ? $item['serial_no'] : (!empty($item['latest_calib_serial']) ? $item['latest_calib_serial'] : '----------');
                $rawUnit = !empty($item['unit']) ? strtolower(trim($item['unit'])) : 'pc';
                $unitVal = ($rawUnit === 'pieces' || $rawUnit === 'pcs' || $rawUnit === 'piece' || $rawUnit === 'pc') ? 'Pc' : ucfirst($item['unit'] ?? 'Pc');
                $datePurchasedVal = '----------';
                if (!empty($item['date_purchased'])) {
                    $datePurchasedVal = date('m/d/Y', strtotime($item['date_purchased']));
                } elseif (!empty($item['date_acquired'])) {
                    $datePurchasedVal = date('m/d/Y', strtotime($item['date_acquired']));
                }

                $equipmentFlat[] = [
                    'item_no' => $equipCounter++,
                    'item_id' => $item['id'],
                    'description' => $desc,
                    'qty' => $totalStock > 0 ? $totalStock : 1,
                    'unit' => $unitVal,
                    'brand' => !empty($item['brand_name']) ? $item['brand_name'] : '----------',
                    'model_no' => !empty($item['model_no']) ? $item['model_no'] : '----------',
                    'serial_no' => $serialVal,
                    'supplier' => !empty($item['supplier']) ? $item['supplier'] : '----------',
                    'date_purchased' => $datePurchasedVal,
                    'remarks' => $equipRemarks,
                    'last_calibrated' => $item['last_calibrated'],
                    'calibration_due' => $item['calibration_due'],
                    'branch' => $branch
                ];
            }
        }

        $this->jsonResponse([
            'success' => true,
            'items' => $items,
            'batches_flat' => $batchesFlat,
            'equipment_flat' => $equipmentFlat,
            'summary' => [
                'total_items' => count($items),
                'total_drawer_stock' => $totalDrawer,
                'total_main_stock' => $totalMain,
                'total_stock' => $totalCombined,
                'expiring_count' => $expiringCount,
                'expired_count' => $expiredCount,
                'drawer_low_count' => $drawerLowCount
            ],
            'meta' => (function() use ($branch, $userBranch, $isSuperAdmin, $semester, $schoolYear, $startDate, $endDate, $category, $status, $currentUser, $pdo) {
                $currName = !empty($currentUser['name']) ? $currentUser['name'] : (!empty($currentUser['username']) ? $currentUser['username'] : 'Clinic Staff');
                $currRole = $currentUser['role'] ?? 'Staff';

                // Look up Physician configured in Settings
                $physicianName = '';
                $physicianTitle = 'School Physician';
                try {
                    $stmtSet = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'medcert_personnel' LIMIT 1");
                    $stmtSet->execute();
                    $rawPersonnel = $stmtSet->fetchColumn();
                    if ($rawPersonnel) {
                        $personnelList = json_decode($rawPersonnel, true);
                        if (is_array($personnelList) && !empty($personnelList)) {
                            foreach ($personnelList as $p) {
                                $pos = strtolower($p['position'] ?? '');
                                $pName = strtolower($p['name'] ?? '');
                                if (str_contains($pos, 'physician') || str_contains($pos, 'doctor') || str_contains($pName, 'md') || str_contains($pName, 'dr.')) {
                                    $physicianName = $p['name'] ?? '';
                                    $physicianTitle = $p['position'] ?? 'School Physician';
                                    break;
                                }
                            }
                            if (empty($physicianName) && !empty($personnelList[0]['name'])) {
                                $physicianName = $personnelList[0]['name'];
                                $physicianTitle = $personnelList[0]['position'] ?? 'School Physician';
                            }
                        }
                    }
                } catch (\Exception $e) {
                    error_log('[CJC-CLINIC] Error fetching physician for report: ' . $e->getMessage());
                }

                return [
                    'branch' => $branch,
                    'user_branch' => $userBranch,
                    'is_superadmin' => $isSuperAdmin,
                    'semester' => $semester,
                    'school_year' => $schoolYear,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'category' => $category,
                    'status' => $status,
                    'current_user_name' => $currName,
                    'current_user_role' => $currRole,
                    'physician_name' => $physicianName,
                    'physician_title' => $physicianTitle,
                    'generated_at' => date('Y-m-d H:i:s')
                ];
            })()
        ]);
    }

    public function addMedicine() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $name = trim($input['medicine_name'] ?? ($input['generic_name'] ?? ''));
        $brand = trim($input['brand_name'] ?? '');
        $dosage = trim($input['dosage'] ?? '');
        $lotNo = trim($input['lot_number'] ?? ($input['batch_number'] ?? ''));
        $quantity = (int)($input['quantity'] ?? 0);
        $expiredOn = !empty($input['expired_on']) ? trim($input['expired_on']) : (!empty($input['expiration_date']) ? trim($input['expiration_date']) : null);
        $semester = trim($input['restock_semester'] ?? '1st Semester');
        $schoolYear = trim($input['school_year'] ?? '2025-2026');
        $branch = !$this->isSuperAdmin() ? $this->getUserBranch() : trim($input['clinic_branch'] ?? $this->getUserBranch());

        if (empty($name) || $quantity <= 0 || empty($expiredOn)) {
            $this->jsonResponse(['success' => false, 'error' => 'Medicine name, quantity greater than 0, and expiration date are required.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        try {
            $pdo->beginTransaction();

            // 1. Find or create item in inventory_items
            $itemStmt = $pdo->prepare("SELECT id FROM inventory_items WHERE generic_name = ? AND category = 'medicine' AND (dosage = ? OR dosage IS NULL) LIMIT 1");
            $itemStmt->execute([$name, $dosage ?: null]);
            $item = $itemStmt->fetch();

            if ($item) {
                $itemId = (int)$item['id'];
                if (!empty($brand)) {
                    $pdo->prepare("UPDATE inventory_items SET brand_name = COALESCE(brand_name, ?) WHERE id = ?")->execute([$brand, $itemId]);
                }
            } else {
                $insItem = $pdo->prepare("INSERT INTO inventory_items (category, brand_name, generic_name, dosage, unit, alert_threshold) VALUES ('medicine', ?, ?, ?, 'pieces', 20)");
                $insItem->execute([$brand ?: null, $name, $dosage ?: null]);
                $itemId = (int)$pdo->lastInsertId();
            }

            // Auto-generate lot number if empty
            if (empty($lotNo)) {
                $lotNo = 'LOT-' . date('Y') . '-' . str_pad((string)$itemId, 4, '0', STR_PAD_LEFT);
            }

            // 2. Insert new batch directly to Main Inventory
            $bStmt = $pdo->prepare("
                INSERT INTO inventory_batches (
                    item_id, clinic_branch, batch_number, lot_number, 
                    stock_remaining, main_stock, drawer_stock, 
                    date_arrived, expired_on, restock_semester, school_year, status
                ) VALUES (?, ?, ?, ?, ?, ?, 0, CURDATE(), ?, ?, ?, 'active')
            ");
            $bStmt->execute([
                $itemId, $branch, $lotNo, $lotNo,
                $quantity, $quantity,
                $expiredOn, $semester, $schoolYear
            ]);
            $batchId = (int)$pdo->lastInsertId();

            // 3. Log to inventory_logs
            $currentUser = cjcCurrentUser();
            $logStmt = $pdo->prepare("
                INSERT INTO inventory_logs (
                    batch_id, action_type, quantity_changed, 
                    source_location, target_location, disposed_to, processed_by
                ) VALUES (?, 'restock', ?, 'main', 'main', 'Initial Stock to Main Inventory', ?)
            ");
            $logStmt->execute([$batchId, $quantity, $currentUser['id'] ?? null]);

            $pdo->commit();
            $this->jsonResponse([
                'success' => true, 
                'message' => "Medicine '{$name}' added directly to Main Inventory ({$quantity} units).",
                'item_id' => $itemId,
                'batch_id' => $batchId
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Add Medicine Error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
        }
    }

    public function transferToDrawer() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Doctor', 'Nurse', 'Staff']);
        $this->forbidSuperAdminTransactions();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $transfers = $input['transfers'] ?? []; // Array of { batch_id, quantity }
        
        // Also support single item payload { batch_id, quantity }
        if (empty($transfers) && !empty($input['batch_id'])) {
            $transfers = [
                [
                    'batch_id' => (int)$input['batch_id'],
                    'quantity' => (int)($input['quantity'] ?? 0)
                ]
            ];
        }

        if (empty($transfers) || !is_array($transfers)) {
            $this->jsonResponse(['success' => false, 'error' => 'No items selected for transfer.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        $currentUser = cjcCurrentUser();

        try {
            $pdo->beginTransaction();
            $transferredCount = 0;
            $itemsTransferred = [];

            $bStmt = $pdo->prepare("
                SELECT b.id, b.item_id, b.clinic_branch, b.batch_number, b.lot_number, b.main_stock, b.drawer_stock, b.stock_remaining, b.expired_on, i.generic_name 
                FROM inventory_batches b
                JOIN inventory_items i ON b.item_id = i.id
                WHERE b.id = ?
                LIMIT 1
            ");

            $uStmt = $pdo->prepare("
                UPDATE inventory_batches 
                SET main_stock = main_stock - ?, drawer_stock = drawer_stock + ? 
                WHERE id = ?
            ");

            $lStmt = $pdo->prepare("
                INSERT INTO inventory_logs (
                    batch_id, action_type, quantity_changed, 
                    source_location, target_location, disposed_to, processed_by
                ) VALUES (?, 'transfer', ?, 'main', 'drawer', ?, ?)
            ");

            $today = date('Y-m-d');
            foreach ($transfers as $t) {
                $batchId = (int)($t['batch_id'] ?? 0);
                $qty = (int)($t['quantity'] ?? 0);
                if ($batchId <= 0 || $qty <= 0) continue;

                $bStmt->execute([$batchId]);
                $batch = $bStmt->fetch(PDO::FETCH_ASSOC);
                if (!$batch) continue;

                if (!$this->isSuperAdmin() && $batch['clinic_branch'] !== $this->getUserBranch()) {
                    throw new Exception("You do not have permission to transfer stock for " . ($batch['clinic_branch'] ?? 'another clinic branch') . ".");
                }

                // Reject expired batches
                if (!empty($batch['expired_on']) && $batch['expired_on'] < $today) {
                    throw new Exception("Batch #{$batch['batch_number']} ({$batch['generic_name']}) is expired ({$batch['expired_on']}) and cannot be transferred to the drawer.");
                }

                $availMain = (int)$batch['main_stock'];
                if ($availMain <= 0) {
                    throw new Exception("Batch #{$batch['batch_number']} ({$batch['generic_name']}) has no remaining stock in Main Inventory.");
                }

                if ($qty > $availMain) {
                    throw new Exception("Transfer quantity ({$qty}) exceeds available stock in Main Inventory ({$availMain}) for {$batch['generic_name']}.");
                }

                $uStmt->execute([$qty, $qty, $batchId]);

                $logMsg = "Transferred {$qty} unit(s) from Main Inventory to Drawer Inventory";
                $lStmt->execute([$batchId, $qty, $logMsg, $currentUser['id'] ?? null]);

                $transferredCount += $qty;
                $itemsTransferred[] = "{$batch['generic_name']} ({$qty} units)";
            }

            $pdo->commit();
            $this->jsonResponse([
                'success' => true, 
                'message' => "Successfully transferred {$transferredCount} unit(s) to Drawer Inventory!",
                'details' => $itemsTransferred
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Transfer to Drawer Error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()], 400);
        }
    }

    public function getExpirationWatch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        $branch = $this->isSuperAdmin() ? ($_GET['branch'] ?? 'all') : $this->getUserBranch();

        $branchSql = "";
        $params = [];
        if ($branch !== 'all' && $branch !== 'All Branches') {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $branchSql = " AND (b.clinic_branch = :branch OR b.clinic_branch = :branchAlt) ";
            $params['branch'] = $branch;
            $params['branchAlt'] = $branchAlt;
        }

        try {
            // 1. Expiring within 6 months (180 days)
            $card6mStmt = $pdo->prepare("
                SELECT COUNT(*) FROM inventory_batches b 
                WHERE b.stock_remaining > 0 AND b.expired_on IS NOT NULL 
                  AND b.expired_on > CURDATE() AND b.expired_on <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH)
                $branchSql
            ");
            $card6mStmt->execute($params);
            $expiring6m = (int)$card6mStmt->fetchColumn();

            // 2. Expiring within 3 months (90 days)
            $card3mStmt = $pdo->prepare("
                SELECT COUNT(*) FROM inventory_batches b 
                WHERE b.stock_remaining > 0 AND b.expired_on IS NOT NULL 
                  AND b.expired_on > CURDATE() AND b.expired_on <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
                $branchSql
            ");
            $card3mStmt->execute($params);
            $expiring3m = (int)$card3mStmt->fetchColumn();

            // 3. Expiring within 1 month (30 days)
            $card1mStmt = $pdo->prepare("
                SELECT COUNT(*) FROM inventory_batches b 
                WHERE b.stock_remaining > 0 AND b.expired_on IS NOT NULL 
                  AND b.expired_on > CURDATE() AND b.expired_on <= DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
                $branchSql
            ");
            $card1mStmt->execute($params);
            $expiring1m = (int)$card1mStmt->fetchColumn();

            // 4. Expired Medicines
            $cardExpStmt = $pdo->prepare("
                SELECT COUNT(*) FROM inventory_batches b 
                WHERE b.stock_remaining > 0 AND b.expired_on IS NOT NULL 
                  AND b.expired_on <= CURDATE()
                $branchSql
            ");
            $cardExpStmt->execute($params);
            $expiredCount = (int)$cardExpStmt->fetchColumn();

            // Ordered list of batches sorted soonest first
            $listStmt = $pdo->prepare("
                SELECT b.id as batch_id, b.item_id, b.batch_number, COALESCE(b.lot_number, b.batch_number) as lot_number,
                       b.stock_remaining, b.main_stock, b.drawer_stock, b.expired_on, b.clinic_branch,
                       b.restock_semester, b.school_year,
                       DATEDIFF(b.expired_on, CURDATE()) as days_until_expiration,
                       i.generic_name, i.brand_name, i.dosage, i.unit, i.category
                FROM inventory_batches b
                JOIN inventory_items i ON b.item_id = i.id
                WHERE b.stock_remaining > 0 AND b.expired_on IS NOT NULL
                $branchSql
                ORDER BY b.expired_on ASC, b.id ASC
            ");
            $listStmt->execute($params);
            $list = $listStmt->fetchAll(PDO::FETCH_ASSOC);

            $this->jsonResponse([
                'success' => true,
                'stats' => [
                    'expiring_6_months' => $expiring6m,
                    'expiring_3_months' => $expiring3m,
                    'expiring_1_month'  => $expiring1m,
                    'expired_medicines' => $expiredCount
                ],
                'items' => $list
            ]);
        } catch (Throwable $e) {
            error_log('getExpirationWatch Error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function getAuditTrail() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        $branch = $this->isSuperAdmin() ? ($_GET['branch'] ?? 'all') : $this->getUserBranch();
        $actionFilter = $_GET['action_filter'] ?? 'all';
        $search = trim($_GET['search'] ?? '');
        $limit = (int)($_GET['limit'] ?? 100);

        $where = ["1=1"];
        $params = [];

        if ($branch !== 'all' && $branch !== 'All Branches') {
            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);
            $where[] = "(b.clinic_branch = :branch OR b.clinic_branch = :branchAlt)";
            $params['branch'] = $branch;
            $params['branchAlt'] = $branchAlt;
        }

        if ($actionFilter !== 'all') {
            $where[] = "l.action_type = :action_type";
            $params['action_type'] = $actionFilter;
        }

        if (!empty($search)) {
            $where[] = "(i.generic_name LIKE :search OR i.brand_name LIKE :search OR u.name LIKE :search OR l.disposed_to LIKE :search)";
            $params['search'] = "%$search%";
        }

        $whereSql = implode(" AND ", $where);

        try {
            $stmt = $pdo->prepare("
                SELECT l.id, l.batch_id, l.action_type, l.quantity_changed, 
                       l.source_location, l.target_location, l.disposed_to, l.created_at,
                       b.batch_number, COALESCE(b.lot_number, b.batch_number) as lot_number,
                       b.clinic_branch, b.stock_remaining, b.main_stock, b.drawer_stock,
                       i.id as item_id, i.generic_name, i.brand_name, i.dosage, i.unit,
                       COALESCE(u.name, 'Staff') as staff_name, u.role as staff_role,
                       CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                       p.patient_id_number
                FROM inventory_logs l
                JOIN inventory_batches b ON l.batch_id = b.id
                JOIN inventory_items i ON b.item_id = i.id
                LEFT JOIN users u ON l.processed_by = u.id
                LEFT JOIN profiles p ON l.profile_id = p.id
                WHERE $whereSql
                ORDER BY l.id DESC
                LIMIT $limit
            ");
            $stmt->execute($params);
            $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->jsonResponse(['success' => true, 'logs' => $logs]);
        } catch (Throwable $e) {
            error_log('getAuditTrail Error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    protected function ensureSchema($pdo) {
        try {
            $iCols = $pdo->query("SHOW COLUMNS FROM inventory_items LIKE 'unit'")->fetch();
            if (!$iCols) {
                $pdo->exec("ALTER TABLE inventory_items ADD COLUMN unit VARCHAR(50) DEFAULT 'pieces' AFTER alert_threshold");
            }
            $sCols = $pdo->query("SHOW COLUMNS FROM inventory_items LIKE 'serial_no'")->fetch();
            if (!$sCols) {
                $pdo->exec("ALTER TABLE inventory_items ADD COLUMN serial_no VARCHAR(100) NULL AFTER formulation");
                $pdo->exec("ALTER TABLE inventory_items ADD COLUMN model_no VARCHAR(100) NULL AFTER serial_no");
                $pdo->exec("ALTER TABLE inventory_items ADD COLUMN supplier VARCHAR(150) NULL AFTER model_no");
            }
            $bCols = $pdo->query("SHOW COLUMNS FROM inventory_batches LIKE 'main_stock'")->fetch();
            if (!$bCols) {
                $pdo->exec("ALTER TABLE inventory_batches ADD COLUMN main_stock INT NOT NULL DEFAULT 0 AFTER stock_remaining");
                $pdo->exec("ALTER TABLE inventory_batches ADD COLUMN drawer_stock INT NOT NULL DEFAULT 0 AFTER main_stock");
                $pdo->exec("ALTER TABLE inventory_batches ADD COLUMN lot_number VARCHAR(50) DEFAULT NULL AFTER batch_number");
                $pdo->exec("ALTER TABLE inventory_batches ADD COLUMN restock_semester VARCHAR(50) DEFAULT '1st Semester' AFTER expired_on");
                $pdo->exec("ALTER TABLE inventory_batches ADD COLUMN school_year VARCHAR(20) DEFAULT '2025-2026' AFTER restock_semester");
                $pdo->exec("UPDATE inventory_batches SET main_stock = stock_remaining WHERE main_stock = 0 AND drawer_stock = 0 AND stock_remaining > 0");
                $pdo->exec("UPDATE inventory_batches SET lot_number = batch_number WHERE (lot_number IS NULL OR lot_number = '') AND batch_number IS NOT NULL");
            }
            $lCols = $pdo->query("SHOW COLUMNS FROM inventory_logs LIKE 'source_location'")->fetch();
            if (!$lCols) {
                $pdo->exec("ALTER TABLE inventory_logs MODIFY COLUMN action_type ENUM('restock', 'dispense', 'dispose', 'adjust', 'transfer', 'edit') NOT NULL");
                $pdo->exec("ALTER TABLE inventory_logs ADD COLUMN source_location ENUM('main', 'drawer') NULL AFTER quantity_changed");
                $pdo->exec("ALTER TABLE inventory_logs ADD COLUMN target_location ENUM('main', 'drawer') NULL AFTER source_location");
            }
        } catch (Exception $e) {
            error_log('ensureSchema inventory error: ' . $e->getMessage());
        }
    }
}

