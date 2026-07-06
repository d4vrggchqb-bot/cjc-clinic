export async function loadInventory(category = 'all') {
    const response = await fetch(`api/inventory.php?category=${encodeURIComponent(category)}`);
    if (!response.ok) {
        return;
    }
    const data = await response.json();
    const items = data.items;
    const listContainer = document.getElementById('inventoryList');
    if (listContainer) {
        listContainer.innerHTML = items.map((item) => `
      <div class="card border-0 shadow-sm rounded-4 mb-3">
        <div class="card-body p-3">
          <div class="row align-items-center gy-3 gx-4">
            <div class="col">
              <p class="small text-uppercase text-secondary mb-1">${item.category}</p>
              <p class="h6 mb-1 text-dark">${item.brand_name}</p>
            </div>
            <div class="col-auto">
              <p class="mb-0 small text-secondary">Stock: ${item.stock}</p>
            </div>
          </div>
          <p class="mt-3 mb-1 small text-secondary">Generic: ${item.generic_name || 'N/A'}</p>
          <p class="mb-0 small text-secondary">Status: ${item.status}</p>
        </div>
      </div>
    `).join('');
    }
    const timelineContainer = document.getElementById('timelineRequests');
    if (timelineContainer) {
        const requests = data.requests;
        timelineContainer.innerHTML = requests.map((request) => `
      <div class="card border-0 shadow-sm rounded-4 mb-3">
        <div class="card-body p-3">
          <div class="row align-items-center gy-3 gx-4">
            <div class="col">
              <p class="mb-1 small fw-semibold text-dark">${request.item_name}</p>
              <p class="mb-0 small text-secondary">Requested: ${request.requested_date}</p>
            </div>
            <div class="col-auto">
              <span class="badge rounded-pill ${request.transit_status === 'delivered' ? 'badge-status-delivered' : request.transit_status === 'in transit' ? 'badge-status-in-transit' : 'badge-status-default'} text-uppercase small">${request.transit_status}</span>
            </div>
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
      </div>
    `).join('');
    }
}
//# sourceMappingURL=inventory.js.map