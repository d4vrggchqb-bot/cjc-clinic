import type { InventoryMetrics, Medicine } from '../types';

export async function renderDashboard(): Promise<void> {
  const response = await fetch('api/inventory.php');
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  const metrics: InventoryMetrics = data.metrics;
  const consultations = data.consultations || [];

  document.getElementById('metricVisits')!.textContent = String(metrics.today_visits ?? 4);
  document.getElementById('metricConsultations')!.textContent = String(metrics.active_consultations ?? 2);
  document.getElementById('metricLowStock')!.textContent = String(metrics.low_stock);
  document.getElementById('metricExpired')!.textContent = String(metrics.expired);
  document.getElementById('metricMedCerts')!.textContent = String(metrics.medcert_count ?? 1);

  const consultationsContainer = document.getElementById('activeConsultations');
  if (consultationsContainer) {
    consultationsContainer.innerHTML = '';
    const active = data.activeConsultations || [
      { title: 'Fever assessment', provider: 'Dr. Angela Santos', status: 'In progress' },
      { title: 'Respiratory review', provider: 'Nurse Maria Luz', status: 'Monitoring' }
    ];
    active.forEach((item: any) => {
      const node = document.createElement('div');
      node.className = 'dashboard-list-card mb-3 p-3';
      node.innerHTML = `
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <p class="mb-1 small fw-semibold text-dark">${item.title}</p>
            <p class="mb-0 small text-secondary">Provider: ${item.provider}</p>
          </div>
          <span class="status-pill">${item.status}</span>
        </div>
      `;
      consultationsContainer.appendChild(node);
    });
  }

  const inventoryBreakdown = document.getElementById('inventoryBreakdown');
  if (inventoryBreakdown) {
    inventoryBreakdown.innerHTML = '';
    (data.items ?? []).slice(0, 3).forEach((item: Medicine) => {
      const block = document.createElement('div');
      block.className = 'dashboard-list-card mb-3 p-3';
      block.innerHTML = `
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <p class="small text-uppercase text-secondary mb-2">${item.category}</p>
            <p class="h6 mb-1 text-dark">${item.brand_name}</p>
            <p class="small text-secondary mb-0">${item.generic_name || 'Generic'} • Stock ${item.stock}</p>
          </div>
          <span class="stock-pill">${item.stock} in stock</span>
        </div>
      `;
      inventoryBreakdown.appendChild(block);
    });
  }
}
