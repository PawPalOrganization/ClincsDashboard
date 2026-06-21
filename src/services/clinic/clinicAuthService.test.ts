import { describe, it, expect, vi, beforeEach } from 'vitest';
import clinicAuthService from './clinicAuthService';
import { makeLoginResponse, mockFetchOk, mockFetchError } from '../../test/factories';

const TOKEN_KEY     = 'clinicStaffToken';
const STAFF_KEY     = 'clinicStaff';
const CLINIC_ID_KEY = 'portalClinicId';
const BRANCH_ID_KEY = 'portalBranchId';

// ─── login ────────────────────────────────────────────────────────────────────

describe('clinicAuthService.login', () => {
  it('persists token to localStorage on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk(makeLoginResponse()),
    );
    await clinicAuthService.login('user@clinic.com', 'password123');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-jwt-token');
  });

  it('persists staff JSON to localStorage on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk(makeLoginResponse()),
    );
    await clinicAuthService.login('user@clinic.com', 'password123');
    const stored = JSON.parse(localStorage.getItem(STAFF_KEY)!);
    expect(stored.email).toBe('jane@clinic.com');
  });

  it('persists clinicId from first branch to localStorage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk(makeLoginResponse()),
    );
    await clinicAuthService.login('user@clinic.com', 'password123');
    expect(localStorage.getItem(CLINIC_ID_KEY)).toBe('5');
  });

  it('persists branchId from first branch to localStorage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk(makeLoginResponse()),
    );
    await clinicAuthService.login('user@clinic.com', 'password123');
    expect(localStorage.getItem(BRANCH_ID_KEY)).toBe('10');
  });

  it('returns the stored auth object', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchOk(makeLoginResponse()),
    );
    const result = await clinicAuthService.login('user@clinic.com', 'password123');
    expect(result.token).toBe('test-jwt-token');
    expect(result.clinicId).toBe('5');
    expect(result.branchId).toBe('10');
    expect(result.staff.email).toBe('jane@clinic.com');
  });

  it('throws ApiError with friendly message on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(401, { message: 'Unauthorized' }),
    );
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login', href: '' },
      writable: true,
    });
    await expect(clinicAuthService.login('bad@email.com', 'wrong')).rejects.toThrow(
      'Invalid email or password.',
    );
  });

  it('does not persist anything to localStorage on failed login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockFetchError(401, { message: 'Unauthorized' }),
    );
    Object.defineProperty(window, 'location', {
      value: { pathname: '/login', href: '' },
      writable: true,
    });
    await clinicAuthService.login('bad@email.com', 'wrong').catch(() => {});
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('stores empty string for clinicId/branchId when staff has no branches', async () => {
    const response = makeLoginResponse();
    response.data.staff.branches = [];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockFetchOk(response));
    const result = await clinicAuthService.login('user@clinic.com', 'pass');
    expect(result.clinicId).toBe('');
    expect(result.branchId).toBe('');
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('clinicAuthService.logout', () => {
  beforeEach(() => {
    localStorage.setItem(TOKEN_KEY, 'some-token');
    localStorage.setItem(STAFF_KEY, '{"id":1}');
    localStorage.setItem(CLINIC_ID_KEY, '5');
    localStorage.setItem(BRANCH_ID_KEY, '10');
  });

  it('removes token from localStorage', () => {
    clinicAuthService.logout();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('removes staff from localStorage', () => {
    clinicAuthService.logout();
    expect(localStorage.getItem(STAFF_KEY)).toBeNull();
  });

  it('removes clinicId from localStorage', () => {
    clinicAuthService.logout();
    expect(localStorage.getItem(CLINIC_ID_KEY)).toBeNull();
  });

  it('removes branchId from localStorage', () => {
    clinicAuthService.logout();
    expect(localStorage.getItem(BRANCH_ID_KEY)).toBeNull();
  });
});

// ─── getStoredAuth ────────────────────────────────────────────────────────────

describe('clinicAuthService.getStoredAuth', () => {
  it('returns null when no token in localStorage', () => {
    expect(clinicAuthService.getStoredAuth()).toBeNull();
  });

  it('returns null when token present but no staff', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    expect(clinicAuthService.getStoredAuth()).toBeNull();
  });

  it('returns auth object when token and staff are present', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(STAFF_KEY, JSON.stringify({ id: 1, email: 'a@b.com' }));
    localStorage.setItem(CLINIC_ID_KEY, '5');
    localStorage.setItem(BRANCH_ID_KEY, '10');
    const result = clinicAuthService.getStoredAuth();
    expect(result?.token).toBe('tok');
    expect(result?.clinicId).toBe('5');
    expect(result?.branchId).toBe('10');
  });

  it('returns null for corrupted staff JSON', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(STAFF_KEY, 'not-valid-json{{{');
    expect(clinicAuthService.getStoredAuth()).toBeNull();
  });

  it('returns empty strings for clinicId/branchId when keys are absent', () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    localStorage.setItem(STAFF_KEY, JSON.stringify({ id: 1 }));
    const result = clinicAuthService.getStoredAuth();
    expect(result?.clinicId).toBe('');
    expect(result?.branchId).toBe('');
  });
});
