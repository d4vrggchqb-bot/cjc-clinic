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
      <div class="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm uppercase tracking-[0.24em] text-slate-500">${item.category}</p>
            <p class="mt-1 text-lg font-semibold text-slate-900">${item.brand_name}</p>
          </div>
          <p class="text-sm text-slate-600">Stock: ${item.stock}</p>
        </div>
        <p class="mt-3 text-sm text-slate-500">Generic: ${item.generic_name || 'N/A'}</p>
        <p class="mt-1 text-sm text-slate-500">Status: ${item.status}</p>
      </div>
    `).join('');
    }
    const timelineContainer = document.getElementById('timelineRequests');
    if (timelineContainer) {
        const requests = data.requests;
        timelineContainer.innerHTML = requests.map((request) => `
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-sm font-semibold text-slate-900">${request.item_name}</p>
            <p class="text-sm text-slate-500">Requested: ${request.requested_date}</p>
          </div>
          <span class="rounded-full ${request.transit_status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : request.transit_status === 'in transit' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'} px-3 py-1 text-xs font-semibold uppercase">${request.transit_status}</span>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <p class="text-sm text-slate-500">Delivery date: ${request.delivery_date || 'TBD'}</p>
          <p class="text-sm text-slate-500">Manifest: ${request.manifest_details || 'Pending details'}</p>
        </div>
      </div>
    `).join('');
    }
}
//# sourceMappingURL=inventory.js.map