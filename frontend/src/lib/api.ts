const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Access token stored in memory (not in localStorage)
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

let refreshPromise: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Sends HttpOnly refresh_token cookie
      });
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const data = await res.json();
      if (data && data.accessToken) {
        setAccessToken(data.accessToken);
        return true;
      }
      setAccessToken(null);
      return false;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Always include cookies cross-origin
  });

  // If 401 on a protected resource, attempt refresh with HttpOnly cookie and retry
  const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/refresh');
  if (res.status === 401 && !isAuthEndpoint) {
    const refreshed = await refreshAccessToken();
    if (refreshed && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ statusCode: res.status, message: 'Request failed' }));
    throw error;
  }

  if (res.status === 204) return undefined as T;
  
  return res.json();
}
