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

// Build visits by college - try multiple strategies depending on schema
$colleges = [
    'BED Department',
    'College of Accounting, Business and Entreprenueurship (CABE)',
    'College of Education and Sciences (CEDAS)',
    'College of Health Sciences (CHS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Engineering (COE)',
    'College of Special Programs (CSP)',
];

$visitsByCollege = array_fill_keys($colleges, 0);

// If consultations has a 'college' column, group by it
$hasCollegeInConsult = false;
$colCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'college'");
if ($colCheck && $colCheck->fetch()) {
    $hasCollegeInConsult = true;
    $stmt = $pdo->query("SELECT college, COUNT(*) AS cnt FROM consultations GROUP BY college");
    if ($stmt) {
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = $row['college'];
            if ($key && array_key_exists($key, $visitsByCollege)) $visitsByCollege[$key] = (int)$row['cnt'];
        }
    }
}

// Otherwise, try joining to profiles and grouping by a college/program column
if (!$hasCollegeInConsult) {
    $profileCollegeCol = null;
    $possible = ['college', 'program', 'department', 'course'];
    foreach ($possible as $col) {
        $check = $pdo->query("SHOW COLUMNS FROM profiles LIKE '$col'");
        if ($check && $check->fetch()) { $profileCollegeCol = $col; break; }
    }

    if ($profileCollegeCol) {
        $sql = "SELECT p.$profileCollegeCol AS college, COUNT(c.id) AS cnt FROM consultations c LEFT JOIN profiles p ON p.id = c.profile_id GROUP BY p.$profileCollegeCol";
        $stmt = $pdo->query($sql);
        if ($stmt) {
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $key = $row['college'];
                if ($key && array_key_exists($key, $visitsByCollege)) $visitsByCollege[$key] = (int)$row['cnt'];
            }
        }
    }
}

// Top diagnoses (best effort)
$topDiagnoses = [];
$diagCheck = $pdo->query("SHOW COLUMNS FROM consultations LIKE 'diagnosis'");
if ($diagCheck && $diagCheck->fetch()) {
    $stmt = $pdo->query("SELECT diagnosis, COUNT(*) AS cnt FROM consultations GROUP BY diagnosis ORDER BY cnt DESC LIMIT 10");
    if ($stmt) {
        while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $topDiagnoses[] = ['diagnosis' => $r['diagnosis'], 'count' => (int)$r['cnt']];
        }
    }
}

echo json_encode([
    'visits_this_week' => $visitsWeek,
    'total_registered' => $totalRegistered,
    'unattended' => $unattended,
    'pending_rechecks' => $pendingRechecks,
    'inventory_count' => $inventoryCount,
    'visits_by_college' => $visitsByCollege,
    'top_diagnoses' => $topDiagnoses,
]);
