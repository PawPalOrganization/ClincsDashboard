import clinicApi from './clinicApi';
import type {
  ApiResponse,
  PaginatedResponse,
  PaginatedList,
  ClinicBranch,
  CreateBranchPayload,
  UpdateBranchPayload,
} from '../../types/clinic.types';

// The branches list endpoint may return a plain array or a paginated object
type BranchesListResponse = PaginatedResponse<ClinicBranch> | ApiResponse<ClinicBranch[]>;

const clinicBranchesService = {
  async list(
    clinicId: string,
    page = 1,
    limit = 10,
  ): Promise<PaginatedList<ClinicBranch>> {
    const res = await clinicApi.get<BranchesListResponse>(
      `/clinics/${clinicId}/branches`,
      { page, limit },
    );
    const raw = res.data;
    if (Array.isArray(raw)) {
      return {
        items: raw,
        meta: { total: raw.length, page: 1, limit: raw.length, totalPages: 1 },
      };
    }
    return raw as PaginatedList<ClinicBranch>;
  },

  async getOne(clinicId: string, branchId: string): Promise<ClinicBranch> {
    const res = await clinicApi.get<ApiResponse<ClinicBranch>>(
      `/clinics/${clinicId}/branches/${branchId}`,
    );
    return res.data;
  },

  async create(clinicId: string, payload: CreateBranchPayload): Promise<ClinicBranch> {
    const res = await clinicApi.post<ApiResponse<ClinicBranch>>(
      `/clinics/${clinicId}/branches`,
      payload,
    );
    return res.data;
  },

  async update(
    clinicId: string,
    branchId: string,
    payload: UpdateBranchPayload,
  ): Promise<ClinicBranch> {
    const res = await clinicApi.put<ApiResponse<ClinicBranch>>(
      `/clinics/${clinicId}/branches/${branchId}`,
      payload,
    );
    return res.data;
  },
};

export default clinicBranchesService;
