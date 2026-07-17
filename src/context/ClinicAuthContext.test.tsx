import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { ClinicAuthProvider, useClinicAuth } from './ClinicAuthContext';
import clinicAuthService from '../services/clinic/clinicAuthService';
import type { StoredAuth } from '../services/clinic/clinicAuthService';
import { makeStaff } from '../test/factories';

// ─── Helper: renders the provider and exposes context value via a test component

function TestConsumer({ onValue }: { onValue: (v: ReturnType<typeof useClinicAuth>) => void }) {
  const ctx = useClinicAuth();
  onValue(ctx);
  return null;
}

function renderProvider(onValue: (v: ReturnType<typeof useClinicAuth>) => void) {
  return render(
    <ClinicAuthProvider>
      <TestConsumer onValue={onValue} />
    </ClinicAuthProvider>,
  );
}

// ─── Hydration from localStorage ──────────────────────────────────────────────

describe('ClinicAuthProvider hydration', () => {
  it('is unauthenticated when no stored auth', () => {
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(null);
    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    expect(ctx.isLoading).toBe(false);
    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.staff).toBeNull();
    expect(ctx.token).toBeNull();
  });

  // There is no server-side session-validation endpoint for the clinic portal
  // (no GET /clinic/api/auth/me), so hydration trusts localStorage directly and
  // synchronously — no fetch, no loading flicker, no fallback branches to test.
  it('is authenticated immediately from stored auth, with no server round trip', () => {
    const storedAuth: StoredAuth = {
      token: 'stored-token',
      staff: makeStaff(),
      clinicId: '5',
      branchId: '10',
    };
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(storedAuth);
    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    expect(ctx.isLoading).toBe(false);
    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.token).toBe('stored-token');
    expect(ctx.clinicId).toBe('5');
    expect(ctx.staff?.email).toBe('jane@clinic.com');
  });
});

// ─── Login action ─────────────────────────────────────────────────────────────

describe('ClinicAuthProvider login', () => {
  it('sets isAuthenticated to true after successful login', async () => {
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(null);
    const storedAuth: StoredAuth = {
      token: 'new-token',
      staff: makeStaff(),
      clinicId: '5',
      branchId: '10',
    };
    vi.spyOn(clinicAuthService, 'login').mockResolvedValue(storedAuth);

    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    await waitFor(() => expect(ctx.isLoading).toBe(false));

    await act(async () => {
      await ctx.login('jane@clinic.com', 'pass');
    });

    expect(ctx.isAuthenticated).toBe(true);
    expect(ctx.token).toBe('new-token');
    expect(ctx.clinicId).toBe('5');
  });

  it('propagates error thrown by clinicAuthService.login', async () => {
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(null);
    vi.spyOn(clinicAuthService, 'login').mockRejectedValue(new Error('Invalid credentials'));

    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    await waitFor(() => expect(ctx.isLoading).toBe(false));

    await expect(
      act(async () => { await ctx.login('bad@email.com', 'wrong'); }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('remains unauthenticated after a failed login', async () => {
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(null);
    vi.spyOn(clinicAuthService, 'login').mockRejectedValue(new Error('Bad creds'));

    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    await waitFor(() => expect(ctx.isLoading).toBe(false));

    await act(async () => {
      await ctx.login('bad@email.com', 'wrong').catch(() => {});
    });

    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.token).toBeNull();
  });
});

// ─── Logout action ────────────────────────────────────────────────────────────

describe('ClinicAuthProvider logout', () => {
  it('clears auth state after logout', () => {
    const storedAuth: StoredAuth = {
      token: 'tok',
      staff: makeStaff(),
      clinicId: '5',
      branchId: '10',
    };
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(storedAuth);
    vi.spyOn(clinicAuthService, 'logout').mockImplementation(() => {});

    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    expect(ctx.isAuthenticated).toBe(true);

    act(() => ctx.logout());

    expect(ctx.isAuthenticated).toBe(false);
    expect(ctx.staff).toBeNull();
    expect(ctx.token).toBeNull();
    expect(ctx.clinicId).toBeNull();
  });

  it('calls clinicAuthService.logout when logging out', async () => {
    vi.spyOn(clinicAuthService, 'getStoredAuth').mockReturnValue(null);
    const logoutSpy = vi.spyOn(clinicAuthService, 'logout').mockImplementation(() => {});

    let ctx!: ReturnType<typeof useClinicAuth>;
    renderProvider((c) => { ctx = c; });
    await waitFor(() => expect(ctx.isLoading).toBe(false));

    act(() => ctx.logout());
    expect(logoutSpy).toHaveBeenCalledOnce();
  });
});

// ─── Hook guard ───────────────────────────────────────────────────────────────

describe('useClinicAuth guard', () => {
  it('throws when used outside of ClinicAuthProvider', () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Naked() { useClinicAuth(); return null; }
    expect(() => render(<Naked />)).toThrow('useClinicAuth must be used within a ClinicAuthProvider');
    consoleErrorMock.mockRestore();
  });
});
