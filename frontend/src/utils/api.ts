// Base URL of the PHP API (when running decoupled)
export const API_BASE = 'http://localhost:8000';

let cachedCsrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  try {
    const res = await fetch(`${API_BASE}/api/csrf.php`, {
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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Extremely important for PHP sessions to persist!
  });

  return res.json();
}

export async function apiDownload(endpoint: string, filename: string) {
  const headers: Record<string, string> = {};
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
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
