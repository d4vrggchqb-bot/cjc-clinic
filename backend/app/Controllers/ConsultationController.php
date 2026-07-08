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
            $sql = "SELECT c.id,
                           p.patient_id_number,
                           COALESCE(CONCAT(p.first_name, ' ', p.last_name), 'Unknown') AS patient_name,
                           c.created_at AS time_in,
                           c.purpose,
                           c.time_out,
                           c.attended_by,
                           c.status
                    FROM consultations c
                    LEFT JOIN profiles p ON p.id = c.profile_id
                    WHERE $whereClause
                    ORDER BY c.created_at DESC";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $sessions = $stmt->fetchAll();
            
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] consultations list API error: ' . $e->getMessage());
        }

        $this->jsonResponse(['sessions' => $sessions]);
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
                'status'        => 'active',
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
            }

            $this->jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Update consultation error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to update record.'], 500);
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
            $stmt = $pdo->prepare("UPDATE consultations SET time_out = CURRENT_TIMESTAMP, status = 'completed' WHERE status = 'active' AND DATE(created_at) = CURDATE()");
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
