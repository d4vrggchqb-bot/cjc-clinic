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

        try {
            $countSql = "SELECT COUNT(*) FROM consultations c WHERE $whereClause";
            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();
            
            $totalPages = ceil($total / $perPage);
            if ($totalPages < 1) $totalPages = 1;

            $sql = "SELECT c.id,
                           c.profile_id,
                           p.patient_id_number,
                           COALESCE(CONCAT(p.first_name, ' ', p.last_name), 'Unknown') AS patient_name,
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
            'total_pages' => $totalPages
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
            $sql = "SELECT id, created_at AS date, purpose, blood_pressure, temperature, weight, diagnosis, treatment, attended_by, status
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

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO consultations (profile_id, purpose, status, attended_by)
                 VALUES (:profile_id, :purpose, :status, :attended_by)'
            );
            $stmt->execute([
                'profile_id'    => $profile_id,
                'purpose'       => $purpose,
                'status'        => 'waiting',
                'attended_by'   => $attended_by
            ]);
            
            $this->jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
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

        try {
            $stmt = $pdo->prepare("UPDATE consultations 
                                   SET blood_pressure = :bp, 
                                       temperature = :temp, 
                                       weight = :weight, 
                                       diagnosis = :diag, 
                                       treatment = :treatment 
                                   WHERE id = :id");
            $stmt->execute([
                'bp' => $bp,
                'temp' => $temp,
                'weight' => $weight,
                'diag' => $diagnosis,
                'treatment' => $treatment,
                'id' => $id
            ]);

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

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
