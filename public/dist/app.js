const tabs = Array.from(document.querySelectorAll('[data-view]'));
const views = Array.from(document.querySelectorAll('main section'));

async function renderDashboard() {
  const response = await fetch('api/inventory.php');
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const metrics = data.metrics || {};

  document.getElementById('metricVisits').textContent = String(metrics.today_visits || 0);
  document.getElementById('metricConsultations').textContent = String(metrics.active_consultations || 0);
  document.getElementById('metricLowStock').textContent = String(metrics.low_stock || 0);
  document.getElementById('metricExpired').textContent = String(metrics.expired || 0);
  document.getElementById('metricMedCerts').textContent = String(metrics.medcert_count || 0);

  const consultationsContainer = document.getElementById('activeConsultations');
  if (consultationsContainer) {
    consultationsContainer.innerHTML = '';
    const active = data.activeConsultations || [
      { title: 'Fever assessment', provider: 'Dr. Angela Santos', status: 'In progress' },
      { title: 'Respiratory review', provider: 'Nurse Maria Luz', status: 'Monitoring' }
    ];
    active.forEach((item) => {
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
    (data.items || []).slice(0, 3).forEach((item) => {
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

async function loadPatientTable(profileType = 'all') {
  const response = await fetch(`api/patients.php?type=${encodeURIComponent(profileType)}`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const rows = data.profiles || [];
  const body = document.getElementById('patientTableBody');
  if (!body) {
    return;
  }
  body.innerHTML = rows.map((profile) => `
    <tr class="border-b border-slate-100">
      <td class="px-6 py-4 text-sm text-slate-700">${profile.id}</td>
      <td class="px-6 py-4 text-sm font-semibold text-slate-900">${profile.name}</td>
      <td class="px-6 py-4 text-sm text-slate-600">${profile.contact}</td>
      <td class="px-6 py-4 text-sm text-slate-600">${profile.program_department}</td>
      <td class="px-6 py-4 text-sm text-slate-600">${profile.blood_type}</td>
    </tr>
  `).join('');
}

async function uploadPatientAttachment(file) {
  const formData = new FormData();
  formData.append('attachment', file);
  const response = await fetch('api/patients.php?action=upload', {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Upload failed');
  }
  return result.url;
}

async function loadInventory(category = 'all') {
  const response = await fetch(`api/inventory.php?category=${encodeURIComponent(category)}`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const items = data.items || [];
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
    const requests = data.requests || [];
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

function setActiveView(viewId) {
  views.forEach((view) => {
    view.classList.toggle('hidden', view.id !== `${viewId}View`);
  });
  tabs.forEach((button) => {
    if (button.dataset.view === viewId) {
      button.classList.add('bg-white', 'text-slate-900');
      button.classList.remove('bg-white/10', 'text-slate-100');
    } else {
      button.classList.remove('bg-white', 'text-slate-900');
      button.classList.add('bg-white/10', 'text-slate-100');
    }
  });
}

function bindEvents() {
  tabs.forEach((button) => {
    button.addEventListener('click', async () => {
      setActiveView(button.dataset.view || 'dashboard');
      if (button.dataset.view === 'dashboard') {
        await renderDashboard();
      }
      if (button.dataset.view === 'patients') {
        await loadPatientTable(document.getElementById('patientTypeFilter').value);
      }
      if (button.dataset.view === 'inventory') {
        await loadInventory(document.getElementById('inventoryCategoryFilter').value);
      }
    });
  });

  const patientTypeFilter = document.getElementById('patientTypeFilter');
  patientTypeFilter === null || patientTypeFilter.addEventListener('change', async () => {
    await loadPatientTable(patientTypeFilter.value);
  });

  const patientUploadForm = document.getElementById('patientUploadForm');
  patientUploadForm === null || patientUploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fileInput = document.getElementById('patientUploadFile');
    const status = document.getElementById('patientUploadStatus');
    if (!fileInput.files.length) {
      if (status) status.textContent = 'Please select a file to upload.';
      return;
    }
    const file = fileInput.files[0];
    if (status) status.textContent = 'Uploading...';
    try {
      const url = await uploadPatientAttachment(file);
      if (status) status.textContent = `Upload successful: ${url}`;
      fileInput.value = '';
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  });

  const inventoryCategory = document.getElementById('inventoryCategoryFilter');
  inventoryCategory === null || inventoryCategory.addEventListener('change', async () => {
    await loadInventory(inventoryCategory.value);
  });

  const medcertForm = document.getElementById('medcertForm');
  medcertForm === null || medcertForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(medcertForm);
    const status = document.getElementById('medcertStatus');
    const preview = document.getElementById('medcertPreview');
    if (status) status.textContent = 'Generating certificate preview...';
    try {
      const result = await fetch('api/medcert.php', {
        method: 'POST',
        body: formData,
      });
      const data = await result.json();
      if (data.success) {
        if (preview) preview.innerHTML = data.preview;
        if (status) status.textContent = 'Certificate preview updated.';
      } else {
        if (status) status.textContent = data.message || 'Unable to generate certificate.';
      }
    } catch (error) {
      if (status) status.textContent = 'Could not connect to server.';
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  setActiveView('dashboard');
  await renderDashboard();
});
