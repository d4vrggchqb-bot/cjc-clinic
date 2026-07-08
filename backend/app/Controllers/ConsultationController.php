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

        try {
            $stmt = $pdo->query(
                "SELECT c.id,
                        c.status,
                        c.created_at,
                        c.notes,
                        c.prescriptions,
                        COALESCE(p.name, CONCAT('Patient #', c.profile_id)) AS patient_name,
                        COALESCE(c.complaint, 'General consultation') AS complaint,
                        COALESCE(c.assigned_to, 'Clinic Staff') AS assigned_to
                 FROM consultations c
                 LEFT JOIN profiles p ON p.id = c.profile_id
                 WHERE c.status IN ('active', 'in-progress', 'waiting', 'pending')
                 ORDER BY c.created_at DESC
                 LIMIT 20"
            );
            if ($stmt) {
                $sessions = $stmt->fetchAll();
                
                $currentUser = cjcCurrentUser();
                $isClinical = in_array($currentUser['role'], ['Doctor', 'Nurse'], true);
                
                foreach ($sessions as &$session) {
                    if ($session['notes']) {
                        if ($isClinical) {
                            $decrypted = cjcDecrypt($session['notes']);
                            $session['notes'] = $decrypted !== null ? $decrypted : $session['notes'];
                        } else {
                            $session['notes'] = '[REDACTED: Clinical Notes Protected]';
                        }
                    }
                    
                    if ($session['prescriptions']) {
                        $decoded = json_decode($session['prescriptions'], true);
                        $session['prescriptions'] = json_last_error() === JSON_ERROR_NONE ? $decoded : [];
                    } else {
                        $session['prescriptions'] = [];
                    }
                    
                    if (empty($session['complaint']) && !empty($session['notes']) && $isClinical) {
                        $session['complaint'] = substr($session['notes'], 0, 50) . '...';
                    }
                }
                unset($session);
            }
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] consultations API error: ' . $e->getMessage());
        }

        $this->jsonResponse(['sessions' => $sessions]);
    }

    public function create() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Doctor', 'Nurse']);
        
        $pdo = cjcDatabaseConnection();
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        
        $profile_id    = (int)($input['profile_id'] ?? 0);
        $complaint     = trim($input['complaint'] ?? '');
        $notes         = trim($input['notes'] ?? '');
        $prescriptions = $input['prescriptions'] ?? [];
        
        if (!$profile_id || !$complaint) {
            $this->jsonResponse(['success' => false, 'message' => 'Profile ID and complaint are required.'], 400);
        }
        
        try {
            $stmt = $pdo->prepare('SELECT id FROM profiles WHERE id = :id LIMIT 1');
            $stmt->execute(['id' => $profile_id]);
            if (!$stmt->fetch()) {
                $this->jsonResponse(['success' => false, 'message' => 'Patient profile not found.'], 404);
            }
        } catch (PDOException $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Database error.'], 500);
        }
        
        $encryptedNotes = $notes !== '' ? cjcEncrypt($notes) : '';
        $prescriptionsJson = is_array($prescriptions) && !empty($prescriptions) 
            ? json_encode($prescriptions) 
            : null;
            
        $currentUser = cjcCurrentUser();
        $assigned_to = $currentUser['name'] ?? 'Clinic Staff';

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO consultations (profile_id, complaint, notes, prescriptions, status, assigned_to)
                 VALUES (:profile_id, :complaint, :notes, :prescriptions, :status, :assigned_to)'
            );
            $stmt->execute([
                'profile_id'    => $profile_id,
                'complaint'     => $complaint,
                'notes'         => $encryptedNotes,
                'prescriptions' => $prescriptionsJson,
                'status'        => 'in-progress',
                'assigned_to'   => $assigned_to
            ]);
            
            $this->jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] Create consultation error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to save consultation record.'], 500);
        }
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
