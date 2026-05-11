import clinicApi from './clinicApi';
import type {
  ApiResponse,
  ClinicStaff,
  CreateClinicStaffPayload,
  PaginatedList,
  PaginatedResponse,
  UpdateClinicStaffPayload,
  UpdateStaffAssignmentsPayload,
} from '../../types/clinic.types';

export interface ClinicStaffListParams {
  page: number;
  limit: number;
  search?: string;
  clinicBranchId?: string | number;
}

type StaffListResponse = PaginatedResponse<ClinicStaff> | ApiResponse<ClinicStaff[]>;

const clinicStaffService = {
  async list(params: ClinicStaffListParams): Promise<PaginatedList<ClinicStaff>> {
    const res = await clinicApi.get<StaffListResponse>('/clinic-staff', {
      page: params.page,
      limit: params.limit,
      search: params.search?.trim() || undefined,
      clinicBranchId: params.clinicBranchId,
    });

    const raw = res.data;
    if (Array.isArray(raw)) {
      return {
        items: raw,
        meta: {
          total: raw.length,
          page: params.page,
          limit: params.limit,
          totalPages: 1,
        },
      };
    }

    return raw;
  },

  async getOne(staffId: string | number): Promise<ClinicStaff> {
    const res = await clinicApi.get<ApiResponse<ClinicStaff>>(`/clinic-staff/${staffId}`);
    return res.data;
  },

  async create(payload: CreateClinicStaffPayload): Promise<ClinicStaff> {
    const res = await clinicApi.post<ApiResponse<ClinicStaff>>('/clinic-staff', payload);
    return res.data;
  },

  async update(
    staffId: string | number,
    payload: UpdateClinicStaffPayload,
  ): Promise<ClinicStaff> {
    const res = await clinicApi.put<ApiResponse<ClinicStaff>>(
      `/clinic-staff/${staffId}`,
      payload,
    );
    return res.data;
  },

  async updateAssignments(
    staffId: string | number,
    payload: UpdateStaffAssignmentsPayload,
  ): Promise<ClinicStaff> {
    const res = await clinicApi.put<ApiResponse<ClinicStaff>>(
      `/clinic-staff/${staffId}/assignments`,
      payload,
    );
    return res.data;
  },
};

export default clinicStaffService;
