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
    $preview = "<div class='space-y-4 text-sm text-slate-700'>";
    $preview .= "<div class='border-b border-slate-200 pb-4'><p class='text-xs uppercase tracking-[0.24em] text-slate-400'>Official Medical Certificate</p><h2 class='mt-2 text-xl font-semibold text-slate-900'>CJC School Clinic</h2></div>";
    $preview .= "<div class='space-y-2'><p><span class='font-semibold'>Patient:</span> " . cjcEscape($payload['issued_to']) . "</p><p><span class='font-semibold'>Provider:</span> " . cjcEscape($payload['issued_by']) . "</p><p><span class='font-semibold'>Date Issued:</span> {$issuedAt}</p><p><span class='font-semibold'>Valid Until:</span> " . cjcEscape($payload['valid_until']) . "</p></div>";
    $preview .= "<div class='rounded-3xl border border-slate-200 bg-slate-50 p-4'><p class='text-slate-600'>" . nl2br(cjcEscape($payload['reason'])) . "</p></div>";
    $preview .= "<div class='grid gap-4 md:grid-cols-2'><div class='rounded-3xl border border-slate-200 p-4'><p class='text-xs uppercase tracking-[0.24em] text-slate-400'>Signature</p><p class='mt-6 h-8 border-b border-slate-300'></p></div><div class='rounded-3xl border border-slate-200 p-4'><p class='text-xs uppercase tracking-[0.24em] text-slate-400'>Clinic Seal</p><div class='mt-6 h-20 rounded-3xl bg-white'></div></div></div>";
    $preview .= "<p class='text-xs text-slate-400'>Certificate ID: MC-" . str_pad((string)$id, 5, '0', STR_PAD_LEFT) . "</p>";
    $preview .= "</div>";
    return $preview;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
