import clinicApi from './clinicApi';
import type {
  ClinicServiceCategory,
  ClinicServiceCategoryListParams,
  PaginatedList,
  PaginationMeta,
} from '../../types/clinic.types';

const clinicServiceCategoriesService = {
  async list(
    params: ClinicServiceCategoryListParams = {},
  ): Promise<PaginatedList<ClinicServiceCategory>> {
    const res = await clinicApi.get<unknown>(
      '/clinic-service-categories',
      { page: params.page ?? 1, limit: params.limit ?? 100, search: params.search },
    );
    const raw = res as Record<string, unknown>;
    const data = (raw.data ?? []) as ClinicServiceCategory[];
    const meta = (raw.meta ?? {}) as PaginationMeta;
    return {
      items: Array.isArray(data) ? data : [],
      meta: {
        total:      meta.total      ?? (Array.isArray(data) ? data.length : 0),
        page:       meta.page       ?? params.page ?? 1,
        limit:      meta.limit      ?? params.limit ?? 100,
        totalPages: meta.totalPages ?? 1,
      },
    };
  },
};

export default clinicServiceCategoriesService;
