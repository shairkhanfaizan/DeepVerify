const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE = rawBase.replace(/\/+$/, '');

export function getAuthToken(): string | null {
  return localStorage.getItem('dv_auth_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('dv_auth_token', token);
  } else {
    localStorage.removeItem('dv_auth_token');
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = API_BASE ? `${API_BASE}${cleanEndpoint}` : cleanEndpoint;
  
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  // Default to application/json if body is present and not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  options.headers = headers;
  
  // Ensure credentials are included for cookies as well (dual auth)
  options.credentials = 'include';
  
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `Cannot connect to server: ${errorMsg}`);
  }
  
  if (!response.ok) {
    if (response.status === 401) {
      setAuthToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    
    let message = 'An error occurred';
    try {
      const data = await response.json();
      if (Array.isArray(data.detail)) {
        message = data.detail.map((e: any) => e.msg).join(", ");
      } else {
        message = data.detail || data.error?.message || message;
      }
    } catch {
      // Ignored
    }
    throw new ApiError(response.status, message);
  }
  
  // If no content, return null
  if (response.status === 204) return null;
  
  // Return JSON
  try {
    return await response.json();
  } catch {
    return null;
  }
}
