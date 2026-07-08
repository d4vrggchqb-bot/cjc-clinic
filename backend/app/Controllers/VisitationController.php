<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class VisitationController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $perPage = max(1, min(50, (int)($_GET['per_page'] ?? 20)));
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $offset  = ($page - 1) * $perPage;
        $search  = trim($_GET['search'] ?? '');

        $conditions = [];
        $params     = [];
        if ($search !== '') {
            $conditions[]      = "(p.name LIKE :search OR c.complaint LIKE :search OR c.notes LIKE :search)";
            $params['search']  = '%' . $search . '%';
        }
        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $totalCount = 0;
        try {
            $countSql  = "SELECT COUNT(*) FROM consultations c LEFT JOIN profiles p ON p.id = c.profile_id $where";
            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);
            $totalCount = (int)$countStmt->fetchColumn();
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] visitation count error: ' . $e->getMessage());
        }

        $visits = [];
        try {
            $sql = "SELECT c.id,
                           c.status,
                           c.created_at,
                           COALESCE(p.name, CONCAT('Patient #', c.profile_id)) AS patient_name,
                           COALESCE(c.complaint, c.notes, 'General consultation') AS complaint,
                           COALESCE(c.assigned_to, 'Clinic Staff') AS assigned_to,
                           COALESCE(p.program_department, '') AS department
                    FROM consultations c
                    LEFT JOIN profiles p ON p.id = c.profile_id
                    $where
                    ORDER BY c.created_at DESC
                    LIMIT :limit OFFSET :offset";
            $stmt = $pdo->prepare($sql);
            $stmt->bindValue(':limit',  $perPage, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset,  PDO::PARAM_INT);
            foreach ($params as $key => $value) {
                $stmt->bindValue(':' . $key, $value);
            }
            $stmt->execute();
            $visits = $stmt->fetchAll();
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] visitation records error: ' . $e->getMessage());
        }

        $this->jsonResponse([
            'visits'     => $visits,
            'pagination' => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total_count' => $totalCount,
                'total_pages' => $totalCount > 0 ? (int)ceil($totalCount / $perPage) : 1,
            ],
        ]);
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
