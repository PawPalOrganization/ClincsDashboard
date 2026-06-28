import clinicApi from './clinicApi';
import type { ApiResponse, UserSearchResponse } from '../../types/clinic.types';

const clinicUserSearchService = {
  // GET /clinic/api/users/search?phone={phone}&clinicId={clinicId}
  // Returns a discriminated union based on whether the user exists and what consent state applies.
  async searchByPhone(phone: string, clinicId: string | number): Promise<UserSearchResponse> {
    const res = await clinicApi.get<ApiResponse<UserSearchResponse>>('/users/search', {
      phone,
      clinicId: String(clinicId),
    });
    return res.data;
  },

  // POST /clinic/api/users/:userId/share-request  { clinicId }
  // Sends push + email to the pet owner requesting access.
  // Idempotent when already pending (no duplicate push); 409 if already approved.
  async requestShare(
    userId: string | number,
    clinicId: string | number,
  ): Promise<{ shareRequestId: number }> {
    const res = await clinicApi.post<ApiResponse<{ shareRequestId: number }>>(
      `/users/${userId}/share-request`,
      { clinicId: Number(clinicId) },
    );
    return res.data;
  },

  // GET /clinic/api/users/:userId?clinicId={clinicId}
  // Returns the approved profile + shared pets. Used as polling fallback while consent is pending.
  async getProfile(userId: string | number, clinicId: string | number): Promise<UserSearchResponse> {
    const res = await clinicApi.get<ApiResponse<UserSearchResponse>>(
      `/users/${userId}`,
      { clinicId: String(clinicId) },
    );
    return res.data;
  },
};

export default clinicUserSearchService;
