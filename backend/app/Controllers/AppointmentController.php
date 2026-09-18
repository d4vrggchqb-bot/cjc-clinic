<?php
require_once __DIR__ . '/BaseController.php';

class AppointmentController extends BaseController {

    protected function ensureSchema($pdo) {
        try {
            $column = $pdo->query("SHOW COLUMNS FROM appointments LIKE 'created_by'")->fetch();
            if (!$column) {
                $pdo->exec("ALTER TABLE appointments ADD COLUMN created_by INT NULL AFTER clinic_branch");
            }
            $codeCol = $pdo->query("SHOW COLUMNS FROM appointments LIKE 'appointment_code'")->fetch();
            if (!$codeCol) {
                $pdo->exec("ALTER TABLE appointments ADD COLUMN appointment_code VARCHAR(50) DEFAULT NULL AFTER id;");
            }
            $aptCol = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'appointment_id'")->fetch();
            if (!$aptCol) {
                $pdo->exec("ALTER TABLE consultations ADD COLUMN appointment_id INT NULL AFTER profile_id");
                $pdo->exec("ALTER TABLE consultations ADD CONSTRAINT fk_consultations_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL");
            }
            $pdo->exec("ALTER TABLE appointments MODIFY COLUMN status ENUM('Scheduled', 'In Consultation', 'Completed', 'Cancelled', 'No-Show') DEFAULT 'Scheduled'");
        } catch (Exception $e) {
            error_log('[CJC-CLINIC] ensureSchema error: ' . $e->getMessage());
        }
    }

