import type { InventoryMetrics, Medicine } from '../types';

function getStatusClass(status: string): string {
  const val = (status || '').toLowerCase();
  if (val.includes('progress') || val.includes('transit')) return 'in-progress';
  if (val.includes('monitor')) return 'monitoring';
  if (val.includes('complete') || val.includes('deliver') || val.includes('success')) return 'completed';
  if (val.includes('low') || val.includes('warn')) return 'low-stock';
  if (val.includes('expire') || val.includes('danger') || val.includes('dispos')) return 'expired';
  return '';
}

export async function renderDashboard(): Promise<void> {
  const response = await fetch('api/inventory.php');
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  const metrics: InventoryMetrics = data.metrics;

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
      node.className = 'dashboard-list-card animate-fade-in';

      const isProgress = item.status === 'In progress';
      const isMonitor = item.status === 'Monitoring';
      const dotHtml = isProgress
        ? '<span class="pulse-dot"></span>'
        : (isMonitor ? '<span class="pulse-dot warning"></span>' : '');

      node.innerHTML = `
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              ${dotHtml}
              <p class="mb-0 small fw-semibold text-dark">${item.title}</p>
            </div>
            <p class="mb-0 small text-secondary">Provider: ${item.provider}</p>
          </div>
          <span class="status-pill ${getStatusClass(item.status)}">${item.status}</span>
        </div>
      `;
      consultationsContainer.appendChild(node);
    });
  }

  const inventoryBreakdown = document.getElementById('inventoryBreakdown');
  if (inventoryBreakdown) {
    inventoryBreakdown.innerHTML = '';
    const items = data.items ?? [];
    const lowStockItems = items.filter((item: Medicine) => Number(item.stock) <= 10).slice(0, 3);
    const displayItems = lowStockItems.length > 0 ? lowStockItems : items.slice(0, 3);

    displayItems.forEach((item: Medicine) => {
      const block = document.createElement('div');
      block.className = 'dashboard-list-card animate-fade-in';

      const stockNum = Number(item.stock);
      const stockClass = stockNum === 0 ? 'empty' : (stockNum <= 10 ? 'low' : '');
      const badgeText = stockNum === 0 ? 'Out of Stock' : `${item.stock} in stock`;

      block.innerHTML = `
        <div class="d-flex align-items-start justify-content-between gap-3">
          <div>
            <p class="small text-uppercase text-secondary mb-1" style="font-size:0.65rem; font-weight:700; letter-spacing:0.04em;">${item.category}</p>
            <p class="h6 mb-1 text-dark" style="font-weight:600;">${item.brand_name}</p>
            <p class="small text-secondary mb-0">${item.generic_name || 'Generic Product'}</p>
          </div>
          <span class="stock-pill ${stockClass}">${badgeText}</span>
        </div>
      `;
      inventoryBreakdown.appendChild(block);
    });
  }
}
