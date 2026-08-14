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

  // Handle Offline Immediately for Mutations if offline
  if (!isOnline && method !== 'GET') {
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

    const data = await res.json();

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
    } else {
      // POST/PUT/DELETE failed due to network error -> queue it
      return handleOfflineMutation(endpoint, options);
    }

    throw err;
  }
}

/**
 * Handle caching GET API responses into IndexedDB
 */
async function handleCacheResponse(endpoint: string, data: any) {
  try {
    if (endpoint.includes('action=check_session') && data.success && data.user) {
      localStorage.setItem('cjc_cached_session_user', JSON.stringify(data.user));
    } else if (endpoint.includes('route=patients&action=list') && Array.isArray(data.profiles)) {
      await offlineDb.setMany('patients', data.profiles);
    } else if (endpoint.includes('route=inventory&action=items') && Array.isArray(data.items)) {
      await offlineDb.setMany('inventory', data.items);
    } else if (endpoint.includes('route=consultation') && Array.isArray(data.sessions)) {
      await offlineDb.setMany('consultations', data.sessions);
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
    if (endpoint.includes('action=check_session')) {
      const cached = localStorage.getItem('cjc_cached_session_user');
      if (cached) {
        const user = JSON.parse(cached);
        return { success: true, user, offline: true };
      }
      return { success: false, offline: true };
    }

    if (endpoint.includes('route=patients&action=list')) {
      const cachedPatients = await offlineDb.getAll<any>('patients');
      return {
        profiles: cachedPatients,
        pagination: {
          page: 1,
          per_page: cachedPatients.length || 25,
          total_count: cachedPatients.length,
          total_pages: 1,
        },
        offline: true,
      };
    }

    if (endpoint.includes('route=inventory&action=items')) {
      const cachedItems = await offlineDb.getAll<any>('inventory');
      return { items: cachedItems, offline: true };
    }

    if (endpoint.includes('route=consultation')) {
      const cachedConsultations = await offlineDb.getAll<any>('consultations');
      return { sessions: cachedConsultations, offline: true, history: cachedConsultations };
    }

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

  // Determine action
  if (endpoint.includes('route=patients&action=create')) {
    const tempId = 'temp-' + Date.now();
    const patientData = { ...bodyData, id: tempId, sync_status: 'pending_sync' };
    await offlineDb.put('patients', patientData);
    await syncManager.queueAction('create_patient', { ...bodyData, temp_id: tempId });
    return {
      success: true,
      offline: true,
      id: tempId,
      message: 'Patient profile recorded locally. Will sync automatically once connected.',
    };
  }

  if (endpoint.includes('route=consultation') && endpoint.includes('action=create')) {
    const tempId = 'temp-cons-' + Date.now();
    const consData = { ...bodyData, id: tempId, created_at: new Date().toISOString(), sync_status: 'pending_sync' };
    await offlineDb.put('consultations', consData);
    await syncManager.queueAction('create_consultation', bodyData);
    return {
      success: true,
      offline: true,
      id: tempId,
      message: 'Consultation recorded locally (Offline Mode).',
    };
  }

  if (endpoint.includes('route=borrowings&action=submit')) {
    const tempId = 'temp-bor-' + Date.now();
    const bookingCode = 'OFFLINE-EQ-' + Math.floor(1000 + Math.random() * 9000);
    const borData = { ...bodyData, id: tempId, booking_code: bookingCode, created_at: new Date().toISOString(), status: 'active', sync_status: 'pending_sync' };
    await offlineDb.put('borrowings', borData);
    await syncManager.queueAction('create_borrowing', bodyData);
    return {
      success: true,
      offline: true,
      borrowing_id: tempId,
      booking_code: bookingCode,
      message: 'Equipment borrowing saved locally (Offline Mode).',
    };
  }

  if (endpoint.includes('route=borrowings&action=return_borrowing')) {
    await syncManager.queueAction('return_borrowing', bodyData);
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
    error: 'You are currently offline. This specific operation requires an active internet connection.',
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
