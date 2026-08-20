// Base URL of the PHP API (when running decoupled)
// Automatically use the current hostname so it works over WiFi (e.g., from a phone)
import { offlineDb } from './db';
import { syncManager } from './syncManager';

const API_BASE_URL = '';
let cachedCsrfToken: string | null = null;

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  try {
    const res = await fetch(`${API_BASE_URL}/api/csrf.php`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.token) {
      cachedCsrfToken = data.token;
      return data.token;
    }
  } catch (e) {
    // Offline or CSRF unreachable
  }
  return '';
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const isForm = options.body instanceof FormData;
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isForm && !headers['Content-Type'] && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  // Inject CSRF token if method modifies state
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const token = await getCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  const isOnline = syncManager.getIsOnline();

  // These routes must ALWAYS go to the server — never silently queue offline.
  // A stale isOnline=false flag (e.g. from a failed ping) should never block them.
  const ALWAYS_ONLINE_ROUTES = [
    'route=auth',       // all user management: create_user, delete_user, change_password
    'route=settings',
    'route=users',
    'action=add_user',
    'action=delete_user',
    'action=change_password',
    'action=login',
    'action=google_login',
    'action=request_password_reset',
    'action=perform_password_reset',
  ];
  const mustBeLive = ALWAYS_ONLINE_ROUTES.some(r => endpoint.includes(r));

  // Also trust the browser's own live network flag — if navigator.onLine is true,
  // the device has connectivity regardless of what our cached ping result says.
  const browserSaysOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Only short-circuit to offline queue when we are CERTAIN we are offline:
  // – syncManager says offline AND browser also says offline AND route is not in the bypass list
  if (!isOnline && !browserSaysOnline && !mustBeLive && method !== 'GET') {
    return handleOfflineMutation(endpoint, options);
  }


  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'include',
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      const cleanText = text.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
      return {
        success: false,
        error: cleanText ? `Server returned: ${cleanText.substring(0, 150)}` : `Server error (${res.status})`
      };
    }

    // Cache successful GET responses in background for offline use
    if (method === 'GET' && data) {
      handleCacheResponse(endpoint, data);
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);

    // If network failed, attempt offline fallback
    if (method === 'GET') {
      const fallbackData = await handleOfflineGetFallback(endpoint);
      if (fallbackData !== null) {
        return fallbackData;
      }
    } else if (!mustBeLive) {
      // POST/PUT/DELETE failed due to network error -> queue it only if not mustBeLive
      return handleOfflineMutation(endpoint, options);
    }

    throw err;
  }
}

