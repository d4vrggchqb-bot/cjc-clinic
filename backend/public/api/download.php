<?php
require_once __DIR__ . '/../../config/config.php';

// Ensure the user is authenticated and session is valid
cjcRequireAuth();

// Enforce RBAC: Only Doctors and Nurses can view clinical attachments
cjcRequireRole(['Superadmin', 'Admin', 'Doctor', 'Nurse', 'Staff']);

// Get the requested filename from query parameter
$requestedFile = $_GET['file'] ?? '';

if (empty($requestedFile)) {
    http_response_code(400);
    echo "Bad Request: No file specified.";
    exit;
}

// Security: Prevent path traversal by extracting just the base filename
$safeFilename = basename($requestedFile);

// Construct the full path to the protected storage area
$targetPath = CJC_UPLOAD_DIR . DIRECTORY_SEPARATOR . $safeFilename;

if (!file_exists($targetPath) || !is_file($targetPath)) {
    http_response_code(404);
    echo "Not Found: The requested file does not exist.";
    exit;
}

// Determine the MIME type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($targetPath);
if (!$mimeType) {
    $mimeType = 'application/octet-stream';
}

// Serve the file securely
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($targetPath));

// For PDFs or Images, we want them to display inline usually, not force download
// Using 'inline' allows the browser to render it if capable
header('Content-Disposition: inline; filename="' . $safeFilename . '"');
header('Cache-Control: private, max-age=86400'); // Cache for 1 day

// Prevent execution
header('X-Content-Type-Options: nosniff');

readfile($targetPath);
exit;
