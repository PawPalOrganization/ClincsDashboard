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
  avgRating?: number;
  reviewsCount?: number;
  reviewsEnabled?: boolean;
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
  avgRating?: number;
  reviewsCount?: number;
  reviewsEnabled?: boolean;
}

// ─── Services ─────────────────────────────────────────────────────────────────

export interface BranchService {
  clinicServiceId: number;
  cost: number;
}

export interface ClinicServiceCategory {
  id: number;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  logoUrl?: string | null;
}

export interface ClinicService {
  id: string | number;
  clinicId: number | null;
  isPlatform: boolean;
  name: string;
  nameAr?: string | null;
  description?: string;
  descriptionAr?: string | null;
  logoUrl?: string | null;
  homeServiceAvailable?: boolean;
  clinicServiceCategoryId?: number | null;
  category?: ClinicServiceCategory | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClinicServicePayload {
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  logoUrl?: string | null;
  homeServiceAvailable?: boolean;
  clinicServiceCategoryId: number;
}

export interface UpdateClinicServicePayload {
  name?: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  logoUrl?: string | null;
  homeServiceAvailable?: boolean;
  clinicServiceCategoryId?: number;
}

export interface ClinicServiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: number | string;
  /** 'all' (default) = platform catalog (clinicId null) + this clinic's own services. 'clinic' = this clinic's own services only. */
  scope?: 'all' | 'clinic';
}

export interface ClinicServiceCategoryListParams {
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
  sortBy?: 'scheduledAt';
  sortOrder?: 'asc' | 'desc';
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

// Response from POST /clinic/api/users/share-request. consentStatus is 'approved' when
// the target user already had an approved share on file (backend notifies them to share
// an additional pet rather than granting anything new here) — 'pending' for a fresh request.
export interface ShareRequestResponse {
  shareRequestId: number;
  consentStatus?: 'pending' | 'approved';
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

// ─── Walk-in client onboarding (unclaimed users) ─────────────────────────────

export type ClinicClientAccountStatus = 'claimed' | 'unclaimed';

// POST /clinic/api/clinics/:clinicId/users
export interface CreateClientUserPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
}

export interface ClientUser {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  accountStatus: ClinicClientAccountStatus;
}

// POST /clinic/api/clinics/:clinicId/users/:userId/pets
export interface CreateClientPetPayload {
  name: string;
  petTypeId: number;
  petTypeBreedId?: number;
  size?: string;
  weight?: string;
  age?: string;
  notes?: string;
  birthdate?: string;
  adoptionDate?: string;
  imageUrl?: string;
  gender?: string;
}

// GET /api/pet-types (public, proxied same as /clinic/api)
export interface PetType {
  id: number;
  name: string;
  imageUrl?: string;
}

// GET /api/pet-type-breeds?petTypeId= (public)
export interface PetTypeBreed {
  id: number;
  name: string;
  petTypeId: number;
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

// ─── Reviews ──────────────────────────────────────────────────────────────────
// Read-only on the clinic portal — no create/edit/delete. Reviews are left by
// pet owners after a finished appointment (mobile app), and appear here plus
// stream in live over Pusher (private-branch-{branchId} → review.created/updated/deleted).

export interface Review {
  id: string | number;
  clinicId?: number;
  clinicBranchId?: number;
  branch?: { id: number | string; title: string } | null;
  appointmentId?: number;
  userId?: number;
  rating: number;
  comment?: string | null;
  reviewerName?: string | null;
  user?: { firstName?: string; lastName?: string } | null;
  createdAt: string;
  updatedAt?: string;
}

// GET /clinic/api/clinics/:clinicId/reviews?sort=&page=&limit=
// GET /clinic/api/clinics/:clinicId/branches/:branchId/reviews?sort=&page=&limit=
export interface ReviewListParams {
  page?: number;
  limit?: number;
  sort?: 'latest' | 'highest' | 'lowest';
}

// Pusher payload on private-branch-{branchId} → review.deleted
export interface ReviewDeletedEvent {
  id: string | number;
  clinicBranchId?: number;
}

// ─── Dashboard Analytics ───────────────────────────────────────────────────────
// Read-only. startDate/endDate are YYYY-MM-DD (UTC calendar days) — send both or
// neither (a single date is rejected by the backend with 400).

export interface DashboardDateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface DashboardPeriod {
  startDate: string;
  endDate: string;
}

export interface AppointmentSourceSplit {
  app: number;
  manual: number;
  appPercent: number;
  manualPercent: number;
}

export interface ClientComposition {
  new: number;
  returning: number;
  newPercent: number;
  returningPercent: number;
}

// GET /clinic/api/clinics/:clinicId/dashboard/kpis?startDate=&endDate=
// Defaults when no dates given: all-time (period: null), except branches/staffMembers/
// appointmentsToday which are always current/UTC-today regardless of the date filter.
export interface DashboardKpis {
  branches: number;
  staffMembers: number;
  appointmentsToday: number;
  noShowRate: number;
  noShowRateDelta: number | null; // vs previous equal-length period; null when period is all-time
  totalAppointments: number;
  appointmentSources: AppointmentSourceSplit;
  clientComposition: ClientComposition;
  period: DashboardPeriod | null; // null = all-time
}

export type DashboardGrain = 'daily' | 'monthly';

export interface RevenueByBranch {
  clinicBranchId: number;
  branchTitle: string;
  revenue: number;
}

export interface RevenuePoint {
  bucket: string; // '2026-07-19' (daily grain) or '2026-07' (monthly grain)
  revenue: number;
  byBranch: RevenueByBranch[];
}

// GET /clinic/api/clinics/:clinicId/dashboard/revenue?startDate=&endDate=
// Default range when no dates given: 1st of current month → today. grain is
// backend-decided (daily for <=30 day ranges, monthly otherwise) — never sent by the client.
export interface DashboardRevenue {
  period: DashboardPeriod;
  grain: DashboardGrain;
  points: RevenuePoint[];
}

// GET /clinic/api/clinics/:clinicId/dashboard/services?sortBy=&sortOrder=&startDate=&endDate=
// Same default range as revenue. Only services with profit > 0 are included; bookings
// counts distinct finished appointments. No pagination — backend returns the full list.
export interface DashboardServiceListParams extends DashboardDateRangeParams {
  sortBy?: 'bookings' | 'profit';
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardServiceItem {
  clinicServiceId: number;
  name: string;
  nameAr: string;
  profit: number;
  bookings: number;
}

export interface DashboardServices {
  period: DashboardPeriod;
  grain: DashboardGrain;
  items: DashboardServiceItem[];
}
