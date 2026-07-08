import type { Medicine, RequestTimeline, Pagination, VisitRecord } from '../types';
import { escHtml } from './security.js';

// ─── Status helpers ───────────────────────────────────────────────────────────
function getStatusClass(status: string): string {
  const val = (status || '').toLowerCase();
  if (val.includes('progress') || val.includes('transit') || val.includes('route')) return 'in-progress';
  if (val.includes('monitor') || val.includes('pend')) return 'monitoring';
  if (val.includes('complete') || val.includes('deliver') || val.includes('success') || val.includes('received')) return 'completed';
  if (val.includes('low') || val.includes('warn')) return 'low-stock';
  if (val.includes('expire') || val.includes('danger') || val.includes('dispos')) return 'expired';
  return 'monitoring';
}

// ─── Pagination control renderer ──────────────────────────────────────────────
function renderPagination(pagination: Pagination, containerId: string, dataAttr: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, total_pages, total_count, per_page } = pagination;
  const from = Math.min((page - 1) * per_page + 1, total_count);
  const to   = Math.min(page * per_page, total_count);

  if (total_pages <= 1) {
    container.innerHTML = `<span class="small text-secondary">${total_count} item${total_count !== 1 ? 's' : ''}</span>`;
    return;
  }

  container.innerHTML = `
    <span class="small text-secondary">${from}–${to} of ${total_count}</span>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-outline-secondary" ${page <= 1 ? 'disabled' : ''} data-${dataAttr}="${page - 1}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">‹ Prev</button>
      <span class="btn btn-sm btn-light disabled" style="font-size:0.75rem; padding:0.25rem 0.6rem; pointer-events:none;">${page} / ${total_pages}</span>
      <button class="btn btn-sm btn-outline-secondary" ${page >= total_pages ? 'disabled' : ''} data-${dataAttr}="${page + 1}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">Next ›</button>
    </div>
  `;
}

// ─── Inventory loader ─────────────────────────────────────────────────────────
// Accepts either a category string (legacy) or a full URL string (paginated use)
export async function loadInventory(categoryOrUrl: string = 'all'): Promise<void> {
  const listContainer     = document.getElementById('inventoryList');
  const timelineContainer = document.getElementById('timelineRequests');

  // Build the URL: if arg is a full URL use it directly, otherwise build from category
  const url = categoryOrUrl.startsWith('api/')
    ? categoryOrUrl
    : `api/inventory.php?category=${encodeURIComponent(categoryOrUrl)}&per_page=20`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="text-center py-5 text-danger">
            <p class="fw-semibold mb-1">Failed to load inventory</p>
            <p class="small mb-0">Server returned status ${escHtml(String(response.status))}.</p>
          </div>`;
      }
      return;
    }

    const data       = await response.json();
    const items      = data.items      as Medicine[];
    const requests   = data.requests   as RequestTimeline[];
    const pagination = data.pagination as Pagination | undefined;

    // ── Inventory items ────────────────────────────────────────────────────────
    if (listContainer) {
      if (!items || items.length === 0) {
        listContainer.innerHTML = `
          <div class="text-center py-5 text-secondary">
            <p class="fw-semibold mb-1">No items found</p>
            <p class="small mb-0">No inventory products match the selected category or search.</p>
          </div>`;
      } else {
        listContainer.innerHTML = items.map((item) => {
          const stockNum   = Number(item.stock);
          const stockClass = stockNum === 0 ? 'empty' : (stockNum <= 10 ? 'low' : '');
          const badgeText  = stockNum === 0 ? 'Out of Stock' : `${escHtml(String(item.stock))} in stock`;

          return `
            <div class="dashboard-list-card animate-fade-in">
              <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <p class="small text-uppercase text-secondary mb-1" style="font-size:0.65rem; font-weight:700; letter-spacing:0.04em;">${escHtml(item.category)}</p>
                  <p class="h6 mb-1 text-dark" style="font-weight:600;">${escHtml(item.brand_name)}</p>
                  <p class="mb-1 small text-secondary">Generic: ${escHtml(item.generic_name || 'N/A')}</p>
                  <div class="d-flex align-items-center gap-2 mt-2">
                    <span class="small text-secondary" style="font-size:0.75rem;">Status:</span>
                    <span class="status-pill ${escHtml(getStatusClass(item.status))}" style="padding: 0.2rem 0.6rem; font-size:0.65rem;">${escHtml(item.status)}</span>
                  </div>
                </div>
                <span class="stock-pill ${escHtml(stockClass)}">${badgeText}</span>
              </div>
            </div>`;
        }).join('');
      }

      // Pagination controls
      if (pagination) {
        renderPagination(pagination, 'inventoryPagination', 'inv-page');
      }
    }

    // ── Purchase request timeline ──────────────────────────────────────────────
    if (timelineContainer) {
      if (!requests || requests.length === 0) {
        timelineContainer.innerHTML = `
          <div class="text-center py-4 text-secondary">
            <p class="small mb-0">No procurement timeline requests logged.</p>
          </div>`;
      } else {
        timelineContainer.innerHTML = requests.map((request) => {
          const statusClass = getStatusClass(request.transit_status);
          return `
            <div class="dashboard-list-card animate-fade-in">
              <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <p class="mb-1 small fw-semibold text-dark">${escHtml(request.item_name)}</p>
                  <p class="mb-0 small text-secondary" style="font-size:0.75rem;">Requested: ${escHtml(request.requested_date)}</p>
                </div>
                <span class="status-pill ${escHtml(statusClass)}">${escHtml(request.transit_status)}</span>
              </div>
              <div class="row mt-3 gx-3 gy-2" style="border-top:1px solid rgba(15,23,42,0.04); padding-top:0.75rem;">
                <div class="col-sm-6">
                  <p class="mb-0 small text-secondary" style="font-size:0.75rem;"><span class="fw-semibold">Delivery:</span> ${escHtml(request.delivery_date || 'TBD')}</p>
                </div>
                <div class="col-sm-6">
                  <p class="mb-0 small text-secondary" style="font-size:0.75rem;"><span class="fw-semibold">Manifest:</span> ${escHtml(request.manifest_details || 'Pending')}</p>
                </div>
              </div>
            </div>`;
        }).join('');
      }
    }
  } catch (err) {
    console.error('[CJC] loadInventory error:', err);
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="text-center py-5 text-danger">
          <p class="fw-semibold mb-1">Network error</p>
          <p class="small mb-0">Could not connect to the server. Please try again.</p>
        </div>`;
    }
  }
}

