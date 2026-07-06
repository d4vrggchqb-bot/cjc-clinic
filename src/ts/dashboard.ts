import type { InventoryMetrics, Medicine } from '../types';

export async function renderDashboard(): Promise<void> {
  const response = await fetch('api/inventory.php');
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  const metrics: InventoryMetrics = data.metrics;
  const requests: Medicine[] = data.items;
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
      node.className = 'rounded-3xl border border-slate-200 bg-slate-50 p-4';
      node.innerHTML = `
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-slate-900">${item.title}</p>
            <p class="mt-1 text-sm text-slate-500">Provider: ${item.provider}</p>
          </div>
          <span class="rounded-full bg-[#f44b38]/10 px-3 py-1 text-xs font-semibold text-[#f44b38]">${item.status}</span>
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
      block.className = 'rounded-3xl border border-slate-200 bg-white p-4';
      block.innerHTML = `
        <p class="text-sm text-slate-500">${item.category.toUpperCase()}</p>
        <p class="mt-2 text-lg font-semibold text-slate-900">${item.brand_name}</p>
        <p class="text-sm text-slate-500">${item.generic_name || 'Generic'} • Stock ${item.stock}</p>
      `;
      inventoryBreakdown.appendChild(block);
    });
  }
}
