import { renderDashboard } from './dashboard.js';
import { loadInventory } from './inventory.js';
import { loadPatientTable, uploadPatientAttachment } from './patients.js';

export type AppPage = 'dashboard' | 'patients' | 'consultation' | 'visitation' | 'inventory';

function getCurrentPage(): AppPage {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('patients')) return 'patients';
  if (path.includes('consultation')) return 'consultation';
  if (path.includes('visitation')) return 'visitation';
  if (path.includes('inventory')) return 'inventory';
  return 'dashboard';
}

function getPageMeta(page: AppPage): { title: string; subtitle: string } {
  switch (page) {
    case 'patients':
      return { title: 'Patient Registry', subtitle: 'Manage clinic patient records and profiles' };
    case 'consultation':
      return { title: 'Consultation & Certificates', subtitle: 'Track medical sessions and issue certificates' };
    case 'visitation':
      return { title: 'Visitation History', subtitle: 'Review past clinic visits and student/staff check-ins' };
    case 'inventory':
      return { title: 'Inventory & Supplies', subtitle: 'Monitor stock levels and purchase requests' };
    default:
      return { title: 'Clinic Dashboard', subtitle: 'Overview of clinic activity and inventory health' };
  }
}

function renderSidebar(page: AppPage): string {
  const links: Array<{ id: AppPage; label: string; href: string; icon: string }> = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      href: 'index.php', 
      icon: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`
    },
    { 
      id: 'patients', 
      label: 'Patient List', 
      href: 'patients.php', 
      icon: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`
    },
    { 
      id: 'consultation', 
      label: 'Consultation', 
      href: 'consultation.php', 
      icon: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>`
    },
    { 
      id: 'visitation', 
      label: 'Visitation History', 
      href: 'visitation.php', 
      icon: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>`
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      href: 'inventory.php', 
      icon: `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm4-5H5V8h14v3z"/></svg>`
    },
  ];

  return `
    <aside class="sidebar">
      <div class="brand-logo-container mx-auto">
        <img src="assets/logo.png" alt="CJC Logo" class="brand-logo">
      </div>
      <h1 class="brand-title mb-0 text-center">CJC-Clinic<sup>+</sup></h1>
      <p class="brand-subtitle mb-0 text-center">Clinic Patient Records System<br>and Inventory</p>
      <div class="sidebar-divider"></div>
      <nav class="sidebar-nav w-100">
        ${links.map((link) => `
          <a href="${link.href}" class="nav-pill ${page === link.id ? 'active' : ''}">
            ${link.icon}
            <span>${link.label}</span>
          </a>
        `).join('')}
      </nav>
    </aside>
  `;
}

