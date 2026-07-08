<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

// Auth guard: checks session, enforces timeout, initialises CSRF token
cjcRequireAuth();

$currentUser = cjcCurrentUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CJC-Clinic+ | Consultation</title>
    <!-- CSRF token for use by fetch() calls in JavaScript -->
    <meta name="csrf-token" content="<?php echo cjcEscape(cjcCsrfToken()); ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="dist/app.css">
</head>
<body>
    <div id="app"></div>
    <script type="module" src="dist/ts/app.js"></script>
</body>
</html>
