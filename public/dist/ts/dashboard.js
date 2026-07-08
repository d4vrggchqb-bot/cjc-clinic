const dashboardFilters = {
    dateRange: '30d',
    branch: 'all',
    physician: 'all',
    selectedDepartment: 'all',
    selectedDiagnosis: 'all',
    activePatientId: null,
    showBreakdown: false,
};
const waitThresholds = {
    all: 17,
    Cardiology: 24,
    'Primary Care': 16,
    Neurology: 21,
    Pediatrics: 13,
};
const queueData = [
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
function getWaitLevel(minutes) {
    if (minutes < 15)
        return 'ok';
    if (minutes <= 30)
        return 'warning';
    return 'danger';
}
function getDepartmentLabel(value) {
    return value === 'all' ? 'All colleges' : value;
}
function formatCurrency(value) {
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
function renderDepartmentChips() {
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
function renderFunnelChart(snapshot) {
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
function initOrUpdateFunnelChart(snapshot) {
    const ctx = document.getElementById('funnelCanvas');
    if (!ctx)
        return;
    const colleges = [
        'BED Department',
        'College of Accounting, Business and Entreprenueurship (CABE)',
        'College of Education and Sciences (CEDAS)',
        'College of Health Sciences (CHS)',
        'College of Computing and Information Sciences (CCIS)',
        'College of Engineering (COE)',
        'College of Special Programs (CSP)'
    ];
    // Prefer API-provided counts when available
    const apiData = window.__apiData || {};
    const apiCounts = apiData.visits_by_college || null;
    let values = [];
    if (apiCounts) {
        values = colleges.map((c) => Number(apiCounts[c] ?? 0));
    }
    else {
        const weights = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6];
        const totalWeight = weights.reduce((s, w) => s + w, 0);
        let remaining = snapshot.consultations;
        values = colleges.map((c, i) => {
            const v = i === colleges.length - 1
                ? remaining
                : Math.round(snapshot.consultations * (weights[i] / totalWeight));
            remaining -= v;
            return v;
        });
    }
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
function initOrUpdateHeatmapChart(snapshot) {
    const ctx = document.getElementById('heatmapCanvas');
    if (!ctx)
        return;
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
                    backgroundColor: labels.map((l, i) => ['#ef4444', '#f97316', '#2563eb', '#0f766e'][i % 4]),
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
function initOrUpdateTopDiagnosesChart() {
    const ctx = document.getElementById('topDiagnosesCanvas');
    if (!ctx)
        return;
    const labels = ['Hypertension', 'Asthma', 'Migraine', 'Flu', 'Allergy'];
    const data = [12, 9, 7, 5, 4];
    window.__charts = window.__charts || {};
    if (window.__charts.topDiagnoses) {
        window.__charts.topDiagnoses.data.labels = labels;
        window.__charts.topDiagnoses.data.datasets[0].data = data;
        window.__charts.topDiagnoses.update();
        return;
    }
    window.__charts.topDiagnoses = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Count', data, backgroundColor: '#ef4444' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}
function initOrUpdateIllnessTrendChart() {
    const ctx = document.getElementById('illnessTrendCanvas');
    if (!ctx)
        return;
    const labels = ['W-7', 'W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1', 'W-now'];
    const data = [0, 0, 0, 0, 0, 2, 5, 2];
    window.__charts = window.__charts || {};
    if (window.__charts.illnessTrend) {
        window.__charts.illnessTrend.data.labels = labels;
        window.__charts.illnessTrend.data.datasets[0].data = data;
        window.__charts.illnessTrend.update();
        return;
    }
    window.__charts.illnessTrend = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Visits', data, borderColor: '#a30f36', backgroundColor: 'rgba(163,15,54,0.06)', fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}
function initOrUpdateVisitsByCollegeChart(snapshot) {
    const ctx = document.getElementById('visitsByCollegeCanvas');
    if (!ctx)
        return;
    const colleges = ['BED', 'CABE', 'CEDAS', 'CHS', 'CCIS', 'COE', 'CSP', 'Employees'];
    const apiData = window.__apiData || {};
    let values = [];
    if (apiData && apiData.visits_by_college) {
        // Map full college names to short labels used here
        const mapping = {
            'BED Department': 'BED',
            'College of Accounting, Business and Entreprenueurship (CABE)': 'CABE',
            'College of Education and Sciences (CEDAS)': 'CEDAS',
            'College of Health Sciences (CHS)': 'CHS',
            'College of Computing and Information Sciences (CCIS)': 'CCIS',
            'College of Engineering (COE)': 'COE',
            'College of Special Programs (CSP)': 'CSP',
        };
        values = colleges.map((short) => {
            const full = Object.keys(mapping).find((k) => mapping[k] === short) || (short === 'Employees' ? 'Employees' : short);
            return Number(apiData.visits_by_college[full] ?? 0);
        });
    }
    else {
        values = [5, 2, 3, 1, 0, 0, 0, 2];
    }
    window.__charts = window.__charts || {};
    if (window.__charts.visitsByCollege) {
        window.__charts.visitsByCollege.data.labels = colleges;
        window.__charts.visitsByCollege.data.datasets[0].data = values;
        window.__charts.visitsByCollege.update();
        return;
    }
    window.__charts.visitsByCollege = new Chart(ctx, {
        type: 'bar',
        data: { labels: colleges, datasets: [{ label: 'Visits', data: values, backgroundColor: '#0f766e' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}
function initOrUpdateInventoryStatusChart() {
    const ctx = document.getElementById('inventoryStatusCanvas');
    if (!ctx)
        return;
    const labels = ['Syndex D', 'Paracetamol'];
    const data = [12, 102];
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}
function renderRevenueChart(snapshot) {
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
function renderQueueTable() {
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
function renderModal(patientId) {
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
export async function renderDashboard() {
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
    // Fetch metrics and college-level counts from backend API
    let apiData = {};
    try {
        const resp = await fetch('api/dashboard.php');
        if (resp.ok) {
            apiData = await resp.json();
            const visitsEl = document.getElementById('metricVisitsWeek');
            const totalEl = document.getElementById('metricTotalRegistered');
            const unattendedEl = document.getElementById('metricUnattended');
            const pendingEl = document.getElementById('metricPendingRechecks');
            const inventoryEl = document.getElementById('metricInventory');
            if (visitsEl)
                visitsEl.textContent = String(apiData.visits_this_week ?? 0);
            if (totalEl)
                totalEl.textContent = String(apiData.total_registered ?? 0);
            if (unattendedEl)
                unattendedEl.textContent = String(apiData.unattended ?? 0);
            if (pendingEl)
                pendingEl.textContent = String(apiData.pending_rechecks ?? 0);
            if (inventoryEl)
                inventoryEl.textContent = String(apiData.inventory_count ?? 0);
        }
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to fetch dashboard API', e);
    }
    // expose apiData for export and chart functions
    window.__apiData = apiData;
    if (metricPatients)
        metricPatients.textContent = String(snapshot.patients);
    if (metricPatientsTrend)
        metricPatientsTrend.textContent = `${snapshot.patientGrowth > 0 ? '+' : ''}${snapshot.patientGrowth.toFixed(1)}% vs last month`;
    if (metricConsultations)
        metricConsultations.textContent = String(snapshot.consultations);
    if (metricConsultationsTarget)
        metricConsultationsTarget.textContent = `Target ${snapshot.consultationTarget} / day`;
    if (metricWait)
        metricWait.textContent = `${snapshot.waitMinutes} min`;
    if (metricWaitState)
        metricWaitState.textContent = waitText;
    if (departmentChips)
        departmentChips.innerHTML = renderDepartmentChips();
    if (funnelChart)
        funnelChart.innerHTML = renderFunnelChart(snapshot);
    // Initialize or update Chart.js charts
    initOrUpdateFunnelChart(snapshot);
    initOrUpdateHeatmapChart(snapshot);
    initOrUpdateTopDiagnosesChart();
    initOrUpdateIllnessTrendChart();
    initOrUpdateVisitsByCollegeChart(snapshot);
    initOrUpdateInventoryStatusChart();
    if (queueTableBody)
        queueTableBody.innerHTML = renderQueueTable();
    if (dashboardBadge)
        dashboardBadge.textContent = `${getDepartmentLabel(dashboardFilters.selectedDepartment)} • ${dashboardFilters.branch === 'all' ? 'All branches' : dashboardFilters.branch}`;
    if (dashboardFilterSummary)
        dashboardFilterSummary.textContent = `${dashboardFilters.dateRange === '90d' ? 'Last 90 days' : dashboardFilters.dateRange === '7d' ? 'Last 7 days' : 'Last 30 days'} • ${dashboardFilters.physician === 'all' ? 'All physicians' : dashboardFilters.physician}`;
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
    const dateSelect = document.getElementById('dashboardDateRange');
    const branchSelect = document.getElementById('dashboardBranch');
    const physicianSelect = document.getElementById('dashboardPhysician');
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
    document.querySelectorAll('[data-dept-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            const department = button.getAttribute('data-dept-filter') || 'all';
            dashboardFilters.selectedDepartment = department;
            dashboardFilters.showBreakdown = false;
            void renderDashboard();
        });
    });
    document.querySelectorAll('[data-diagnosis]').forEach((button) => {
        button.addEventListener('click', () => {
            dashboardFilters.selectedDiagnosis = button.getAttribute('data-diagnosis') || 'all';
            void renderDashboard();
        });
    });
    const viewPeriod = document.getElementById('viewPeriod');
    const exportBtn = document.getElementById('exportDashboard');
    const refreshBtn = document.getElementById('dashboardRefreshBtn');
    viewPeriod?.addEventListener('change', () => {
        // For now, change the dateRange when viewPeriod changes to influence charts
        dashboardFilters.dateRange = viewPeriod.value === 'weekly' ? '7d' : viewPeriod.value === 'monthly' ? '30d' : '90d';
        void renderDashboard();
    });
    exportBtn?.addEventListener('click', async () => {
        // show export options menu
        const existing = document.getElementById('exportMenu');
        if (existing) {
            existing.remove();
            return;
        }
        const menu = document.createElement('div');
        menu.id = 'exportMenu';
        menu.style.position = 'absolute';
        menu.style.zIndex = '9999';
        menu.style.background = 'white';
        menu.style.border = '1px solid rgba(15,23,42,0.06)';
        menu.style.borderRadius = '6px';
        menu.style.padding = '6px';
        menu.style.boxShadow = '0 8px 24px rgba(15,23,42,0.08)';
        const opts = [
            { id: 'json', label: 'Export JSON' },
            { id: 'csv', label: 'Export CSV' },
            { id: 'visits-png', label: 'Export Visits PNG' },
        ];
        opts.forEach((o) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-plain';
            btn.style.display = 'block';
            btn.style.width = '100%';
            btn.style.textAlign = 'left';
            btn.style.padding = '8px 12px';
            btn.style.border = 'none';
            btn.style.background = 'transparent';
            btn.textContent = o.label;
            btn.addEventListener('click', async () => {
                const apiData = window.__apiData || {};
                if (o.id === 'json') {
                    const blob = new Blob([JSON.stringify(apiData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'dashboard-export.json';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                }
                if (o.id === 'csv') {
                    // flatten apiData to CSV (visits_by_college + metrics)
                    const rows = [];
                    rows.push('metric,value');
                    ['visits_this_week', 'total_registered', 'unattended', 'pending_rechecks', 'inventory_count'].forEach((k) => {
                        rows.push(`${k},${apiData[k] ?? ''}`);
                    });
                    if (apiData.visits_by_college) {
                        rows.push('');
                        rows.push('college,visits');
                        Object.keys(apiData.visits_by_college).forEach((col) => rows.push(`"${col}",${apiData.visits_by_college[col]}`));
                    }
                    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'dashboard-export.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                }
                if (o.id === 'visits-png') {
                    const chart = window.__charts?.visitsByCollege;
                    if (chart && chart.toBase64Image) {
                        const dataUrl = chart.toBase64Image();
                        const a = document.createElement('a');
                        a.href = dataUrl;
                        a.download = 'visits-by-college.png';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    }
                }
                menu.remove();
            });
            menu.appendChild(btn);
        });
        document.body.appendChild(menu);
        const rect = exportBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;
    });
    refreshBtn?.addEventListener('click', () => {
        void renderDashboard();
    });
    // Chip scroll buttons and keyboard navigation
    const chipsHost = document.getElementById('departmentChips');
    const leftBtn = document.getElementById('chipsScrollLeft');
    const rightBtn = document.getElementById('chipsScrollRight');
    leftBtn?.addEventListener('click', () => { chipsHost?.scrollBy({ left: -160, behavior: 'smooth' }); });
    rightBtn?.addEventListener('click', () => { chipsHost?.scrollBy({ left: 160, behavior: 'smooth' }); });
    chipsHost?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            chipsHost.scrollBy({ left: 120, behavior: 'smooth' });
        }
        if (e.key === 'ArrowLeft') {
            chipsHost.scrollBy({ left: -120, behavior: 'smooth' });
        }
    });
    document.querySelectorAll('[data-patient-id]').forEach((row) => {
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
//# sourceMappingURL=dashboard.js.map