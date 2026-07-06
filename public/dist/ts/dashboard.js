export async function renderDashboard() {
    const response = await fetch('api/inventory.php');
    if (!response.ok) {
        return;
    }
    const data = await response.json();
    const metrics = data.metrics;
    const consultations = data.consultations || [];
    document.getElementById('metricVisits').textContent = String(metrics.today_visits ?? 4);
    document.getElementById('metricConsultations').textContent = String(metrics.active_consultations ?? 2);
    document.getElementById('metricLowStock').textContent = String(metrics.low_stock);
    document.getElementById('metricExpired').textContent = String(metrics.expired);
    document.getElementById('metricMedCerts').textContent = String(metrics.medcert_count ?? 1);
    const consultationsContainer = document.getElementById('activeConsultations');
    if (consultationsContainer) {
        consultationsContainer.innerHTML = '';
        const active = data.activeConsultations || [
            { title: 'Fever assessment', provider: 'Dr. Angela Santos', status: 'In progress' },
            { title: 'Respiratory review', provider: 'Nurse Maria Luz', status: 'Monitoring' }
        ];
        active.forEach((item) => {
            const node = document.createElement('div');
            node.className = 'card border-0 shadow-sm rounded-4 mb-3';
            node.innerHTML = `
        <div class="card-body p-3">
          <div class="d-flex align-items-start justify-content-between gap-3">
            <div>
              <p class="mb-1 small fw-semibold text-dark">${item.title}</p>
              <p class="mb-0 small text-secondary">Provider: ${item.provider}</p>
            </div>
            <span class="badge rounded-pill bg-light text-dark">${item.status}</span>
          </div>
        </div>
      `;
            consultationsContainer.appendChild(node);
        });
    }
    const inventoryBreakdown = document.getElementById('inventoryBreakdown');
    if (inventoryBreakdown) {
        inventoryBreakdown.innerHTML = '';
        (data.items ?? []).slice(0, 3).forEach((item) => {
            const block = document.createElement('div');
            block.className = 'card border-0 shadow-sm rounded-4 mb-3';
            block.innerHTML = `
        <div class="card-body p-3">
          <p class="small text-uppercase text-secondary mb-2">${item.category}</p>
          <p class="h6 mb-1 text-dark">${item.brand_name}</p>
          <p class="small text-secondary mb-0">${item.generic_name || 'Generic'} � Stock ${item.stock}</p>
        </div>
      `;
            inventoryBreakdown.appendChild(block);
        });
    }
}
//# sourceMappingURL=dashboard.js.map