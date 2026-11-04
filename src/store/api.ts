let csrfToken = '';
export const setCsrf = (token: string) => { csrfToken = token || ''; };
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  } catch { throw new ApiError('Unable to reach the store. Check your connection and try again.', 0); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !['/api/login', '/api/session'].includes(url)) window.dispatchEvent(new Event('forme:expired'));
    const message = data.message === 'API endpoint not found.'
      ? 'This feature is temporarily unavailable. Please refresh the page and try again.'
      : data.message || 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }
  if (data.csrfToken) setCsrf(data.csrfToken);
  return data;
}
