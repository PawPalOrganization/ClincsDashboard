import clinicApi from './clinicApi';
import type {
  ApiResponse,
  DashboardDateRangeParams,
  DashboardKpis,
  DashboardRevenue,
  DashboardServiceListParams,
  DashboardServices,
} from '../../types/clinic.types';

const clinicDashboardService = {
  async getKpis(
    clinicId: string | number,
    params: DashboardDateRangeParams = {},
    opts?: { signal?: AbortSignal },
  ): Promise<DashboardKpis> {
    const res = await clinicApi.get<ApiResponse<DashboardKpis>>(
      `/clinics/${clinicId}/dashboard/kpis`,
      { startDate: params.startDate, endDate: params.endDate },
      opts,
    );
    return res.data;
  },

  async getRevenue(
    clinicId: string | number,
    params: DashboardDateRangeParams = {},
    opts?: { signal?: AbortSignal },
  ): Promise<DashboardRevenue> {
    const res = await clinicApi.get<ApiResponse<DashboardRevenue>>(
      `/clinics/${clinicId}/dashboard/revenue`,
      { startDate: params.startDate, endDate: params.endDate },
      opts,
    );
    return res.data;
  },

  async getServices(
    clinicId: string | number,
    params: DashboardServiceListParams = {},
    opts?: { signal?: AbortSignal },
  ): Promise<DashboardServices> {
    const res = await clinicApi.get<ApiResponse<DashboardServices>>(
      `/clinics/${clinicId}/dashboard/services`,
      {
        startDate: params.startDate,
        endDate: params.endDate,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      },
      opts,
    );
    return res.data;
  },
};

export default clinicDashboardService;
