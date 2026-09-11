import clinicApi from './clinicApi';
import type {
  ApiResponse,
  CreateVaccinationPlanPayload,
  PaginatedList,
  PaginatedResponse,
  UpdateVaccinationPayload,
  UpdateVaccinationPlanPayload,
  Vaccination,
  VaccinationListParams,
  VaccinationPlan,
  VaccinationType,
} from '../../types/clinic.types';

type VaccinationTypesResponse = PaginatedResponse<VaccinationType> | ApiResponse<VaccinationType[]>;

const clinicVaccinationService = {
  // GET /clinic/api/vaccination-types?page&limit&search
  // Read-only platform catalog for the plan-creation dropdown — no portal "create type".
  async listTypes(params: { page?: number; limit?: number; search?: string } = {}): Promise<PaginatedList<VaccinationType>> {
    const res = await clinicApi.get<VaccinationTypesResponse>('/vaccination-types', {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      search: params.search || undefined,
    });
    const raw = res.data;
    if (Array.isArray(raw)) {
      return { items: raw, meta: { total: raw.length, page: 1, limit: raw.length, totalPages: 1 } };
    }
    return raw;
  },

  // GET /clinic/api/pets/:petId/vaccinations?clinicId=&search=&status=
  // Every clinic's occurrences for a shared pet — the caller filters mutability by
  // comparing plan.clinicId against their own portal clinicId.
  async listForPet(petId: string | number, params: VaccinationListParams): Promise<Vaccination[]> {
    const res = await clinicApi.get<ApiResponse<Vaccination[]>>(`/pets/${petId}/vaccinations`, {
      clinicId: String(params.clinicId),
      search: params.search || undefined,
      status: params.status,
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  // POST /clinic/api/pets/:petId/vaccination-plans
  // Creates the plan + its first occurrence internally; returns that first occurrence
  // (with the nested plan) — never a full future schedule.
  async createPlan(petId: string | number, payload: CreateVaccinationPlanPayload): Promise<Vaccination> {
    const res = await clinicApi.post<ApiResponse<Vaccination>>(`/pets/${petId}/vaccination-plans`, payload);
    return res.data;
  },

  async updatePlan(planId: string | number, payload: UpdateVaccinationPlanPayload): Promise<VaccinationPlan> {
    const res = await clinicApi.put<ApiResponse<VaccinationPlan>>(`/vaccination-plans/${planId}`, payload);
    return res.data;
  },

  // Cascades to the plan's occurrences and their linked reminders.
  async deletePlan(planId: string | number): Promise<void> {
    await clinicApi.del<ApiResponse<unknown>>(`/vaccination-plans/${planId}`);
  },

  async updateOccurrence(id: string | number, payload: UpdateVaccinationPayload): Promise<Vaccination> {
    const res = await clinicApi.put<ApiResponse<Vaccination>>(`/vaccinations/${id}`, payload);
    return res.data;
  },

  // Only the current pending next occurrence — done history rows 409. If it's the
  // plan's only occurrence, the backend deletes the plan too.
  async deleteOccurrence(id: string | number): Promise<void> {
    await clinicApi.del<ApiResponse<unknown>>(`/vaccinations/${id}`);
  },
};

export default clinicVaccinationService;
