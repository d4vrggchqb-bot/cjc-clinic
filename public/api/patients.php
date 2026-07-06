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

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'upload') {
    if (empty($_FILES['attachment']) || $_FILES['attachment']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Upload failed.']);
        exit;
    }

    $file = $_FILES['attachment'];
    $filename = uniqid('attachment_', true) . '_' . basename($file['name']);
    $targetPath = realpath(__DIR__ . '/../uploads') . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to save file.']);
        exit;
    }

    echo json_encode(['success' => true, 'url' => 'uploads/' . $filename]);
    exit;
}

$profileType = $_GET['type'] ?? 'all';
$allowed = ['student', 'employee'];
if ($profileType !== 'all' && !in_array($profileType, $allowed, true)) {
    $profileType = 'all';
}

$sql = 'SELECT id, profile_type, name, contact, program_department, blood_type, health_history, vital_stats FROM profiles';
$params = [];
if ($profileType !== 'all') {
    $sql .= ' WHERE profile_type = :type';
    $params['type'] = $profileType;
}
$sql .= ' ORDER BY created_at DESC LIMIT 50';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$profiles = $stmt->fetchAll();

echo json_encode(['profiles' => $profiles]);
