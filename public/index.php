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
            background-color: #f8fafc;
            color: #1e293b;
        }

        .app-shell {
            min-height: 100vh;
        }

        /* Sidebar styling */
        .sidebar {
            width: 260px;
            background: linear-gradient(180deg, #800016 0%, #5c0010 100%);
            padding: 2.5rem 1.25rem;
            flex-shrink: 0;
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.05);
            display: flex;
            flex-direction: column;
        }

        .sidebar .brand-logo {
            width: 4.5rem;
            height: 4.5rem;
            object-fit: contain;
            background: #ffffff;
            border-radius: 50%;
            padding: 0.4rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .sidebar .brand-title {
            color: #ffffff;
            font-weight: 800;
            font-size: 1.4rem;
            margin-top: 1rem;
            letter-spacing: -0.02em;
        }

        .sidebar .brand-title sup {
            font-size: 0.6em;
            color: #ffa3b1;
            font-weight: 600;
        }

        .sidebar .brand-subtitle {
            color: rgba(255, 255, 255, 0.75);
            font-size: 0.68rem;
            font-weight: 500;
            line-height: 1.4;
            margin-top: 0.25rem;
        }

        .sidebar-divider {
            border-top: 1px solid rgba(255, 255, 255, 0.15);
            margin: 1.5rem 0;
        }

        .nav-pill {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            width: 100%;
            padding: 0.8rem 1.2rem;
            border-radius: 0.5rem;
            margin-bottom: 0.4rem;
            font-size: 0.75rem;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-decoration: none;
            color: rgba(255, 255, 255, 0.8);
            transition: all 0.2s ease;
        }

        .nav-pill:hover {
            background-color: rgba(255, 255, 255, 0.1);
            color: #ffffff;
        }

        .nav-pill .bullet {
            width: 0.4rem;
            height: 0.4rem;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.4);
            transition: all 0.2s ease;
            flex-shrink: 0;
        }

        .nav-pill:hover .bullet {
            background-color: #ffffff;
        }

        .nav-pill.active {
            background-color: #ffffff;
            color: #800016;
            font-weight: 700;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .nav-pill.active .bullet {
            background-color: #800016;
        }

        /* Main Content Layout */
        .main-content {
            flex: 1;
            padding: 2.5rem 3rem;
            max-width: 1400px;
        }

        .page-title {
            color: #0f172a;
            font-weight: 800;
            letter-spacing: -0.02em;
        }

        .page-subtitle {
            color: #64748b;
            font-weight: 500;
        }

        /* Metric Cards */
        .metric-card {
            background-color: #ffffff;
            border-radius: 0.75rem;
            padding: 1.5rem 1rem;
            text-align: center;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        .metric-label {
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 700;
        }

        .metric-value {
            font-size: 2rem;
            font-weight: 800;
            margin: 0.35rem 0;
            letter-spacing: -0.03em;
        }

        .metric-sub {
            font-size: 0.72rem;
            color: #94a3b8;
            font-weight: 500;
        }

        /* Metric Colors Variants */
        .metric-visits {
            color: #dc2626;
        }

        .metric-consultations {
            color: #2563eb;
        }

        .metric-lowstock {
            color: #ea580c;
        }

        .metric-expired {
            color: #9333ea;
        }

        .metric-medcerts {
            color: #475569;
        }

        /* Panels styling */
        .dashboard-panel {
            background-color: #ffffff;
            border-radius: 0.75rem;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02);
        }

        .dashboard-list-card {
            background-color: #f8fafc;
            border-radius: 0.5rem;
            border: 1px solid #e2e8f0;
        }

        .status-pill {
            background-color: #fee2e2;
            color: #991b1b;
            font-size: 0.72rem;
            font-weight: 600;
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            white-space: nowrap;
        }

        .stock-pill {
            background-color: #f1f5f9;
            color: #334155;
            font-size: 0.72rem;
            font-weight: 600;
            padding: 0.25rem 0.75rem;
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
            <p class="brand-subtitle mb-0">Clinic Patient Records System<br>and Inventory</p>
            <div class="sidebar-divider"></div>
            <nav class="w-100">
                <a href="index.php" class="nav-pill active"><span class="bullet"></span>DASHBOARD</a>
                <a href="patients.php" class="nav-pill"><span class="bullet"></span>PATIENT LIST</a>
                <a href="consultation.php" class="nav-pill"><span class="bullet"></span>CONSULTATION</a>
                <a href="visitation.php" class="nav-pill"><span class="bullet"></span>VISITATION HISTORY</a>
                <a href="inventory.php" class="nav-pill"><span class="bullet"></span>INVENTORY</a>
            </nav>
        </aside>

        <main class="main-content">
            <div class="mb-4">
                <h2 class="page-title mb-1">Dashboard</h2>
                <p class="page-subtitle small mb-0">Overview of clinic activity</p>
            </div>

            <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-4 mb-4">
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

            <div class="dashboard-panel p-4 mb-4" id="activeConsultations"></div>
            <div class="dashboard-panel p-4" id="inventoryBreakdown"></div>
        </main>
    </div>

    <script type="module" src="dist/app.js"></script>
</body>

</html>