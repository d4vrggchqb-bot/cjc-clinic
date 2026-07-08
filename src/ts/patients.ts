import type { Profile } from '../types';

export async function loadPatientTable(profileType: string = 'all'): Promise<void> {
  const response = await fetch(`api/patients.php?type=${encodeURIComponent(profileType)}`);
  if (!response.ok) {
    return;
  }
  const data = await response.json();
  const rows = data.profiles as Profile[];
  const body = document.getElementById('patientTableBody');
  if (!body) {
    return;
  }
  
  if (rows.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-5 text-secondary">
          <p class="fw-semibold mb-1">No patient profiles found</p>
          <p class="small mb-0">No records match the current filter selection.</p>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows.map((profile) => `
    <tr class="align-middle animate-fade-in">
      <td class="py-3 text-secondary font-monospace" style="font-size:0.8rem; font-weight:600;">#${profile.id}</td>
      <td class="py-3 fw-bold text-dark">${profile.name}</td>
      <td class="py-3 text-secondary">${profile.contact}</td>
      <td class="py-3 text-secondary">
        <span class="badge bg-light text-dark border px-2.5 py-1.5" style="border-radius: 0.5rem; font-size: 0.72rem; font-weight: 600;">
          ${profile.program_department}
        </span>
      </td>
      <td class="py-3">
        <span class="stock-pill" style="font-weight: 700;">${profile.blood_type || 'N/A'}</span>
      </td>
    </tr>
  `).join('');
}

export async function uploadPatientAttachment(file: File): Promise<string> {
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
