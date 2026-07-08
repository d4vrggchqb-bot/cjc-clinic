function getStatusClass(status) {
    const val = (status || '').toLowerCase();
    if (val.includes('progress') || val.includes('transit') || val.includes('route'))
        return 'in-progress';
    if (val.includes('monitor') || val.includes('pend'))
        return 'monitoring';
    if (val.includes('complete') || val.includes('deliver') || val.includes('success') || val.includes('received'))
        return 'completed';
    if (val.includes('low') || val.includes('warn'))
        return 'low-stock';
    if (val.includes('expire') || val.includes('danger') || val.includes('dispos'))
        return 'expired';
    return 'monitoring'; // fallback for custom statuses
}
export async function loadInventory(category = 'all') {
    const response = await fetch(`api/inventory.php?category=${encodeURIComponent(category)}`);
    if (!response.ok) {
        return;
    }
    const data = await response.json();
    const items = data.items;
    const listContainer = document.getElementById('inventoryList');
    if (listContainer) {
        if (items.length === 0) {
            listContainer.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <p class="fw-semibold mb-1">No items found</p>
          <p class="small mb-0">No inventory products match the selected category filter.</p>
        </div>
      `;
        }
        else {
            listContainer.innerHTML = items.map((item) => {
                const stockNum = Number(item.stock);
                const stockClass = stockNum === 0 ? 'empty' : (stockNum <= 10 ? 'low' : '');
                const badgeText = stockNum === 0 ? 'Out of Stock' : `${item.stock} in stock`;
                return `
          <div class="dashboard-list-card animate-fade-in">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div>
                <p class="small text-uppercase text-secondary mb-1" style="font-size:0.65rem; font-weight:700; letter-spacing:0.04em;">${item.category}</p>
                <p class="h6 mb-1 text-dark" style="font-weight:600;">${item.brand_name}</p>
                <p class="mb-1 small text-secondary">Generic: ${item.generic_name || 'N/A'}</p>
                <div class="d-flex align-items-center gap-2 mt-2">
                  <span class="small text-secondary" style="font-size:0.75rem;">Status:</span>
                  <span class="status-pill ${getStatusClass(item.status)}" style="padding: 0.2rem 0.6rem; font-size:0.65rem;">${item.status}</span>
                </div>
              </div>
              <span class="stock-pill ${stockClass}">${badgeText}</span>
            </div>
          </div>
        `;
            }).join('');
        }
    }
    const timelineContainer = document.getElementById('timelineRequests');
    if (timelineContainer) {
        const requests = data.requests;
        if (requests.length === 0) {
            timelineContainer.innerHTML = `
        <div class="text-center py-4 text-secondary">
          <p class="small mb-0">No procurement timeline requests logged.</p>
        </div>
      `;
        }
        else {
            timelineContainer.innerHTML = requests.map((request) => {
                const statusClass = getStatusClass(request.transit_status);
                return `
          <div class="dashboard-list-card animate-fade-in">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div>
                <p class="mb-1 small fw-semibold text-dark">${request.item_name}</p>
                <p class="mb-0 small text-secondary" style="font-size:0.75rem;">Requested Date: ${request.requested_date}</p>
              </div>
              <span class="status-pill ${statusClass}">${request.transit_status}</span>
            </div>
            <div class="row mt-3 gx-3 gy-2" style="border-top: 1px solid rgba(15,23,42,0.04); padding-top: 0.75rem;">
              <div class="col-sm-6">
                <p class="mb-0 small text-secondary" style="font-size:0.75rem;"><span class="fw-semibold">Delivery Date:</span> ${request.delivery_date || 'To Be Determined (TBD)'}</p>
              </div>
              <div class="col-sm-6">
                <p class="mb-0 small text-secondary" style="font-size:0.75rem;"><span class="fw-semibold">Tracking Manifest:</span> ${request.manifest_details || 'Pending Details'}</p>
              </div>
            </div>
          </div>
        `;
            }).join('');
        }
    }
}
//# sourceMappingURL=inventory.js.map