function renderPageContent(page: AppPage): string {
  const meta = getPageMeta(page);

  if (page === 'patients') {
    return `
      <div class="mb-4">
        <h2 class="page-title mb-1">${meta.title}</h2>
        <p class="page-subtitle small mb-0">${meta.subtitle}</p>
      </div>
      <div class="card-panel p-4 mb-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h5 class="mb-1 fw-bold text-dark">Patient Registry</h5>
            <p class="text-secondary small mb-0">Manage and browse clinic profiles.</p>
          </div>
          <span class="status-pill completed">Connected</span>
        </div>
        
        <div class="row g-4 mb-4 align-items-end">
          <div class="col-md-4">
            <label class="form-label" for="patientTypeFilter">Filter Patient Type</label>
            <select class="form-select" id="patientTypeFilter">
              <option value="all">All Profiles</option>
              <option value="student">Students</option>
              <option value="employee">Employees</option>
            </select>
          </div>
          <div class="col-md-8">
            <form id="patientUploadForm">
              <label class="form-label">Upload Medical Attachment</label>
              <div class="d-flex gap-2">
                <div class="file-upload-wrapper flex-grow-1">
                  <input type="file" id="patientUploadFile" class="file-upload-input" accept=".jpg,.jpeg,.png,.pdf">
                  <div class="file-upload-trigger py-2 px-3 border rounded-4 d-flex flex-row align-items-center justify-content-center gap-2" style="height: 38px;">
                    <svg class="file-upload-icon m-0" style="width:1.1rem; height:1.1rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <span class="small text-secondary fw-semibold" id="uploadFileName" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;">Choose file...</span>
                  </div>
                </div>
                <button type="submit" class="brand-btn" style="padding: 0 1.5rem; height: 38px;">Upload</button>
              </div>
              <p class="small mb-0 mt-1" id="patientUploadStatus" style="font-size:0.72rem; color:var(--text-secondary);"></p>
            </form>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead>
              <tr class="text-uppercase small text-secondary">
                <th style="width: 10%">ID</th>
                <th style="width: 35%">Name</th>
                <th style="width: 20%">Contact</th>
                <th style="width: 20%">Program / Department</th>
                <th style="width: 15%">Blood Type</th>
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
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="card-panel p-4 mb-4">
            <h5 class="panel-header mb-3">
              <span>Active Sessions</span>
              <span class="pulse-indicator">
                <span class="pulse-dot"></span>
                <span class="small text-muted" style="font-size: 0.65rem; font-weight: 700;">LIVE</span>
              </span>
            </h5>
            <ul class="list-group list-group-flush" id="activeConsultationsList">
              <li class="list-group-item px-0 py-3 d-flex justify-content-between align-items-start gap-3">
                <div>
                  <p class="mb-1 small fw-semibold text-dark">Patient #001 - Follow-up assessment</p>
                  <p class="mb-0 small text-secondary">Provider: Dr. Angela Santos</p>
                </div>
                <span class="status-pill in-progress">In progress</span>
              </li>
              <li class="list-group-item px-0 py-3 d-flex justify-content-between align-items-start gap-3">
                <div>
                  <p class="mb-1 small fw-semibold text-dark">Patient #002 - Prescription review</p>
                  <p class="mb-0 small text-secondary">Provider: Nurse Maria Luz</p>
                </div>
                <span class="status-pill monitoring">Monitoring</span>
              </li>
            </ul>
          </div>
          <div class="card-panel p-4">
            <h5 class="panel-header mb-3">Certificate Generator</h5>
            <form id="medcertForm">
              <div class="mb-3">
                <label class="form-label" for="profileSelect">Select Patient Profile</label>
                <select class="form-select" id="profileSelect" name="profile_id" required>
                  <option value="" disabled selected>Loading patients...</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label" for="issuedTo">Issued To (Patient Name)</label>
                <input type="text" class="form-control" id="issuedTo" name="issued_to" placeholder="Patient's Full Name" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="issuedBy">Issued By (Medical Staff)</label>
                <input type="text" class="form-control" id="issuedBy" name="issued_by" placeholder="Physician or Nurse Name" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="validUntil">Valid Until</label>
                <input type="date" class="form-control" id="validUntil" name="valid_until" required>
              </div>
              <div class="mb-3">
                <label class="form-label" for="certReason">Medical Reason / Diagnosis</label>
                <textarea class="form-control" id="certReason" name="reason" rows="3" placeholder="State the medical justification..." required></textarea>
              </div>
              <button type="submit" class="brand-btn w-100">Generate Certificate</button>
              <p class="small text-secondary text-center mt-2 mb-0" id="medcertStatus"></p>
            </form>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="card-panel p-4 h-100 d-flex flex-column">
            <h5 class="panel-header mb-3">Document Preview</h5>
            <div class="flex-grow-1 d-flex align-items-center justify-content-center bg-light rounded-4 p-3" style="min-height: 480px;">
              <div class="w-100" id="medcertPreview">
                <div class="text-center py-5 text-secondary">
                  <svg class="mb-3 text-muted mx-auto d-block" style="width: 3.5rem; height: 3.5rem;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                  <p class="fw-semibold mb-1">No Active Preview</p>
                  <p class="small mb-0 px-4">Complete and submit the generator form on the left to render the high-quality physical document preview here.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
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
        <h5 class="panel-header mb-3">Recent Visit Logs</h5>
        <ul class="list-group list-group-flush">
          <li class="list-group-item px-0 py-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <p class="mb-1 small fw-semibold text-dark">Patient #001 - Annual health check-up</p>
              <p class="mb-0 small text-secondary">Logged on 2026-07-08 • Vital stats recorded</p>
            </div>
            <span class="status-pill completed">Completed</span>
          </li>
          <li class="list-group-item px-0 py-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
              <p class="mb-1 small fw-semibold text-dark">Patient #002 - General health assessment</p>
              <p class="mb-0 small text-secondary">Logged on 2026-07-05 • Follow-up recommended</p>
            </div>
            <span class="status-pill completed">Completed</span>
          </li>
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
        <div class="row align-items-end g-3">
          <div class="col-md-4">
            <label class="form-label" for="inventoryCategoryFilter">Category Filter</label>
            <select class="form-select" id="inventoryCategoryFilter">
              <option value="all">All Categories</option>
              <option value="medicine">Medicines</option>
              <option value="supply">Supplies</option>
              <option value="equipment">Equipment</option>
            </select>
          </div>
          <div class="col-md-8 text-md-end">
            <span class="status-pill completed">Active Real-Time Quantities</span>
          </div>
        </div>
      </div>
      <div class="card-panel p-4 mb-4">
        <h5 class="panel-header mb-3">Stock Quantities & Indicators</h5>
        <div id="inventoryList"></div>
      </div>
      <div class="card-panel p-4">
        <h5 class="panel-header mb-3">Recent Purchase Requisitions</h5>
        <div id="timelineRequests"></div>
      </div>
    `;
  }

  return `
    <div class="mb-4 animate-fade-in">
      <div class="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
        <div>
          <h2 class="page-title mb-1">${meta.title}</h2>
          <p class="page-subtitle small mb-0">${meta.subtitle}</p>
        </div>
        <div class="status-pill completed" id="dashboardBadge">Cross-department view</div>
      </div>

      <div class="dashboard-filter-bar">
        <div class="filter-group">
          <label for="dashboardDateRange">Date range</label>
          <select class="form-select" id="dashboardDateRange">
            <option value="7d">Last 7 days</option>
            <option value="30d" selected>Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="dashboardBranch">Clinic branch</label>
          <select class="form-select" id="dashboardBranch">
            <option value="all" selected>All branches</option>
            <option value="north">North campus</option>
            <option value="south">South campus</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="dashboardPhysician">Attending physician</label>
          <select class="form-select" id="dashboardPhysician">
            <option value="all" selected>All physicians</option>
            <option value="dr-arias">Dr. Arias</option>
            <option value="dr-patel">Dr. Patel</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Privacy</label>
          <div class="privacy-pill">HIPAA-safe masking</div>
        </div>
      </div>
      <p class="small text-secondary mb-0" id="dashboardFilterSummary">Last 30 days • All physicians</p>
    </div>

    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-5 g-4 mb-4 animate-scale-up">
      <div class="col">
        <div class="metric-card card-visits">
          <div class="metric-label">Visits this week</div>
          <div class="metric-value" id="metricVisitsWeek">0</div>
          <div class="metric-sub">This week</div>
        </div>
      </div>
      <div class="col">
        <div class="metric-card card-registered">
          <div class="metric-label">Total registered</div>
          <div class="metric-value" id="metricTotalRegistered">0</div>
          <div class="metric-sub">Students &amp; Employees</div>
        </div>
      </div>
      <div class="col">
        <div class="metric-card card-unattended">
          <div class="metric-label">Unattended</div>
          <div class="metric-value" id="metricUnattended">0</div>
          <div class="metric-sub">Today: Waiting for care</div>
        </div>
      </div>
      <div class="col">
        <div class="metric-card card-pending">
          <div class="metric-label">Pending re-checks</div>
          <div class="metric-value" id="metricPendingRechecks">0</div>
          <div class="metric-sub">Follow-ups due</div>
        </div>
      </div>
      <div class="col">
        <div class="metric-card card-inventory">
          <div class="metric-label">Inventory</div>
          <div class="metric-value" id="metricInventory">0</div>
          <div class="metric-sub">Medicines, supplies &amp; equipment</div>
        </div>
      </div>
    </div>

    <div class="row g-4 animate-fade-in">
      <div class="col-xl-8">
        <div class="dashboard-panel p-4 h-100">
          <div class="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
            <h5 class="panel-header mb-0">Patient-consultation funnel</h5>
            <div class="department-chip-row" id="departmentChips"></div>
          </div>
          <div id="funnelChart"><canvas id="funnelCanvas" height="160"></canvas></div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="dashboard-panel p-4 h-100">
          <h5 class="panel-header mb-0">Wait time alert</h5>
          <div id="waitTimeAlert" class="wait-time-card warning"></div>
          <div class="mt-3" id="waitTimeBreakdown"></div>
        </div>
      </div>
    </div>

    <div class="row g-4 animate-fade-in">
      <div class="col-xl-12">
        <div class="dashboard-panel p-4 h-100">
          <h5 class="panel-header mb-0">Diagnosis vs specialty heatmap</h5>
          <div class="mt-3" id="heatmapGrid"><canvas id="heatmapCanvas" height="220"></canvas></div>
        </div>
      </div>
    </div>

    <div class="dashboard-panel p-4 animate-fade-in">
      <div class="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
        <h5 class="panel-header mb-0">Operational pulse</h5>
        <span class="status-pill completed">Refreshes every 60 seconds</span>
      </div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead>
            <tr class="text-uppercase small text-secondary">
              <th>Patient</th>
              <th>Status</th>
              <th>Wait</th>
              <th>Service</th>
              <th>Masked ID</th>
            </tr>
          </thead>
          <tbody id="queueTableBody"></tbody>
        </table>
      </div>
    </div>

    <div id="modalHost"></div>
  `;
}

