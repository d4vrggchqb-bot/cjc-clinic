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

declare const Chart: any;

const dashboardFilters: DashboardFilters = {
  dateRange: '30d',
  branch: 'all',
  physician: 'all',
  selectedDepartment: 'all',
  selectedDiagnosis: 'all',
  activePatientId: null,
  showBreakdown: false,
};

const waitThresholds: Record<string, number> = {
  all: 17,
  Cardiology: 24,
  'Primary Care': 16,
  Neurology: 21,
  Pediatrics: 13,
};

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

function getWaitLevel(minutes: number): WaitLevel {
  if (minutes < 15) return 'ok';
  if (minutes <= 30) return 'warning';
  return 'danger';
}

function getDepartmentLabel(value: string): string {
  return value === 'all' ? 'All colleges' : value;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getSnapshot() {
  const branchMultiplier = dashboardFilters.branch === 'all' ? 1 : dashboardFilters.branch === 'north' ? 1.08 : 0.94;
  const physicianMultiplier = dashboardFilters.physician === 'all' ? 1 : dashboardFilters.physician === 'dr-arias' ? 1.03 : 0.97;
  // For college-level view we keep a neutral multiplier; refine per-college weights later.
  const departmentMultiplier = 1;

  const patients = Math.round(1842 * branchMultiplier * physicianMultiplier * departmentMultiplier);
  const consultations = Math.round(128 * branchMultiplier * physicianMultiplier * (dashboardFilters.selectedDepartment === 'Neurology' ? 1.07 : 1));
  const waitMinutes = Math.round(waitThresholds[dashboardFilters.selectedDepartment] ?? waitThresholds.all * (dashboardFilters.branch === 'north' ? 1.08 : 1));
  const revenue = Math.round(84250 * branchMultiplier * physicianMultiplier);
  const currentDateRange = dashboardFilters.dateRange === '90d' ? '90 days' : dashboardFilters.dateRange === '7d' ? '7 days' : '30 days';

  return {
    patients,
    patientGrowth: dashboardFilters.dateRange === '90d' ? 18.2 : dashboardFilters.dateRange === '7d' ? 6.8 : 12.4,
    consultations,
    consultationTarget: 150,
    waitMinutes,
    waitLevel: getWaitLevel(waitMinutes),
    revenue,
    dateRangeLabel: currentDateRange,
  };
}

function renderDepartmentChips(): string {
  const departments = [
    'all',
    'BED Department',
    'College of Accounting, Business and Entreprenueurship (CABE)',
    'College of Education and Sciences (CEDAS)',
    'College of Health Sciences (CHS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Engineering (COE)',
    'College of Special Programs (CSP)'
  ];
  return departments.map((department) => `
    <button class="department-chip ${dashboardFilters.selectedDepartment === department ? 'active' : ''}" data-dept-filter="${department}" type="button">
      ${getDepartmentLabel(department)}
    </button>
  `).join('');
}

function renderFunnelChart(snapshot: ReturnType<typeof getSnapshot>): string {
  // Colleges for the school clinic funnel
  const colleges = [
    'BED Department',
    'College of Accounting, Business and Entreprenueurship (CABE)',
    'College of Education and Sciences (CEDAS)',
    'College of Health Sciences (CHS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Engineering (COE)',
    'College of Special Programs (CSP)'
  ];

  // distribute consultations across colleges using sample weights
  const weights = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let remaining = snapshot.consultations;
  const values = colleges.map((c, i) => {
    const v = i === colleges.length - 1
      ? remaining
      : Math.round(snapshot.consultations * (weights[i] / totalWeight));
    remaining -= v;
    return v;
  });

  const tones = ['teal', 'maroon', 'blue', 'teal', 'maroon', 'blue', 'teal'];

  return `
    <div class="chart-rail colleges-rail">
      ${colleges.map((label, i) => `
        <div class="funnel-bar ${tones[i % tones.length]}" role="button" data-dept-filter="${label}">
          <div class="funnel-label">${label}</div>
          <div class="funnel-value">${values[i]}</div>
          <div class="funnel-caption">College-level consultations</div>
        </div>
      `).join('')}
    </div>
  `;
}

function initOrUpdateFunnelChart(snapshot: ReturnType<typeof getSnapshot>) {
  const ctx = document.getElementById('funnelCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;
  const colleges = [
    'BED Department',
    'College of Accounting, Business and Entreprenueurship (CABE)',
    'College of Education and Sciences (CEDAS)',
    'College of Health Sciences (CHS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Engineering (COE)',
    'College of Special Programs (CSP)'
  ];

  const weights = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let remaining = snapshot.consultations;
  const values = colleges.map((c, i) => {
    const v = i === colleges.length - 1
      ? remaining
      : Math.round(snapshot.consultations * (weights[i] / totalWeight));
    remaining -= v;
    return v;
  });

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
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });
}

