import clinicApi from './clinicApi';
import type {
  ApiResponse,
  PaginatedList,
  PaginationMeta,
  Review,
  ReviewListParams,
} from '../../types/clinic.types';

type ReviewListResponse = ApiResponse<PaginatedList<Review>> | ApiResponse<Review[]>;

// Backend may return { data: [...], meta: {...} } with meta top-level, or a nested
// paginated object under data — same defensive convention used across the other services.
function normalizePaginated(
  raw: PaginatedList<Review> | Review[],
  topMeta: PaginationMeta | undefined,
  page?: number,
  limit?: number,
): PaginatedList<Review> {
  if (Array.isArray(raw)) {
    return {
      items: raw,
      meta: {
        total:      topMeta?.total      ?? raw.length,
        page:       topMeta?.page       ?? page ?? 1,
        limit:      topMeta?.limit      ?? limit ?? raw.length,
        totalPages: topMeta?.totalPages ?? 1,
      },
    };
  }
  return raw;
}

const clinicReviewsService = {
  async listForClinic(
    clinicId: string | number,
    params: ReviewListParams = {},
  ): Promise<PaginatedList<Review>> {
    const res = await clinicApi.get<ReviewListResponse>(`/clinics/${clinicId}/reviews`, {
      sort: params.sort ?? 'latest',
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    });
    const topMeta = (res as unknown as Record<string, unknown>).meta as PaginationMeta | undefined;
    return normalizePaginated(res.data, topMeta, params.page, params.limit);
  },

  async listForBranch(
    clinicId: string | number,
    branchId: string | number,
    params: ReviewListParams = {},
  ): Promise<PaginatedList<Review>> {
    const res = await clinicApi.get<ReviewListResponse>(
      `/clinics/${clinicId}/branches/${branchId}/reviews`,
      {
        sort: params.sort ?? 'latest',
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    );
    const topMeta = (res as unknown as Record<string, unknown>).meta as PaginationMeta | undefined;
    return normalizePaginated(res.data, topMeta, params.page, params.limit);
  },
};

export default clinicReviewsService;
