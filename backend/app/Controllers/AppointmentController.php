<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class AppointmentController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->jsonResponse(['error' => 'Method not allowed'], 405);
        
        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $userRole = $_SESSION['cjc_user']['role'] ?? 'Staff';
        $branchFilter = "";
        $params = [];
        if (!in_array($userRole, ['Admin', 'Superadmin'])) {
            $branchFilter = " WHERE a.clinic_branch = ? ";
            $params[] = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';
        }

        $stmt = $pdo->prepare("
            SELECT a.*, p.patient_id_number, p.first_name, p.last_name, p.profile_type, p.college_dept
            FROM appointments a
            JOIN profiles p ON a.profile_id = p.id
            $branchFilter
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        ");
        $stmt->execute($params);
        $this->jsonResponse(['appointments' => $stmt->fetchAll()]);
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
        $branch = $_SESSION['cjc_user']['clinic_branch'] ?? 'College Clinic';

        if (!$profile_id || !$date || !$time || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'All fields are required.'], 400);
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO appointments (profile_id, appointment_date, appointment_time, purpose, clinic_branch) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$profile_id, $date, $time, $purpose, $branch]);
            $this->jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
        } catch (Exception $e) {
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
        $group_name = trim($input['group_name'] ?? '');
        $branch = 'College Clinic'; 

        if (empty($profile_ids) || !is_array($profile_ids) || !$date || !$time || !$purpose) {
            $this->jsonResponse(['success' => false, 'message' => 'Missing required fields.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $stmt = $pdo->prepare("INSERT INTO appointments (profile_id, appointment_date, appointment_time, purpose, clinic_branch, group_name) VALUES (?, ?, ?, ?, ?, ?)");
            
            $insertedCount = 0;
            foreach ($profile_ids as $pid) {
                if ($pid > 0) {
                    $stmt->execute([$pid, $date, $time, $purpose, $branch, $group_name ?: null]);
                    $insertedCount++;
                }
            }
            $pdo->commit();
            $this->jsonResponse(['success' => true, 'count' => $insertedCount]);
        } catch (Exception $e) {
            $pdo->rollBack();
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

        if (!$id || !$status) {
            $this->jsonResponse(['success' => false, 'message' => 'ID and Status required.'], 400);
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

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
