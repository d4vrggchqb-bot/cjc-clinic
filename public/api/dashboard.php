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

// Visits this week (last 7 days)
$stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM consultations WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
$stmt->execute();
$visitsWeek = (int)($stmt->fetchColumn() ?? 0);

// Total registered profiles
$stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM profiles");
$stmt->execute();
$totalRegistered = (int)($stmt->fetchColumn() ?? 0);

// Unattended: consultations with status indicating waiting/pending/no-show
$unattended = 0;
$statusStmt = $pdo->query("SELECT COUNT(*) AS cnt FROM consultations WHERE status IN ('pending','waiting','no-show')");
if ($statusStmt) {
    $unattended = (int)($statusStmt->fetchColumn() ?? 0);
}

// Pending re-checks: try to detect columns or status values safely
$pendingRechecks = 0;
// If there is a 'follow_up' boolean column
$colCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'follow_up'");
if ($colCheck && $colCheck->fetch()) {
    $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM consultations WHERE follow_up = 1");
    $pendingRechecks = (int)($stmt->fetchColumn() ?? 0);
} else {
    // fallback: count rows with status 'follow-up' or 'recheck'
    $stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM consultations WHERE status IN ('follow-up','recheck')");
    if ($stmt) $pendingRechecks = (int)($stmt->fetchColumn() ?? 0);
}

// Inventory count
$stmt = $pdo->query("SELECT COUNT(*) AS cnt FROM inventory");
$inventoryCount = (int)($stmt->fetchColumn() ?? 0);

echo json_encode([
    'visits_this_week' => $visitsWeek,
    'total_registered' => $totalRegistered,
    'unattended' => $unattended,
    'pending_rechecks' => $pendingRechecks,
    'inventory_count' => $inventoryCount,
]);
