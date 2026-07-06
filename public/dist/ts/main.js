import { renderDashboard } from './dashboard';
import { loadPatientTable, uploadPatientAttachment } from './patients';
import { loadInventory } from './inventory';
const tabs = Array.from(document.querySelectorAll('[data-view]'));
const views = Array.from(document.querySelectorAll('main section'));
async function updateDashboard() {
    await renderDashboard();
}
async function updatePatients() {
    const filter = document.getElementById('patientTypeFilter');
    await loadPatientTable(filter?.value || 'all');
}
async function updateInventory(category = 'all') {
    await loadInventory(category);
}
function setActiveView(viewId) {
    views.forEach((view) => {
        view.classList.toggle('d-none', view.id !== `${viewId}View`);
    });
    tabs.forEach((button) => {
        if (button.dataset.view === viewId) {
            button.classList.add('btn-light', 'text-dark');
            button.classList.remove('btn-outline-light', 'text-white');
        }
        else {
            button.classList.remove('btn-light', 'text-dark');
            button.classList.add('btn-outline-light', 'text-white');
        }
    });
}
function bindEvents() {
    tabs.forEach((button) => {
        button.addEventListener('click', async () => {
            setActiveView(button.dataset.view ?? 'dashboard');
            if (button.dataset.view === 'dashboard') {
                await updateDashboard();
            }
            if (button.dataset.view === 'patients') {
                await updatePatients();
            }
            if (button.dataset.view === 'inventory') {
                await updateInventory();
            }
            if (button.dataset.view === 'consultations') {
                await updateDashboard();
            }
            if (button.dataset.view === 'history') {
                await updateDashboard();
            }
        });
    });
    const patientTypeFilter = document.getElementById('patientTypeFilter');
    patientTypeFilter?.addEventListener('change', async () => {
        await updatePatients();
    });
    const patientUploadForm = document.getElementById('patientUploadForm');
    patientUploadForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById('patientUploadFile');
        const status = document.getElementById('patientUploadStatus');
        if (!fileInput?.files?.length) {
            if (status)
                status.textContent = 'Please select a file to upload.';
            return;
        }
        const file = fileInput.files[0];
        if (status)
            status.textContent = 'Uploading...';
        try {
            const url = await uploadPatientAttachment(file);
            if (status)
                status.textContent = `Upload successful: ${url}`;
            fileInput.value = '';
        }
        catch (error) {
            if (status)
                status.textContent = error.message;
        }
    });
    const inventoryCategory = document.getElementById('inventoryCategoryFilter');
    inventoryCategory?.addEventListener('change', async () => {
        await updateInventory(inventoryCategory.value);
    });
    const medcertForm = document.getElementById('medcertForm');
    medcertForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(medcertForm);
        const status = document.getElementById('medcertStatus');
        const preview = document.getElementById('medcertPreview');
        if (status)
            status.textContent = 'Generating certificate preview...';
        try {
            const result = await fetch('api/medcert.php', {
                method: 'POST',
                body: formData,
            });
            const data = await result.json();
            if (data.success) {
                if (preview)
                    preview.innerHTML = data.preview;
                if (status)
                    status.textContent = 'Certificate preview updated.';
            }
            else {
                if (status)
                    status.textContent = data.message || 'Unable to generate certificate.';
            }
        }
        catch (error) {
            if (status)
                status.textContent = 'Could not connect to server.';
        }
    });
}
window.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    setActiveView('dashboard');
    await updateDashboard();
});
//# sourceMappingURL=main.js.map