<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class InventoryController {

    public function list() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        $pdo = cjcDatabaseConnection();

        $category = $_GET['category'] ?? 'all';
        $allowed  = ['medicine', 'supply', 'equipment'];
        $params   = [];

        $perPage = max(1, min(100, (int)($_GET['per_page'] ?? 25)));
        $page    = max(1, (int)($_GET['page'] ?? 1));
        $offset  = ($page - 1) * $perPage;
        $search  = trim($_GET['search'] ?? '');
        $sortDir = ($_GET['sort'] ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $conditions = [];
        if (in_array($category, $allowed, true)) {
            $conditions[]         = 'category = :category';
            $params['category']   = $category;
        }
        if ($search !== '') {
            $conditions[]         = '(brand_name LIKE :search OR generic_name LIKE :search)';
            $params['search']     = '%' . $search . '%';
        }
        $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

        try {
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM inventory $where");
            $countStmt->execute($params);
            $totalCount = (int)$countStmt->fetchColumn();
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] inventory count error: ' . $e->getMessage());
            $totalCount = 0;
        }

        $listSql  = "SELECT id, category, brand_name, generic_name, stock, expired_on, status
                     FROM inventory $where
                     ORDER BY stock $sortDir
                     LIMIT :limit OFFSET :offset";
        $listStmt = $pdo->prepare($listSql);
        $listStmt->bindValue(':limit',  $perPage, PDO::PARAM_INT);
        $listStmt->bindValue(':offset', $offset,  PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $listStmt->bindValue(':' . $key, $value);
        }
        $listStmt->execute();
        $items = $listStmt->fetchAll();

        foreach ($items as &$item) {
            if (!array_key_exists('batch_number', $item)) {
                $item['batch_number'] = 'LOT-' . str_pad((string)$item['id'], 6, '0', STR_PAD_LEFT);
            }
        }
        unset($item);

        $metrics = [
            'low_stock'           => 0,
            'expired'             => 0,
            'total_items'         => 0,
            'active_consultations'=> 0,
            'today_visits'        => 0,
            'medcert_count'       => 0,
        ];

        try {
            $metrics['total_items'] = $totalCount;

            $lowParams          = $params;
            $lowWhere           = $where ? $where . ' AND stock <= 10' : 'WHERE stock <= 10';
            $lowStmt            = $pdo->prepare("SELECT COUNT(*) FROM inventory $lowWhere");
            $lowStmt->execute($lowParams);
            $metrics['low_stock'] = (int)$lowStmt->fetchColumn();

            $expWhere           = $where ? $where . " AND expired_on IS NOT NULL AND expired_on < CURDATE()" : "WHERE expired_on IS NOT NULL AND expired_on < CURDATE()";
            $expStmt            = $pdo->prepare("SELECT COUNT(*) FROM inventory $expWhere");
            $expStmt->execute($params);
            $metrics['expired'] = (int)$expStmt->fetchColumn();

            $consultationStmt = $pdo->query("SELECT COUNT(*) FROM consultations WHERE status = 'active'");
            if ($consultationStmt) {
                $metrics['active_consultations'] = (int)$consultationStmt->fetchColumn();
            }

            $visitStmt = $pdo->prepare("SELECT COUNT(*) FROM consultations WHERE DATE(created_at) = CURDATE()");
            $visitStmt->execute();
            $metrics['today_visits'] = (int)$visitStmt->fetchColumn();

            $medcertStmt = $pdo->query('SELECT COUNT(*) FROM medcerts');
            if ($medcertStmt) {
                $metrics['medcert_count'] = (int)$medcertStmt->fetchColumn();
            }
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] inventory metrics error: ' . $e->getMessage());
        }

        $requests = [];
        try {
            $requestStmt = $pdo->query(
                'SELECT id, item_name, requested_date, transit_status, delivery_date, manifest_details
                 FROM purchase_requests ORDER BY requested_date DESC LIMIT 10'
            );
            if ($requestStmt) {
                $requests = $requestStmt->fetchAll();
            }
        } catch (PDOException $e) {
            error_log('[CJC-CLINIC] purchase_requests query error: ' . $e->getMessage());
        }

        $this->jsonResponse([
            'items'      => $items,
            'metrics'    => $metrics,
            'requests'   => $requests,
            'pagination' => [
                'page'        => $page,
                'per_page'    => $perPage,
                'total_count' => $totalCount,
                'total_pages' => $totalCount > 0 ? (int)ceil($totalCount / $perPage) : 1,
            ],
        ]);
    }

    public function dispense() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Doctor', 'Nurse', 'Clerk']);
        
        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $generic_name = trim($input['generic_name'] ?? '');
        $quantity     = (int)($input['quantity'] ?? 0);
        
        if (empty($generic_name) || $quantity <= 0) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid dispensing parameters.'], 400);
        }
        
        $pdo = cjcDatabaseConnection();
        try {
            $pdo->beginTransaction();
            
            $stmt = $pdo->prepare("
                SELECT id, stock, expired_on 
                FROM inventory 
                WHERE generic_name = :name AND stock > 0 AND (expired_on >= CURDATE() OR expired_on IS NULL)
                ORDER BY expired_on ASC, id ASC
            ");
            $stmt->execute(['name' => $generic_name]);
            $batches = $stmt->fetchAll();
            
            $remainingToDispense = $quantity;
            $consumedLog = [];
            
            foreach ($batches as $batch) {
                if ($remainingToDispense <= 0) break;
                
                $available = (int)$batch['stock'];
                $consumed = min($available, $remainingToDispense);
                
                $newStock = $available - $consumed;
                
                $updateStmt = $pdo->prepare("UPDATE inventory SET stock = :stock WHERE id = :id");
                $updateStmt->execute(['stock' => $newStock, 'id' => $batch['id']]);
                
                $remainingToDispense -= $consumed;
                $consumedLog[] = [
                    'batch_id' => $batch['id'],
                    'expired_on' => $batch['expired_on'],
                    'consumed' => $consumed,
                    'remaining_stock_in_batch' => $newStock
                ];
            }
            
            if ($remainingToDispense > 0) {
                $pdo->rollBack();
                $this->jsonResponse([
                    'success' => false, 
                    'message' => "Insufficient unexpired stock. Short by {$remainingToDispense} units."
                ], 400);
            }
            
            $pdo->commit();
            $this->jsonResponse([
                'success' => true,
                'message' => "Successfully dispensed {$quantity} units using FEFO logic.",
                'consumed_batches' => $consumedLog
            ]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            error_log('[CJC-CLINIC] FEFO Dispense error: ' . $e->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Database error during dispense operation.'], 500);
        }
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
