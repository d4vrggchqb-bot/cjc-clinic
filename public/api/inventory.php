<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

header('Content-Type: application/json');
if (!isset($_SESSION['cjc_user'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$pdo = cjcDatabaseConnection();

$category = $_GET['category'] ?? 'all';
$allowed = ['medicine', 'supply', 'equipment'];
$where = '';
$params = [];
if (in_array($category, $allowed, true)) {
    $where = 'WHERE category = :category';
    $params['category'] = $category;
}

$stmt = $pdo->prepare("SELECT id, category, brand_name, generic_name, stock, expired_on, status FROM inventory $where ORDER BY stock ASC LIMIT 80");
$stmt->execute($params);
$items = $stmt->fetchAll();

$metrics = [
    'low_stock' => 0,
    'expired' => 0,
    'total_items' => count($items),
    'active_consultations' => 0,
    'today_visits' => 0,
    'medcert_count' => 0
];
foreach ($items as $item) {
    if ((int)$item['stock'] <= 10) {
        $metrics['low_stock']++;
    }
    if (!empty($item['expired_on']) && strtotime($item['expired_on']) < time()) {
        $metrics['expired']++;
    }
}

$consultationStmt = $pdo->query("SELECT COUNT(*) AS active_count FROM consultations WHERE status = 'active'");
$consultationResult = $consultationStmt->fetch();
$metrics['active_consultations'] = (int)($consultationResult['active_count'] ?? 0);

$visitStmt = $pdo->prepare("SELECT COUNT(*) AS today_count FROM consultations WHERE DATE(created_at) = CURDATE()");
$visitStmt->execute();
$visitResult = $visitStmt->fetch();
$metrics['today_visits'] = (int)($visitResult['today_count'] ?? 0);

$medcertStmt = $pdo->query('SELECT COUNT(*) AS medcert_count FROM medcerts');
$medcertResult = $medcertStmt->fetch();
$metrics['medcert_count'] = (int)($medcertResult['medcert_count'] ?? 0);

$requestStmt = $pdo->query('SELECT id, item_name, requested_date, transit_status, delivery_date, manifest_details FROM purchase_requests ORDER BY requested_date DESC LIMIT 10');
$requests = $requestStmt->fetchAll();

echo json_encode(['items' => $items, 'metrics' => $metrics, 'requests' => $requests]);
