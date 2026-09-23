<?php
require_once __DIR__ . '/BaseController.php';

class ConsultationController extends BaseController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        // Automatically roll-over and clean up leftover unclosed consultations from previous days
        $this->autoRollOverPastConsultations($pdo);

        $sessions = [];

        $period = $_GET['period'] ?? 'today';
        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;
        
        $page = (int)($_GET['page'] ?? 1);
        $perPage = (int)($_GET['per_page'] ?? 10);
        if ($page < 1) $page = 1;
        if ($perPage < 1) $perPage = 10;
        $offset = ($page - 1) * $perPage;

        $total = 0;
        $totalPages = 1;

        $whereClause = "1=1";
        $params = [];

        if ($period === 'today') {
            $whereClause .= " AND DATE(c.created_at) = CURDATE()";
        } elseif ($period === 'weekly') {
            $whereClause .= " AND YEARWEEK(c.created_at, 1) = YEARWEEK(CURDATE(), 1)";
        } elseif ($period === 'monthly') {
            $whereClause .= " AND MONTH(c.created_at) = MONTH(CURDATE()) AND YEAR(c.created_at) = YEAR(CURDATE())";
        } elseif ($period === 'custom' && $from && $to) {
            $whereClause .= " AND DATE(c.created_at) >= :from AND DATE(c.created_at) <= :to";
            $params['from'] = $from;
            $params['to'] = $to;
        } // 'all' requires no filter

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        
        // Handle branch filtering
        $requestBranch = $_GET['branch'] ?? 'All Branches';
        if ($userRole !== 'Superadmin') {
            $branch = $this->getUserBranch();
            if ($branch === 'Basic Education Clinic' || $branch === 'BED Clinic') {
                $whereClause .= " AND c.clinic_branch IN ('Basic Education Clinic', 'BED Clinic')";
            } else {
                $whereClause .= " AND c.clinic_branch = :branch";
                $params['branch'] = $branch;
            }
        } else {
            if ($requestBranch !== 'All Branches') {
                if ($requestBranch === 'Basic Education Clinic' || $requestBranch === 'BED Clinic') {
                    $whereClause .= " AND c.clinic_branch IN ('Basic Education Clinic', 'BED Clinic')";
                } else {
                    $whereClause .= " AND c.clinic_branch = :branch";
                    $params['branch'] = $requestBranch;
                }
            }
        }

        // Handle status filtering
        $status = $_GET['status'] ?? 'all';
        if ($status !== 'all') {
            if ($status === 'in-progress') {
                $whereClause .= " AND c.status IN ('active', 'in-progress')";
            } else {
                $whereClause .= " AND c.status = :status";
                $params['status'] = $status;
            }
        }

        // FIFO Queue Sorting: Active/waiting queue sorted by check-in time ASC (earliest check-in first)
        $orderBy = "CASE WHEN c.status IN ('waiting', 'active', 'in-progress') THEN 0 ELSE 1 END ASC, 
                    CASE WHEN c.status IN ('waiting', 'active', 'in-progress') THEN c.created_at END ASC, 
                    COALESCE(c.time_out, c.created_at) DESC";

        if ($status === 'waiting' || $status === 'in-progress') {
            $orderBy = "c.created_at ASC";
        } elseif ($status === 'completed') {
            $orderBy = "COALESCE(c.time_out, c.created_at) DESC";
        }

        try {
            $countSql = "SELECT COUNT(*) FROM consultations c WHERE $whereClause";
            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();
            
            $totalPages = ceil($total / $perPage);
            if ($totalPages < 1) $totalPages = 1;

            $sql = "SELECT c.id,
                           c.profile_id,
                           c.appointment_id,
                           COALESCE(a.appointment_code, CONCAT('APT-', YEAR(COALESCE(a.appointment_date, c.created_at)), '-', LPAD(c.appointment_id, 5, '0'))) AS appointment_code,
                           c.clinic_branch,
                           p.patient_id_number,
                           COALESCE(CONCAT(p.first_name, ' ', p.last_name), 'Unknown') AS patient_name,
                           p.address,
                           c.created_at AS time_in,
                           c.purpose,
                           c.clinic_process,
                           c.emergency_disposition,
                           p.profile_type,
                           c.time_out,
                           c.blood_pressure,
                           c.temperature,
                           c.weight,
                           c.diagnosis,
                           c.treatment,
                           c.attended_by,
                           c.status
                    FROM consultations c
                    LEFT JOIN profiles p ON p.id = c.profile_id
                    LEFT JOIN appointments a ON a.id = c.appointment_id
                    WHERE $whereClause
                    ORDER BY $orderBy
                    LIMIT $perPage OFFSET $offset";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $sessions = $stmt->fetchAll();
            
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] consultations list API error: ' . $e->getMessage());
        }

        $this->jsonResponse([
            'sessions' => $sessions,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
            'user_role' => $userRole
        ]);
    }

    public function history() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $profile_id = (int)($_GET['profile_id'] ?? 0);

        if ($profile_id <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Profile ID required.'], 400);
        }

        try {
            $sql = "SELECT id, created_at AS date, clinic_branch, purpose, blood_pressure, temperature, weight, diagnosis, treatment, prescriptions, notes, attended_by, status
                    FROM consultations
                    WHERE profile_id = :id
                    ORDER BY created_at DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['id' => $profile_id]);
            $history = $stmt->fetchAll();
            $this->jsonResponse(['success' => true, 'history' => $history]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] history error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Database error.'], 500);
        }
    }

    public function create() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $rawProfileId      = $input['profile_id'] ?? null;
        $profile_id        = is_numeric($rawProfileId) ? (int)$rawProfileId : 0;
        $patient_id_number = trim($input['patient_id_number'] ?? '');
        $purpose           = trim($input['purpose'] ?? '');
        
        if ((!$profile_id && !$patient_id_number) || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'Valid patient profile and purpose are required.'], 400);
        }
        
        // Ensure patient exists (lookup by primary key id or fallback to patient_id_number)
        try {
            $profile = null;
            if ($profile_id > 0) {
                $stmt = $pdo->prepare('SELECT id, first_name, last_name, patient_id_number FROM profiles WHERE id = :id LIMIT 1');
                $stmt->execute(['id' => $profile_id]);
                $profile = $stmt->fetch();
            }
            if (!$profile && !empty($patient_id_number)) {
                $stmt = $pdo->prepare('SELECT id, first_name, last_name, patient_id_number FROM profiles WHERE patient_id_number = :idNum LIMIT 1');
                $stmt->execute(['idNum' => $patient_id_number]);
                $profile = $stmt->fetch();
                if ($profile) {
                    $profile_id = (int)$profile['id'];
                }
            }
            if (!$profile) {
                $this->jsonResponse(['success' => false, 'message' => 'Patient profile not found in database. The profile may have been deleted or not synced yet.'], 404);
            }

            $patientName = trim(($profile['first_name'] ?? '') . ' ' . ($profile['last_name'] ?? ''));

            // 1. Prevent duplicate active admissions (cannot admit again while currently waiting or in-progress)
            $activeStmt = $pdo->prepare("
                SELECT id, created_at, status, purpose 
                FROM consultations 
                WHERE profile_id = :pid 
                  AND status IN ('waiting', 'in-progress', 'active')
                  AND DATE(created_at) = CURDATE()
                ORDER BY created_at DESC 
                LIMIT 1
            ");
            $activeStmt->execute(['pid' => $profile_id]);
            $activeConsultation = $activeStmt->fetch();

            if ($activeConsultation) {
                $statusLabel = ($activeConsultation['status'] === 'waiting') ? 'Waiting in Queue' : 'In Consultation';
                $timeInFormatted = date('h:i A', strtotime($activeConsultation['created_at']));
                $this->jsonResponse([
                    'success' => false, 
                    'message' => "Admission Blocked: " . ($patientName ?: "This patient") . " is already checked in today at {$timeInFormatted} (Status: {$statusLabel}). Please complete, record vitals, or time-out their active visit first."
                ], 400);
            }

            // 2. Prevent rapid accidental duplicate check-in clicks (30-second debounce)
            $recentStmt = $pdo->prepare("
                SELECT id, created_at, status 
                FROM consultations 
                WHERE profile_id = :pid 
                  AND created_at >= (NOW() - INTERVAL 30 SECOND)
                ORDER BY created_at DESC 
                LIMIT 1
            ");
            $recentStmt->execute(['pid' => $profile_id]);
            $recentConsultation = $recentStmt->fetch();

            if ($recentConsultation) {
                $recentTime = date('h:i:s A', strtotime($recentConsultation['created_at']));
                $this->jsonResponse([
                    'success' => false, 
                    'message' => "Admission Debounce: " . ($patientName ?: "This patient") . " was just admitted a moment ago at {$recentTime}. Please wait a few seconds before submitting again."
                ], 400);
            }

        } catch (PDOException $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Database error.'], 500);
        }
            
        $currentUser = cjcCurrentUser();
        $attended_by = $currentUser['name'] ?? 'Clinic Staff';
        $branch = $this->getUserBranch();

        // Check if explicit appointment_id passed or auto-detect open scheduled appointment today
        $appointmentId = (int)($input['appointment_id'] ?? 0);
        if ($appointmentId <= 0) {
            try {
                $aptStmt = $pdo->prepare("
                    SELECT id FROM appointments 
                    WHERE profile_id = ? AND appointment_date = CURDATE() 
                      AND status IN ('Scheduled', 'No-Show') 
                    ORDER BY appointment_time ASC LIMIT 1
                ");
                $aptStmt->execute([$profile_id]);
                $foundAptId = $aptStmt->fetchColumn();
                if ($foundAptId) {
                    $appointmentId = (int)$foundAptId;
                }
            } catch (Exception $e) {}
        }

        $clinic_process = isset($input['clinic_process']) ? trim($input['clinic_process']) : null;
        $emergency_disposition = isset($input['emergency_disposition']) ? trim($input['emergency_disposition']) : null;

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO consultations (profile_id, appointment_id, purpose, clinic_process, emergency_disposition, status, attended_by, clinic_branch)
                 VALUES (:profile_id, :appointment_id, :purpose, :clinic_process, :emergency_disposition, :status, :attended_by, :clinic_branch)'
            );
            $stmt->execute([
                'profile_id'            => $profile_id,
                'appointment_id'        => $appointmentId > 0 ? $appointmentId : null,
                'purpose'               => $purpose,
                'clinic_process'        => !empty($clinic_process) ? $clinic_process : null,
                'emergency_disposition' => !empty($emergency_disposition) ? $emergency_disposition : null,
                'status'                => 'waiting',
                'attended_by'           => $attended_by,
                'clinic_branch'         => $branch
            ]);

            $newId = $pdo->lastInsertId();

            if ($appointmentId > 0) {
                try {
                    $pdo->prepare("UPDATE appointments SET status = 'In Consultation' WHERE id = ?")->execute([$appointmentId]);
                } catch (Exception $e) {}
            }

            // Auto-add new custom cue to settings presets if not already present
            try {
                $sStmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'cues' LIMIT 1");
                $sStmt->execute();
                $row = $sStmt->fetch();
                $existingCues = [];
                if ($row && !empty($row['setting_value'])) {
                    $decoded = json_decode($row['setting_value'], true);
                    if (is_array($decoded)) {
                        $existingCues = $decoded;
                    }
                }
                if (!in_array($purpose, $existingCues)) {
                    $existingCues[] = $purpose;
                    $upStmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value) VALUES ('cues', :val) ON DUPLICATE KEY UPDATE setting_value = :val2");
                    $valStr = json_encode(array_values($existingCues));
                    $upStmt->execute(['val' => $valStr, 'val2' => $valStr]);
                }
            } catch (Exception $e) {
                error_log('[CJC-CLINIC] Auto-save custom cue error: ' . $e->getMessage());
            }
            
            $this->jsonResponse(['success' => true, 'id' => $newId]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Create consultation error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to save check-in record.'], 500);
        }
    }

    public function update() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $id = (int)($input['id'] ?? 0);
        $action = $input['action'] ?? '';
        
        if ($id <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Consultation ID is required.'], 400);
        }

        try {
            if ($action === 'checkout') {
                $stmt = $pdo->prepare("UPDATE consultations SET time_out = CURRENT_TIMESTAMP, status = 'completed' WHERE id = :id");
                $stmt->execute(['id' => $id]);

                // Auto-complete linked appointment if present
                try {
                    $aptStmt = $pdo->prepare("SELECT appointment_id FROM consultations WHERE id = :id");
                    $aptStmt->execute(['id' => $id]);
                    $aptId = (int)$aptStmt->fetchColumn();
                    if ($aptId > 0) {
                        $updApt = $pdo->prepare("UPDATE appointments SET status = 'Completed' WHERE id = :aptId");
                        $updApt->execute(['aptId' => $aptId]);
                    }
                } catch (Exception $e) {}

            } elseif ($action === 'start') {
                $stmt = $pdo->prepare("UPDATE consultations SET status = 'in-progress' WHERE id = :id");
                $stmt->execute(['id' => $id]);
            } elseif ($action === 'cancel' || $action === 'delete') {
                try {
                    $aptStmt = $pdo->prepare("SELECT appointment_id FROM consultations WHERE id = :id");
                    $aptStmt->execute(['id' => $id]);
                    $aptId = (int)$aptStmt->fetchColumn();
                    if ($aptId > 0) {
                        $updApt = $pdo->prepare("UPDATE appointments SET status = 'Scheduled' WHERE id = :aptId AND status = 'In Consultation'");
                        $updApt->execute(['aptId' => $aptId]);
                    }
                } catch (Exception $e) {}

                $stmt = $pdo->prepare("DELETE FROM consultations WHERE id = :id");
                $stmt->execute(['id' => $id]);
                cjcLogAudit("Cancelled/Deleted consultation queue record ID #$id");
            } elseif ($action === 'update_time_in') {
                $newTimeIn = trim($input['time_in'] ?? '');
                if (!empty($newTimeIn)) {
                    $formattedTimeIn = date('Y-m-d H:i:s', strtotime($newTimeIn));
                    $stmt = $pdo->prepare("UPDATE consultations SET created_at = :time_in WHERE id = :id");
                    $stmt->execute(['time_in' => $formattedTimeIn, 'id' => $id]);
                    cjcLogAudit("Updated Time-In timestamp to $formattedTimeIn for consultation ID #$id");
                }
            }

            $this->jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Update consultation error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to update record.'], 500);
        }
    }

    public function saveNotes() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $id = (int)($input['id'] ?? 0);
        
        if ($id <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Consultation ID is required.'], 400);
        }

        $bp = $input['blood_pressure'] ?? null;
        $temp = $input['temperature'] ?? null;
        $weight = $input['weight'] ?? null;
        $diagnosis = $input['diagnosis'] ?? null;
        $treatment = $input['treatment'] ?? null;
        $dispensedItems = $input['dispensed_items'] ?? [];

        // Format dispensed items summary into treatment notes if not already present
        if (!empty($dispensedItems) && is_array($dispensedItems)) {
            $summaryList = [];
            foreach ($dispensedItems as $di) {
                if (!empty($di['name']) && !empty($di['quantity'])) {
                    $summaryList[] = $di['name'] . ' (Qty: ' . $di['quantity'] . ')';
                }
            }
            if (!empty($summaryList)) {
                $summaryStr = '[Administered/Dispensed: ' . implode(', ', $summaryList) . ']';
                if (empty($treatment)) {
                    $treatment = $summaryStr;
                } elseif (strpos($treatment, $summaryStr) === false) {
                    $treatment .= "\n" . $summaryStr;
                }
            }
        }

        try {
            $pdo->beginTransaction();

            // Retrieve consultation record, branch, and patient info
            $cStmt = $pdo->prepare("SELECT c.clinic_branch, p.id as profile_id, p.first_name, p.last_name, c.prescriptions 
                                    FROM consultations c 
                                    LEFT JOIN profiles p ON c.profile_id = p.id 
                                    WHERE c.id = ?");
            $cStmt->execute([$id]);
            $consultation = $cStmt->fetch(PDO::FETCH_ASSOC);

            if (!$consultation) {
                $pdo->rollBack();
                $this->jsonResponse(['success' => false, 'message' => 'Consultation not found.'], 404);
            }

            $currentPrescriptions = $consultation['prescriptions'];
            $disposedTo = trim(($consultation['first_name'] ?? '') . ' ' . ($consultation['last_name'] ?? '')) ?: 'Patient';
            $profileId = $consultation['profile_id'] ?? null;

            // Determine branch with alias support (BED Clinic <-> Basic Education Clinic)
            $branch = !empty($consultation['clinic_branch']) 
                ? $consultation['clinic_branch'] 
                : (!$this->isSuperAdmin() ? $this->getUserBranch() : (!empty($input['clinic_branch']) ? $input['clinic_branch'] : $this->getUserBranch()));

            $branchAlt = ($branch === 'Basic Education Clinic') ? 'BED Clinic' : (($branch === 'BED Clinic') ? 'Basic Education Clinic' : $branch);

            // Handle Inventory Dispensing: STRICT DRAWER-ONLY DISPENSING
            if (!empty($dispensedItems) && is_array($dispensedItems)) {
                // Pass 0: Pre-validate that all requested items have sufficient unexpired stock in the DRAWER
                foreach ($dispensedItems as $dItem) {
                    $itemId = (int)($dItem['item_id'] ?? 0);
                    $qty = (int)($dItem['quantity'] ?? 0);
                    if ($itemId <= 0 || $qty <= 0) continue;

                    $checkStmt = $pdo->prepare("
                        SELECT i.generic_name, i.brand_name,
                               COALESCE(SUM(CASE WHEN (b.clinic_branch = ? OR b.clinic_branch = ?) AND (b.expired_on >= CURDATE() OR b.expired_on IS NULL) AND b.status != 'depleted' THEN b.drawer_stock ELSE 0 END), 0) as total_drawer,
                               COALESCE(SUM(CASE WHEN (b.clinic_branch = ? OR b.clinic_branch = ?) AND (b.expired_on >= CURDATE() OR b.expired_on IS NULL) AND b.status != 'depleted' THEN b.main_stock ELSE 0 END), 0) as total_main
                        FROM inventory_items i
                        LEFT JOIN inventory_batches b ON i.id = b.item_id
                        WHERE i.id = ?
                        GROUP BY i.id
                    ");
                    $checkStmt->execute([$branch, $branchAlt, $branch, $branchAlt, $itemId]);
                    $itemInfo = $checkStmt->fetch(PDO::FETCH_ASSOC);

                    $itemName = $itemInfo ? ($itemInfo['generic_name'] . ($itemInfo['brand_name'] ? " ({$itemInfo['brand_name']})" : '')) : "Item #$itemId";
                    $totalDrawer = (int)($itemInfo['total_drawer'] ?? 0);
                    $totalMain = (int)($itemInfo['total_main'] ?? 0);

                    if ($totalDrawer < $qty) {
                        $pdo->rollBack();
                        $msg = "Cannot dispense '{$itemName}': Insufficient stock in Drawer Inventory. Available in Drawer: {$totalDrawer}, Requested: {$qty}.";
                        if ($totalMain > 0) {
                            $msg .= " Main Stockroom has {$totalMain} units available. Please transfer stock from Main to Drawer first before dispensing.";
                        } else {
                            $msg .= " Please transfer stock to Drawer or restock first.";
                        }
                        $this->jsonResponse(['success' => false, 'message' => $msg], 400);
                    }
                }

                // Pass 1: Deduct from Drawer Inventory using FEFO / FIFO (unexpired only, earliest expiry first)
                foreach ($dispensedItems as $dItem) {
                    $itemId = (int)($dItem['item_id'] ?? 0);
                    $qty = (int)($dItem['quantity'] ?? 0);
                    if ($itemId <= 0 || $qty <= 0) continue;

                    $remQty = $qty;

                    $drawerStmt = $pdo->prepare("
                        SELECT id, stock_remaining, COALESCE(drawer_stock, 0) as drawer_stock, COALESCE(main_stock, 0) as main_stock 
                        FROM inventory_batches 
                        WHERE item_id = ? AND (clinic_branch = ? OR clinic_branch = ?) AND drawer_stock > 0 
                          AND (expired_on >= CURDATE() OR expired_on IS NULL)
                        ORDER BY expired_on ASC, date_arrived ASC
                    ");
                    $drawerStmt->execute([$itemId, $branch, $branchAlt]);
                    $drawerBatches = $drawerStmt->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($drawerBatches as $batch) {
                        if ($remQty <= 0) break;
                        $curDrawer = (int)$batch['drawer_stock'];
                        $curMain = (int)$batch['main_stock'];
                        $deduct = min($curDrawer, $remQty);

                        $newDrawer = $curDrawer - $deduct;
                        $newStock = $newDrawer + $curMain;

                        $uStmt = $pdo->prepare("UPDATE inventory_batches SET drawer_stock = ?, stock_remaining = ?, status = IF(?=0, 'depleted', 'active') WHERE id = ?");
                        $uStmt->execute([$newDrawer, $newStock, $newStock, $batch['id']]);

                        $lStmt = $pdo->prepare("
                            INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, source_location, disposed_to, profile_id, processed_by) 
                            VALUES (?, 'dispense', ?, 'drawer', ?, ?, ?)
                        ");
                        $lStmt->execute([$batch['id'], -$deduct, $disposedTo, $profileId, $_SESSION['cjc_user']['id']]);

                        $remQty -= $deduct;
                    }

                    if ($remQty > 0) {
                        $pdo->rollBack();
                        $this->jsonResponse(['success' => false, 'message' => "Drawer stock depleted during dispense transaction. Please transfer stock from Main to Drawer first."], 400);
                    }
                }
            }

            // Update prescriptions JSON
            if (!empty($dispensedItems)) {
                $existingArr = json_decode($currentPrescriptions ?: '[]', true) ?: [];
                $merged = array_merge($existingArr, $dispensedItems);
                $prescriptionsJson = json_encode($merged);
            } else {
                $prescriptionsJson = $currentPrescriptions;
            }

            // Update consultation record
            $stmt = $pdo->prepare("UPDATE consultations 
                                   SET blood_pressure = :bp, 
                                       temperature = :temp, 
                                       weight = :weight, 
                                       diagnosis = :diag, 
                                       treatment = :treatment,
                                       prescriptions = :prescriptions 
                                   WHERE id = :id");
            $stmt->execute([
                'bp' => $bp,
                'temp' => $temp,
                'weight' => $weight,
                'diag' => $diagnosis,
                'treatment' => $treatment,
                'prescriptions' => $prescriptionsJson,
                'id' => $id
            ]);

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'message' => 'Notes saved successfully.']);
        } catch (Exception $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[CJC-CLINIC] Save notes error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to save notes: ' . $e->getMessage()], 500);
        }
    }

    public function checkoutAll() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        
        $pdo = cjcDatabaseConnection();
        $currentUser = cjcAuthUser();
        $branch = $currentUser['clinic_branch'] ?? 'College Clinic';
        $userRole = $currentUser['role'] ?? 'Staff';

        try {
            if ($userRole === 'Superadmin' && isset($_POST['branch']) && $_POST['branch'] === 'All Branches') {
                $stmt = $pdo->prepare("UPDATE consultations SET time_out = CURRENT_TIMESTAMP, status = 'completed' WHERE status IN ('active', 'waiting', 'in-progress') AND DATE(created_at) = CURDATE()");
                $stmt->execute();
            } else {
                if ($branch === 'Basic Education Clinic' || $branch === 'BED Clinic') {
                    $stmt = $pdo->prepare("UPDATE consultations SET time_out = CURRENT_TIMESTAMP, status = 'completed' WHERE status IN ('active', 'waiting', 'in-progress') AND DATE(created_at) = CURDATE() AND clinic_branch IN ('Basic Education Clinic', 'BED Clinic')");
                    $stmt->execute();
                } else {
                    $stmt = $pdo->prepare("UPDATE consultations SET time_out = CURRENT_TIMESTAMP, status = 'completed' WHERE status IN ('active', 'waiting', 'in-progress') AND DATE(created_at) = CURDATE() AND clinic_branch = :branch");
                    $stmt->execute(['branch' => $branch]);
                }
            }

            // Auto-complete any linked appointments
            try {
                $pdo->exec("
                    UPDATE appointments a
                    JOIN consultations c ON c.appointment_id = a.id
                    SET a.status = 'Completed'
                    WHERE c.status = 'completed' AND a.status = 'In Consultation'
                ");
            } catch (Exception $e) {}

            $this->jsonResponse(['success' => true, 'message' => "All active visitors for $branch today have been timed out."]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Checkout All error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to checkout all.'], 500);
        }
    }

    public function analyzeVitals() {
        cjcRequireAuth();

        $rawBp = trim($_GET['bp'] ?? $_POST['bp'] ?? '');
        $rawTemp = (float)($_GET['temp'] ?? $_POST['temp'] ?? 0);
        $rawPulse = (int)($_GET['pulse'] ?? $_POST['pulse'] ?? 0);

        $alerts = [];
        $suggestedDiagnosis = [];
        $suggestedTreatment = [];
        $statusSeverity = 'normal';

        // 1. Blood Pressure Analysis
        if (!empty($rawBp)) {
            $parts = explode('/', $rawBp);
            if (count($parts) === 2) {
                $sys = (int)trim($parts[0]);
                $dia = (int)trim($parts[1]);

                if ($sys > 0 && $dia > 0) {
                    if ($sys >= 180 || $dia >= 120) {
                        $statusSeverity = 'critical';
                        $alerts[] = ['type' => 'critical', 'message' => "CRITICAL: Hypertensive Crisis ($sys/$dia mmHg)"];
                        $suggestedDiagnosis[] = 'Hypertensive Crisis / Severe Elevated BP';
                        $suggestedTreatment[] = 'Immediate medical evaluation required. Administered prescribed antihypertensive if available, advised strict rest & urgent transfer.';
                    } elseif ($sys >= 140 || $dia >= 90) {
                        if ($statusSeverity !== 'critical') $statusSeverity = 'warning';
                        $alerts[] = ['type' => 'warning', 'message' => "Stage 2 Hypertension ($sys/$dia mmHg)"];
                        $suggestedDiagnosis[] = 'Hypertension (Stage 2)';
                        $suggestedTreatment[] = 'Advised 15-minute rest, re-check BP. Avoid caffeine/stress. Prescribed/recommended medical consultation & BP monitoring log.';
                    } elseif (($sys >= 130 && $sys <= 139) || ($dia >= 80 && $dia <= 89)) {
                        if ($statusSeverity === 'normal') $statusSeverity = 'warning';
                        $alerts[] = ['type' => 'warning', 'message' => "Stage 1 Hypertension ($sys/$dia mmHg)"];
                        $suggestedDiagnosis[] = 'Hypertension (Stage 1) / Elevated BP';
                        $suggestedTreatment[] = 'Advised rest, deep breathing exercises, hydration, and daily BP log monitoring.';
                    } elseif ($sys < 90 || $dia < 60) {
                        if ($statusSeverity === 'normal') $statusSeverity = 'warning';
                        $alerts[] = ['type' => 'warning', 'message' => "Hypotension / Low Blood Pressure ($sys/$dia mmHg)"];
                        $suggestedDiagnosis[] = 'Hypotension (Low BP)';
                        $suggestedTreatment[] = 'Advised oral rehydration solution / water, elevated legs position, & rest until stable.';
                    }
                }
            }
        }

        // 2. Temperature Analysis (°C)
        if ($rawTemp > 0) {
            if ($rawTemp >= 38.5) {
                if ($statusSeverity !== 'critical') $statusSeverity = 'warning';
                $alerts[] = ['type' => 'warning', 'message' => "High Fever / Febrile ($rawTemp °C)"];
                $suggestedDiagnosis[] = 'Febrile Illness / High Fever';
                $suggestedTreatment[] = 'Administered Paracetamol 500mg (1 tab PO). Encouraged tepid sponge bath (TSB) & oral fluid intake.';
            } elseif ($rawTemp >= 37.6 && $rawTemp <= 38.4) {
                if ($statusSeverity === 'normal') $statusSeverity = 'info';
                $alerts[] = ['type' => 'info', 'message' => "Low-Grade Fever ($rawTemp °C)"];
                $suggestedDiagnosis[] = 'Low-Grade Fever';
                $suggestedTreatment[] = 'Advised increased fluid intake, rest, & Paracetamol 500mg if fever persists > 38.0°C.';
            } elseif ($rawTemp < 35.5) {
                if ($statusSeverity === 'normal') $statusSeverity = 'warning';
                $alerts[] = ['type' => 'warning', 'message' => "Hypothermia / Low Body Temp ($rawTemp °C)"];
                $suggestedDiagnosis[] = 'Hypothermia / Low Temperature';
                $suggestedTreatment[] = 'Provided warm blanket, warm fluid intake, & monitored vital signs.';
            }
        }

        // 3. Pulse Rate Analysis (bpm)
        if ($rawPulse > 0) {
            if ($rawPulse > 100) {
                $alerts[] = ['type' => 'info', 'message' => "Tachycardia / High Heart Rate ($rawPulse bpm)"];
                $suggestedDiagnosis[] = 'Tachycardia / Elevated Pulse';
            } elseif ($rawPulse < 60) {
                $alerts[] = ['type' => 'info', 'message' => "Bradycardia / Low Heart Rate ($rawPulse bpm)"];
                $suggestedDiagnosis[] = 'Bradycardia / Low Pulse';
            }
        }

        $this->jsonResponse([
            'success' => true,
            'severity' => $statusSeverity,
            'alerts' => $alerts,
            'suggested_diagnosis' => array_values(array_unique($suggestedDiagnosis)),
            'suggested_treatment' => array_values(array_unique($suggestedTreatment))
        ]);
    }

    /**
     * Automatically roll-over and clean up leftover unclosed consultations from previous days
     */
    private function autoRollOverPastConsultations(PDO $pdo): void {
        try {
            // 1. Past 'waiting' or 'pending' items auto-transition to 'no-show'
            $pdo->exec("
                UPDATE consultations 
                SET status = 'no-show', 
                    time_out = COALESCE(time_out, created_at)
                WHERE status IN ('waiting', 'pending') 
                  AND DATE(created_at) < CURDATE()
            ");

            // 2. Past 'in-progress' or 'active' items with notes auto-complete; without notes auto-transition to 'no-show'
            $pdo->exec("
                UPDATE consultations 
                SET status = CASE 
                        WHEN (diagnosis IS NOT NULL AND diagnosis != '') OR (treatment IS NOT NULL AND treatment != '') THEN 'completed' 
                        ELSE 'no-show' 
                    END,
                    time_out = COALESCE(time_out, created_at)
                WHERE status IN ('active', 'in-progress') 
                  AND DATE(created_at) < CURDATE()
            ");
        } catch (Exception $e) {
            error_log('[CJC-CLINIC] auto roll-over consultations error: ' . $e->getMessage());
        }
    }

    /**
     * Manual bulk resolution for leftover consultations from past days
     */
    public function resolvePastLeftovers() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
        $branch = $this->getUserBranch();
        $currentUser = cjcCurrentUser();
        $userRole = $currentUser['role'] ?? 'Staff';

        $branchSql = "";
        $params = [];
        if ($userRole !== 'Superadmin') {
            if ($branch === 'Basic Education Clinic' || $branch === 'BED Clinic') {
                $branchSql = "AND clinic_branch IN ('Basic Education Clinic', 'BED Clinic')";
            } else {
                $branchSql = "AND clinic_branch = :branch";
                $params['branch'] = $branch;
            }
        }

        try {
            $stmt = $pdo->prepare("
                UPDATE consultations 
                SET status = CASE 
                        WHEN (diagnosis IS NOT NULL AND diagnosis != '') OR (treatment IS NOT NULL AND treatment != '') THEN 'completed' 
                        ELSE 'no-show' 
                    END,
                    time_out = COALESCE(time_out, created_at)
                WHERE status IN ('waiting', 'pending', 'active', 'in-progress') 
                  AND DATE(created_at) < CURDATE()
                  $branchSql
            ");
            $stmt->execute($params);
            $affected = $stmt->rowCount();

            $this->jsonResponse([
                'success' => true, 
                'message' => "Successfully resolved $affected unclosed consultation(s) from previous days.",
                'resolved_count' => $affected
            ]);
        } catch (PDOException $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Failed to resolve past consultations.'], 500);
        }
    }
}
