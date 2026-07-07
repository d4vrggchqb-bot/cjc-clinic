import type { Medicine, RequestTimeline } from '../types';

export async function loadInventory(category: string = 'all'): Promise<void> {
  const response = await fetch(`api/inventory.php?category=${encodeURIComponent(category)}`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const items = data.items as Medicine[];
  const listContainer = document.getElementById('inventoryList');
  if (listContainer) {
    listContainer.innerHTML = items.map((item) => `
      <div class="dashboard-list-card mb-3 p-3">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <p class="small text-uppercase text-secondary mb-1">${item.category}</p>
            <p class="h6 mb-1 text-dark">${item.brand_name}</p>
            <p class="mb-1 small text-secondary">Generic: ${item.generic_name || 'N/A'}</p>
            <p class="mb-0 small text-secondary">Status: ${item.status}</p>
          </div>
          <span class="stock-pill">${item.stock} in stock</span>
        </div>
      </div>
    `).join('');
  }

  const timelineContainer = document.getElementById('timelineRequests');
  if (timelineContainer) {
    const requests = data.requests as RequestTimeline[];
    timelineContainer.innerHTML = requests.map((request) => `
      <div class="dashboard-list-card mb-3 p-3">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <p class="mb-1 small fw-semibold text-dark">${request.item_name}</p>
            <p class="mb-0 small text-secondary">Requested: ${request.requested_date}</p>
          </div>
          <span class="status-pill">${request.transit_status}</span>
        </div>
        <div class="row mt-3 gx-3 gy-2">
          <div class="col-sm-6">
            <p class="mb-0 small text-secondary">Delivery date: ${request.delivery_date || 'TBD'}</p>
          </div>
          <div class="col-sm-6">
            <p class="mb-0 small text-secondary">Manifest: ${request.manifest_details || 'Pending details'}</p>
          </div>
        </div>
      </div>
    `).join('');
  }
}
