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
  body.innerHTML = rows.map((profile) => `
    <tr class="border-bottom align-middle">
      <td class="py-3 align-middle text-secondary">${profile.id}</td>
      <td class="py-3 align-middle fw-semibold text-dark">${profile.name}</td>
      <td class="py-3 align-middle text-secondary">${profile.contact}</td>
      <td class="py-3 align-middle text-secondary">${profile.program_department}</td>
      <td class="py-3 align-middle">
        <span class="stock-pill">${profile.blood_type || 'N/A'}</span>
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
