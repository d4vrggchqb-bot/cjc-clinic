// Base URL of the PHP API (when running decoupled)
// Automatically use the current hostname so it works over WiFi (e.g., from a phone)
const API_BASE_URL = ''
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
    console.error('Failed to fetch CSRF token:', e);
  }
  return '';
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isForm && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Inject CSRF token if method modifies state
  if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
    const token = await getCsrfToken();
    headers['X-CSRF-Token'] = token;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'include', // Extremely important for PHP sessions to persist!
      cache: 'no-store', // Prevent stale data on navigation
    });
    clearTimeout(timeoutId);
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
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
  
  // Delay revoking the object URL to ensure the browser has time to start the download
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 1000);
}
