<?php
require_once __DIR__ . '/BaseController.php';

class AppointmentController extends BaseController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branchFilter = "";
        $params = [];
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branchFilter = " WHERE a.clinic_branch = ? ";
            $params[] = $this->getUserBranch();
        }

        // Auto-update past-due scheduled appointments to No-Show
        try {
            $pdo->exec("
                UPDATE appointments 
                SET status = 'No-Show' 
                WHERE status = 'Scheduled' 
                  AND (appointment_date < CURDATE() OR (appointment_date = CURDATE() AND appointment_time < CURTIME()))
            ");
        } catch (Exception $e) {
            error_log('[CJC-CLINIC] auto-update No-Show error: ' . $e->getMessage());
        }

        try {
            $stmt = $pdo->prepare("
                SELECT a.*, 
                       COALESCE(a.appointment_code, CONCAT('APT-', YEAR(a.appointment_date), '-', LPAD(a.id, 5, '0'))) as appointment_code,
                       p.patient_id_number, p.first_name, p.last_name, p.profile_type, p.college_dept, p.course, p.year_level
                FROM appointments a
                JOIN profiles p ON a.profile_id = p.id
                $branchFilter
                ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC
            ");
            $stmt->execute($params);
            $this->jsonResponse(['appointments' => $stmt->fetchAll()]);
        } catch (PDOException $e) {
            try {
                $pdo->exec("ALTER TABLE appointments ADD COLUMN appointment_code VARCHAR(50) DEFAULT NULL AFTER id;");
                $stmt = $pdo->prepare("
                    SELECT a.*, 
                           COALESCE(a.appointment_code, CONCAT('APT-', YEAR(a.appointment_date), '-', LPAD(a.id, 5, '0'))) as appointment_code,
                           p.patient_id_number, p.first_name, p.last_name, p.profile_type, p.college_dept, p.course, p.year_level
                    FROM appointments a
                    JOIN profiles p ON a.profile_id = p.id
                    $branchFilter
                    ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC
                ");
                $stmt->execute($params);
                $this->jsonResponse(['appointments' => $stmt->fetchAll()]);
            } catch (Exception $ex) {
                error_log('[CJC-CLINIC] appointments list error: ' . $e->getMessage());
                $this->jsonResponse(['appointments' => [], 'error' => $e->getMessage()]);
            }
        }
    }

    private function generateDynamicPrefix($purpose, $groupName = null) {
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
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $profile_id = (int)($input['profile_id'] ?? 0);
        $date = trim($input['appointment_date'] ?? '');
        $time = trim($input['appointment_time'] ?? '');
        $purpose = trim($input['purpose'] ?? '');
        if (mb_strlen($purpose) > 255) {
            $purpose = mb_substr($purpose, 0, 255);
        }
        $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';

        if (!$profile_id || !$date || !$time || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'All fields are required.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO appointments (profile_id, appointment_date, appointment_time, purpose, clinic_branch) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$profile_id, $date, $time, $purpose, $branch]);
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
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => 'Failed to create appointment.'], 500);
        }
    }

    public function bulkCreate() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth(); cjcCsrfValidate();
        $pdo = cjcDatabaseConnection();
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
            $stmt = $pdo->prepare("INSERT INTO appointments (profile_id, appointment_date, appointment_time, purpose, clinic_branch, group_name) VALUES (?, ?, ?, ?, ?, ?)");
            $upd = $pdo->prepare("UPDATE appointments SET appointment_code = ? WHERE id = ?");
            
            $year = date('Y', strtotime($date)) ?: date('Y');
            $prefix = $this->generateDynamicPrefix($purpose, $group_name);
            $insertedCount = 0;
            $createdCodes = [];

            foreach ($profile_ids as $pid) {
                if ($pid > 0) {
                    $stmt->execute([$pid, $date, $time, $purpose, $branch, $group_name ?: null]);
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
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $this->jsonResponse(['success' => false, 'message' => 'Failed to create appointments.'], 500);
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

        $allowedStatuses = ['Scheduled', 'Completed', 'Cancelled', 'No-Show'];
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
}
