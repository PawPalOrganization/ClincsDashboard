import clinicApi, { ApiError } from './clinicApi';
import type { ApiResponse, ClinicLoginResponse, ClinicStaff } from '../../types/clinic.types';

const TOKEN_KEY    = 'clinicStaffToken';
const STAFF_KEY    = 'clinicStaff';
const CLINIC_ID_KEY = 'portalClinicId';
const BRANCH_ID_KEY = 'portalBranchId';

export interface StoredAuth {
  token: string;
  staff: ClinicStaff;
  clinicId: string;
  branchId: string;
}

const clinicAuthService = {
  /**
   * POST /clinic/api/auth/login
   * Saves token, staff, clinicId, and branchId to localStorage.
   * clinicId and branchId come from staff.branches[0].
   */
  async login(email: string, password: string): Promise<StoredAuth> {
    let response: ApiResponse<ClinicLoginResponse>;
    try {
      response = await clinicApi.post<ApiResponse<ClinicLoginResponse>>(
        '/auth/login',
        { email, password },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw new ApiError(401, 'Invalid email or password.');
      }
      throw err;
    }

    const { token, staff } = response.data;
    const firstBranch = staff.branches?.[0];
    const clinicId = firstBranch?.clinicId ?? '';
    const branchId = firstBranch?.id ?? '';

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    localStorage.setItem(CLINIC_ID_KEY, clinicId);
    localStorage.setItem(BRANCH_ID_KEY, branchId);

    return { token, staff, clinicId, branchId };
  },

  /** Removes all clinic session keys from localStorage. */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STAFF_KEY);
    localStorage.removeItem(CLINIC_ID_KEY);
    localStorage.removeItem(BRANCH_ID_KEY);
  },

  /**
   * Reads all four keys from localStorage.
   * Returns null if token or staff is missing (session is invalid).
   * Safe to call synchronously on app load.
   */
  getStoredAuth(): StoredAuth | null {
    const token    = localStorage.getItem(TOKEN_KEY);
    const staffRaw = localStorage.getItem(STAFF_KEY);

    if (!token || !staffRaw) return null;

    try {
      const staff    = JSON.parse(staffRaw) as ClinicStaff;
      const clinicId = localStorage.getItem(CLINIC_ID_KEY) ?? '';
      const branchId = localStorage.getItem(BRANCH_ID_KEY) ?? '';
      return { token, staff, clinicId, branchId };
    } catch {
      // Corrupted localStorage data — treat as logged out
      return null;
    }
  },
};

export default clinicAuthService;
