// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardFilters = {
  dateRange: string;
  branch: string;
  physician: string;
  selectedDepartment: string;
  selectedDiagnosis: string;
  activePatientId: number | null;
  showBreakdown: boolean;
};

type WaitLevel = 'ok' | 'warning' | 'danger';

type QueueItem = {
  id: number;
  name: string;
  department: string;
  status: string;
  wait: string;
  charge: string;
  maskedId: string;
  history: string;
  detail: string;
};

type ApiData = {
  visits_this_week?: number;
  total_registered?: number;
  unattended?: number;
  pending_rechecks?: number;
  inventory_count?: number;
  visits_by_college?: Record<string, number>;
  top_diagnoses?: Array<{ diagnosis: string; count: number }>;
};

// Minimal typings for the Chart.js global to avoid 'any'
declare class Chart {
  constructor(context: HTMLCanvasElement | string, config: any);
  data: {
    labels: string[];
    datasets: Array<{ data: number[]; [key: string]: any }>;
  };
  update(): void;
  toBase64Image?(): string;
}

// ─── Module-level state ───────────────────────────────────────────────────────

const dashboardFilters: DashboardFilters = {
  dateRange: '30d',
  branch: 'all',
  physician: 'all',
  selectedDepartment: 'all',
  selectedDiagnosis: 'all',
  activePatientId: null,
  showBreakdown: false,
};

// Cached API data — updated each time fetchApiData() is called
let cachedApiData: ApiData = {};

// Guard to ensure event listeners are only bound ONCE
let listenersInitialised = false;

const waitThresholds: Record<string, number> = {
  all: 17,
  Cardiology: 24,
  'Primary Care': 16,
  Neurology: 21,
  Pediatrics: 13,
};

