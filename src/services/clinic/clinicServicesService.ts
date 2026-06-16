import clinicApi, { ApiError } from './clinicApi';
import type { ApiResponse, ClinicService, PaginatedList, PaginatedResponse } from '../../types/clinic.types';

type ServiceListResponse = PaginatedResponse<ClinicService> | ApiResponse<ClinicService[]>;

const clinicServicesService = {
  async list(search?: string): Promise<ClinicService[]> {
    try {
      const res = await clinicApi.get<ServiceListResponse>('/clinic-services', {
        search: search?.trim() || undefined,
        limit: 100,
      });
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      return (raw as PaginatedList<ClinicService>).items;
    } catch (err) {
      // Endpoint not yet available in clinic portal — fail silently
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return [];
      throw err;
    }
  },
};

export default clinicServicesService;