    protected function ensureCreatorColumn($pdo) {
        $this->ensureSchema($pdo);
    }

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branchFilter = "";
        $params = [];
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branchFilter = " WHERE a.clinic_branch = ? ";
            $params[] = $this->getUserBranch();
        }

        // 1. Only auto-update past-due scheduled appointments from PREVIOUS days to No-Show.
        // Today's appointments remain open throughout the operating day so early or late arrivals can be catered.
        try {
            $pdo->exec("
                UPDATE appointments 
                SET status = 'No-Show' 
                WHERE status = 'Scheduled' 
                  AND appointment_date < CURDATE()
            ");
        } catch (Exception $e) {
            error_log('[CJC-CLINIC] auto-update No-Show error: ' . $e->getMessage());
        }

        // 2. Self-heal: If today's appointment was previously prematurely marked 'No-Show' without any consultation, restore to 'Scheduled'
        try {
            $pdo->exec("
                UPDATE appointments a
                LEFT JOIN consultations c ON c.appointment_id = a.id
                SET a.status = 'Scheduled'
                WHERE a.status = 'No-Show'
                  AND a.appointment_date = CURDATE()
                  AND c.id IS NULL
            ");
        } catch (Exception $e) {}

        try {
            $stmt = $pdo->prepare("
                SELECT a.*, 
                       COALESCE(a.appointment_code, CONCAT('APT-', YEAR(a.appointment_date), '-', LPAD(a.id, 5, '0'))) as appointment_code,
                       p.patient_id_number, p.first_name, p.last_name, p.profile_type, p.college_dept, p.course, p.year_level,
                       c.id AS consultation_id, c.status AS consultation_status, c.created_at AS time_in, c.time_out
                FROM appointments a
                JOIN profiles p ON a.profile_id = p.id
                LEFT JOIN consultations c ON c.appointment_id = a.id
                $branchFilter
                ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC
            ");
            $stmt->execute($params);
            $this->jsonResponse(['appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] appointments list error: ' . $e->getMessage());
            $this->jsonResponse(['appointments' => [], 'error' => $e->getMessage()]);
        }
    }

    protected function generateDynamicPrefix($purpose, $groupName = null) {
        if (!empty($groupName)) {
            return 'GRP';
        }

        $purpose = trim($purpose);
        if (empty($purpose)) {
            return 'APT';
        }

        $pdo = cjcDatabaseConnection();
        $prefix = null;
        try {
            $stmt = $pdo->prepare("SELECT setting_value FROM settings WHERE setting_key = 'cues_meta' OR setting_key = 'cues' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row) {
                $cues = json_decode($row['setting_value'], true);
                if (is_array($cues)) {
                    foreach ($cues as $c) {
                        if (is_array($c) && isset($c['name']) && strtolower(trim($c['name'])) === strtolower($purpose) && !empty($c['prefix'])) {
                            $prefix = strtoupper(trim($c['prefix']));
                            break;
                        }
                    }
                }
            }
        } catch (Exception $e) {}

        if (!empty($prefix)) {
            return preg_replace('/[^A-Z0-9]/', '', $prefix);
        }

        // Auto-generate acronym/prefix from the purpose string (e.g. "Medical Clearance" -> MED, "Headache" -> HEA)
        $words = preg_split('/\s+/', $purpose);
        if (count($words) >= 2) {
            $acronym = '';
            foreach ($words as $w) {
                $wClean = preg_replace('/[^A-Za-z0-9]/', '', $w);
                if (!empty($wClean)) {
                    $acronym .= strtoupper($wClean[0]);
                }
            }
            if (strlen($acronym) >= 2 && strlen($acronym) <= 4) {
                return $acronym;
            }
        }

        $clean = preg_replace('/[^A-Za-z0-9]/', '', $purpose);
        $clean = strtoupper($clean);
        if (strlen($clean) >= 3) {
            return substr($clean, 0, 3);
        } elseif (strlen($clean) > 0) {
            return str_pad($clean, 3, 'X');
        }

        return 'APT';
    }

    public function create() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        
        cjcRequireAuth(); cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $profile_id = (int)($input['profile_id'] ?? 0);
        $date = trim($input['appointment_date'] ?? '');
        $time = trim($input['appointment_time'] ?? '');
        $purpose = trim($input['purpose'] ?? '');
        if (mb_strlen($purpose) > 255) {
            $purpose = mb_substr($purpose, 0, 255);
        }
        $currentUser = cjcCurrentUser();
        $branch = $currentUser['clinic_branch'] ?? 'College Clinic';
        $created_by = $currentUser['id'] ?? null;

        if (!$profile_id || !$date || !$time || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'All fields are required.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO appointments (profile_id, appointment_date, appointment_time, purpose, clinic_branch, created_by) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$profile_id, $date, $time, $purpose, $branch, $created_by]);
            $id = $pdo->lastInsertId();

            $year = date('Y', strtotime($date)) ?: date('Y');
            $prefix = $this->generateDynamicPrefix($purpose);
            $code = sprintf('%s-%s-%05d', $prefix, $year, $id);

            try {
                $upd = $pdo->prepare("UPDATE appointments SET appointment_code = ? WHERE id = ?");
                $upd->execute([$code, $id]);
            } catch (Exception $e) {}

            $pdo->commit();
            $this->jsonResponse(['success' => true, 'id' => $id, 'appointment_code' => $code]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('[CJC-CLINIC] create appointment error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Failed to create appointment: ' . $e->getMessage()], 500);
        }
    }

    public function bulkCreate() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth(); cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $profile_ids = $input['profile_ids'] ?? [];
        $date = trim($input['appointment_date'] ?? '');
        $time = trim($input['appointment_time'] ?? '');
        $purpose = trim($input['purpose'] ?? '');
        if (mb_strlen($purpose) > 255) {
            $purpose = mb_substr($purpose, 0, 255);
        }
        $group_name = trim($input['group_name'] ?? '');
        $currentUser = cjcAuthUser();
        $branch = trim($input['clinic_branch'] ?? ($currentUser['clinic_branch'] ?? 'College Clinic')); 

        if (empty($profile_ids) || !is_array($profile_ids) || !$date || !$time || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'Missing required fields.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO appointments (profile_id, appointment_date, appointment_time, purpose, clinic_branch, group_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $upd = $pdo->prepare("UPDATE appointments SET appointment_code = ? WHERE id = ?");
            
            $year = date('Y', strtotime($date)) ?: date('Y');
            $prefix = $this->generateDynamicPrefix($purpose, $group_name);
            $insertedCount = 0;
            $createdCodes = [];

            foreach ($profile_ids as $pid) {
                if ($pid > 0) {
                    $stmt->execute([$pid, $date, $time, $purpose, $branch, $group_name ?: null, $currentUser['id'] ?? null]);
                    $id = $pdo->lastInsertId();
                    $code = sprintf('%s-%s-%05d', $prefix, $year, $id);
                    try {
                        $upd->execute([$code, $id]);
                    } catch (Exception $e) {}
                    $createdCodes[] = $code;
                    $insertedCount++;
                }
            }
            $pdo->commit();
            $this->jsonResponse(['success' => true, 'count' => $insertedCount, 'codes' => $createdCodes]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('[CJC-CLINIC] bulkCreate appointment error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Failed to create appointments: ' . $e->getMessage()], 500);
        }
    }

    public function update() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth(); cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $id = (int)($input['id'] ?? 0);
        $status = trim($input['status'] ?? '');

        $allowedStatuses = ['Scheduled', 'In Consultation', 'Completed', 'Cancelled', 'No-Show'];
        if (!$id || !$status) {
            $this->jsonResponse(['success' => false, 'message' => 'ID and Status required.'], 400);
        }

        if (!in_array($status, $allowedStatuses, true)) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid appointment status.'], 400);
        }

        try {
            $stmt = $pdo->prepare("UPDATE appointments SET status = ? WHERE id = ?");
            $stmt->execute([$status, $id]);
            $this->jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Failed to update appointment.'], 500);
        }
    }

    public function updateDetails() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth(); cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $id = (int)($input['id'] ?? 0);
        $date = trim($input['appointment_date'] ?? '');
        $time = trim($input['appointment_time'] ?? '');
        $purpose = trim($input['purpose'] ?? '');
        if (mb_strlen($purpose) > 255) {
            $purpose = mb_substr($purpose, 0, 255);
        }

        if (!$id || !$date || !$time || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'ID, Date, Time, and Purpose required.'], 400);
        }

        try {
            $stmt = $pdo->prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ?, purpose = ? WHERE id = ?");
            $stmt->execute([$date, $time, $purpose, $id]);
            $this->jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Failed to update appointment details.'], 500);
        }
    }

    public function checkIn() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $id = (int)($input['id'] ?? ($input['appointment_id'] ?? 0));
        if ($id <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Valid appointment ID is required.'], 400);
        }

        try {
            $stmt = $pdo->prepare("
                SELECT a.*, p.first_name, p.last_name, p.patient_id_number 
                FROM appointments a 
                JOIN profiles p ON a.profile_id = p.id 
                WHERE a.id = ? 
                LIMIT 1
            ");
            $stmt->execute([$id]);
            $apt = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$apt) {
                $this->jsonResponse(['success' => false, 'message' => 'Appointment not found.'], 404);
            }

            $profile_id = (int)$apt['profile_id'];
            $patientName = trim($apt['first_name'] . ' ' . $apt['last_name']);
            $purpose = $apt['purpose'];
            $branch = $apt['clinic_branch'] ?: $this->getUserBranch();
            $currentUser = cjcCurrentUser();
            $attended_by = $currentUser['name'] ?? 'Clinic Staff';

            // 1. Check if an active consultation already exists for this appointment
            $cCheck = $pdo->prepare("SELECT id, status, created_at FROM consultations WHERE appointment_id = ? LIMIT 1");
            $cCheck->execute([$id]);
            $existingLinked = $cCheck->fetch(PDO::FETCH_ASSOC);

            if ($existingLinked) {
                $pdo->prepare("UPDATE appointments SET status = 'In Consultation' WHERE id = ?")->execute([$id]);
                $this->jsonResponse([
                    'success' => true,
                    'consultation_id' => $existingLinked['id'],
                    'message' => "{$patientName} is already checked in and in the Consultation Queue."
                ]);
                return;
            }

            // 2. Check if patient already has an active consultation today (e.g. from quick check-in)
            $pCheck = $pdo->prepare("
                SELECT id, status FROM consultations 
                WHERE profile_id = ? AND DATE(created_at) = CURDATE() AND status IN ('waiting', 'in-progress', 'active') 
                ORDER BY id DESC LIMIT 1
            ");
            $pCheck->execute([$profile_id]);
            $activeConsultation = $pCheck->fetch(PDO::FETCH_ASSOC);

            if ($activeConsultation) {
                $cId = (int)$activeConsultation['id'];
                $pdo->prepare("UPDATE consultations SET appointment_id = ? WHERE id = ?")->execute([$id, $cId]);
                $pdo->prepare("UPDATE appointments SET status = 'In Consultation' WHERE id = ?")->execute([$id]);

                cjcLogAudit("Linked appointment #{$id} to active consultation #{$cId} for {$patientName}");
                $this->jsonResponse([
                    'success' => true,
                    'consultation_id' => $cId,
                    'message' => "{$patientName} has an active visit today. Linked appointment to Consultation Queue!"
                ]);
                return;
            }

            // 3. Create new consultation entry in queue
            $cInsert = $pdo->prepare("
                INSERT INTO consultations (profile_id, appointment_id, purpose, status, attended_by, clinic_branch)
                VALUES (?, ?, ?, 'waiting', ?, ?)
            ");
            $cInsert->execute([$profile_id, $id, $purpose, $attended_by, $branch]);
            $newConsultationId = (int)$pdo->lastInsertId();

            // 4. Update appointment status to 'In Consultation'
            $uApt = $pdo->prepare("UPDATE appointments SET status = 'In Consultation' WHERE id = ?");
            $uApt->execute([$id]);

            cjcLogAudit("Admitted appointment #{$id} for {$patientName} into Consultation Queue (Consultation #{$newConsultationId})");

            $this->jsonResponse([
                'success' => true,
                'consultation_id' => $newConsultationId,
                'message' => "{$patientName} successfully admitted to the Consultation Queue!"
            ]);

        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Appointment checkIn error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Database error while admitting patient.'], 500);
        }
    }

    public function todayList() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();
        $this->ensureSchema($pdo);

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branchFilter = "";
        $params = [];
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branchFilter = " AND a.clinic_branch = ? ";
            $params[] = $this->getUserBranch();
        }

        try {
            $stmt = $pdo->prepare("
                SELECT a.*, 
                       COALESCE(a.appointment_code, CONCAT('APT-', YEAR(a.appointment_date), '-', LPAD(a.id, 5, '0'))) as appointment_code,
                       p.patient_id_number, p.first_name, p.last_name, p.profile_type, p.college_dept, p.course, p.year_level,
                       c.id AS consultation_id, c.status AS consultation_status, c.created_at AS time_in, c.time_out
                FROM appointments a
                JOIN profiles p ON a.profile_id = p.id
                LEFT JOIN consultations c ON c.appointment_id = a.id
                WHERE a.appointment_date = CURDATE()
                $branchFilter
                ORDER BY a.appointment_time ASC, a.id ASC
            ");
            $stmt->execute($params);
            $this->jsonResponse(['success' => true, 'appointments' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] todayList error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'appointments' => [], 'error' => $e->getMessage()]);
        }
    }
}
