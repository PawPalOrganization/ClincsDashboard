import clinicApi from './clinicApi';
import type { ApiResponse, PaginatedList, PetMedicine, PetProfile, Appointment, AppointmentStatus } from '../../types/clinic.types';

interface PetAppointmentParams {
  branchId?: string | number;
  status?: AppointmentStatus;
  page?: number;
  limit?: number;
}

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
    const res = await clinicApi.get<ApiResponse<PaginatedList<Appointment>>>(
      `/pets/${petId}/appointments`,
      query,
    );
    return res.data;
  },
};

export default clinicPetService;
