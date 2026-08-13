<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class ConsultationController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
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
            $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
            $whereClause .= " AND c.clinic_branch = :branch";
            $params['branch'] = $branch;
        } else {
            if ($requestBranch !== 'All Branches') {
                $whereClause .= " AND c.clinic_branch = :branch";
                $params['branch'] = $requestBranch;
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

        try {
            $countSql = "SELECT COUNT(*) FROM consultations c WHERE $whereClause";
            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();
            
            $totalPages = ceil($total / $perPage);
            if ($totalPages < 1) $totalPages = 1;

            $sql = "SELECT c.id,
                           c.profile_id,
                           c.clinic_branch,
                           p.patient_id_number,
                           COALESCE(CONCAT(p.first_name, ' ', p.last_name), 'Unknown') AS patient_name,
                           p.address,
                           c.created_at AS time_in,
                           c.purpose,
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
                    WHERE $whereClause
                    ORDER BY c.created_at DESC
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
        
        $profile_id    = (int)($input['profile_id'] ?? 0);
        $purpose       = trim($input['purpose'] ?? '');
        
        if (!$profile_id || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'Profile ID and purpose are required.'], 400);
        }
        
        // Ensure patient exists
        try {
            $stmt = $pdo->prepare('SELECT id FROM profiles WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $profile_id]);
            if (!$stmt->fetch()) {
                $this->jsonResponse(['success' => false, 'message' => 'Patient profile not found.'], 404);
            }
        } catch (PDOException $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Database error.'], 500);
        }
            
        $currentUser = cjcCurrentUser();
        $attended_by = $currentUser['name'] ?? 'Clinic Staff';
        $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO consultations (profile_id, purpose, status, attended_by, clinic_branch)
                 VALUES (:profile_id, :purpose, :status, :attended_by, :clinic_branch)'
            );
            $stmt->execute([
                'profile_id'    => $profile_id,
                'purpose'       => $purpose,
                'status'        => 'waiting',
                'attended_by'   => $attended_by,
                'clinic_branch' => $branch
            ]);

            $newId = $pdo->lastInsertId();

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
            } elseif ($action === 'start') {
                $stmt = $pdo->prepare("UPDATE consultations SET status = 'in-progress' WHERE id = :id");
                $stmt->execute(['id' => $id]);
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

        $prescriptionsJson = !empty($dispensedItems) ? json_encode($dispensedItems) : null;

        try {
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

            // Handle Inventory Dispensing
            $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
            if (!empty($dispensedItems)) {
                // Get patient name for disposed_to
                $pStmt = $pdo->prepare("SELECT p.id, p.first_name, p.last_name FROM profiles p JOIN consultations c ON p.id = c.profile_id WHERE c.id = ?");
                $pStmt->execute([$id]);
                $patient = $pStmt->fetch();
                $disposedTo = $patient ? ($patient['first_name'] . ' ' . $patient['last_name']) : 'Patient';
                $profileId = $patient ? $patient['id'] : null;

                foreach ($dispensedItems as $dItem) {
                    $itemId = (int)$dItem['item_id'];
                    $qty = (int)$dItem['quantity'];
                    if ($itemId <= 0 || $qty <= 0) continue;

                    // FEFO Logic
                    $bStmt = $pdo->prepare("
                        SELECT id, stock_remaining FROM inventory_batches 
                        WHERE item_id = ? AND clinic_branch = ? AND stock_remaining > 0 
                          AND (expired_on >= CURDATE() OR expired_on IS NULL)
                        ORDER BY expired_on ASC, date_arrived ASC
                    ");
                    $bStmt->execute([$itemId, $branch]);
                    $batches = $bStmt->fetchAll();

                    $remQty = $qty;
                    foreach ($batches as $batch) {
                        if ($remQty <= 0) break;
                        $available = (int)$batch['stock_remaining'];
                        $consumed = min($available, $remQty);
                        $newStock = $available - $consumed;

                        $uStmt = $pdo->prepare("UPDATE inventory_batches SET stock_remaining = ?, status = IF(?=0, 'depleted', 'active') WHERE id = ?");
                        $uStmt->execute([$newStock, $newStock, $batch['id']]);

                        $lStmt = $pdo->prepare("INSERT INTO inventory_logs (batch_id, action_type, quantity_changed, disposed_to, profile_id, processed_by) VALUES (?, 'dispense', ?, ?, ?, ?)");
                        $lStmt->execute([$batch['id'], -$consumed, $disposedTo, $profileId, $_SESSION['cjc_user']['id']]);

                        $remQty -= $consumed;
                    }
                }
            }

            $this->jsonResponse(['success' => true, 'message' => 'Notes saved successfully.']);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Save notes error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to save notes.'], 500);
        }
    }

    public function checkoutAll() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        
        $pdo = cjcDatabaseConnection();

        try {
            $stmt = $pdo->prepare("UPDATE consultations SET time_out = CURRENT_TIMESTAMP, status = 'completed' WHERE status IN ('active', 'waiting', 'in-progress') AND DATE(created_at) = CURDATE()");
            $stmt->execute();

            $this->jsonResponse(['success' => true, 'message' => 'All active visitors today have been timed out.']);
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

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
