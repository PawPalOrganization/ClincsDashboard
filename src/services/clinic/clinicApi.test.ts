import { describe, it, expect, vi, beforeEach } from 'vitest';
import clinicApi, { ApiError } from './clinicApi';
import { mockFetchOk, mockFetchError } from '../../test/factories';

const TOKEN_KEY    = 'clinicStaffToken';
const STAFF_KEY    = 'clinicStaff';
const CLINIC_ID_KEY = 'portalClinicId';
const BRANCH_ID_KEY = 'portalBranchId';

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('clinicApi.get', () => {
  it('calls the correct URL with the BASE_PATH prefix', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk({ data: [] }),
    );
    await clinicApi.get('/appointments');
    expect(spy).toHaveBeenCalledWith(
      '/clinic/api/appointments',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('appends query parameters to the URL', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk({ data: [] }),
    );
    await clinicApi.get('/appointments', { page: 1, limit: 10, status: 'reserved' });
    const [url] = spy.mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).toContain('limit=10');
    expect(url).toContain('status=reserved');
  });

  it('omits undefined query parameters', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk({ data: [] }),
    );
    await clinicApi.get('/appointments', { page: 1, status: undefined });
    const [url] = spy.mock.calls[0];
    expect(url).toContain('page=1');
    expect(url).not.toContain('status');
  });

  it('sends Bearer token from localStorage when present', async () => {
    setToken('my-jwt-token');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk({ data: [] }),
    );
    await clinicApi.get('/appointments');
    const [, options] = spy.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer my-jwt-token',
    });
  });

  it('sends no Authorization header when no token in localStorage', async () => {
    localStorage.clear();
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk({ data: [] }),
    );
    await clinicApi.get('/appointments');
    const [, options] = spy.mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('returns the parsed JSON response', async () => {
    const payload = { data: [{ id: 1 }] };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk(payload));
    const result = await clinicApi.get('/appointments');
    expect(result).toEqual(payload);
  });

  it('throws ApiError on non-ok responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(400, { message: 'Bad request' }),
    );
    await expect(clinicApi.get('/appointments')).rejects.toBeInstanceOf(ApiError);
  });

  it('includes the HTTP status on thrown ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(422, { message: 'Validation failed' }),
    );
    try {
      await clinicApi.get('/appointments');
    } catch (err) {
      expect((err as ApiError).status).toBe(422);
    }
  });

  it('surfaces field-level errors from NestJS array format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(400, {
        message: 'Validation failed',
        errors: [{ path: 'email', msg: 'must be a valid email' }],
      }),
    );
    await expect(clinicApi.get('/test')).rejects.toThrow('email: must be a valid email');
  });

  it('surfaces field-level errors from object format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(400, {
        message: 'Validation error',
        errors: { email: ['must be valid'], name: ['is required'] },
      }),
    );
    const err = await clinicApi.get('/test').catch((e) => e as ApiError) as ApiError;
    expect(err.message).toContain('must be valid');
  });

  it('throws ApiError with invalid JSON response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('not json at all'),
    } as unknown as Response);
    await expect(clinicApi.get('/test')).rejects.toBeInstanceOf(ApiError);
  });
});

// ─── 401 session expiry ───────────────────────────────────────────────────────

describe('clinicApi 401 handling', () => {
  beforeEach(() => {
    setToken('expired-token');
    [TOKEN_KEY, STAFF_KEY, CLINIC_ID_KEY, BRANCH_ID_KEY].forEach((k) =>
      localStorage.setItem(k, 'data'),
    );
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard', href: '' },
      writable: true,
    });
  });

  it('clears all localStorage keys on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(401, { message: 'Unauthorized' }),
    );
    await clinicApi.get('/appointments').catch(() => {});
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(STAFF_KEY)).toBeNull();
    expect(localStorage.getItem(CLINIC_ID_KEY)).toBeNull();
    expect(localStorage.getItem(BRANCH_ID_KEY)).toBeNull();
  });

  it('throws ApiError with status 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(401, { message: 'Unauthorized' }),
    );
    const err = await clinicApi.get('/appointments').catch((e) => e as ApiError) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });

  it('does not redirect when already on /login', async () => {
    window.location.pathname = '/login';
    const locationSpy = vi.fn();
    Object.defineProperty(window.location, 'href', { set: locationSpy, configurable: true });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(401, {}),
    );
    await clinicApi.get('/test').catch(() => {});
    expect(locationSpy).not.toHaveBeenCalled();
  });
});

// ─── POST / PUT / PATCH / DELETE ─────────────────────────────────────────────

describe('clinicApi write methods', () => {
  it('post sends JSON body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk({ data: {} }));
    await clinicApi.post('/appointments', { name: 'test' });
    const [, options] = spy.mock.calls[0];
    expect((options as RequestInit).method).toBe('POST');
    expect((options as RequestInit).body).toBe(JSON.stringify({ name: 'test' }));
  });

  it('put sends JSON body with PUT method', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk({ data: {} }));
    await clinicApi.put('/appointments/1', { status: 'finished' });
    const [, options] = spy.mock.calls[0];
    expect((options as RequestInit).method).toBe('PUT');
  });

  it('patch sends JSON body with PATCH method', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk({ data: {} }));
    await clinicApi.patch('/appointments/1/status', { status: 'cancelled' });
    const [, options] = spy.mock.calls[0];
    expect((options as RequestInit).method).toBe('PATCH');
  });

  it('del sends DELETE method with no body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk({ data: {} }));
    await clinicApi.del('/branches/1');
    const [, options] = spy.mock.calls[0];
    expect((options as RequestInit).method).toBe('DELETE');
    expect((options as RequestInit).body).toBeUndefined();
  });

  it('post with no body sends undefined body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk({ data: {} }));
    await clinicApi.post('/logout');
    const [, options] = spy.mock.calls[0];
    expect((options as RequestInit).body).toBeUndefined();
  });
});

// ─── ApiError class ───────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('has the correct name', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.name).toBe('ApiError');
  });

  it('exposes the status code', () => {
    const err = new ApiError(500, 'Server error');
    expect(err.status).toBe(500);
  });

  it('extends Error', () => {
    expect(new ApiError(400, 'Bad')).toBeInstanceOf(Error);
  });

  it('message is accessible', () => {
    const err = new ApiError(403, 'Forbidden');
    expect(err.message).toBe('Forbidden');
  });
});
