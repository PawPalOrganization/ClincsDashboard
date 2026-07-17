import clinicApi from './clinicApi';
import type { ApiResponse, PaginatedList, PaginationMeta, PetMedicine, PetProfile, Appointment, AppointmentStatus } from '../../types/clinic.types';

interface PetAppointmentParams {
  branchId?: string | number;
  status?: AppointmentStatus;
  page?: number;
  limit?: number;
}

type PetAppointmentsResponse = ApiResponse<PaginatedList<Appointment>> | ApiResponse<Appointment[]>;

const clinicPetService = {
  // GET /clinic/api/pets/:petId?clinicId=
  // Returns full pet profile + owner summary + medicines. 403 if consent missing.
  async getProfile(petId: string | number, clinicId: string | number): Promise<PetProfile> {
    const res = await clinicApi.get<ApiResponse<PetProfile>>(
      `/pets/${petId}`,
      { clinicId: String(clinicId) },
    );
    return res.data;
  },

  // GET /clinic/api/pets/:petId/medicines?clinicId=&category=
  // Read-only medicines/vaccines for a shared pet. 403 if consent missing.
  async listMedicines(
    petId: string | number,
    clinicId: string | number,
    category?: 'vaccine' | 'medicine' | 'other',
  ): Promise<PetMedicine[]> {
    const params: Record<string, string> = { clinicId: String(clinicId) };
    if (category) params.category = category;
    const res = await clinicApi.get<ApiResponse<PetMedicine[]>>(
      `/pets/${petId}/medicines`,
      params,
    );
    return Array.isArray(res.data) ? res.data : [];
  },

  // GET /clinic/api/pets/:petId/appointments?clinicId=&branchId=&status=finished&page=&limit=
  // Visit history for a shared pet (defaults to finished appointments). 403 if consent missing.
  async listAppointments(
    petId: string | number,
    clinicId: string | number,
    params: PetAppointmentParams = {},
  ): Promise<PaginatedList<Appointment>> {
    const query: Record<string, string | number> = {
      clinicId: String(clinicId),
      status: params.status ?? 'finished',
      page: params.page ?? 1,
      limit: params.limit ?? 10,
    };
    if (params.branchId != null) query.branchId = String(params.branchId);
    const res = await clinicApi.get<PetAppointmentsResponse>(
      `/pets/${petId}/appointments`,
      query,
    );

    const raw = res.data;
    // Same convention as clinicAppointmentService.list: the backend sometimes returns
    // { data: [...], meta: {...} } with meta top-level rather than nested inside data —
    // without this normalization, res.data.items/.meta come back undefined and crash callers.
    if (Array.isArray(raw)) {
      const topMeta = (res as unknown as Record<string, unknown>).meta as PaginationMeta | undefined;
      return {
        items: raw,
        meta: {
          total:      topMeta?.total      ?? raw.length,
          page:       topMeta?.page       ?? params.page ?? 1,
          limit:      topMeta?.limit      ?? params.limit ?? raw.length,
          totalPages: topMeta?.totalPages ?? 1,
        },
      };
    }
    return raw;
  },
};

export default clinicPetService;
