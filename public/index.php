<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

if (!isset($_SESSION['cjc_user'])) {
    cjcRedirectToLogin();
}

cjcSessionValidate();
$user = cjcCurrentUser();
$staffName = cjcEscape($user['name']);
$staffRole = cjcEscape($user['role']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CJC-Clinic+ Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="dist/app.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="min-vh-100 bg-light text-dark">
    <div class="d-flex min-vh-100">
        <aside class="d-none d-xl-flex flex-column bg-danger text-white p-4 sidebar-panel" style="width: 24rem;">
            <div class="d-flex align-items-center gap-3 border-bottom border-white-25 pb-4 mb-4">
                <img src="assets/logo.png" alt="CJC Logo" class="rounded-circle border border-white-25 bg-white-10 p-2" style="width: 3rem; height: 3rem; object-fit: contain;">
                <div>
                    <p class="text-uppercase small text-white-75">CJC Clinic+</p>
                    <h1 class="h4 fw-bold mb-0">CJC-Clinic+</h1>
                </div>
            </div>
            <nav class="nav flex-column gap-3 mb-4 sidebar-nav">
                <button data-view="dashboard" class="btn btn-light text-dark rounded-4 text-start py-3">📊 Dashboard</button>
                <button data-view="patients" class="btn btn-outline-light text-white rounded-4 text-start py-3">👥 Patient List</button>
                <button data-view="consultations" class="btn btn-outline-light text-white rounded-4 text-start py-3">🩺 Consultation</button>
                <button data-view="history" class="btn btn-outline-light text-white rounded-4 text-start py-3">📄 Visitation History</button>
                <button data-view="inventory" class="btn btn-outline-light text-white rounded-4 text-start py-3">📦 Inventory</button>
            </nav>
            <div class="mt-auto rounded-4 border border-white-25 bg-white-10 p-4 text-sm text-white-75 shadow-sm">
                <p class="text-uppercase small text-white-50 mb-1">Signed in as</p>
                <p class="fw-semibold mb-1"><?php echo $staffName; ?></p>
                <p class="small text-white-75"><?php echo $staffRole; ?></p>
            </div>
        </aside>

        <main class="flex-fill px-4 py-4 px-xl-5">
            <header class="mb-5 d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
                <div>
                    <h2 class="h2 fw-semibold mb-1">Dashboard</h2>
                    <p class="text-secondary mb-0">Overview of clinic activity</p>
                </div>
                <div class="d-flex align-items-center gap-3 rounded-4 border border-secondary bg-white px-3 py-2 shadow-sm">
                    <div class="rounded-4 bg-light px-3 py-2 text-uppercase small text-secondary">Attending Staff</div>
                    <div class="d-flex align-items-center gap-3">
                        <div class="d-flex align-items-center justify-content-center rounded-4" style="width:3rem;height:3rem;background-color:rgba(244,75,56,.1);color:#f44b38;">MS</div>
                        <div>
                            <p class="mb-0 fw-semibold"><?php echo $staffName; ?></p>
                            <p class="small text-secondary"><?php echo $staffRole; ?></p>
                        </div>
                    </div>
                </div>
            </header>

            <section id="dashboardView" class="mb-5">
                <div class="row g-4 mb-4 dashboard-metrics">
                    <div class="col-sm-6 col-xl-2">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hero-panel">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-2">Today's Visits</p>
                                <p id="metricVisits" class="h3 fw-semibold mb-0 text-dark">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-2">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-2">Active Consultations</p>
                                <p id="metricConsultations" class="h3 fw-semibold mb-0 text-dark">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-2">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-2">Low Stock Items</p>
                                <p id="metricLowStock" class="h3 fw-semibold mb-0 text-dark">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-2">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-2">Expired Items</p>
                                <p id="metricExpired" class="h3 fw-semibold mb-0 text-dark">0</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-sm-6 col-xl-2">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-2">Issued MedCerts</p>
                                <p id="metricMedCerts" class="h3 fw-semibold mb-0 text-dark">0</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-lg-8">
                        <div class="card border-0 shadow-sm rounded-4 hero-panel">
                            <div class="card-body">
                                <div class="mb-4">
                                    <p class="small text-uppercase text-secondary mb-1">Active Consultation Feed</p>
                                    <h3 class="h5 mb-0 text-dark">Patient care snapshot</h3>
                                </div>
                                <div id="activeConsultations" class="row g-3"></div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card border-0 shadow-sm rounded-4 h-100 hero-panel">
                            <div class="card-body">
                                <div class="mb-4">
                                    <p class="small text-uppercase text-secondary mb-1">Inventory Breakdown</p>
                                    <h3 class="h5 mb-0 text-dark">Stock levels by category</h3>
                                </div>
                                <div id="inventoryBreakdown" class="row g-3"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="patientsView" class="d-none">
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-body">
                        <div class="row align-items-center gy-3">
                            <div class="col-md-8">
                                <p class="small text-uppercase text-secondary mb-1">Patient Profiles</p>
                                <h3 class="h5 mb-0 text-dark">Students & Employees</h3>
                            </div>
                            <div class="col-md-4 text-md-end">
                                <label class="small text-secondary me-2 mb-1 d-inline-block">Filter</label>
                                <select id="patientTypeFilter" class="form-select d-inline-block w-auto rounded-4">
                                    <option value="all">All Profiles</option>
                                    <option value="student">Students</option>
                                    <option value="employee">Employees</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                    <div class="table-responsive">
                        <table class="table mb-0">
                            <thead class="table-light text-secondary small text-uppercase">
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Contact</th>
                                    <th>Program / Department</th>
                                    <th>Blood Type</th>
                                </tr>
                            </thead>
                            <tbody id="patientTableBody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="card border-0 shadow-sm rounded-4 p-4 bg-light text-secondary mb-4">
                    <p class="fw-semibold text-dark">Attachment Upload Zone</p>
                    <p class="mb-3 small">Drag and drop patient PDFs or images here to store consultation documents and lab summaries.</p>
                    <form id="patientUploadForm" class="row g-3">
                        <div class="col-12 col-sm-8">
                            <input id="patientUploadFile" name="attachment" type="file" accept="application/pdf,image/*" class="form-control rounded-4" />
                        </div>
                        <div class="col-12 col-sm-4">
                            <button type="submit" class="btn brand-btn w-100 rounded-4">Upload File</button>
                        </div>
                    </form>
                    <p id="patientUploadStatus" class="mt-3 small"></p>
                </div>
            </section>

            <section id="consultationsView" class="d-none">
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-body">
                        <p class="small text-uppercase text-secondary mb-1">Prescription & Consultation Logs</p>
                        <h3 class="h5 mb-0 text-dark">Active medical workflows</h3>
                        <div id="consultationFeed" class="mt-3 row g-3"></div>
                    </div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-1">E-MedCert Workspace</p>
                                <h3 class="h5 mb-4 text-dark">Generate certificates</h3>
                                <form id="medcertForm" class="row g-3">
                                    <div class="col-12">
                                        <label class="form-label">Patient Name</label>
                                        <input name="issued_to" required class="form-control rounded-4" />
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Provider</label>
                                        <input name="issued_by" required class="form-control rounded-4" value="<?php echo $staffName; ?>" />
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Reason</label>
                                        <textarea name="reason" required rows="4" class="form-control rounded-4"></textarea>
                                    </div>
                                    <div class="col-sm-6">
                                        <label class="form-label">Valid Until</label>
                                        <input type="date" name="valid_until" required class="form-control rounded-4" />
                                    </div>
                                    <div class="col-sm-6">
                                        <label class="form-label">Profile ID</label>
                                        <input name="profile_id" type="number" required class="form-control rounded-4" placeholder="e.g. 1" />
                                    </div>
                                    <div class="col-12">
                                        <button type="submit" class="btn brand-btn w-100 rounded-4">Generate Certificate</button>
                                    </div>
                                </form>
                                <p id="medcertStatus" class="mt-3 small text-secondary"></p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card border-0 shadow-sm rounded-4 h-100">
                            <div class="card-body">
                                <p class="small text-uppercase text-secondary mb-1">Live Certificate Preview</p>
                                <h3 class="h5 mb-4 text-dark">Official layout</h3>
                                <div id="medcertPreview" class="border rounded-4 p-4 bg-white text-secondary">
                                    <p class="small mb-0">Fill in the form to preview an official medical certificate here.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="historyView" class="d-none">
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body">
                        <p class="small text-uppercase text-secondary mb-1">Visitation History</p>
                        <h3 class="h5 mb-4 text-dark">Records by date</h3>
                        <div class="row g-4">
                            <div class="col-sm-6">
                                <div class="card rounded-4 border-0 bg-light h-100">
                                    <div class="card-body">
                                        <p class="small text-secondary mb-1">Recent visits</p>
                                        <p class="h3 fw-semibold mb-0 text-dark">28</p>
                                    </div>
                                </div>
                            </div>
                            <div class="col-sm-6">
                                <div class="card rounded-4 border-0 bg-light h-100">
                                    <div class="card-body">
                                        <p class="small text-secondary mb-1">Follow-ups</p>
                                        <p class="h3 fw-semibold mb-0 text-dark">6</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="inventoryView" class="d-none">
                <div class="card border-0 shadow-sm rounded-4 mb-4">
                    <div class="card-body">
                        <div class="row align-items-center gy-3">
                            <div class="col-md-8">
                                <p class="small text-uppercase text-secondary mb-1">Inventory Catalog</p>
                                <h3 class="h5 mb-0 text-dark">Medicines, Supplies & Equipment</h3>
                            </div>
                            <div class="col-md-4 text-md-end">
                                <select id="inventoryCategoryFilter" class="form-select rounded-4 w-auto d-inline-block"> 
                                    <option value="all">All Categories</option>
                                    <option value="medicine">Medicines</option>
                                    <option value="supply">Supplies</option>
                                    <option value="equipment">Equipment</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="inventoryList" class="row g-3 mb-4"></div>
                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body">
                        <p class="small text-uppercase text-secondary mb-1">Purchase Request Timeline</p>
                        <h3 class="h5 mb-0 text-dark">Delivery status and manifests</h3>
                        <div id="timelineRequests" class="row g-3 mt-3"></div>
                    </div>
                </div>
            </section>

            <section id="medcertView" class="d-none"></section>
        </main>
    </div>
    <script>
        window.CJCClinic = {
            user: {
                name: '<?php echo $staffName; ?>',
                role: '<?php echo $staffRole; ?>'
            }
        };
    </script>
    <script src="dist/app.js" type="module"></script>
</body>
</html>
