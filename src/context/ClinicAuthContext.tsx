import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClinicStaff } from '../types/clinic.types';
import clinicAuthService from '../services/clinic/clinicAuthService';

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
  /** Refreshes the cached staff record (e.g. after self-assigning to a new branch) without a full re-login. */
  updateStaff: (staff: ClinicStaff) => void;
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

// Hydrates auth state straight from localStorage — there is no server-side session
// endpoint for the clinic portal (no GET /clinic/api/auth/me), so there's nothing to
// validate against on mount. A stale/invalid token is caught by the next real API
// call via clinicApi's global 401 handler, which clears the session and redirects.
function hydrateFromStorage(): ClinicAuthState {
  const stored = clinicAuthService.getStoredAuth();
  if (!stored) return { ...INITIAL_STATE, isLoading: false };
  return {
    staff: stored.staff,
    token: stored.token,
    clinicId: stored.clinicId,
    branchId: stored.branchId,
    isAuthenticated: true,
    isLoading: false,
  };
}

export function ClinicAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ClinicAuthState>(hydrateFromStorage);

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

  function updateStaff(staff: ClinicStaff): void {
    clinicAuthService.updateStoredStaff(staff);
    setState((prev) => ({ ...prev, staff }));
  }

  return (
    <ClinicAuthContext.Provider value={{ ...state, login, logout, updateStaff }}>
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
