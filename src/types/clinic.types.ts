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
  unreadCount?: number;
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
  id?: string | number;
  name?: string;
  slug?: string;
  token?: string;
  title?: string;
  key?: string;
  code?: string;
}

export interface ClinicStaffRole {
  id: string | number;
  name: string;
  permissions?: Array<ClinicStaffPermission | string>;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface ClinicStaffClinic {
  clinicId: number;
  isOwner: boolean;
}

export interface ClinicStaff {
  id: string | number;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
  bio?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  yearsOfExperience?: number;
  joinedAt?: string;
  roleId?: string | number;
  role?: ClinicStaffRole;
  permissions?: Array<ClinicStaffPermission | string>;
  clinicBranchId?: string | number;
  branches?: ClinicBranch[];
  isOwner?: boolean;
  clinics?: ClinicStaffClinic[];
  workingHours?: BranchWorkingHour[];
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
  id: string | number;
  clinicId: string | number;
  title: string;
  description?: string;
  logoUrl?: string;
  isMainBranch: boolean;
  phoneNumber?: string;
  lat?: number;
  lng?: number;
  address?: string;
  services?: BranchService[];
  tags?: Array<string | number | { id?: string | number; name?: string; title?: string }>;
  workingHours?: BranchWorkingHour[];
}

// ─── Services ─────────────────────────────────────────────────────────────────

export interface BranchService {
  clinicServiceId: number;
  cost: number;
}

export interface ClinicService {
  id: string | number;
  clinicId: number | null;
  isPlatform: boolean;
  name: string;
  description?: string;
  logoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClinicServicePayload {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface UpdateClinicServicePayload {
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
}

export interface ClinicServiceListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface UploadedFile {
  bucket?: string;
  key?: string;
  signedUrl?: string;
  publicUrl: string;
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
  services?: BranchService[];
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
  services?: BranchService[];
  tags?: string[];
  workingHours?: BranchWorkingHour[];
}

// POST /clinic/api/clinic-staff
// Non-owner: clinicBranchId required (clinic derived from branch)
// Owner: isOwner: true + clinicId required; clinicBranchId ignored
export interface CreateClinicStaffPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  imageUrl?: string;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
  yearsOfExperience?: number;
  joinedAt?: string;
  roleId?: string | number;
  clinicBranchId?: string | number;
  isOwner?: boolean;
  clinicId?: number;
  workingHours?: BranchWorkingHour[];
}

// PUT /clinic/api/clinic-staff/:id
export interface UpdateClinicStaffPayload {
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  bio?: string;
  email?: string;
  password?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  yearsOfExperience?: number;
  joinedAt?: string;
  roleId?: string | number;
  workingHours?: BranchWorkingHour[];
}

// PUT /clinic/api/clinic-staff/:id/assignments
// Sends the full replacement list — not a partial update
export interface UpdateStaffAssignmentsPayload {
  clinicBranchIds: Array<string | number>;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export type AppointmentStatus = 'reserved' | 'finished' | 'cancelled';

export interface AppointmentService {
  clinicServiceId: number;
  name?: string;
  cost: number;
}

export interface AppointmentDoctor {
  id: string | number;
  firstName: string;
  lastName: string;
  role?: { name: string };
}

export interface AppointmentUser {
  id: string | number;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

export interface Appointment {
  id: string | number;
  clinicBranchId: string | number;
  clinicStaffId: string | number;
  userId?: string | number;
  petId?: string | number;
  contactName?: string;
  contactPhone?: string;
  contactAddress?: string;
  scheduledAt: string;
  timezone?: string;
  status: AppointmentStatus;
  notes?: string;
  doctor?: AppointmentDoctor;
  user?: AppointmentUser;
  services: AppointmentService[];
  totalCost: number;
  visitorOrder?: number;
  cancellationReason?: string;
  branch?: { id: string | number; title: string };
}

export interface CreateAppointmentPayload {
  clinicBranchId: string | number;
  clinicStaffId: string | number;
  clinicServiceIds?: Array<string | number>;
  userId?: string | number;
  petId?: string | number;
  contactName?: string;
  contactPhone?: string;
  contactAddress?: string;
  scheduledAt: string;
  timezone?: string;
  notes?: string;
}

export interface UpdateAppointmentPayload {
  clinicStaffId?: string | number;
  clinicServiceIds?: Array<string | number>;
  contactName?: string;
  contactPhone?: string;
  contactAddress?: string;
  scheduledAt?: string;
  timezone?: string;
  notes?: string;
}

export interface AppointmentStats {
  numOfCancellationsUserSide: number;
  numOfCancellationsClinicSide: number;
  numOfVisitors: number;
  numOfTransactions: number;
}

export interface AppointmentListParams {
  page?: number;
  limit?: number;
  branchId?: string | number;
  date?: string;
  status?: AppointmentStatus;
  clinicStaffId?: string | number;
  clinicServiceId?: string | number;
  phone?: string;
  name?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface ClinicNotificationData {
  appointmentId?: number;
  clinicBranchId?: number;
  branchTitle?: string;
  scheduledAt?: string;
  visitorOrder?: number;
  cancelledBy?: 'user' | 'clinic';
  cancellationReason?: string | null;
}

export interface ClinicNotification {
  id: string | number;
  title: string;
  body: string;
  type?: 'appointment_booked' | 'appointment_cancelled' | string;
  isRead: boolean;
  createdAt: string;
  branchId?: string | number;
  data?: ClinicNotificationData | null;
}

// ─── User search (for appointment booking) ───────────────────────────────────

export interface UserSearchResult {
  id: string | number;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}
