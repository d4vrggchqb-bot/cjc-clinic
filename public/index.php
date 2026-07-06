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
    <link rel="stylesheet" href="dist/app.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900">
    <div class="flex min-h-screen">
        <aside class="hidden w-96 flex-col bg-[#f44b38] px-8 py-10 text-white xl:flex">
            <div class="flex items-center gap-4 border-b border-white/10 pb-8">
                <img src="assets/logo.png" alt="CJC Logo" class="h-12 w-12 object-contain rounded-full border border-white/20 bg-white/10 p-1">
                <div>
                    <p class="text-sm uppercase tracking-[0.24em] text-slate-100/80">CJC Clinic+</p>
                    <h1 class="text-2xl font-bold">CJC-Clinic+</h1>
                </div>
            </div>
            <nav class="mt-10 space-y-3">
                <button data-view="dashboard" class="w-full rounded-3xl bg-white px-5 py-4 text-left text-slate-900 shadow-sm transition hover:bg-slate-100">📊 Dashboard</button>
                <button data-view="patients" class="w-full rounded-3xl bg-white/10 px-5 py-4 text-left text-slate-100 transition hover:bg-white/15">👥 Patient List</button>
                <button data-view="consultations" class="w-full rounded-3xl bg-white/10 px-5 py-4 text-left text-slate-100 transition hover:bg-white/15">🩺 Consultation</button>
                <button data-view="history" class="w-full rounded-3xl bg-white/10 px-5 py-4 text-left text-slate-100 transition hover:bg-white/15">📄 Visitation History</button>
                <button data-view="inventory" class="w-full rounded-3xl bg-white/10 px-5 py-4 text-left text-slate-100 transition hover:bg-white/15">📦 Inventory</button>
            </nav>
            <div class="mt-auto rounded-3xl border border-white/15 bg-white/10 p-5 text-sm text-white/90 shadow-sm">
                <p class="text-xs uppercase tracking-[0.24em] text-white/60">Signed in as</p>
                <p class="mt-2 font-semibold"><?php echo $staffName; ?></p>
                <p class="text-slate-100/80"><?php echo $staffRole; ?></p>
            </div>
        </aside>

        <main class="flex-1 px-6 py-6 xl:px-10">
            <header class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 class="text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h2>
                    <p class="mt-2 text-sm text-slate-500">Overview of clinic activity</p>
                </div>
                <div class="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div class="rounded-2xl bg-slate-100 px-3 py-2 text-xs uppercase tracking-[0.24em] text-slate-500">Attending Staff</div>
                    <div class="flex items-center gap-3">
                        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f44b38]/10 text-[#f44b38]">MS</div>
                        <div>
                            <p class="text-sm font-semibold"><?php echo $staffName; ?></p>
                            <p class="text-xs text-slate-500"><?php echo $staffRole; ?></p>
                        </div>
                    </div>
                </div>
            </header>

            <section id="dashboardView" class="space-y-6">
                <div class="grid gap-4 xl:grid-cols-5">
                    <article class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Today's Visits</p>
                        <p id="metricVisits" class="mt-4 text-3xl font-semibold text-slate-900">0</p>
                    </article>
                    <article class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Active Consultations</p>
                        <p id="metricConsultations" class="mt-4 text-3xl font-semibold text-slate-900">0</p>
                    </article>
                    <article class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Low Stock Items</p>
                        <p id="metricLowStock" class="mt-4 text-3xl font-semibold text-slate-900">0</p>
                    </article>
                    <article class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Expired Items</p>
                        <p id="metricExpired" class="mt-4 text-3xl font-semibold text-slate-900">0</p>
                    </article>
                    <article class="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Issued MedCerts</p>
                        <p id="metricMedCerts" class="mt-4 text-3xl font-semibold text-slate-900">0</p>
                    </article>
                </div>

                <div class="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div class="mb-5 flex items-center justify-between">
                            <div>
                                <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Active Consultation Feed</p>
                                <h3 class="mt-2 text-xl font-semibold text-slate-900">Patient care snapshot</h3>
                            </div>
                        </div>
                        <div id="activeConsultations" class="space-y-4"></div>
                    </div>
                    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div class="mb-5">
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Inventory Breakdown</p>
                            <h3 class="mt-2 text-xl font-semibold text-slate-900">Stock levels by category</h3>
                        </div>
                        <div id="inventoryBreakdown" class="space-y-4"></div>
                    </div>
                </div>
            </section>

            <section id="patientsView" class="hidden space-y-6">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Patient Profiles</p>
                            <h3 class="mt-2 text-2xl font-semibold text-slate-900">Students & Employees</h3>
                        </div>
                        <div class="inline-flex items-center gap-3 rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">
                            <span class="font-semibold">Filter</span>
                            <select id="patientTypeFilter" class="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10">
                                <option value="all">All Profiles</option>
                                <option value="student">Students</option>
                                <option value="employee">Employees</option>
                            </select>
                        </div>
                    </div>
                    <div class="overflow-hidden rounded-3xl border border-slate-200">
                        <table class="min-w-full divide-y divide-slate-200 text-sm">
                            <thead class="bg-slate-50 text-left text-slate-500">
                                <tr>
                                    <th class="px-6 py-4">ID</th>
                                    <th class="px-6 py-4">Name</th>
                                    <th class="px-6 py-4">Contact</th>
                                    <th class="px-6 py-4">Program / Department</th>
                                    <th class="px-6 py-4">Blood Type</th>
                                </tr>
                            </thead>
                            <tbody id="patientTableBody" class="divide-y divide-slate-100 bg-white"></tbody>
                        </table>
                    </div>
                    <div class="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-slate-500">
                        <p class="font-semibold text-slate-800">Attachment Upload Zone</p>
                        <p class="mt-2 text-sm">Drag and drop patient PDFs or images here to store consultation documents and lab summaries.</p>
                        <form id="patientUploadForm" class="mt-4 flex flex-col gap-3 sm:flex-row">
                            <input id="patientUploadFile" name="attachment" type="file" accept="application/pdf,image/*" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 outline-none" />
                            <button type="submit" class="w-full rounded-2xl bg-[#f44b38] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d03c2f]">Upload File</button>
                        </form>
                        <p id="patientUploadStatus" class="mt-3 text-xs text-slate-400"></p>
                    </div>
                </div>
            </section>

            <section id="consultationsView" class="hidden space-y-6">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div class="mb-5">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Prescription & Consultation Logs</p>
                        <h3 class="mt-2 text-2xl font-semibold text-slate-900">Active medical workflows</h3>
                    </div>
                    <div id="consultationFeed" class="space-y-4"></div>
                </div>
                <div class="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div class="mb-5">
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">E-MedCert Workspace</p>
                            <h3 class="mt-2 text-2xl font-semibold text-slate-900">Generate certificates</h3>
                        </div>
                        <form id="medcertForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-600">Patient Name</label>
                                <input name="issued_to" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-600">Provider</label>
                                <input name="issued_by" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" value="<?php echo $staffName; ?>" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-600">Reason</label>
                                <textarea name="reason" required rows="4" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10"></textarea>
                            </div>
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label class="block text-sm font-medium text-slate-600">Valid Until</label>
                                    <input type="date" name="valid_until" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-600">Profile ID</label>
                                    <input name="profile_id" type="number" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" placeholder="e.g. 1" />
                                </div>
                            </div>
                            <button type="submit" class="w-full rounded-2xl bg-[#f44b38] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d03c2f]">Generate Certificate</button>
                        </form>
                        <p id="medcertStatus" class="mt-3 text-sm text-slate-500"></p>
                    </div>
                    <div class="rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
                        <div class="mb-5">
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Live Certificate Preview</p>
                            <h3 class="mt-2 text-2xl font-semibold text-slate-900">Official layout</h3>
                        </div>
                        <div id="medcertPreview" class="rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
                            <p class="text-sm text-slate-500">Fill in the form to preview an official medical certificate here.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="historyView" class="hidden space-y-6">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div class="mb-5">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Visitation History</p>
                        <h3 class="mt-2 text-2xl font-semibold text-slate-900">Records by date</h3>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <p class="text-sm text-slate-500">Recent visits</p>
                            <p class="mt-3 text-3xl font-semibold text-slate-900">28</p>
                        </div>
                        <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                            <p class="text-sm text-slate-500">Follow-ups</p>
                            <p class="mt-3 text-3xl font-semibold text-slate-900">6</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="inventoryView" class="hidden space-y-6">
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Inventory Catalog</p>
                            <h3 class="mt-2 text-2xl font-semibold text-slate-900">Medicines, Supplies & Equipment</h3>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-3">
                            <select id="inventoryCategoryFilter" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10">
                                <option value="all">All Categories</option>
                                <option value="medicine">Medicines</option>
                                <option value="supply">Supplies</option>
                                <option value="equipment">Equipment</option>
                            </select>
                        </div>
                    </div>
                    <div id="inventoryList" class="space-y-4"></div>
                </div>
                <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div class="mb-5">
                        <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Purchase Request Timeline</p>
                        <h3 class="mt-2 text-2xl font-semibold text-slate-900">Delivery status and manifests</h3>
                    </div>
                    <div id="timelineRequests" class="space-y-4"></div>
                </div>
            </section>

            <section id="medcertView" class="hidden space-y-6">
                <div class="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div class="mb-5">
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">E-MedCert Workspace</p>
                            <h3 class="mt-2 text-2xl font-semibold text-slate-900">Generate certificates</h3>
                        </div>
                        <form id="medcertForm" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-600">Patient Name</label>
                                <input name="issued_to" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-600">Provider</label>
                                <input name="issued_by" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" value="<?php echo $staffName; ?>" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-slate-600">Reason</label>
                                <textarea name="reason" required rows="4" class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10"></textarea>
                            </div>
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label class="block text-sm font-medium text-slate-600">Valid Until</label>
                                    <input type="date" name="valid_until" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-600">Profile ID</label>
                                    <input name="profile_id" type="number" required class="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#f44b38] focus:ring-2 focus:ring-[#f44b38]/10" placeholder="e.g. 1" />
                                </div>
                            </div>
                            <button type="submit" class="w-full rounded-2xl bg-[#f44b38] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d03c2f]">Generate Certificate</button>
                        </form>
                        <p id="medcertStatus" class="mt-3 text-sm text-slate-500"></p>
                    </div>
                    <div class="rounded-3xl border border-slate-100 bg-slate-50 p-6 shadow-sm">
                        <div class="mb-5">
                            <p class="text-sm uppercase tracking-[0.24em] text-slate-400">Live Certificate Preview</p>
                            <h3 class="mt-2 text-2xl font-semibold text-slate-900">Official layout</h3>
                        </div>
                        <div id="medcertPreview" class="rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
                            <p class="text-sm text-slate-500">Fill in the form to preview an official medical certificate here.</p>
                        </div>
                    </div>
                </div>
            </section>
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
