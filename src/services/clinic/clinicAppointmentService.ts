import clinicApi from './clinicApi';
import type {
  ApiResponse,
  Appointment,
  AppointmentListParams,
  AppointmentStats,
  CreateAppointmentPayload,
  PaginatedList,
  PaginatedResponse,
  PaginationMeta,
  UpdateAppointmentPayload,
} from '../../types/clinic.types';

type AppointmentListResponse = PaginatedResponse<Appointment> | ApiResponse<Appointment[]>;

const clinicAppointmentService = {
  async list(params: AppointmentListParams): Promise<PaginatedList<Appointment>> {
    const res = await clinicApi.get<AppointmentListResponse>('/appointments', {
      page: params.page,
      limit: params.limit,
      branchId: params.branchId,
      date: params.date,
      status: params.status,
      clinicStaffId: params.clinicStaffId,
      clinicServiceId: params.clinicServiceId,
      phone: params.phone,
      name: params.name,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    });

    const raw = res.data;

    // Backend returns { data: [...], meta: { total, page, limit, totalPages } }
    // meta is top-level on res, not nested inside data
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

  async getToday(branchId: string | number, date?: string): Promise<Appointment[]> {
    const res = await clinicApi.get<ApiResponse<Appointment[]>>('/appointments/today', {
      branchId,
      date,
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  async getOne(id: string | number): Promise<Appointment> {
    const res = await clinicApi.get<ApiResponse<Appointment>>(`/appointments/${id}`);
    return res.data;
  },

  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const res = await clinicApi.post<ApiResponse<Appointment>>('/appointments', payload);
    return res.data;
  },

  async update(id: string | number, payload: UpdateAppointmentPayload): Promise<Appointment> {
    const res = await clinicApi.put<ApiResponse<Appointment>>(`/appointments/${id}`, payload);
    return res.data;
  },

  async finish(id: string | number): Promise<Appointment> {
    const res = await clinicApi.patch<ApiResponse<Appointment>>(`/appointments/${id}/status`, {
      status: 'finished',
    });
    return res.data;
  },

  async cancel(id: string | number, reason?: string): Promise<Appointment> {
    const res = await clinicApi.post<ApiResponse<Appointment>>(`/appointments/${id}/cancel`, {
      reason,
    });
    return res.data;
  },

  async getBranchStats(branchId: string | number): Promise<AppointmentStats> {
    const res = await clinicApi.get<ApiResponse<AppointmentStats>>(
      `/appointments/branches/${branchId}/stats`,
    );
    return res.data;
  },

  async getClinicStats(clinicId: string | number): Promise<AppointmentStats> {
    const res = await clinicApi.get<ApiResponse<AppointmentStats>>(
      `/appointments/clinics/${clinicId}/stats`,
    );
    return res.data;
  },
};

export default clinicAppointmentService;