// ─── Operational queue (demo data — replace with API when endpoint exists) ────
const queueData: QueueItem[] = [
  {
    id: 1,
    name: 'A. Rivera',
    department: 'Cardiology',
    status: 'In progress',
    wait: '8 min',
    charge: '$210',
    maskedId: '**** 4219',
    history: 'Arrhythmia follow-up · Recent ECG reviewed',
    detail: 'Insurance pre-authorization pending',
  },
  {
    id: 2,
    name: 'M. Santos',
    department: 'Primary Care',
    status: 'Up next',
    wait: '12 min',
    charge: '$84',
    maskedId: '**** 1182',
    history: 'Acute respiratory assessment · Asthma history',
    detail: 'Medication refill approved',
  },
  {
    id: 3,
    name: 'L. Chen',
    department: 'Neurology',
    status: 'Delayed',
    wait: '34 min',
    charge: '$310',
    maskedId: '**** 5560',
    history: 'Migraine review · MRI follow-up',
    detail: 'Lab results pending review',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWaitLevel(minutes: number): WaitLevel {
  if (minutes < 15) return 'ok';
  if (minutes <= 30) return 'warning';
  return 'danger';
}

function getDepartmentLabel(value: string): string {
  return value === 'all' ? 'All colleges' : value;
}

// ─── API fetch ────────────────────────────────────────────────────────────────

/**
 * Fetches live dashboard data from the PHP API and caches it in cachedApiData.
 * Metric cards are updated directly here; charts read from cachedApiData.
 */
async function fetchApiData(): Promise<void> {
  try {
    const resp = await fetch('api/dashboard.php');
    if (!resp.ok) {
      console.warn('[CJC] dashboard API returned', resp.status);
      return;
    }
    const data: ApiData = await resp.json();
    cachedApiData = data;

    // ── Update the five real metric cards directly from API values ─────────
    const map: Record<string, keyof ApiData> = {
      metricVisitsWeek:      'visits_this_week',
      metricTotalRegistered: 'total_registered',
      metricUnattended:      'unattended',
      metricPendingRechecks: 'pending_rechecks',
      metricInventory:       'inventory_count',
    };
    for (const [elId, key] of Object.entries(map)) {
      const el = document.getElementById(elId);
      if (el) el.textContent = String(data[key] ?? 0);
    }

    // ── Wire top-diagnoses chart to real API data ─────────────────────────
    if (data.top_diagnoses && data.top_diagnoses.length > 0) {
      updateTopDiagnosesFromApi(data.top_diagnoses);
    }

    // ── Expose for export feature ─────────────────────────────────────────
    (window as any).__apiData = cachedApiData;
  } catch (e) {
    console.warn('[CJC] Failed to fetch dashboard API', e);
  }
}

// ─── Wait-time snapshot (filter-aware, uses real wait thresholds) ─────────────

/**
 * Returns the current wait time and level based on the selected department
 * and branch filters. Does NOT fabricate patient/revenue numbers.
 */
function getWaitSnapshot() {
  const waitMinutes = Math.round(
    (waitThresholds[dashboardFilters.selectedDepartment] ?? waitThresholds.all) *
    (dashboardFilters.branch === 'north' ? 1.08 : 1),
  );
  return {
    waitMinutes,
    waitLevel: getWaitLevel(waitMinutes),
  };
}

// ─── Chart initialisers / updaters ────────────────────────────────────────────

function initOrUpdateFunnelChart() {
  const ctx = document.getElementById('funnelCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;

  const colleges = [
    'BED Department',
    'College of Accounting, Business and Entreprenueurship (CABE)',
    'College of Education and Sciences (CEDAS)',
    'College of Health Sciences (CHS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Engineering (COE)',
    'College of Special Programs (CSP)',
  ];

  // Use real API data when available; fall back to zeros (not fabricated weights)
  const apiCounts = cachedApiData.visits_by_college ?? null;
  const values: number[] = colleges.map((c) =>
    apiCounts ? Number(apiCounts[c] ?? 0) : 0,
  );

  window.__charts = window.__charts || {};
  if (window.__charts.funnel) {
    window.__charts.funnel.data.labels = colleges;
    window.__charts.funnel.data.datasets[0].data = values;
    window.__charts.funnel.update();
    return;
  }

  window.__charts.funnel = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: colleges,
      datasets: [{
        label: 'Consultations by college',
        data: values,
        backgroundColor: ['#14b8a6', '#800016', '#2563eb', '#0f766e', '#a855f7', '#f59e0b', '#ef4444'],
        borderRadius: 8,
      }],
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function initOrUpdateHeatmapChart() {
  const ctx = document.getElementById('heatmapCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;

  // Use real top_diagnoses data if available, otherwise show empty placeholder
  const apiDiagnoses = cachedApiData.top_diagnoses ?? [];
  const labels = apiDiagnoses.length > 0
    ? apiDiagnoses.slice(0, 4).map((d) => d.diagnosis)
    : ['No data yet'];
  const data = apiDiagnoses.length > 0
    ? apiDiagnoses.slice(0, 4).map((d) => d.count)
    : [0];

  window.__charts = window.__charts || {};
  if (window.__charts.heatmap) {
    window.__charts.heatmap.data.labels = labels;
    window.__charts.heatmap.data.datasets[0].data = data;
    window.__charts.heatmap.update();
    return;
  }

  window.__charts.heatmap = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cases',
        data,
        backgroundColor: labels.map((_l, i) => ['#ef4444', '#f97316', '#2563eb', '#0f766e'][i % 4]),
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true } },
    },
  });
}

