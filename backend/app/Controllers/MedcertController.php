<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';

class MedcertController {

    public function generate() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->jsonResponse(['error' => 'Method not allowed'], 405);
        }

        cjcRequireAuth();
        cjcCsrfValidate();
        cjcRequireRole(['Doctor', 'Nurse', 'Admin']);

        $pdo = cjcDatabaseConnection();

        $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        $data = [
            'profile_id'    => (int)($input['profile_id'] ?? 0),
            'issued_to'     => trim($input['issued_to']  ?? ''),
            'issued_by'     => trim($input['issued_by']  ?? ''),
            'reason'        => trim($input['reason']     ?? ''),
            'valid_until'   => trim($input['valid_until']?? ''),
            'clinic_branch' => trim($input['clinic_branch'] ?? 'College Clinic'),
        ];

        if (!$data['profile_id'] || !$data['issued_to'] || !$data['issued_by'] || !$data['reason'] || !$data['valid_until']) {
            $this->jsonResponse(['success' => false, 'message' => 'All fields are required.'], 400);
        }

        $parsedDate = DateTime::createFromFormat('Y-m-d', $data['valid_until']);
        if (!$parsedDate || $parsedDate->format('Y-m-d') !== $data['valid_until']) {
            $this->jsonResponse(['success' => false, 'message' => 'Invalid date format. Use YYYY-MM-DD.'], 400);
        }

        try {
            $profileCheck = $pdo->prepare('SELECT id FROM profiles WHERE id = :id LIMIT 1');
            $profileCheck->execute(['id' => $data['profile_id']]);
            if (!$profileCheck->fetch()) {
                $this->jsonResponse(['success' => false, 'message' => 'Patient profile not found.'], 404);
            }
        } catch (PDOException $e) {
            $this->jsonResponse(['success' => false, 'message' => 'Unable to verify patient profile.'], 500);
        }

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO medcerts (profile_id, clinic_branch, issued_to, issued_by, reason, valid_until)
                 VALUES (:profile_id, :clinic_branch, :issued_to, :issued_by, :reason, :valid_until)'
            );
            $stmt->execute($data);
            $certId = (int)$pdo->lastInsertId();

            $hashData = $certId . '|' . $data['issued_to'] . '|' . $data['valid_until'];
            $cryptoHash = hash_hmac('sha256', $hashData, CJC_APP_KEY);
            
            $certStringId = 'MC-' . str_pad((string)$certId, 5, '0', STR_PAD_LEFT);
            
            $uploadDir = realpath(CJC_UPLOAD_DIR);
            if ($uploadDir === false || !is_dir($uploadDir)) {
                $this->jsonResponse(['success' => false, 'message' => 'Storage directory is not configured properly.'], 500);
            }
            
            $filename = 'medcert_' . $certStringId . '_' . substr($cryptoHash, 0, 8) . '.pdf';
            $targetPath = $uploadDir . DIRECTORY_SEPARATOR . $filename;
            
            $pdfScript = realpath(__DIR__ . '/../../scripts/pdf_generator.py');
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || $_SERVER['SERVER_PORT'] == 443 ? "https://" : "http://";
            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
            $verifyUrl = $protocol . $host . CJC_BASE_URL . "public/verify.php?id={$certId}&hash={$cryptoHash}";
            
            $pdfPayload = json_encode([
                'id' => $certStringId,
                'issued_to' => $data['issued_to'],
                'hash' => $cryptoHash,
                'verify_url' => $verifyUrl
            ]);
            
            $pdfUrl = '';
            if ($pdfScript) {
                $cmd = escapeshellcmd("python") . " " . escapeshellarg($pdfScript) . " " . escapeshellarg($pdfPayload) . " " . escapeshellarg($targetPath);
                $output = [];
                $return_var = 0;
                exec($cmd, $output, $return_var);
                
                if ($return_var === 0 && file_exists($targetPath)) {
                    $pdfUrl = 'api/download.php?file=' . urlencode($filename);
                }
            }
            
            $certificateHtml = $this->generateMedCertPreview($data, $certId, $cryptoHash);
            
            $this->jsonResponse([
                'success' => true, 
                'preview' => $certificateHtml,
                'pdf_url' => $pdfUrl,
                'hash'    => $cryptoHash
            ]);
        } catch (PDOException $exception) {
            error_log('[CJC-CLINIC] medcert insert error: ' . $exception->getMessage());
            $this->jsonResponse(['success' => false, 'message' => 'Unable to generate medical certificate.'], 500);
        }
    }

    private function generateMedCertPreview(array $payload, int $id, string $hash): string
    {
        $issuedAt = date('F j, Y');
        $certStringId = 'MC-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT);
        $clinicBranch = cjcEscape($payload['clinic_branch'] ?? 'College Clinic');
        
        $preview  = "<div class='small text-secondary'>";
        $preview .= "<div class='border-bottom border-secondary pb-3 mb-3'><p class='small text-uppercase text-secondary letter-spacing-2 mb-1'>Official Medical Certificate</p><h2 class='h5 fw-semibold mb-0 text-slate-900'>CJC {$clinicBranch}</h2></div>";
        $preview .= "<div class='mb-3'><p><span class='fw-semibold text-slate-900'>Patient:</span> " . cjcEscape($payload['issued_to']) . "</p><p><span class='fw-semibold text-slate-900'>Provider:</span> " . cjcEscape($payload['issued_by']) . "</p><p><span class='fw-semibold text-slate-900'>Date Issued:</span> {$issuedAt}</p><p><span class='fw-semibold text-slate-900'>Valid Until:</span> " . cjcEscape($payload['valid_until']) . "</p></div>";
        $preview .= "<div class='rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4'><p class='text-slate-500 mb-0'>" . nl2br(cjcEscape($payload['reason'])) . "</p></div>";
        
        $preview .= "<div class='rounded-2xl border border-blue-200 bg-blue-50 p-3 mb-4 text-xs font-mono text-blue-800 break-all'>";
        $preview .= "<span class='font-bold uppercase text-blue-900 block mb-1'>Anti-Forgery Data</span>";
        $preview .= "ID: {$certStringId}<br>HASH: {$hash}";
        $preview .= "</div>";
        
        $preview .= "<div class='grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'><div class='rounded-2xl border border-slate-200 p-4'><p class='text-sm uppercase text-slate-400 mb-2'>Signature</p><div class='mt-4 border-b border-slate-300' style='min-height:2rem;'></div></div><div class='rounded-2xl border border-slate-200 p-4'><p class='text-sm uppercase text-slate-400 mb-2'>Clinic Seal</p><div class='mt-4 rounded-xl bg-white' style='height:5rem;'></div></div></div>";
        $preview .= "</div>";
        return $preview;
    }

    private function jsonResponse(array $data, int $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
