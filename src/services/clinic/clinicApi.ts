const BASE_PATH = '/clinic/api';

const TOKEN_KEY = 'clinicStaffToken';
const STAFF_KEY = 'clinicStaff';
const CLINIC_ID_KEY = 'portalClinicId';
const BRANCH_ID_KEY = 'portalBranchId';

// ─── Exported types ───────────────────────────────────────────────────────────

/** Use undefined to omit a param from the query string. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STAFF_KEY);
  localStorage.removeItem(CLINIC_ID_KEY);
  localStorage.removeItem(BRANCH_ID_KEY);
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = `${BASE_PATH}${path}`;
  if (!params) return url;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      qs.set(key, String(value));
    }
  }

  const query = qs.toString();
  return query ? `${url}?${query}` : url;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    clearSession();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  const text = await response.text();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(response.status, 'The server returned an invalid response.');
  }

  if (!response.ok) {
    const body = json as {
      message?: string | string[];
      errors?: Record<string, string[]> | Array<{ msg?: string; message?: string; path?: string }>;
      error?: string;
    };
    const rawMsg = body.message;
    let message = Array.isArray(rawMsg)
      ? rawMsg.join('; ')
      : rawMsg ?? `Request failed with status ${response.status}`;
    // Surface field-level validation errors — handles both NestJS array format and object format
    if (body.errors) {
      let details = '';
      if (Array.isArray(body.errors)) {
        details = body.errors
          .map((e) => (e.path ? `${e.path}: ${e.msg ?? e.message ?? ''}` : (e.msg ?? e.message ?? '')))
          .filter(Boolean)
          .join('; ');
      } else if (typeof body.errors === 'object') {
        details = Object.values(body.errors).flat().join('; ');
      }
      if (details) message = `${message}: ${details}`;
    }
    if (import.meta.env.DEV) {
      console.error('[API Error]', response.status, JSON.stringify(body));
    }
    throw new ApiError(response.status, message);
  }

  return json as T;
}

// ─── API client ───────────────────────────────────────────────────────────────

const clinicApi = {
  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const response = await fetch(buildUrl(path, params), {
      method: 'GET',
      headers: buildHeaders(),
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_PATH}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_PATH}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${BASE_PATH}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async del<T>(path: string): Promise<T> {
    const response = await fetch(`${BASE_PATH}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return handleResponse<T>(response);
  },
};

export default clinicApi;
