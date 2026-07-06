import clinicApi from './clinicApi';
import type {
  ApiResponse,
  Appointment,
  PaginatedList,
  PaginationMeta,
  PatientAppointmentListParams,
  PatientClinicProfile,
  PatientDirectoryItem,
  PatientDirectoryListParams,
} from '../../types/clinic.types';

type DirectoryListResponse = ApiResponse<PaginatedList<PatientDirectoryItem>> | ApiResponse<PatientDirectoryItem[]>;
type AppointmentListResponse = ApiResponse<PaginatedList<Appointment>> | ApiResponse<Appointment[]>;

// Backend returns { data: [...], meta: {...} } with meta top-level on the response,
// not nested inside data — same convention as clinicAppointmentService.list.
function normalizePaginated<T>(
  raw: PaginatedList<T> | T[],
  topMeta: PaginationMeta | undefined,
  page?: number,
  limit?: number,
): PaginatedList<T> {
  if (Array.isArray(raw)) {
    return {
      items: raw,
      meta: {
        total:      topMeta?.total      ?? raw.length,
        page:       topMeta?.page       ?? page ?? 1,
        limit:      topMeta?.limit      ?? limit ?? raw.length,
        totalPages: topMeta?.totalPages ?? 1,
      },
    };
  }
  return raw;
}

const clinicPatientsService = {
  async list(
    clinicId: string | number,
    params: PatientDirectoryListParams,
  ): Promise<PaginatedList<PatientDirectoryItem>> {
    const res = await clinicApi.get<DirectoryListResponse>('/users/directory', {
      clinicId: String(clinicId),
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort,
      branchId: params.branchId,
      minAppointments: params.minAppointments,
      lastVisitFrom: params.lastVisitFrom,
      lastVisitTo: params.lastVisitTo,
      hasUpcoming: params.hasUpcoming,
      sharedPetId: params.sharedPetId,
    });
    const topMeta = (res as unknown as Record<string, unknown>).meta as PaginationMeta | undefined;
    return normalizePaginated(res.data, topMeta, params.page, params.limit);
  },

  async getClinicProfile(
    userId: string | number,
    clinicId: string | number,
  ): Promise<PatientClinicProfile> {
    const res = await clinicApi.get<ApiResponse<PatientClinicProfile>>(
      `/users/${userId}/clinic-profile`,
      { clinicId: String(clinicId) },
    );
    return res.data;
  },

  async listAppointments(
    userId: string | number,
    clinicId: string | number,
    params: PatientAppointmentListParams,
  ): Promise<PaginatedList<Appointment>> {
    const res = await clinicApi.get<AppointmentListResponse>(`/users/${userId}/appointments`, {
      clinicId: String(clinicId),
      page: params.page,
      limit: params.limit,
      status: params.status,
      branchId: params.branchId,
    });
    const topMeta = (res as unknown as Record<string, unknown>).meta as PaginationMeta | undefined;
    return normalizePaginated(res.data, topMeta, params.page, params.limit);
  },
};

export default clinicPatientsService;