function initOrUpdateHeatmapChart(snapshot: ReturnType<typeof getSnapshot>) {
  const ctx = document.getElementById('heatmapCanvas') as HTMLCanvasElement | null;
  if (!ctx) return;

  // Example diagnosis counts (replace with real API data later)
  const labels = ['Hypertension', 'Asthma', 'Migraine', 'Pediatric flu'];
  const data = [24, 19, 16, 14];

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
        backgroundColor: labels.map((l, i) => ['#ef4444','#f97316','#2563eb','#0f766e'][i % 4]),
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true } }
    }
  });
}

function renderRevenueChart(snapshot: ReturnType<typeof getSnapshot>): string {
  const weeklyRevenue = [42, 56, 51, 64, 69, 74, 78].map((value) => Math.round(value * (snapshot.revenue / 84000)));
  return `
    <div class="dual-axis-chart">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <p class="mb-1 fw-semibold text-dark">High-value hours</p>
          <p class="mb-0 small text-secondary">Revenue vs completed consultations</p>
        </div>
        <span class="status-pill completed">Peak at 14:00</span>
      </div>
      <div class="dual-axis-bars">
        ${weeklyRevenue.map((value, index) => `
          <div class="axis-column">
            <div class="axis-bar revenue" style="height: ${Math.min(100, Math.round(value / 12))}%"></div>
            <div class="axis-bar consult" style="height: ${Math.min(100, 45 + index * 4)}%"></div>
            <span class="axis-label">${['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
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
  if (!patientId) {
    return '';
  }

  const patient = queueData.find((item) => item.id === patientId);
  if (!patient) {
    return '';
  }

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

export async function renderDashboard(): Promise<void> {
  const snapshot = getSnapshot();
  const waitText = snapshot.waitLevel === 'ok' ? 'Stable operations' : snapshot.waitLevel === 'warning' ? 'Monitor queue' : 'Immediate attention';

  const metricPatients = document.getElementById('metricPatients');
  const metricPatientsTrend = document.getElementById('metricPatientsTrend');
  const metricConsultations = document.getElementById('metricConsultations');
  const metricConsultationsTarget = document.getElementById('metricConsultationsTarget');
  const metricWait = document.getElementById('metricWait');
  const metricWaitState = document.getElementById('metricWaitState');
  const departmentChips = document.getElementById('departmentChips');
  const funnelChart = document.getElementById('funnelChart');
  const heatmapGrid = document.getElementById('heatmapGrid');
  const queueTableBody = document.getElementById('queueTableBody');
  const waitTimeAlert = document.getElementById('waitTimeAlert');
  const waitTimeBreakdown = document.getElementById('waitTimeBreakdown');
  const dashboardBadge = document.getElementById('dashboardBadge');
  const dashboardFilterSummary = document.getElementById('dashboardFilterSummary');
  const modalHost = document.getElementById('modalHost');

  // Fetch real metrics for the school clinic dashboard cards
  try {
    const resp = await fetch('api/dashboard.php');
    if (resp.ok) {
      const db = await resp.json();
      const visitsEl = document.getElementById('metricVisitsWeek');
      const totalEl = document.getElementById('metricTotalRegistered');
      const unattendedEl = document.getElementById('metricUnattended');
      const pendingEl = document.getElementById('metricPendingRechecks');
      const inventoryEl = document.getElementById('metricInventory');

      if (visitsEl) visitsEl.textContent = String(db.visits_this_week ?? 0);
      if (totalEl) totalEl.textContent = String(db.total_registered ?? 0);
      if (unattendedEl) unattendedEl.textContent = String(db.unattended ?? 0);
      if (pendingEl) pendingEl.textContent = String(db.pending_rechecks ?? 0);
      if (inventoryEl) inventoryEl.textContent = String(db.inventory_count ?? 0);
    }
  } catch (e) {
    // fallback: keep generated snapshot values for other charts
    // eslint-disable-next-line no-console
    console.warn('Failed to fetch dashboard API', e);
  }

  if (metricPatients) metricPatients.textContent = String(snapshot.patients);
  if (metricPatientsTrend) metricPatientsTrend.textContent = `${snapshot.patientGrowth > 0 ? '+' : ''}${snapshot.patientGrowth.toFixed(1)}% vs last month`;
  if (metricConsultations) metricConsultations.textContent = String(snapshot.consultations);
  if (metricConsultationsTarget) metricConsultationsTarget.textContent = `Target ${snapshot.consultationTarget} / day`;
  if (metricWait) metricWait.textContent = `${snapshot.waitMinutes} min`;
  if (metricWaitState) metricWaitState.textContent = waitText;
  if (departmentChips) departmentChips.innerHTML = renderDepartmentChips();
  if (funnelChart) funnelChart.innerHTML = renderFunnelChart(snapshot);
  // Initialize or update Chart.js charts
  initOrUpdateFunnelChart(snapshot);
  initOrUpdateHeatmapChart(snapshot);
  if (queueTableBody) queueTableBody.innerHTML = renderQueueTable();
  if (dashboardBadge) dashboardBadge.textContent = `${getDepartmentLabel(dashboardFilters.selectedDepartment)} • ${dashboardFilters.branch === 'all' ? 'All branches' : dashboardFilters.branch}`;
  if (dashboardFilterSummary) dashboardFilterSummary.textContent = `${dashboardFilters.dateRange === '90d' ? 'Last 90 days' : dashboardFilters.dateRange === '7d' ? 'Last 7 days' : 'Last 30 days'} • ${dashboardFilters.physician === 'all' ? 'All physicians' : dashboardFilters.physician}`;

  if (waitTimeAlert) {
    waitTimeAlert.className = `wait-time-card ${snapshot.waitLevel}`;
    waitTimeAlert.innerHTML = `
      <div class="d-flex justify-content-between align-items-start gap-3">
        <div>
          <p class="mb-1 fw-semibold text-dark">${snapshot.waitMinutes} min average wait</p>
          <p class="mb-0 small text-secondary">${waitText}</p>
        </div>
        <span class="status-pill ${snapshot.waitLevel === 'ok' ? 'completed' : snapshot.waitLevel === 'warning' ? 'warning' : 'danger'}">${snapshot.waitMinutes < 15 ? 'Healthy' : snapshot.waitMinutes <= 30 ? 'Watch' : 'Critical'}</span>
      </div>
    `;
  }

  if (waitTimeBreakdown) {
    waitTimeBreakdown.innerHTML = dashboardFilters.showBreakdown
      ? '<div class="detail-card"><p class="detail-label">Bottleneck breakdown</p><p class="detail-value">Some colleges are driving the queue. Several delayed consultations need escalation.</p></div>'
      : '<p class="small text-secondary mb-0">Click the alert to inspect the delayed consultations causing the backlog.</p>';
  }

  if (modalHost) {
    modalHost.innerHTML = renderModal(dashboardFilters.activePatientId);
  }

  const dateSelect = document.getElementById('dashboardDateRange') as HTMLSelectElement | null;
  const branchSelect = document.getElementById('dashboardBranch') as HTMLSelectElement | null;
  const physicianSelect = document.getElementById('dashboardPhysician') as HTMLSelectElement | null;
  dateSelect?.addEventListener('change', () => {
    dashboardFilters.dateRange = dateSelect.value;
    void renderDashboard();
  });
  branchSelect?.addEventListener('change', () => {
    dashboardFilters.branch = branchSelect.value;
    void renderDashboard();
  });
  physicianSelect?.addEventListener('change', () => {
    dashboardFilters.physician = physicianSelect.value;
    void renderDashboard();
  });

  document.querySelectorAll<HTMLElement>('[data-dept-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const department = button.getAttribute('data-dept-filter') || 'all';
      dashboardFilters.selectedDepartment = department;
      dashboardFilters.showBreakdown = false;
      void renderDashboard();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-diagnosis]').forEach((button) => {
    button.addEventListener('click', () => {
      dashboardFilters.selectedDiagnosis = button.getAttribute('data-diagnosis') || 'all';
      void renderDashboard();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-patient-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = Number(row.getAttribute('data-patient-id'));
      dashboardFilters.activePatientId = id;
      void renderDashboard();
    });
  });

  const waitCard = document.getElementById('waitTimeAlert');
  waitCard?.addEventListener('click', () => {
    dashboardFilters.showBreakdown = !dashboardFilters.showBreakdown;
    void renderDashboard();
  });

  const closeModalButton = document.getElementById('closePatientModal');
  closeModalButton?.addEventListener('click', () => {
    dashboardFilters.activePatientId = null;
    void renderDashboard();
  });

  const backdrop = document.getElementById('modalBackdrop');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      dashboardFilters.activePatientId = null;
      void renderDashboard();
    }
  });

  if (!window.__dashboardRefreshHooked) {
    window.__dashboardRefreshHooked = true;
    window.setInterval(() => {
      dashboardFilters.dateRange = '30d';
      void renderDashboard();
    }, 60000);
  }
}

declare global {
  interface Window {
    __dashboardRefreshHooked?: boolean;
    __charts?: Record<string, any>;
  }
}
