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
  imageUrl?: string | null;
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
  imageUrl?: string | null;
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

// ─── User search & data-share consent ────────────────────────────────────────

export type ConsentStatus = 'none' | 'pending' | 'approved' | 'denied';

export interface PetSummary {
  id: number;
  name: string;
  imageUrl?: string;
}

// Discriminated union returned by GET /clinic/api/users/single?clinicId=&(userHash|phoneNumber|userId)=
export type UserSearchResponse =
  | { found: false }
  | { found: true; userId: number; consentStatus: 'none'; canRequestShare: true }
  | { found: true; userId: number; consentStatus: 'pending'; canRequestShare: false }
  | {
      found: true;
      userId: number;
      userHash: string;
      consentStatus: 'approved';
      firstName: string;
      lastName: string;
      phoneNumber: string;
      pets: PetSummary[];
    };

// Exactly one of userHash/phoneNumber/userId must be set — GET /clinic/api/users/single
export interface UserLookupParams {
  clinicId: string | number;
  userHash?: string;
  phoneNumber?: string;
  userId?: string | number;
}

// Exactly one of userHash/phoneNumber must be set — POST /clinic/api/users/share-request
export interface ShareRequestPayload {
  clinicId: string | number;
  userHash?: string;
  phoneNumber?: string;
}

// Pusher payload on private-staff-{staffId} → data_share.approved
export interface DataShareApprovedEvent {
  shareRequestId: number;
  userId: number;
  clinicId: number;
  consentStatus: 'approved';
  firstName: string;
  lastName: string;
  phoneNumber: string;
  pets: PetSummary[];
}

// Pusher payload on private-staff-{staffId} → data_share.denied
export interface DataShareDeniedEvent {
  shareRequestId: number;
  userId: number;
  consentStatus: 'denied';
}

// ─── Pet portal (consent-gated) ───────────────────────────────────────────────

export interface PetMedicine {
  id: number;
  petId: number;
  name: string;
  category: 'vaccine' | 'medicine' | 'other';
  notes?: string;
  dosageSchedule?: {
    amount?: string;
    unit?: string;
    frequencyLabel?: string;
    timesPerDay?: number;
    instructions?: string;
  };
  batchNumber?: string;
  lotNumber?: string;
  recurrence?: unknown;
  recurrenceEndDate?: string | null;
  startDate?: string;
  timezone?: string;
  isActive?: boolean;
  appointmentId?: number | null;
  clinicId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// Full pet profile from GET /clinic/api/pets/:petId?clinicId=
export interface PetProfile {
  id: number;
  name: string;
  imageUrl?: string;
  gender?: string;
  size?: string;
  weight?: string;
  age?: string;
  birthdate?: string;
  notes?: string;
  petType?: { id: number; name: string; imageUrl?: string };
  breed?: { id: number; name: string };
  owner?: { userId: number; firstName: string; lastName: string; phoneNumber: string };
  medicines?: PetMedicine[];
}

// Kept for backward-compat — old search returned this shape; new endpoint returns UserSearchResponse
export interface UserSearchResult {
  id: string | number;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

// ─── Patient Directory (approved-consent patients only) ──────────────────────

export interface PatientDirectoryStats {
  totalAppointments: number;
  finishedAppointments: number;
  cancelledAppointments: number;
  upcomingAppointments: number;
  lastVisitDate?: string;
}

// GET /clinic/api/users/directory?clinicId=&page=&limit=&search=&sort=&branchId=
//   &minAppointments=&lastVisitFrom=&lastVisitTo=&hasUpcoming=&sharedPetId=
export interface PatientDirectoryItem {
  userId: number;
  userHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  consentStatus: 'approved';
  consentApprovedAt: string;
  sharedPetsCount: number;
  sharedPetsPreview: PetSummary[]; // first 3 only — full list on the profile
  stats: PatientDirectoryStats;
}

export interface PatientDirectoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'lastVisit' | 'name' | 'totalAppointments' | 'consentApprovedAt';
  branchId?: string | number;
  minAppointments?: number;
  lastVisitFrom?: string;
  lastVisitTo?: string;
  hasUpcoming?: boolean;
  sharedPetId?: string | number;
}

export interface PatientAppointmentStats {
  total: number;
  finished: number;
  cancelled: number;
  upcoming: number;
  rescheduled: number;
}

export interface PatientVisitStats {
  firstVisitDate?: string;
  lastVisitDate?: string;
  lastVisitBranch?: { id: string | number; title: string };
  daysSinceLastVisit?: number;
  averageDaysBetweenVisits?: number;
}

// GET /clinic/api/users/:userId/clinic-profile?clinicId=  — 404 if no approved share
export interface PatientClinicProfile {
  userId: number;
  userHash: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  consentStatus: 'approved';
  consentApprovedAt: string;
  pets: PetSummary[];
  stats: {
    appointments: PatientAppointmentStats;
    visits: PatientVisitStats;
    pets: { sharedCount: number; distinctPetsVisited: number };
    spend: { totalFinishedSpend: number };
    bookingSource: { ownerBooked: number; clinicBooked: number };
  };
  recentAppointments: Appointment[]; // last 5
}

// GET /clinic/api/users/:userId/appointments?clinicId=&page=&limit=&status=&branchId=
export interface PatientAppointmentListParams {
  page?: number;
  limit?: number;
  status?: AppointmentStatus;
  branchId?: string | number;
}
