import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ApiResponse, ClinicStaff } from '../types/clinic.types';
import clinicAuthService from '../services/clinic/clinicAuthService';
import clinicApi, { ApiError } from '../services/clinic/clinicApi';

// ─── State shape ──────────────────────────────────────────────────────────────

interface ClinicAuthState {
  staff: ClinicStaff | null;
  token: string | null;
  clinicId: string | null;
  branchId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Context value (state + actions) ─────────────────────────────────────────

interface ClinicAuthContextValue extends ClinicAuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ClinicAuthContext = createContext<ClinicAuthContextValue | null>(null);

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: ClinicAuthState = {
  staff: null,
  token: null,
  clinicId: null,
  branchId: null,
  isAuthenticated: false,
  isLoading: true,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ClinicAuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializer — if there's no stored session, we already know synchronously
  // (before the first paint) that isLoading should be false, so the effect below
  // doesn't need to set it and the app never renders an extra "loading" frame.
  const [state, setState] = useState<ClinicAuthState>(() =>
    clinicAuthService.getStoredAuth() ? INITIAL_STATE : { ...INITIAL_STATE, isLoading: false },
  );

  // Hydrate auth state from localStorage on mount.
  // Validates the stored token against the server and uses the server-provided
  // staff object (eliminating S-2/S-3 client-side permission tampering risk).
  // Falls back to localStorage staff when /auth/me is not yet deployed (404).
  // 401 is handled automatically by clinicApi (clears session + redirects).
  useEffect(() => {
    const stored = clinicAuthService.getStoredAuth();
    if (!stored) return;

    // AbortController lets React StrictMode's cleanup cancel the in-flight request
    // before the second (real) mount fires, preventing double-fetch and state races.
    const controller = new AbortController();

    clinicApi.get<ApiResponse<ClinicStaff>>('/auth/me', undefined, { signal: controller.signal })
      .then((res) => {
        setState({
          staff: res.data,
          token: stored.token,
          clinicId: stored.clinicId,
          branchId: stored.branchId,
          isAuthenticated: true,
          isLoading: false,
        });
      })
      .catch((err) => {
        // Effect was cleaned up (StrictMode unmount or fast navigation) — do nothing
        if (controller.signal.aborted) return;

        // 404 = /auth/me not yet deployed on backend — use cached staff as fallback
        if (err instanceof ApiError && err.status === 404) {
          setState({
            staff: stored.staff,
            token: stored.token,
            clinicId: stored.clinicId,
            branchId: stored.branchId,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
        // Any other error (network failure, etc.) — log out for safety
        clinicAuthService.logout();
        setState((prev) => ({ ...prev, isLoading: false }));
      });

    return () => controller.abort();
  }, []);

  // Calls the service, then mirrors the result into React state.
  // Errors (wrong password, network) propagate to the login page.
  async function login(email: string, password: string): Promise<void> {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const stored = await clinicAuthService.login(email, password);
      setState({
        staff: stored.staff,
        token: stored.token,
        clinicId: stored.clinicId,
        branchId: stored.branchId,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }

  function logout(): void {
    clinicAuthService.logout();
    setState({
      staff: null,
      token: null,
      clinicId: null,
      branchId: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }

  return (
    <ClinicAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </ClinicAuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// Co-locating the hook with its Provider is the standard React Context pattern;
// splitting it into its own file would only avoid a Fast Refresh DX warning at
// the cost of updating every consumer's import path across the app.
// eslint-disable-next-line react-refresh/only-export-components
export function useClinicAuth(): ClinicAuthContextValue {
  const context = useContext(ClinicAuthContext);
  if (!context) {
    throw new Error('useClinicAuth must be used within a ClinicAuthProvider');
  }
  return context;
}
