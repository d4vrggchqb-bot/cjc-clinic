<?php
// Initialize system config without requiring a session/auth since this is a public verification portal
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

$id = (int)($_GET['id'] ?? 0);
$hash = $_GET['hash'] ?? '';

if (!$id || empty($hash)) {
    http_response_code(400);
    die("Invalid Verification Request. Missing ID or Hash.");
}

$pdo = cjcDatabaseConnection();

try {
    $stmt = $pdo->prepare("SELECT id, issued_to, valid_until FROM medcerts WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $cert = $stmt->fetch();
} catch (PDOException $e) {
    http_response_code(500);
    die("Database Error.");
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CJC Clinic - Document Verification</title>
    <!-- Tailwind via CDN for quick public rendering without tying into the main app build process -->
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">

<div class="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
    <div class="p-6 text-center border-b border-slate-100">
        <h1 class="text-2xl font-bold text-slate-900">CJC Clinic</h1>
        <p class="text-slate-500 text-sm mt-1">E-MedCert Verification Portal</p>
    </div>

    <div class="p-8">
        <?php if (!$cert): ?>
            <!-- Not Found -->
            <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center">
                <svg class="w-12 h-12 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h2 class="font-bold text-lg mb-1">Document Not Found</h2>
                <p class="text-sm">There is no record of this certificate in our system. This may be a forgery.</p>
            </div>
        <?php else: 
            // Recalculate hash to verify integrity
            $hashData = $cert['id'] . '|' . $cert['issued_to'] . '|' . $cert['valid_until'];
            $expectedHash = hash_hmac('sha256', $hashData, CJC_APP_KEY);
            
            if (!hash_equals($expectedHash, $hash)):
        ?>
            <!-- Hash Mismatch (Forged/Altered) -->
            <div class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center">
                <svg class="w-12 h-12 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <h2 class="font-bold text-lg mb-1">Forged or Altered Document</h2>
                <p class="text-sm">The cryptographic hash on this document is invalid. The details (such as dates or names) may have been tampered with after issuance.</p>
            </div>
        <?php else: ?>
            <!-- Authentic -->
            <div class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-center mb-6">
                <svg class="w-12 h-12 mx-auto mb-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h2 class="font-bold text-lg mb-1">Authentic Document</h2>
                <p class="text-sm">This medical certificate was securely issued by the CJC Clinic and its integrity is verified.</p>
            </div>
            
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 space-y-3">
                <div class="flex justify-between border-b border-slate-200 pb-2">
                    <span class="text-slate-500 uppercase text-xs font-semibold">Certificate ID</span>
                    <span class="font-mono font-medium text-slate-900">MC-<?= str_pad((string)$cert['id'], 5, '0', STR_PAD_LEFT) ?></span>
                </div>
                <div class="flex justify-between border-b border-slate-200 pb-2">
                    <span class="text-slate-500 uppercase text-xs font-semibold">Issued To</span>
                    <span class="font-medium text-slate-900"><?= htmlspecialchars($cert['issued_to']) ?></span>
                </div>
                <div class="flex justify-between">
                    <span class="text-slate-500 uppercase text-xs font-semibold">Valid Until</span>
                    <span class="font-medium <?= (strtotime($cert['valid_until']) < time()) ? 'text-red-600' : 'text-slate-900' ?>">
                        <?= htmlspecialchars($cert['valid_until']) ?> 
                        <?php if (strtotime($cert['valid_until']) < time()) echo "(Expired)"; ?>
                    </span>
                </div>
            </div>
        <?php endif; endif; ?>
    </div>
</div>

</body>
</html>
