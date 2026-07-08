import type { Profile, Pagination } from '../types';
import { escHtml, csrfHeaders } from './security.js';

// ─── Pagination control renderer ──────────────────────────────────────────────
function renderPagination(pagination: Pagination, containerId: string, dataAttr: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, total_pages, total_count, per_page } = pagination;
  const from = Math.min((page - 1) * per_page + 1, total_count);
  const to   = Math.min(page * per_page, total_count);

  if (total_pages <= 1) {
    container.innerHTML = `<span class="small text-secondary">${total_count} record${total_count !== 1 ? 's' : ''}</span>`;
    return;
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= total_pages;

  container.innerHTML = `
    <span class="small text-secondary">${from}–${to} of ${total_count}</span>
    <div class="d-flex gap-1">
      <button class="btn btn-sm btn-outline-secondary" ${prevDisabled ? 'disabled' : ''} data-${dataAttr}="${page - 1}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">‹ Prev</button>
      <span class="btn btn-sm btn-light disabled" style="font-size:0.75rem; padding:0.25rem 0.6rem; pointer-events:none;">${page} / ${total_pages}</span>
      <button class="btn btn-sm btn-outline-secondary" ${nextDisabled ? 'disabled' : ''} data-${dataAttr}="${page + 1}" style="font-size:0.75rem; padding:0.25rem 0.6rem;">Next ›</button>
    </div>
  `;
}

// ─── Patient table loader ─────────────────────────────────────────────────────
export async function loadPatientTable(
  profileType: string = 'all',
  page: number = 1,
  search: string = '',
): Promise<void> {
  const body = document.getElementById('patientTableBody');
  if (!body) return;

  // Show loading state
  body.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-4 text-secondary small">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Loading patient records...
      </td>
    </tr>`;

  try {
    const params = new URLSearchParams({
      type:     profileType,
      page:     String(page),
      per_page: '25',
    });
    if (search.trim()) params.set('search', search.trim());

    const response = await fetch(`api/patients.php?${params.toString()}`);
    if (!response.ok) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-danger">
            <p class="fw-semibold mb-1">Failed to load patient records</p>
            <p class="small mb-0">Server returned status ${escHtml(String(response.status))}.</p>
          </td>
        </tr>`;
      return;
    }

    const data       = await response.json();
    const rows       = data.profiles as Profile[];
    const pagination = data.pagination as Pagination | undefined;

    if (!rows || rows.length === 0) {
      body.innerHTML = `
        <tr>
          <td colspan="5" class="text-center py-5 text-secondary">
            <p class="fw-semibold mb-1">No patient profiles found</p>
            <p class="small mb-0">${search ? 'No records match your search.' : 'No records match the current filter.'}</p>
          </td>
        </tr>`;
      // Clear pagination
      const paginationEl = document.getElementById('patientPagination');
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    // Build rows using DOM methods to avoid XSS via innerHTML with server data
    const fragment = document.createDocumentFragment();
    rows.forEach((profile) => {
      const tr = document.createElement('tr');
      tr.className = 'align-middle animate-fade-in';

      const tdId = document.createElement('td');
      tdId.className = 'py-3 text-secondary font-monospace';
      tdId.style.cssText = 'font-size:0.8rem; font-weight:600;';
      tdId.textContent = `#${profile.id}`;

      const tdName = document.createElement('td');
      tdName.className = 'py-3 fw-bold text-dark';
      tdName.textContent = profile.name;

      const tdContact = document.createElement('td');
      tdContact.className = 'py-3 text-secondary';
      tdContact.textContent = profile.contact;

      const tdDept = document.createElement('td');
      tdDept.className = 'py-3 text-secondary';
      const badge = document.createElement('span');
      badge.className = 'badge bg-light text-dark border';
      badge.style.cssText = 'border-radius:0.5rem; font-size:0.72rem; font-weight:600; padding:0.3rem 0.6rem;';
      badge.textContent = profile.program_department;
      tdDept.appendChild(badge);

      const tdBlood = document.createElement('td');
      tdBlood.className = 'py-3';
      const bloodPill = document.createElement('span');
      bloodPill.className = 'stock-pill';
      bloodPill.style.fontWeight = '700';
      bloodPill.textContent = profile.blood_type || 'N/A';
      tdBlood.appendChild(bloodPill);

      tr.append(tdId, tdName, tdContact, tdDept, tdBlood);
      fragment.appendChild(tr);
    });

    body.innerHTML = '';
    body.appendChild(fragment);

    // Render pagination controls
    if (pagination) {
      renderPagination(pagination, 'patientPagination', 'pat-page');
    }
  } catch (err) {
    console.error('[CJC] loadPatientTable error:', err);
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5 text-danger">
          <p class="fw-semibold mb-1">Network error</p>
          <p class="small mb-0">Could not connect to the server. Please try again.</p>
        </td>
      </tr>`;
  }
}

// ─── File attachment upload ───────────────────────────────────────────────────
export async function uploadPatientAttachment(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('attachment', file);

  const response = await fetch('api/patients.php?action=upload', {
    method: 'POST',
    body: formData,
    ...csrfHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Upload failed (HTTP ${response.status})`);
  }

  let result: { success: boolean; message?: string; url?: string };
  try {
    result = await response.json();
  } catch {
    throw new Error('Server returned an invalid response.');
  }

  if (!result.success) {
    throw new Error(result.message || 'Upload failed');
  }
  return result.url!;
}

// ─── Active consultations loader (for the Consultation page live panel) ───────
export async function loadActiveConsultations(): Promise<void> {
  const list = document.getElementById('activeConsultationsList');
  if (!list) return;

  try {
    const response = await fetch('api/consultations.php');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data     = await response.json();
    const sessions = data.sessions as Array<{
      id: number; patient_name: string; complaint: string;
      assigned_to: string; status: string; created_at: string;
    }>;

    if (!sessions || sessions.length === 0) {
      list.innerHTML = `
        <li class="list-group-item px-0 py-4 text-center text-secondary small">
          No active sessions right now.
        </li>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    sessions.forEach((s) => {
      const statusClass =
        s.status === 'active' || s.status === 'in-progress' ? 'in-progress' :
        s.status === 'waiting' ? 'warning' : 'monitoring';

      const li = document.createElement('li');
      li.className = 'list-group-item px-0 py-3 d-flex justify-content-between align-items-start gap-3';

      const div = document.createElement('div');
      const title = document.createElement('p');
      title.className = 'mb-1 small fw-semibold text-dark';
      title.textContent = `${s.patient_name} — ${s.complaint}`;

      const sub = document.createElement('p');
      sub.className = 'mb-0 small text-secondary';
      sub.textContent = `Provider: ${s.assigned_to}`;

      div.append(title, sub);

      const pill = document.createElement('span');
      pill.className = `status-pill ${statusClass}`;
      pill.textContent = s.status;

      li.append(div, pill);
      fragment.appendChild(li);
    });

    list.innerHTML = '';
    list.appendChild(fragment);
  } catch (err) {
    console.error('[CJC] loadActiveConsultations error:', err);
    list.innerHTML = `
      <li class="list-group-item px-0 py-3 text-center text-secondary small">
        Unable to load live sessions.
      </li>`;
  }
}