function parseSafeDate(d: any): number {
  if (!d) return 0;
  if (typeof d === 'number') return d;
  const str = String(d).trim();
  const formatted = str.includes(' ') ? str.replace(' ', 'T') : str;
  const time = new Date(formatted).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Handle caching GET API responses into IndexedDB & localStorage
 */
async function handleCacheResponse(endpoint: string, data: any) {
  try {
    if (endpoint.includes('action=check_session') && data.success && data.user) {
      localStorage.setItem('cjc_cached_session_user', JSON.stringify(data.user));
    } else if (endpoint.includes('route=settings&action=get') && data.settings) {
      localStorage.setItem('cjc_cached_settings', JSON.stringify(data.settings));
    } else if (endpoint.includes('route=patients&action=list') && Array.isArray(data.profiles)) {
      const allLocal = await offlineDb.getAll<any>('patients');
      const pendingOffline = allLocal.filter(p => String(p.id).startsWith('temp-') || p.sync_status === 'pending_sync');

      // Save normalized server profiles + pending offline profiles
      const normalizedServer = data.profiles.map((p: any) => ({
        ...p,
        id: p.id,
        name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed Patient',
        first_name: String(p.first_name || ''),
        last_name: String(p.last_name || ''),
        patient_id_number: String(p.patient_id_number || ''),
        contact: String(p.contact || ''),
        program_department: String(p.program_department || p.college_dept || p.course || ''),
      }));

      const serverIdSet = new Set(normalizedServer.map((p: any) => String(p.id)));
      const uniquePending = pendingOffline.filter(p => !serverIdSet.has(String(p.id)));

      await offlineDb.clear('patients');
      await offlineDb.setMany('patients', [...normalizedServer, ...uniquePending]);
    } else if (endpoint.includes('route=inventory&action=items') && Array.isArray(data.items)) {
      await offlineDb.setMany('inventory', data.items);
    } else if (endpoint.includes('route=consultation') && Array.isArray(data.sessions)) {
      const allLocal = await offlineDb.getAll<any>('consultations');
      const pendingOffline = allLocal.filter(c => String(c.id).startsWith('temp-') || c.sync_status === 'pending_sync');

      const serverIdSet = new Set(data.sessions.map((s: any) => String(s.id)));
      const uniquePending = pendingOffline.filter(c => !serverIdSet.has(String(c.id)));

      await offlineDb.clear('consultations');
      await offlineDb.setMany('consultations', [...data.sessions, ...uniquePending]);
    } else if (endpoint.includes('route=borrowings') && (Array.isArray(data.checked_out) || Array.isArray(data.history))) {
      const list = data.checked_out || data.history || [];
      await offlineDb.setMany('borrowings', list);
    }
  } catch (e) {
    console.warn('Failed to cache response to IndexedDB:', e);
  }
}

/**
 * Provide cached fallback responses when offline
 */
async function handleOfflineGetFallback(endpoint: string): Promise<any | null> {
  try {
    // 1. Session check
    if (endpoint.includes('action=check_session')) {
      const cached = localStorage.getItem('cjc_cached_session_user');
      if (cached) {
        const user = JSON.parse(cached);
        return { success: true, user, offline: true };
      }
      return { success: false, offline: true };
    }

    // 2. Global settings
    if (endpoint.includes('route=settings&action=get')) {
      const cached = localStorage.getItem('cjc_cached_settings');
      if (cached) {
        return { success: true, settings: JSON.parse(cached), offline: true };
      }
      return { success: true, settings: {}, offline: true };
    }

    // 3. Patient single profile
    if (endpoint.includes('route=patients&action=get')) {
      const urlObj = new URL(endpoint, 'http://localhost');
      const id = urlObj.searchParams.get('id');
      if (id) {
        const all = await offlineDb.getAll<any>('patients');
        const p = all.find(item => String(item.id) === String(id));
        if (p) return { success: true, profile: p, offline: true };
      }
      return { success: false, error: 'Patient not found offline', offline: true };
    }

    // 4. Patient check ID number
    if (endpoint.includes('route=patients&action=check_id')) {
      const urlObj = new URL(endpoint, 'http://localhost');
      const idNum = String(urlObj.searchParams.get('id_number') || '').trim().toLowerCase();
      if (idNum) {
        const all = await offlineDb.getAll<any>('patients');
        const exists = all.some(item => String(item.patient_id_number || '').trim().toLowerCase() === idNum);
        return { success: true, exists, offline: true };
      }
      return { success: true, exists: false, offline: true };
    }

    // 5. Patient quick search
    if (endpoint.includes('route=patients&action=search')) {
      const urlObj = new URL(endpoint, 'http://localhost');
      const q = String(urlObj.searchParams.get('search') || urlObj.searchParams.get('q') || '').trim().toLowerCase();
      const all = await offlineDb.getAll<any>('patients');
      const results = all.filter(p => {
        if (!q) return true;
        const firstName = String(p.first_name || '').toLowerCase();
        const lastName = String(p.last_name || '').toLowerCase();
        const name = String(p.name || `${firstName} ${lastName}`).trim().toLowerCase();
        const idNum = String(p.patient_id_number || '').toLowerCase();
        const contact = String(p.contact || '').toLowerCase();
        return name.includes(q) || firstName.includes(q) || lastName.includes(q) || idNum.includes(q) || contact.includes(q);
      }).slice(0, 15);
      return { success: true, results, offline: true };
    }

    // 6. Patient list with filtering, search, and pagination
    if (endpoint.includes('route=patients&action=list') || endpoint.includes('route=patients')) {
      const urlObj = new URL(endpoint, 'http://localhost');
      const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
      const perPage = parseInt(urlObj.searchParams.get('per_page') || '25', 10);
      const search = String(urlObj.searchParams.get('search') || '').trim().toLowerCase();
      const filterType = urlObj.searchParams.get('type') || 'all';
      const dept = String(urlObj.searchParams.get('dept') || '').trim().toLowerCase();
      const program = String(urlObj.searchParams.get('program') || '').trim().toLowerCase();
      const year = String(urlObj.searchParams.get('year') || '').trim().toLowerCase();
      const sort = urlObj.searchParams.get('sort') || 'newest';

      let cachedPatients = await offlineDb.getAll<any>('patients');

      // Normalize each patient profile for consistent UI display
      cachedPatients = cachedPatients.map(p => {
        const firstName = String(p.first_name || '');
        const lastName = String(p.last_name || '');
        const fullName = String(p.name || `${firstName} ${lastName}`).trim() || 'Unnamed Patient';
        return {
          ...p,
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          patient_id_number: String(p.patient_id_number || ''),
          contact: String(p.contact || ''),
          program_department: String(p.program_department || p.college_dept || p.course || ''),
        };
      });

      // Apply Filters
      let filtered = cachedPatients.filter(p => {
        if (filterType !== 'all' && p.profile_type !== filterType) {
          return false;
        }
        if (search) {
          const fullName = String(p.name || '').toLowerCase();
          const firstName = String(p.first_name || '').toLowerCase();
          const lastName = String(p.last_name || '').toLowerCase();
          const combinedRev = `${lastName} ${firstName}`.toLowerCase();
          const combinedRevComma = `${lastName}, ${firstName}`.toLowerCase();
          const idNum = String(p.patient_id_number || '').toLowerCase();
          const contact = String(p.contact || '').toLowerCase();
          const progDept = String(p.program_department || '').toLowerCase();

          const matches = fullName.includes(search) ||
                          firstName.includes(search) ||
                          lastName.includes(search) ||
                          combinedRev.includes(search) ||
                          combinedRevComma.includes(search) ||
                          idNum.includes(search) ||
                          contact.includes(search) ||
                          progDept.includes(search);

          if (!matches) return false;
        }
        if (dept) {
          const pDept = String(p.college_dept || p.program_department || '').toLowerCase();
          if (!pDept.includes(dept)) return false;
        }
        if (program) {
          const pProg = String(p.course || '').toLowerCase();
          if (!pProg.includes(program)) return false;
        }
        if (year) {
          const pYear = String(p.year_level || '').toLowerCase();
          if (!pYear.includes(year)) return false;
        }
        return true;
      });

      // Apply Sorting
      filtered.sort((a, b) => {
        if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
        if (sort === 'name_desc') return (b.name || '').localeCompare(a.name || '');
        if (sort === 'dept_asc') return (a.program_department || '').localeCompare(b.program_department || '');
        if (sort === 'oldest') {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : (typeof a.id === 'number' ? a.id : 0);
          const timeB = b.created_at ? new Date(b.created_at).getTime() : (typeof b.id === 'number' ? b.id : 0);
          return timeA - timeB;
        }

        // Default 'newest':
        // 1. Pending sync offline items always at the top
        const aIsTemp = String(a.id).startsWith('temp-') || a.sync_status === 'pending_sync';
        const bIsTemp = String(b.id).startsWith('temp-') || b.sync_status === 'pending_sync';
        if (aIsTemp && !bIsTemp) return -1;
        if (!aIsTemp && bIsTemp) return 1;

        // 2. By created_at date or numeric ID descending
        const timeA = a.created_at ? new Date(a.created_at).getTime() : (typeof a.id === 'number' ? a.id * 1000 : 0);
        const timeB = b.created_at ? new Date(b.created_at).getTime() : (typeof b.id === 'number' ? b.id * 1000 : 0);
        return timeB - timeA;
      });

      // Pagination slice
      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
      const startIndex = (page - 1) * perPage;
      const pageItems = filtered.slice(startIndex, startIndex + perPage);

      return {
        profiles: pageItems,
        pagination: {
          page,
          per_page: perPage,
          total_count: totalCount,
          total_pages: totalPages,
        },
        offline: true,
      };
    }

    // 7. Inventory catalog
    if (endpoint.includes('route=inventory&action=items')) {
      const cachedItems = await offlineDb.getAll<any>('inventory');
      return { items: cachedItems, offline: true };
    }

    if (endpoint.includes('route=inventory&action=batches')) {
      const cachedBatches = await offlineDb.getAll<any>('inventory_batches');
      return { batches: cachedBatches, offline: true };
    }

    // 8. Consultations list & history
    if (endpoint.includes('route=consultations') || endpoint.includes('route=consultation')) {
      const urlObj = new URL(endpoint, 'http://localhost');
      const action = urlObj.searchParams.get('action') || 'list';

      if (action === 'history' || action === 'profile_history') {
        const profileId = urlObj.searchParams.get('profile_id') || urlObj.searchParams.get('id');
        const all = await offlineDb.getAll<any>('consultations');
        const history = all.filter(c => String(c.profile_id) === String(profileId));
        return { success: true, history, sessions: history, offline: true };
      }

      if (action === 'analyze_vitals') {
        return {
          success: true,
          severity: 'normal',
          alerts: [],
          suggested_diagnosis: [],
          suggested_treatment: [],
          offline: true,
        };
      }

      // Default: consultation logbook queue
      const statusFilter = urlObj.searchParams.get('status') || 'all';
      const branchFilter = urlObj.searchParams.get('branch') || 'All Branches';
      const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
      const perPage = parseInt(urlObj.searchParams.get('per_page') || '10', 10);

      let cachedConsultations = await offlineDb.getAll<any>('consultations');
      const allPatients = await offlineDb.getAll<any>('patients');

      // Hydrate missing patient details
      cachedConsultations = cachedConsultations.map(c => {
        let pName = c.patient_name || '';
        let pIdNum = c.patient_id_number || '';
        if (!pName || !pIdNum) {
          const p = allPatients.find(item => String(item.id) === String(c.profile_id));
          if (p) {
            pName = pName || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
            pIdNum = pIdNum || p.patient_id_number || '';
          }
        }
        return {
          ...c,
          patient_name: pName || 'Patient',
          patient_id_number: String(pIdNum || ''),
          time_in: c.time_in || c.created_at || new Date().toISOString(),
          status: c.status || 'waiting',
        };
      });

      // Filter
      let filtered = cachedConsultations.filter(c => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (branchFilter !== 'All Branches' && c.clinic_branch && c.clinic_branch !== branchFilter) return false;
        return true;
      });

      // Sort newest first: Pending sync offline items always at the top, then newest time_in
      filtered.sort((a, b) => {
        const aIsTemp = String(a.id).startsWith('temp-') || a.sync_status === 'pending_sync';
        const bIsTemp = String(b.id).startsWith('temp-') || b.sync_status === 'pending_sync';
        if (aIsTemp && !bIsTemp) return -1;
        if (!aIsTemp && bIsTemp) return 1;

        const timeA = parseSafeDate(a.time_in || a.created_at);
        const timeB = parseSafeDate(b.time_in || b.created_at);
        return timeB - timeA;
      });

      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

      return {
        sessions: pageItems,
        total_pages: totalPages,
        total_count: filtered.length,
        offline: true,
      };
    }

    // 9. Equipment borrowings
    if (endpoint.includes('route=borrowings&action=checked_out')) {
      const cached = await offlineDb.getAll<any>('borrowings');
      return { checked_out: cached.filter(b => b.status === 'active'), offline: true };
    }

    if (endpoint.includes('route=borrowings&action=recent_history')) {
      const cached = await offlineDb.getAll<any>('borrowings');
      return { history: cached, offline: true };
    }
  } catch (e) {
    console.warn('Offline fallback error:', e);
  }
  return null;
}

