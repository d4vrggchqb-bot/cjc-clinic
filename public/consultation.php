<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

if (!isset($_SESSION['cjc_user'])) {
    header('Location: login.php');
    exit;
}

$currentUser = $_SESSION['cjc_user'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CJC-Clinic+ | Consultation</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="dist/app.css">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; }
        .app-shell { min-height: 100vh; }
        .sidebar { width: 260px; background: linear-gradient(180deg, #800016 0%, #5c0010 100%); padding: 2.5rem 1.25rem; flex-shrink: 0; display: flex; flex-direction: column; }
        .sidebar .brand-logo { width: 4.5rem; height: 4.5rem; object-fit: contain; background: #ffffff; border-radius: 50%; padding: 0.4rem; }
        .sidebar .brand-title { color: #ffffff; font-weight: 800; font-size: 1.4rem; margin-top: 1rem; }
        .sidebar .brand-subtitle { color: rgba(255,255,255,0.75); font-size: 0.68rem; font-weight: 500; line-height: 1.4; margin-top: 0.25rem; }
        .sidebar-divider { border-top: 1px solid rgba(255,255,255,0.15); margin: 1.5rem 0; }
        .nav-pill { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.8rem 1.2rem; border-radius: 0.5rem; margin-bottom: 0.4rem; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-decoration: none; color: rgba(255,255,255,0.8); }
        .nav-pill:hover { background-color: rgba(255,255,255,0.1); color: #ffffff; }
        .nav-pill .bullet { width: 0.4rem; height: 0.4rem; border-radius: 50%; background-color: rgba(255,255,255,0.4); flex-shrink: 0; }
        .nav-pill.active { background-color: #ffffff; color: #800016; font-weight: 700; }
        .nav-pill.active .bullet { background-color: #800016; }
        .main-content { flex: 1; padding: 2.5rem 3rem; }
        .page-title { color: #0f172a; font-weight: 800; letter-spacing: -0.02em; }
        .page-subtitle { color: #64748b; font-weight: 500; }
        .card-panel { background-color: #ffffff; border-radius: 0.75rem; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
    </style>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="dist/ts/app.js"></script>
</body>
</html>
