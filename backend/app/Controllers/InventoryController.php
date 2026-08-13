<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class InventoryController {
    
    // --- CATALOG ITEMS ---
    public function getItems() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        
        $stmt = $pdo->query("
            SELECT i.*, 
                   COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as remaining_stock,
                   COALESCE(SUM(CASE WHEN b.status != 'depleted' THEN b.stock_remaining ELSE 0 END), 0) as total_stock,
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

        $items = $stmt->fetchAll();
        $this->jsonResponse(['items' => $items]);
    }

    public function addItem() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate(); cjcRequireRole(['Admin', 'Superadmin', 'Staff']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        if (isset($input['category']) && $input['category'] === 'medicine' && empty(trim($input['brand_name'] ?? ''))) {
            $this->jsonResponse(['success' => false, 'error' => 'Brand name is required for medicines.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("INSERT INTO inventory_items (category, brand_name, generic_name, dosage, formulation, alert_threshold, date_acquired, date_purchased, last_calibrated, calibration_due, calibration_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $input['category'] ?? 'medicine',
            $input['brand_name'] ?? null,
            $input['generic_name'] ?? '',
            $input['dosage'] ?? null,
            $input['formulation'] ?? null,
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
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) $this->jsonResponse(['success' => false, 'error' => 'Invalid item ID'], 400);

        $pdo = cjcDatabaseConnection();
        $stmt = $pdo->prepare("
            UPDATE inventory_items 
            SET category = ?, brand_name = ?, generic_name = ?, dosage = ?, formulation = ?, alert_threshold = ?, 
                date_acquired = ?, date_purchased = ?, last_calibrated = ?, calibration_due = ?, calibration_notes = ? 
            WHERE id = ?
        ");
        $stmt->execute([
            $input['category'] ?? 'medicine',
            $input['brand_name'] ?? null,
            $input['generic_name'] ?? '',
            $input['dosage'] ?? null,
            $input['formulation'] ?? null,
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

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $itemId = (int)($input['item_id'] ?? 0);
        $returnQty = (int)($input['quantity'] ?? 1);
        $profileId = !empty($input['profile_id']) ? (int)$input['profile_id'] : null;
        $patientName = trim($input['patient_name'] ?? 'Patient');
        $branch = $input['clinic_branch'] ?? $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';

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
        
        $branch = $_GET['branch'] ?? 'all';
        $includeAll = isset($_GET['include_all']) ? (int)$_GET['include_all'] : 1;
        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        }

        $params = [];
        $whereClauses = [];
        
        if ($includeAll !== 1) {
            $whereClauses[] = "b.stock_remaining > 0";
        }
        
        if ($branch !== 'all') {
            $whereClauses[] = "b.clinic_branch = :branch";
            $params['branch'] = $branch;
        }

        $whereSql = count($whereClauses) > 0 ? "WHERE " . implode(" AND ", $whereClauses) : "";

        $stmt = $pdo->prepare("
            SELECT b.*, i.generic_name, i.brand_name, i.category, i.dosage, i.formulation,
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
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $batchId = (int)($input['batch_id'] ?? 0);
        $disposeQty = (int)($input['quantity'] ?? 0);
        $reason = trim($input['reason'] ?? 'Expired / Unconsumed Disposal');
        $disposedTo = trim($input['disposed_to'] ?? $reason);

        if ($batchId <= 0 || $disposeQty <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid parameters for disposal.'], 400);
        }

        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("SELECT * FROM inventory_batches WHERE id = ?");
            $stmt->execute([$batchId]);
            $batch = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$batch) {
                throw new Exception("Batch not found.");
            }

            $currentStock = (int)$batch['stock_remaining'];
            if ($disposeQty > $currentStock) {
                throw new Exception("Cannot dispose {$disposeQty} units. Available stock is only {$currentStock}.");
            }

            $newStock = $currentStock - $disposeQty;
            $newStatus = ($newStock === 0) ? 'expired' : $batch['status'];

            $upd = $pdo->prepare("UPDATE inventory_batches SET stock_remaining = ?, status = ? WHERE id = ?");
            $upd->execute([$newStock, $newStatus, $batchId]);

            $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, processed_by) VALUES (?, 'dispose', ?, ?, ?)");
            $logStmt->execute([$batchId, -$disposeQty, $disposedTo, $_SESSION['cjc_user']['id']]);

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => "Successfully disposed {$disposeQty} unit(s)."]);
        } catch (Exception $e) {
            $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function addBatch() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        cjcRequireAuth(); cjcCsrfValidate();
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $pdo = cjcDatabaseConnection();
        
        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO inventory_batches 
                (item_id, clinic_branch, batch_number, stock_remaining, date_arrived, expired_on, last_calibrated, calibration_due, calibration_notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $input['item_id'],
                $input['clinic_branch'],
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
                $logStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'dispense', ?, ?, NULL, ?)");
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
            SELECT i.id, i.category, i.generic_name, i.brand_name, i.dosage, i.formulation, IFNULL(SUM(b.stock_remaining), 0) as total_stock, i.alert_threshold
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
        $pdo = cjcDatabaseConnection();

        // 1. Get current total stock for all items
        $stockStmt = $pdo->query("
            SELECT i.id as item_id, i.generic_name as name, COALESCE(SUM(b.stock_remaining), 0) as current_stock
            FROM inventory_items i
            LEFT JOIN inventory_batches b ON i.id = b.item_id AND b.status = 'active'
            GROUP BY i.id
        ");
        $itemsData = [];
        while ($row = $stockStmt->fetch(PDO::FETCH_ASSOC)) {
            $itemsData[$row['item_id']] = [
                'item_id' => (int)$row['item_id'],
                'name' => $row['name'],
                'current_stock' => (int)$row['current_stock'],
                'daily_history' => []
            ];
        }

        // 2. Get daily dispensing history for the last 30 days
        $historyStmt = $pdo->query("
            SELECT b.item_id, DATE(l.created_at) as date, SUM(ABS(l.quantity_changed)) as dispensed
            FROM inventory_logs l
            JOIN inventory_batches b ON l.batch_id = b.id
            WHERE l.action_type = 'dispense' 
              AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY b.item_id, DATE(l.created_at)
            ORDER BY DATE(l.created_at) ASC
        ");

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

        $itemId = (int)($_POST['item_id'] ?? 0);
        $batchId = !empty($_POST['batch_id']) ? (int)$_POST['batch_id'] : null;
        $calibratedBy = trim($_POST['calibrated_by'] ?? '');
        $certNumber = trim($_POST['cert_number'] ?? '');
        $calibrationDate = trim($_POST['calibration_date'] ?? date('Y-m-d'));
        $dueDate = !empty($_POST['due_date']) ? trim($_POST['due_date']) : null;
        $notes = trim($_POST['notes'] ?? '');

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
                (item_id, batch_id, cert_type, calibrated_by, cert_number, calibration_date, due_date, file_url, filename, uploaded_by, notes)
                VALUES (?, ?, 'external_upload', ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $itemId,
                $batchId,
                $calibratedBy ?: 'External Calibrator',
                $certNumber ?: null,
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

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}

