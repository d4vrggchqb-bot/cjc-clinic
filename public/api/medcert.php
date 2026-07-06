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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = [
        'profile_id' => (int)($_POST['profile_id'] ?? 0),
        'issued_to' => trim($_POST['issued_to'] ?? ''),
        'issued_by' => trim($_POST['issued_by'] ?? ''),
        'reason' => trim($_POST['reason'] ?? ''),
        'valid_until' => trim($_POST['valid_until'] ?? ''),
    ];

    if (!$data['profile_id'] || !$data['issued_to'] || !$data['issued_by'] || !$data['reason'] || !$data['valid_until']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'All fields are required.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare('INSERT INTO medcerts (profile_id, issued_to, issued_by, reason, valid_until) VALUES (:profile_id, :issued_to, :issued_by, :reason, :valid_until)');
        $stmt->execute($data);
        $certId = $pdo->lastInsertId();

        $certificateHtml = generateMedCertPreview($data, $certId);
        echo json_encode(['success' => true, 'preview' => $certificateHtml]);
        exit;
    } catch (PDOException $exception) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Unable to generate medical certificate.']);
        exit;
    }
}

function generateMedCertPreview(array $payload, int $id): string
{
    $issuedAt = date('F j, Y');
    $preview = "<div class='small text-secondary'>";
    $preview .= "<div class='border-bottom border-secondary pb-3 mb-3'><p class='small text-uppercase text-secondary letter-spacing-2 mb-1'>Official Medical Certificate</p><h2 class='h5 fw-semibold mb-0 text-dark'>CJC School Clinic</h2></div>";
    $preview .= "<div class='mb-3'><p><span class='fw-semibold text-dark'>Patient:</span> " . cjcEscape($payload['issued_to']) . "</p><p><span class='fw-semibold text-dark'>Provider:</span> " . cjcEscape($payload['issued_by']) . "</p><p><span class='fw-semibold text-dark'>Date Issued:</span> {$issuedAt}</p><p><span class='fw-semibold text-dark'>Valid Until:</span> " . cjcEscape($payload['valid_until']) . "</p></div>";
    $preview .= "<div class='rounded-4 border border-secondary bg-light p-3 mb-3'><p class='text-secondary mb-0'>" . nl2br(cjcEscape($payload['reason'])) . "</p></div>";
    $preview .= "<div class='row g-3 mb-3'><div class='col-md-6'><div class='rounded-4 border border-secondary p-3'><p class='small text-uppercase text-secondary mb-2 letter-spacing-2'>Signature</p><div class='mt-3 border-bottom border-secondary' style='min-height:2rem;'></div></div></div><div class='col-md-6'><div class='rounded-4 border border-secondary p-3'><p class='small text-uppercase text-secondary mb-2 letter-spacing-2'>Clinic Seal</p><div class='mt-3 rounded-4 bg-white' style='height:5rem;'></div></div></div></div>";
    $preview .= "<p class='small text-secondary mb-0'>Certificate ID: MC-" . str_pad((string)$id, 5, '0', STR_PAD_LEFT) . "</p>";
    $preview .= "</div>";
    return $preview;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
