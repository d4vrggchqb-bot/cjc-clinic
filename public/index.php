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
    <title>CJC-Clinic+ Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="dist/app.css">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f2f2f2;
        }

        .app-shell {
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 240px;
            background-color: #8b0000;
            padding: 2rem 1rem;
            flex-shrink: 0;
        }

        .sidebar .brand-logo {
            width: 4.25rem;
            height: 4.25rem;
            object-fit: contain;
            background: #ffffff;
            border-radius: 50%;
            padding: 0.35rem;
        }

        .sidebar .brand-title {
            color: #ffffff;
            font-weight: 700;
            font-size: 1.25rem;
            margin-top: 0.75rem;
        }

        .sidebar .brand-title sup {
            font-size: 0.55em;
            top: -0.6em;
        }

        .sidebar .brand-subtitle {
            color: rgba(255, 255, 255, 0.85);
            font-size: 0.62rem;
            letter-spacing: 0.02em;
        }

        .sidebar-divider {
            border-top: 1px solid rgba(255, 255, 255, 0.35);
            margin: 1rem 0 1.25rem;
        }

        .nav-pill {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            width: 100%;
            border: none;
            text-align: left;
            padding: 0.65rem 1rem;
            border-radius: 0.6rem;
            margin-bottom: 0.6rem;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-decoration: none;
            background-color: #c31d3a;
            color: #ffffff;
        }

        .nav-pill .bullet {
            width: 0.6rem;
            height: 0.6rem;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.85);
            flex-shrink: 0;
        }

        .nav-pill.active {
            background-color: #ffffff;
            color: #c31d3a;
        }

        .nav-pill.active .bullet {
            background-color: #d9d9d9;
        }

        /* Main content */
        .main-content {
            flex: 1;
            padding: 2rem 2.5rem;
        }

        .page-title {
            color: #c1123f;
            font-weight: 700;
        }

        .page-subtitle {
            color: #9aa0a6;
        }

        .metric-card {
            background-color: #ffffff;
            border-radius: 0.6rem;
            padding: 1rem 0.75rem;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .metric-label {
            font-size: 0.6rem;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #9aa0a6;
            font-weight: 600;
        }

        .metric-value {
            font-size: 1.6rem;
            font-weight: 700;
            margin: 0.25rem 0;
        }

        .metric-sub {
            font-size: 0.62rem;
            color: #b5b8bc;
        }

        .metric-visits {
            color: #c94f6a;
        }

        .metric-consultations {
            color: #4f8fdd;
        }

        .metric-lowstock {
            color: #e37a3f;
        }

        .metric-expired {
            color: #c98fb4;
        }

        .metric-medcerts {
            color: #6f7376;
        }

        .dashboard-panel {
            background-color: #ffffff;
            border-radius: 0.6rem;
            min-height: 80px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .dashboard-list-card {
            background-color: #f8f8f9;
            border-radius: 0.5rem;
        }

        .status-pill {
            background-color: #fdecef;
            color: #c1123f;
            font-size: 0.68rem;
            font-weight: 600;
            padding: 0.25rem 0.65rem;
            border-radius: 999px;
            white-space: nowrap;
        }

        .stock-pill {
            background-color: #eef2f7;
            color: #4f6f96;
            font-size: 0.68rem;
            font-weight: 600;
            padding: 0.25rem 0.65rem;
            border-radius: 999px;
            white-space: nowrap;
        }
    </style>
</head>

<body>
    <div class="app-shell d-flex">
        <aside class="sidebar text-center">
            <img src="assets/logo.png" alt="CJC Logo" class="brand-logo mx-auto d-block">
            <h1 class="brand-title mb-0">CJC-Clinic<sup>+</sup></h1>
            <p class="brand-subtitle mb-0">Clinic Patient Records System and Inventory</p>
            <div class="sidebar-divider"></div>
            <nav>
                <a href="index.php" class="nav-pill active"><span class="bullet"></span>DASHBOARD</a>
                <a href="patients.php" class="nav-pill"><span class="bullet"></span>PATIENT LIST</a>
                <a href="consultation.php" class="nav-pill"><span class="bullet"></span>CONSULTATION</a>
                <a href="visitation.php" class="nav-pill"><span class="bullet"></span>VISITATION HISTORY</a>
                <a href="inventory.php" class="nav-pill"><span class="bullet"></span>INVENTORY</a>
            </nav>
        </aside>

        <main class="main-content">
            <h2 class="page-title mb-0">Dashboard</h2>
            <p class="page-subtitle small mb-4">Overview of clinic activity</p>

            <div class="row g-3 mb-4">
                <div class="col">
                    <div class="metric-card">
                        <div class="metric-label">Today's Patient Visits</div>
                        <div class="metric-value metric-visits" id="metricVisits">0</div>
                        <div class="metric-sub">Registered today</div>
                    </div>
                </div>
                <div class="col">
                    <div class="metric-card">
                        <div class="metric-label">Ongoing Consultations</div>
                        <div class="metric-value metric-consultations" id="metricConsultations">0</div>
                        <div class="metric-sub">Currently in progress</div>
                    </div>
                </div>
                <div class="col">
                    <div class="metric-card">
                        <div class="metric-label">Low Stock Items</div>
                        <div class="metric-value metric-lowstock" id="metricLowStock">0</div>
                        <div class="metric-sub">Urgently needing restock</div>
                    </div>
                </div>
                <div class="col">
                    <div class="metric-card">
                        <div class="metric-label">Expired Items</div>
                        <div class="metric-value metric-expired" id="metricExpired">0</div>
                        <div class="metric-sub">Needs disposal</div>
                    </div>
                </div>
                <div class="col">
                    <div class="metric-card">
                        <div class="metric-label">Med Certificates</div>
                        <div class="metric-value metric-medcerts" id="metricMedCerts">0</div>
                        <div class="metric-sub">Issued this month</div>
                    </div>
                </div>
            </div>

            <div class="dashboard-panel p-3 mb-3" id="activeConsultations"></div>
            <div class="dashboard-panel p-3" id="inventoryBreakdown"></div>
        </main>
    </div>

    <script type="module" src="dist/app.js"></script>
</body>

</html>