// ─── Visitation history loader ────────────────────────────────────────────────
export async function loadVisitationHistory(page: number = 1, search: string = ''): Promise<void> {
  const listEl  = document.getElementById('visitationList');
  const pagEl   = document.getElementById('visitationPagination');
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="text-center py-5 text-secondary small">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Loading visit records...
    </div>`;

  try {
    const params = new URLSearchParams({ page: String(page), per_page: '20' });
    if (search.trim()) params.set('search', search.trim());

    const response = await fetch(`api/visitation.php?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data       = await response.json();
    const visits     = data.visits     as VisitRecord[];
    const pagination = data.pagination as Pagination | undefined;

    if (!visits || visits.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-5 text-secondary">
          <p class="fw-semibold mb-1">No visit records found</p>
          <p class="small mb-0">${search ? 'No results match your search.' : 'No consultations have been recorded yet.'}</p>
        </div>`;
      if (pagEl) pagEl.innerHTML = '';
      return;
    }

    // Build list using DOM methods (XSS-safe)
    const fragment = document.createDocumentFragment();
    visits.forEach((v) => {
      const statusClass =
        v.status === 'active' || v.status === 'in-progress' ? 'in-progress' :
        v.status === 'completed' ? 'completed' :
        v.status === 'no-show' ? 'expired' : 'monitoring';

      const item = document.createElement('div');
      item.className = 'list-group-item px-0 py-3 border-bottom d-flex justify-content-between align-items-start gap-3';

      const infoDiv = document.createElement('div');

      const title = document.createElement('p');
      title.className = 'mb-1 small fw-semibold text-dark';
      title.textContent = `${v.patient_name} — ${v.complaint}`;

      const sub = document.createElement('p');
      sub.className = 'mb-0 small text-secondary';
      const dateStr = v.created_at ? new Date(v.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
      sub.textContent = `${dateStr}${v.department ? ' • ' + v.department : ''} • ${v.assigned_to}`;

      infoDiv.append(title, sub);

      const pill = document.createElement('span');
      pill.className = `status-pill ${statusClass}`;
      pill.style.whiteSpace = 'nowrap';
      pill.textContent = v.status;

      item.append(infoDiv, pill);
      fragment.appendChild(item);
    });

    listEl.innerHTML = '';
    listEl.appendChild(fragment);

    if (pagination && pagEl) {
      renderPagination(pagination, 'visitationPagination', 'visit-page');
    }
  } catch (err) {
    console.error('[CJC] loadVisitationHistory error:', err);
    listEl.innerHTML = `
      <div class="text-center py-5 text-danger">
        <p class="fw-semibold mb-1">Network error</p>
        <p class="small mb-0">Could not load visit history. Please try again.</p>
      </div>`;
  }
}
