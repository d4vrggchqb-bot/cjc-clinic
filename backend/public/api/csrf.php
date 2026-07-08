<?php
require_once __DIR__ . '/../../config/config.php';

// Generate or retrieve the CSRF token from the session
$token = cjcCsrfToken();

header('Content-Type: application/json');
echo json_encode(['token' => $token]);