/**
 * Handle queuing mutations when offline
 */
async function handleOfflineMutation(endpoint: string, options: RequestInit): Promise<any> {
  let bodyData: any = {};
  if (options.body && typeof options.body === 'string') {
    try {
      bodyData = JSON.parse(options.body);
    } catch {
      bodyData = {};
    }
  }

  // 1. Patient Profile Creation (Offline)
  if (endpoint.includes('route=patients') && (endpoint.includes('action=create') || endpoint.includes('action=add'))) {
    const tempId = 'temp-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const fullName = `${bodyData.first_name || ''} ${bodyData.last_name || ''}`.trim() || 'Unnamed Patient';
    const programDept = bodyData.college_dept || bodyData.course || '';

    const patientData = {
      ...bodyData,
      id: tempId,
      name: fullName,
      program_department: programDept,
      created_at: new Date().toISOString(),
      sync_status: 'pending_sync',
    };

    await offlineDb.put('patients', patientData);
    await syncManager.queueAction('create_patient', { ...bodyData, temp_id: tempId });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'create_patient', patient: patientData } }));
    }

    return {
      success: true,
      offline: true,
      id: tempId,
      message: 'Patient profile recorded locally. Will sync automatically once connected.',
    };
  }

  // 2. Patient Profile Update (Offline)
  if (endpoint.includes('route=patients') && endpoint.includes('action=update')) {
    const existing = await offlineDb.get<any>('patients', bodyData.id);
    const fullName = `${bodyData.first_name || existing?.first_name || ''} ${bodyData.last_name || existing?.last_name || ''}`.trim();
    const programDept = bodyData.college_dept || bodyData.course || existing?.college_dept || existing?.course || '';

    const updated = {
      ...(existing || {}),
      ...bodyData,
      name: fullName,
      program_department: programDept,
      sync_status: 'pending_sync',
    };

    await offlineDb.put('patients', updated);
    await syncManager.queueAction('update_patient', bodyData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'update_patient', patient: updated } }));
    }

    return {
      success: true,
      offline: true,
      id: bodyData.id,
      message: 'Patient updated locally (Offline Mode).',
    };
  }

  // 3. Consultation Admission / Check-in (Offline) - Allowed for Admin, Staff & Superadmin
  if ((endpoint.includes('route=consultations') || endpoint.includes('route=consultation')) && endpoint.includes('action=create')) {
    const tempId = 'temp-cons-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    // Look up patient name & details from IndexedDB
    let patientName = bodyData.patient_name || '';
    let patientIdNum = bodyData.patient_id_number || '';
    let clinicBranch = bodyData.clinic_branch || 'College Clinic';

    if (bodyData.profile_id) {
      let patient = await offlineDb.get<any>('patients', bodyData.profile_id);
      if (!patient) {
        const allPatients = await offlineDb.getAll<any>('patients');
        patient = allPatients.find(p => String(p.id) === String(bodyData.profile_id));
      }
      if (patient) {
        patientName = patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
        patientIdNum = String(patient.patient_id_number || patientIdNum || '');
        if (patient.sub_type === 'BED') clinicBranch = 'Basic Education Clinic';
      }
    }

    const cachedUser = localStorage.getItem('cjc_cached_session_user');
    let attendedBy = 'Clinic Staff';
    if (cachedUser) {
      try {
        const u = JSON.parse(cachedUser);
        attendedBy = u.name || u.username || attendedBy;
        if (u.clinic_branch && !bodyData.clinic_branch) clinicBranch = u.clinic_branch;
      } catch {}
    }

    const consData = {
      id: tempId,
      profile_id: bodyData.profile_id,
      patient_id_number: patientIdNum,
      patient_name: patientName,
      purpose: bodyData.purpose || 'General Consultation',
      complaint: bodyData.complaint || '',
      status: 'waiting',
      time_in: new Date().toISOString(),
      time_out: null,
      clinic_branch: clinicBranch,
      attended_by: attendedBy,
      created_at: new Date().toISOString(),
      sync_status: 'pending_sync',
    };

    await offlineDb.put('consultations', consData);
    await syncManager.queueAction('create_consultation', { ...bodyData, temp_id: tempId, status: 'waiting' });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'create_consultation', consultation: consData } }));
    }

    return {
      success: true,
      offline: true,
      id: tempId,
      message: 'Patient admitted locally (Offline Mode).',
    };
  }

  // 4. Save Consultation Medical Notes, Vitals & Dispensing (Offline)
  if ((endpoint.includes('route=consultations') || endpoint.includes('route=consultation')) && (endpoint.includes('action=saveNotes') || endpoint.includes('action=save_notes'))) {
    const existing = await offlineDb.get<any>('consultations', bodyData.id);
    const updatedCons = {
      ...(existing || {}),
      id: bodyData.id,
      blood_pressure: bodyData.blood_pressure || existing?.blood_pressure || '',
      temperature: bodyData.temperature || existing?.temperature || '',
      weight: bodyData.weight || existing?.weight || '',
      pulse: bodyData.pulse || existing?.pulse || '',
      diagnosis: bodyData.diagnosis !== undefined ? bodyData.diagnosis : (existing?.diagnosis || ''),
      treatment: bodyData.treatment !== undefined ? bodyData.treatment : (existing?.treatment || ''),
      status: 'completed',
      time_out: new Date().toISOString(),
      sync_status: 'pending_sync',
    };

    await offlineDb.put('consultations', updatedCons);

    // Deduct stock from local offline inventory cache
    if (Array.isArray(bodyData.dispensed_items) && bodyData.dispensed_items.length > 0) {
      const currentInventory = await offlineDb.getAll<any>('inventory');
      for (const di of bodyData.dispensed_items) {
        const inv = currentInventory.find(i => i.id === di.item_id);
        if (inv) {
          inv.remaining_stock = Math.max(0, (inv.remaining_stock || 0) - (di.quantity || 0));
          inv.total_stock = Math.max(0, (inv.total_stock || 0) - (di.quantity || 0));
          await offlineDb.put('inventory', inv);
        }
      }
    }

    await syncManager.queueAction('save_notes', bodyData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'save_notes', consultation: updatedCons } }));
    }

    return {
      success: true,
      offline: true,
      message: 'Medical notes and vital signs saved locally (Offline Mode).',
    };
  }

  // 5. Update Consultation Time-In or Status (Offline)
  if ((endpoint.includes('route=consultations') || endpoint.includes('route=consultation')) && endpoint.includes('action=update')) {
    const existing = await offlineDb.get<any>('consultations', bodyData.id);
    const updated = { ...(existing || {}), ...bodyData, sync_status: 'pending_sync' };
    await offlineDb.put('consultations', updated);
    await syncManager.queueAction('update_consultation', bodyData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'update_consultation', consultation: updated } }));
    }

    return {
      success: true,
      offline: true,
      message: 'Consultation updated locally (Offline Mode).',
    };
  }

  // 6. Equipment Borrowing (Offline)
  if (endpoint.includes('route=borrowings&action=submit')) {
    const tempId = 'temp-bor-' + Date.now();
    const bookingCode = 'OFFLINE-EQ-' + Math.floor(1000 + Math.random() * 9000);
    const borData = { ...bodyData, id: tempId, booking_code: bookingCode, created_at: new Date().toISOString(), status: 'active', sync_status: 'pending_sync' };
    await offlineDb.put('borrowings', borData);
    await syncManager.queueAction('create_borrowing', bodyData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'create_borrowing', borrowing: borData } }));
    }

    return {
      success: true,
      offline: true,
      borrowing_id: tempId,
      booking_code: bookingCode,
      message: 'Equipment borrowing saved locally (Offline Mode).',
    };
  }

  // 7. Equipment Return (Offline)
  if (endpoint.includes('route=borrowings&action=return_borrowing')) {
    await syncManager.queueAction('return_borrowing', bodyData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cjc-offline-mutation', { detail: { action: 'return_borrowing', payload: bodyData } }));
    }

    return {
      success: true,
      offline: true,
      fully_returned: true,
      message: 'Return recorded locally (Offline Mode).',
    };
  }

  return {
    success: false,
    offline: true,
    error: 'You are currently offline. This operation requires an active internet connection.',
  };
}

export async function apiDownload(endpoint: string, filename: string) {
  const headers: Record<string, string> = {};
  
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Download failed');
  }
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}