export async function renderAppLayout(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) {
    return;
  }

  const page = getCurrentPage();
  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(page)}
      <main class="main-content" id="mainContent"></main>
    </div>
  `;

  const mainContent = document.getElementById('mainContent');
  if (!mainContent) {
    return;
  }

  mainContent.innerHTML = renderPageContent(page);

  // Hook up event handlers and async content loaders
  switch (page) {
    case 'dashboard':
      await renderDashboard();
      break;

    case 'patients':
      await loadPatientTable();
      
      // Bind Patient Page Elements
      const patientFilter = document.getElementById('patientTypeFilter') as HTMLSelectElement | null;
      patientFilter?.addEventListener('change', async () => {
        await loadPatientTable(patientFilter.value);
      });

      const fileInput = document.getElementById('patientUploadFile') as HTMLInputElement | null;
      const fileNameLabel = document.getElementById('uploadFileName');
      fileInput?.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          if (fileNameLabel) {
            fileNameLabel.textContent = fileInput.files[0].name;
            fileNameLabel.classList.remove('text-secondary');
            fileNameLabel.classList.add('text-dark', 'fw-bold');
          }
        }
      });

      const uploadForm = document.getElementById('patientUploadForm') as HTMLFormElement | null;
      const uploadStatus = document.getElementById('patientUploadStatus');
      uploadForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fileInput?.files?.length) {
          if (uploadStatus) {
            uploadStatus.textContent = 'Please choose a file first.';
            uploadStatus.style.color = '#ef4444';
          }
          return;
        }

        if (uploadStatus) {
          uploadStatus.textContent = 'Uploading file attachment...';
          uploadStatus.style.color = 'var(--text-secondary)';
        }

        try {
          const file = fileInput.files[0];
          const uploadUrl = await uploadPatientAttachment(file);
          if (uploadStatus) {
            uploadStatus.textContent = `Attached successfully: ${uploadUrl}`;
            uploadStatus.style.color = '#166534';
          }
          fileInput.value = '';
          if (fileNameLabel) {
            fileNameLabel.textContent = 'Choose file...';
            fileNameLabel.classList.add('text-secondary');
            fileNameLabel.classList.remove('text-dark', 'fw-bold');
          }
          // Reload the patient list
          await loadPatientTable(patientFilter?.value || 'all');
        } catch (err) {
          if (uploadStatus) {
            uploadStatus.textContent = (err as Error).message || 'Attachment upload failed.';
            uploadStatus.style.color = '#ef4444';
          }
        }
      });
      break;

    case 'inventory':
      await loadInventory();
      
      const invFilter = document.getElementById('inventoryCategoryFilter') as HTMLSelectElement | null;
      invFilter?.addEventListener('change', async () => {
        await loadInventory(invFilter.value);
      });
      break;

    case 'consultation':
      // Populate profiles select dropdown dynamically
      const profileSelect = document.getElementById('profileSelect') as HTMLSelectElement | null;
      const patientNameInput = document.getElementById('issuedTo') as HTMLInputElement | null;
      const medcertStatus = document.getElementById('medcertStatus');
      const medcertPreview = document.getElementById('medcertPreview');
      
      try {
        const response = await fetch('api/patients.php?type=all');
        if (response.ok) {
          const patientData = await response.json();
          const profiles: Array<{ id: number; name: string; profile_type: string }> = patientData.profiles || [];
          if (profileSelect) {
            profileSelect.innerHTML = `<option value="" disabled selected>Select a patient profile...</option>` + 
              profiles.map(p => `<option value="${p.id}" data-name="${p.name}">ID #${p.id} - ${p.name} (${p.profile_type})</option>`).join('');
          }
        }
      } catch (e) {
        if (profileSelect) {
          profileSelect.innerHTML = `<option value="" disabled>Error loading patient profiles</option>`;
        }
      }

      // Auto-populate Issued To field on select
      profileSelect?.addEventListener('change', () => {
        const selectedOption = profileSelect.options[profileSelect.selectedIndex];
        const name = selectedOption.getAttribute('data-name') || '';
        if (patientNameInput) {
          patientNameInput.value = name;
        }
      });

      // Submit Generator Form
      const certForm = document.getElementById('medcertForm') as HTMLFormElement | null;
      certForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (medcertStatus) {
          medcertStatus.textContent = 'Generating official medical certificate...';
          medcertStatus.style.color = 'var(--text-secondary)';
        }

        try {
          const formData = new FormData(certForm);
          const result = await fetch('api/medcert.php', {
            method: 'POST',
            body: formData
          });
          const resData = await result.json();
          if (resData.success) {
            if (medcertPreview) {
              medcertPreview.innerHTML = `<div class="medcert-preview-canvas animate-scale-up">${resData.preview}</div>`;
            }
            if (medcertStatus) {
              medcertStatus.textContent = 'Certificate generated and registered successfully.';
              medcertStatus.style.color = '#166534';
            }
          } else {
            if (medcertStatus) {
              medcertStatus.textContent = resData.message || 'Generation failed.';
              medcertStatus.style.color = '#ef4444';
            }
          }
        } catch (err) {
          if (medcertStatus) {
            medcertStatus.textContent = 'Network communication error.';
            medcertStatus.style.color = '#ef4444';
          }
        }
      });
      break;

    default:
      break;
  }
}
