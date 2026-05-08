// ─── Generic API wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedList<T> {
  items: T[];
  meta: PaginationMeta;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedList<T>>;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface ClinicLoginResponse {
  token: string;
  type: 'clinic_staff';
  staff: ClinicStaff;
}

// ─── Roles & Permissions ──────────────────────────────────────────────────────

export interface ClinicStaffPermission {
  id: string;
  name: string;
  slug: string;
}

export interface ClinicStaffRole {
  id: string;
  name: string;
  permissions?: ClinicStaffPermission[];
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface ClinicStaff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  bio?: string;
  gender?: 'male' | 'female';
  yearsOfExperience?: number;
  joinedAt?: string;
  roleId?: string;
  role?: ClinicStaffRole;
  clinicBranchId?: string;
  branches?: ClinicBranch[];
}

// ─── Clinic ───────────────────────────────────────────────────────────────────
// Admin-only fields intentionally excluded:
//   license, approved, approvedAt, approvedBy, isActive

export interface Clinic {
  id: string;
  title: string;
  titleInArabic?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  email?: string;
  website?: string;
}

// ─── Branches ─────────────────────────────────────────────────────────────────

// dayOfWeek: 0 = Sunday … 6 = Saturday
export interface BranchWorkingHour {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

// isActive intentionally excluded — clinic staff cannot toggle branch status
export interface ClinicBranch {
  id: string;
  clinicId: string;
  title: string;
  description?: string;
  logoUrl?: string;
  isMainBranch: boolean;
  phoneNumber?: string;
  lat?: number;
  lng?: number;
  address?: string;
  serviceIds?: string[];
  tags?: string[];
  workingHours?: BranchWorkingHour[];
}

// ─── Services (dropdown) ──────────────────────────────────────────────────────

export interface ClinicService {
  id: string;
  name: string;
  description?: string;
}

// ─── Request payloads ─────────────────────────────────────────────────────────

// PUT /clinic/api/clinics/:clinicId
// Excludes: license, approved, approvedAt, approvedBy, isActive
export interface UpdateClinicPayload {
  title?: string;
  titleInArabic?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  email?: string;
  website?: string;
}

// POST /clinic/api/clinics/:clinicId/branches
export interface CreateBranchPayload {
  title: string;
  description?: string;
  logoUrl?: string;
  isMainBranch?: boolean;
  isActive?: boolean;
  phoneNumber?: string;
  lat?: number;
  lng?: number;
  address?: string;
  serviceIds?: string[];
  tags?: string[];
  workingHours?: BranchWorkingHour[];
}

// PUT /clinic/api/clinics/:clinicId/branches/:branchId
// Excludes: isActive — clinic staff cannot toggle branch status
export interface UpdateBranchPayload {
  title?: string;
  description?: string;
  logoUrl?: string;
  isMainBranch?: boolean;
  phoneNumber?: string;
  lat?: number;
  lng?: number;
  address?: string;
  serviceIds?: string[];
  tags?: string[];
  workingHours?: BranchWorkingHour[];
}

// POST /clinic/api/clinic-staff
// clinicBranchId must be a branch the requesting staff is assigned to
export interface CreateClinicStaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  bio?: string;
  gender?: 'male' | 'female';
  yearsOfExperience?: number;
  joinedAt?: string;
  roleId: string;
  clinicBranchId: string;
}

// PUT /clinic/api/clinic-staff/:id
export interface UpdateClinicStaffPayload {
  firstName?: string;
  lastName?: string;
  bio?: string;
  email?: string;
  password?: string;
  gender?: 'male' | 'female';
  yearsOfExperience?: number;
  joinedAt?: string;
  roleId?: string;
}

// PUT /clinic/api/clinic-staff/:id/assignments
// Sends the full replacement list — not a partial update
export interface UpdateStaffAssignmentsPayload {
  clinicBranchIds: string[];
}
