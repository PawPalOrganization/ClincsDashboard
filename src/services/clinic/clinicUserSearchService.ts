import clinicApi from './clinicApi';
import type {
  ApiResponse,
  ShareRequestPayload,
  UserLookupParams,
  UserSearchResponse,
} from '../../types/clinic.types';

const clinicUserSearchService = {
  // GET /clinic/api/users/single?clinicId=&(userHash|phoneNumber|userId)=
  // Exactly one of userHash/phoneNumber/userId must be provided.
  // Returns a discriminated union based on whether the user exists and what consent state applies.
  // Also used to poll by userId while a share request is pending.
  async lookup(params: UserLookupParams): Promise<UserSearchResponse> {
    const identifiers = [params.userHash, params.phoneNumber, params.userId].filter(
      (v) => v !== undefined && v !== null && v !== '',
    );
    if (identifiers.length !== 1) {
      throw new Error('lookup() requires exactly one of userHash, phoneNumber, or userId.');
    }

    const res = await clinicApi.get<ApiResponse<UserSearchResponse>>('/users/single', {
      clinicId: String(params.clinicId),
      userHash: params.userHash,
      phoneNumber: params.phoneNumber,
      userId: params.userId !== undefined ? String(params.userId) : undefined,
    });
    return res.data;
  },

  // POST /clinic/api/users/share-request  { clinicId, userHash | phoneNumber }
  // Sends push + email to the pet owner requesting access.
  // Idempotent when already pending (no duplicate push); 409 if already approved.
  async requestShare(payload: ShareRequestPayload): Promise<{ shareRequestId: number }> {
    const res = await clinicApi.post<ApiResponse<{ shareRequestId: number }>>(
      '/users/share-request',
      {
        clinicId: Number(payload.clinicId),
        userHash: payload.userHash,
        phoneNumber: payload.phoneNumber,
      },
    );
    return res.data;
  },
};

export default clinicUserSearchService;
