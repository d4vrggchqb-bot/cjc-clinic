import { renderDashboard } from './dashboard.js';
import { loadInventory } from './inventory.js';
import { loadPatientTable } from './patients.js';
function getCurrentPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('patients'))
        return 'patients';
    if (path.includes('consultation'))
        return 'consultation';
    if (path.includes('visitation'))
        return 'visitation';
    if (path.includes('inventory'))
        return 'inventory';
    return 'dashboard';
}
function getPageMeta(page) {
    switch (page) {
        case 'patients':
            return { title: 'Patient List', subtitle: 'Manage clinic patient records and profiles' };
        case 'consultation':
            return { title: 'Consultation', subtitle: 'Track active medical consultations' };
        case 'visitation':
            return { title: 'Visitation History', subtitle: 'Review past clinic visits and follow-ups' };
        case 'inventory':
            return { title: 'Inventory', subtitle: 'Monitor stock levels and requests' };
        default:
            return { title: 'Dashboard', subtitle: 'Overview of clinic activity and stock health' };
    }
}
function renderSidebar(page) {
    const links = [
        { id: 'dashboard', label: 'Dashboard', href: 'index.php' },
        { id: 'patients', label: 'Patient List', href: 'patients.php' },
        { id: 'consultation', label: 'Consultation', href: 'consultation.php' },
        { id: 'visitation', label: 'Visitation History', href: 'visitation.php' },
        { id: 'inventory', label: 'Inventory', href: 'inventory.php' },
    ];
    return `
    <aside class="sidebar text-center">
      <img src="assets/logo.png" alt="CJC Logo" class="brand-logo mx-auto d-block">
      <h1 class="brand-title mb-0">CJC-Clinic<sup>+</sup></h1>
      <p class="brand-subtitle mb-0">Clinic Patient Records System<br>and Inventory</p>
      <div class="sidebar-divider"></div>
      <nav class="w-100">
        ${links.map((link) => `
          <a href="${link.href}" class="nav-pill ${page === link.id ? 'active' : ''}">
            <span class="bullet"></span>${link.label}
          </a>
        `).join('')}
      </nav>
    </aside>
  `;
}
function renderPageContent(page) {
    const meta = getPageMeta(page);
    if (page === 'patients') {
        return `
      <div class="mb-4">
        <h2 class="page-title mb-1">${meta.title}</h2>
        <p class="page-subtitle small mb-0">${meta.subtitle}</p>
      </div>
      <div class="card-panel p-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 class="mb-1">Patient Registry</h5>
            <p class="text-secondary small mb-0">Patient records loaded through the TypeScript frontend.</p>
          </div>
          <span class="badge bg-success-subtle text-success">Connected</span>
        </div>
        <div class="table-responsive">
          <table class="table table-borderless align-middle mb-0">
            <thead>
              <tr class="text-uppercase small text-secondary">
                <th>ID</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Program</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="patientTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    }
    if (page === 'consultation') {
        return `
      <div class="mb-4">
        <h2 class="page-title mb-1">${meta.title}</h2>
        <p class="page-subtitle small mb-0">${meta.subtitle}</p>
      </div>
      <div class="card-panel p-4">
        <h5 class="mb-3">Active Consultations</h5>
        <ul class="list-group list-group-flush">
          <li class="list-group-item px-0">Patient #001 - Follow-up assessment scheduled</li>
          <li class="list-group-item px-0">Patient #002 - Prescription review pending</li>
        </ul>
      </div>
    `;
    }
    if (page === 'visitation') {
        return `
      <div class="mb-4">
        <h2 class="page-title mb-1">${meta.title}</h2>
        <p class="page-subtitle small mb-0">${meta.subtitle}</p>
      </div>
      <div class="card-panel p-4">
        <h5 class="mb-3">Recent Visits</h5>
        <ul class="list-group list-group-flush">
          <li class="list-group-item px-0">2026-07-08 - Annual check-up completed</li>
          <li class="list-group-item px-0">2026-07-05 - Follow-up consultation completed</li>
        </ul>
      </div>
    `;
    }
    if (page === 'inventory') {
        return `
      <div class="mb-4">
        <h2 class="page-title mb-1">${meta.title}</h2>
        <p class="page-subtitle small mb-0">${meta.subtitle}</p>
      </div>
      <div class="card-panel p-4 mb-4">
        <h5 class="mb-3">Stock Overview</h5>
        <div id="inventoryList"></div>
      </div>
      <div class="card-panel p-4">
        <h5 class="mb-3">Purchase Requests</h5>
        <div id="timelineRequests"></div>
      </div>
    `;
    }
    return `
    <div class="mb-4">
      <h2 class="page-title mb-1">${meta.title}</h2>
      <p class="page-subtitle small mb-0">${meta.subtitle}</p>
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
  `;
}
export async function renderAppLayout() {
    const app = document.getElementById('app');
    if (!app) {
        return;
    }
    const page = getCurrentPage();
    app.innerHTML = `
    <div class="app-shell d-flex">
      ${renderSidebar(page)}
      <main class="main-content" id="mainContent"></main>
    </div>
  `;
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) {
        return;
    }
    mainContent.innerHTML = renderPageContent(page);
    switch (page) {
        case 'dashboard':
            await renderDashboard();
            break;
        case 'patients':
            await loadPatientTable();
            break;
        case 'inventory':
            await loadInventory();
            break;
        default:
            break;
    }
}
//# sourceMappingURL=layout.js.map