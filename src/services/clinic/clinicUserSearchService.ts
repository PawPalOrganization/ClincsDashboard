import clinicApi from './clinicApi';
import type { ApiResponse, UserSearchResult } from '../../types/clinic.types';

const clinicUserSearchService = {
  async search(q: string): Promise<UserSearchResult[]> {
    const res = await clinicApi.get<ApiResponse<UserSearchResult[]>>('/users/search', { q });
    return Array.isArray(res.data) ? res.data : [];
  },
};

export default clinicUserSearchService;
