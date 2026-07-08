/**
 * Escapes a string for safe insertion as HTML text content.
 * Use this for ALL server-returned strings that are placed into innerHTML
 * template literals to prevent XSS.
 *
 * Example:
 *   element.innerHTML = `<p>${escHtml(serverString)}</p>`;
 */
export function escHtml(value: unknown): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Reads the CSRF token from the <meta name="csrf-token"> tag injected by PHP.
 * Returns an empty string if the tag is missing (e.g., in tests).
 */
export function getCsrfToken(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
  return meta?.content ?? '';
}

/**
 * Returns fetch options that include the CSRF token header.
 * Merge into your fetch() calls for all state-changing requests (POST, PUT, DELETE).
 *
 * Example:
 *   await fetch('api/medcert.php', { method: 'POST', body: formData, ...csrfHeaders() });
 */
export function csrfHeaders(): { headers: Record<string, string> } {
  return { headers: { 'X-CSRF-Token': getCsrfToken() } };
}
