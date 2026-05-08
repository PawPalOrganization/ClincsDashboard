import { createContext, useContext, useEffect, useState } from 'react';
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
  const [state, setState] = useState<ClinicAuthState>(INITIAL_STATE);

  // Hydrate auth state from localStorage on mount.
  // isLoading stays true until this completes, preventing a flash of /login.
  useEffect(() => {
    try {
      const stored = clinicAuthService.getStoredAuth();
      if (stored) {
        setState({
          staff: stored.staff,
          token: stored.token,
          clinicId: stored.clinicId,
          branchId: stored.branchId,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
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

export function useClinicAuth(): ClinicAuthContextValue {
  const context = useContext(ClinicAuthContext);
  if (!context) {
    throw new Error('useClinicAuth must be used within a ClinicAuthProvider');
  }
  return context;
}
