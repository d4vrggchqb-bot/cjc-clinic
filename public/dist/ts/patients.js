export async function loadPatientTable(profileType = 'all') {
    const response = await fetch(`api/patients.php?type=${encodeURIComponent(profileType)}`);
    if (!response.ok) {
        return;
    }
    const data = await response.json();
    const rows = data.profiles;
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
export async function uploadPatientAttachment(file) {
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
//# sourceMappingURL=patients.js.map