function updateTopDiagnosesFromApi(diagnoses: Array<{ diagnosis: string; count: number }>) {
  const labels = diagnoses.slice(0, 5).map((d) => d.diagnosis);
  const data   = diagnoses.slice(0, 5).map((d) => d.count);

  window.__charts = window.__charts || {};
  if (window.__charts.topDiagnoses) {
    window.__charts.topDiagnoses.data.labels = labels;
    window.__charts.topDiagnoses.data.datasets[0].data = data;
    window.__charts.topDiagnoses.update();
    return;
  }

  const ctx = document.getElementById('topDiagnosesCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;
  window.__charts.topDiagnoses = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Count', data, backgroundColor: '#ef4444' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function initOrUpdateTopDiagnosesChart() {
  // If real data available, use it; otherwise render an empty placeholder
  const diagnoses = cachedApiData.top_diagnoses ?? [];
  if (diagnoses.length > 0) {
    updateTopDiagnosesFromApi(diagnoses);
    return;
  }

  const ctx = document.getElementById('topDiagnosesCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;
  window.__charts = window.__charts || {};
  if (window.__charts.topDiagnoses) return; // already initialised as empty

  window.__charts.topDiagnoses = new Chart(ctx, {
    type: 'bar',
    data: { labels: ['No data'], datasets: [{ label: 'Count', data: [0], backgroundColor: '#ef4444' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function initOrUpdateIllnessTrendChart() {
  const ctx = document.getElementById('illnessTrendCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;
  // Placeholder week labels — replace with API-backed weekly visit counts
  const labels = ['W-7', 'W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1', 'Now'];
  const data   = [0, 0, 0, 0, 0, 0, 0, cachedApiData.visits_this_week ?? 0];

  window.__charts = window.__charts || {};
  if (window.__charts.illnessTrend) {
    window.__charts.illnessTrend.data.labels = labels;
    window.__charts.illnessTrend.data.datasets[0].data = data;
    window.__charts.illnessTrend.update();
    return;
  }

  window.__charts.illnessTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Visits',
        data,
        borderColor: '#a30f36',
        backgroundColor: 'rgba(163,15,54,0.06)',
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function initOrUpdateVisitsByCollegeChart() {
  const ctx = document.getElementById('visitsByCollegeCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;

  const shortLabels = ['BED', 'CABE', 'CEDAS', 'CHS', 'CCIS', 'COE', 'CSP', 'Employees'];
  const fullNameMap: Record<string, string> = {
    BED:       'BED Department',
    CABE:      'College of Accounting, Business and Entreprenueurship (CABE)',
    CEDAS:     'College of Education and Sciences (CEDAS)',
    CHS:       'College of Health Sciences (CHS)',
    CCIS:      'College of Computing and Information Sciences (CCIS)',
    COE:       'College of Engineering (COE)',
    CSP:       'College of Special Programs (CSP)',
    Employees: 'Employees',
  };

  const apiCounts = cachedApiData.visits_by_college ?? null;
  const values = shortLabels.map((short) =>
    apiCounts ? Number(apiCounts[fullNameMap[short]] ?? 0) : 0,
  );

  window.__charts = window.__charts || {};
  if (window.__charts.visitsByCollege) {
    window.__charts.visitsByCollege.data.labels = shortLabels;
    window.__charts.visitsByCollege.data.datasets[0].data = values;
    window.__charts.visitsByCollege.update();
    return;
  }

  window.__charts.visitsByCollege = new Chart(ctx, {
    type: 'bar',
    data: { labels: shortLabels, datasets: [{ label: 'Visits', data: values, backgroundColor: '#0f766e' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function initOrUpdateInventoryStatusChart() {
  const ctx = document.getElementById('inventoryStatusCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;
  // Shows total inventory count from real API vs a placeholder "capacity" bar
  const total    = cachedApiData.inventory_count ?? 0;
  const labels   = ['Total Items'];
  const data     = [total];

  window.__charts = window.__charts || {};
  if (window.__charts.inventoryStatus) {
    window.__charts.inventoryStatus.data.labels = labels;
    window.__charts.inventoryStatus.data.datasets[0].data = data;
    window.__charts.inventoryStatus.update();
    return;
  }

  window.__charts.inventoryStatus = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Units', data, backgroundColor: '#166534' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// ─── Renderers (UI only — no state mutation, no listener registration) ─────────

function renderDepartmentChips(): string {
  const departments = [
    'all',
    'BED Department',
    'College of Accounting, Business and Entreprenueurship (CABE)',
    'College of Education and Sciences (CEDAS)',
    'College of Health Sciences (CHS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Engineering (COE)',
    'College of Special Programs (CSP)',
  ];
  return departments.map((department) => `
    <button class="department-chip ${dashboardFilters.selectedDepartment === department ? 'active' : ''}" data-dept-filter="${department}" type="button">
      ${getDepartmentLabel(department)}
    </button>
  `).join('');
}

function renderQueueTable(): string {
  return queueData.map((item) => `
    <tr class="queue-row" data-patient-id="${item.id}" tabindex="0">
      <td>
        <div class="fw-semibold text-dark">${item.name}</div>
        <div class="small text-secondary">${item.department}</div>
      </td>
      <td>
        <span class="status-pill ${item.status === 'Delayed' ? 'warning' : item.status === 'In progress' ? 'in-progress' : 'monitoring'}">${item.status}</span>
      </td>
      <td>${item.wait}</td>
      <td>${item.detail}</td>
      <td class="text-secondary">${item.maskedId}</td>
    </tr>
  `).join('');
}

function renderModal(patientId: number | null): string {
  if (!patientId) return '';
  const patient = queueData.find((item) => item.id === patientId);
  if (!patient) return '';

  return `
    <div class="modal-backdrop" id="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="patientModalTitle">
      <div class="modal-card">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <p class="small text-uppercase text-secondary mb-1">Protected clinical view</p>
            <h5 class="mb-1 fw-bold text-dark" id="patientModalTitle">${patient.name}</h5>
            <p class="mb-0 small text-secondary">${patient.department} • ${patient.maskedId}</p>
          </div>
          <button class="btn-close" id="closePatientModal" type="button" aria-label="Close"></button>
        </div>
        <div class="row g-3">
          <div class="col-md-6">
            <div class="detail-card">
              <p class="detail-label">Billing status</p>
              <p class="detail-value">${patient.detail}</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="detail-card">
              <p class="detail-label">Medical history</p>
              <p class="detail-value">${patient.history}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── DOM update (pure render — no fetch, no listener registration) ─────────────

function updateDom(): void {
  const wait = getWaitSnapshot();
  const waitText =
    wait.waitLevel === 'ok'      ? 'Stable operations' :
    wait.waitLevel === 'warning' ? 'Monitor queue'      : 'Immediate attention';

  // ── Wait card ────────────────────────────────────────────────────────────
  const waitTimeAlert = document.getElementById('waitTimeAlert');
  if (waitTimeAlert) {
    waitTimeAlert.className = `wait-time-card ${wait.waitLevel}`;
    waitTimeAlert.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <p class="mb-1 fw-semibold text-dark">${wait.waitMinutes} min average wait</p>
          <p class="mb-0 small text-secondary">${waitText}</p>
        </div>
        <span class="status-pill ${wait.waitLevel === 'ok' ? 'completed' : wait.waitLevel === 'warning' ? 'warning' : 'danger'}">${wait.waitMinutes < 15 ? 'Healthy' : wait.waitMinutes <= 30 ? 'Watch' : 'Critical'}</span>
      </div>
    `;
  }

  const waitTimeBreakdown = document.getElementById('waitTimeBreakdown');
  if (waitTimeBreakdown) {
    waitTimeBreakdown.innerHTML = dashboardFilters.showBreakdown
      ? '<div class="detail-card"><p class="detail-label">Bottleneck breakdown</p><p class="detail-value">Some colleges are driving the queue. Several delayed consultations need escalation.</p></div>'
      : '<p class="small text-secondary mb-0">Click the alert to inspect the delayed consultations causing the backlog.</p>';
  }

  // ── Department chips ──────────────────────────────────────────────────────
  const departmentChips = document.getElementById('departmentChips');
  if (departmentChips) departmentChips.innerHTML = renderDepartmentChips();

  // ── Queue table ───────────────────────────────────────────────────────────
  const queueTableBody = document.getElementById('queueTableBody');
  if (queueTableBody) queueTableBody.innerHTML = renderQueueTable();

  // ── Filter summary badge ──────────────────────────────────────────────────
  const dashboardBadge = document.getElementById('dashboardBadge');
  if (dashboardBadge) {
    dashboardBadge.textContent = `${getDepartmentLabel(dashboardFilters.selectedDepartment)} • ${dashboardFilters.branch === 'all' ? 'All branches' : dashboardFilters.branch}`;
  }
  const dashboardFilterSummary = document.getElementById('dashboardFilterSummary');
  if (dashboardFilterSummary) {
    const rangeLabel = dashboardFilters.dateRange === '90d' ? 'Last 90 days' : dashboardFilters.dateRange === '7d' ? 'Last 7 days' : 'Last 30 days';
    dashboardFilterSummary.textContent = `${rangeLabel} • ${dashboardFilters.physician === 'all' ? 'All physicians' : dashboardFilters.physician}`;
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  const modalHost = document.getElementById('modalHost');
  if (modalHost) modalHost.innerHTML = renderModal(dashboardFilters.activePatientId);

  // ── Charts ────────────────────────────────────────────────────────────────
  initOrUpdateFunnelChart();
  initOrUpdateHeatmapChart();
  initOrUpdateTopDiagnosesChart();
  initOrUpdateIllnessTrendChart();
  initOrUpdateVisitsByCollegeChart();
  initOrUpdateInventoryStatusChart();
}

// ─── Event listener setup (called ONCE on first render) ───────────────────────

/**
 * All event listeners are registered here exactly once.
 * Handlers mutate dashboardFilters, then call updateDom() or renderDashboard()
 * to re-render. No listeners are added inside updateDom() or fetchApiData().
 */
function initListeners(): void {
  // Filter selects
  document.getElementById('dashboardDateRange')?.addEventListener('change', (e) => {
    dashboardFilters.dateRange = (e.target as HTMLSelectElement).value;
    updateDom();
  });
  document.getElementById('dashboardBranch')?.addEventListener('change', (e) => {
    dashboardFilters.branch = (e.target as HTMLSelectElement).value;
    updateDom();
  });
  document.getElementById('dashboardPhysician')?.addEventListener('change', (e) => {
    dashboardFilters.physician = (e.target as HTMLSelectElement).value;
    updateDom();
  });
  document.getElementById('viewPeriod')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    dashboardFilters.dateRange = val === 'weekly' ? '7d' : val === 'monthly' ? '30d' : '90d';
    updateDom();
  });

  // Refresh button — re-fetches from API then re-renders
  document.getElementById('dashboardRefreshBtn')?.addEventListener('click', () => {
    void renderDashboard();
  });

  // Department chips (delegated — chips are re-rendered on each updateDom)
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-dept-filter]');
    if (!btn) return;
    dashboardFilters.selectedDepartment = btn.getAttribute('data-dept-filter') || 'all';
    dashboardFilters.showBreakdown = false;
    updateDom();
  });

  // Diagnosis filter chips (delegated)
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-diagnosis]');
    if (!btn) return;
    dashboardFilters.selectedDiagnosis = btn.getAttribute('data-diagnosis') || 'all';
    updateDom();
  });

  // Queue row click → open modal (delegated — queue is re-rendered on each updateDom)
  document.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.queue-row[data-patient-id]');
    if (!row) return;
    dashboardFilters.activePatientId = Number(row.getAttribute('data-patient-id'));
    updateDom();
  });

  // Close modal
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('#closePatientModal');
    if (btn) {
      dashboardFilters.activePatientId = null;
      updateDom();
    }
  });

  // Click outside modal to close
  document.addEventListener('click', (e) => {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop && e.target === backdrop) {
      dashboardFilters.activePatientId = null;
      updateDom();
    }
  });

  // Wait-time card toggle
  document.getElementById('waitTimeAlert')?.addEventListener('click', () => {
    dashboardFilters.showBreakdown = !dashboardFilters.showBreakdown;
    updateDom();
  });

  // Chip scroll buttons
  const chipsHost = document.getElementById('departmentChips');
  document.getElementById('chipsScrollLeft')?.addEventListener('click', () => {
    chipsHost?.scrollBy({ left: -160, behavior: 'smooth' });
  });
  document.getElementById('chipsScrollRight')?.addEventListener('click', () => {
    chipsHost?.scrollBy({ left: 160, behavior: 'smooth' });
  });
  chipsHost?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') chipsHost.scrollBy({ left: 120, behavior: 'smooth' });
    if (e.key === 'ArrowLeft')  chipsHost.scrollBy({ left: -120, behavior: 'smooth' });
  });

  // Export menu
  document.getElementById('exportDashboard')?.addEventListener('click', () => {
    const existing = document.getElementById('exportMenu');
    if (existing) { existing.remove(); return; }

    const exportBtn = document.getElementById('exportDashboard')!;
    const menu = document.createElement('div');
    menu.id = 'exportMenu';
    Object.assign(menu.style, {
      position: 'absolute', zIndex: '9999', background: 'white',
      border: '1px solid rgba(15,23,42,0.06)', borderRadius: '6px',
      padding: '6px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
    });

    const opts = [
      { id: 'json',       label: 'Export JSON' },
      { id: 'csv',        label: 'Export CSV' },
      { id: 'visits-png', label: 'Export Visits PNG' },
    ];

    opts.forEach((o) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-plain';
      Object.assign(btn.style, { display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent' });
      btn.textContent = o.label;
      btn.addEventListener('click', () => {
        const data = cachedApiData;
        if (o.id === 'json') {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'dashboard-export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        }
        if (o.id === 'csv') {
          const rows: string[] = ['metric,value'];
          (['visits_this_week', 'total_registered', 'unattended', 'pending_rechecks', 'inventory_count'] as (keyof ApiData)[]).forEach((k) => {
            rows.push(`${k},${data[k] ?? ''}`);
          });
          if (data.visits_by_college) {
            rows.push('', 'college,visits');
            Object.entries(data.visits_by_college).forEach(([col, cnt]) => rows.push(`"${col}",${cnt}`));
          }
          const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'dashboard-export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        }
        if (o.id === 'visits-png') {
          const chart = (window as any).__charts?.visitsByCollege;
          if (chart?.toBase64Image) {
            const dataUrl = chart.toBase64Image();
            const a = document.createElement('a'); a.href = dataUrl; a.download = 'visits-by-college.png'; document.body.appendChild(a); a.click(); a.remove();
          }
        }
        menu.remove();
      });
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    const rect = exportBtn.getBoundingClientRect();
    menu.style.top  = `${rect.bottom + window.scrollY + 6}px`;
    menu.style.left = `${rect.left  + window.scrollX}px`;

    // Close menu when clicking elsewhere
    const closeMenu = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  });

  // 60-second auto-refresh — re-fetches and re-renders WITHOUT resetting filters
  window.setInterval(() => void renderDashboard(), 60_000);
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Called by layout.ts on first load and by the Refresh button.
 *
 * On first call:  fetch API data → render DOM → bind all listeners.
 * On subsequent calls (filter changes, auto-refresh): fetch API data → render DOM.
 * Listeners are NEVER re-registered.
 */
export async function renderDashboard(): Promise<void> {
  // 1. Fetch live data from the PHP API (updates cachedApiData + metric card text)
  await fetchApiData();

  // 2. Re-render all dynamic UI pieces
  updateDom();

  // 3. Bind listeners exactly once
  if (!listenersInitialised) {
    listenersInitialised = true;
    initListeners();
  }
}

// ─── Global augmentation ──────────────────────────────────────────────────────

declare global {
  interface Window {
    __apiData?: ApiData;
    __charts?: Record<string, Chart>;
  }
}
