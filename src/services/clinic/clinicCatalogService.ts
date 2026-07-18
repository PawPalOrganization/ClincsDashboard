import clinicApi from './clinicApi';
import clinicFilesService from './clinicFilesService';
import type {
  ApiResponse,
  ClinicService,
  ClinicServiceListParams,
  CreateClinicServicePayload,
  PaginatedList,
  PaginationMeta,
  UpdateClinicServicePayload,
  UploadedFile,
} from '../../types/clinic.types';

const clinicCatalogService = {
  async list(
    clinicId: string | number,
    params: ClinicServiceListParams = {},
  ): Promise<PaginatedList<ClinicService>> {
    const res = await clinicApi.get<unknown>(
      `/clinics/${clinicId}/services`,
      {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        search: params.search,
        categoryId: params.categoryId,
        scope: params.scope,
      },
    );
    const raw = res as Record<string, unknown>;
    const data = (raw.data ?? []) as ClinicService[];
    const meta = (raw.meta ?? {}) as PaginationMeta;
    return {
      items: Array.isArray(data) ? data : [],
      meta: {
        total:      meta.total      ?? (Array.isArray(data) ? data.length : 0),
        page:       meta.page       ?? params.page ?? 1,
        limit:      meta.limit      ?? params.limit ?? 50,
        totalPages: meta.totalPages ?? 1,
      },
    };
  },

  async getOne(clinicId: string | number, serviceId: string | number): Promise<ClinicService> {
    const res = await clinicApi.get<ApiResponse<ClinicService>>(
      `/clinics/${clinicId}/services/${serviceId}`,
    );
    return res.data;
  },

  async create(
    clinicId: string | number,
    payload: CreateClinicServicePayload,
  ): Promise<ClinicService> {
    const res = await clinicApi.post<ApiResponse<ClinicService>>(
      `/clinics/${clinicId}/services`,
      payload,
    );
    return res.data;
  },

  async update(
    clinicId: string | number,
    serviceId: string | number,
    payload: UpdateClinicServicePayload,
  ): Promise<ClinicService> {
    const res = await clinicApi.put<ApiResponse<ClinicService>>(
      `/clinics/${clinicId}/services/${serviceId}`,
      payload,
    );
    return res.data;
  },

  async delete(clinicId: string | number, serviceId: string | number): Promise<void> {
    await clinicApi.del<ApiResponse<null>>(
      `/clinics/${clinicId}/services/${serviceId}`,
    );
  },

  async uploadLogo(file: File): Promise<UploadedFile> {
    return clinicFilesService.upload(file);
  },
};

export default clinicCatalogService;
