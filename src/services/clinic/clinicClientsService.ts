import clinicApi from './clinicApi';
import type {
  ApiResponse,
  ClientUser,
  CreateClientPetPayload,
  CreateClientUserPayload,
  PetSummary,
} from '../../types/clinic.types';

const clinicClientsService = {
  // POST /clinic/api/clinics/:clinicId/users — 201 new unclaimed user, or 200 if the
  // phone already belongs to an unclaimed user (reused, share already ensured).
  // Throws ApiError(409, ...) if the phone belongs to a claimed app user, or the
  // email is taken by another account.
  async createUser(
    clinicId: string | number,
    payload: CreateClientUserPayload,
  ): Promise<ClientUser> {
    const res = await clinicApi.post<ApiResponse<ClientUser>>(
      `/clinics/${clinicId}/users`,
      payload,
    );
    return res.data;
  },

  // POST /clinic/api/clinics/:clinicId/users/:userId/pets — 201 new pet.
  async createPet(
    clinicId: string | number,
    userId: string | number,
    payload: CreateClientPetPayload,
  ): Promise<PetSummary> {
    const res = await clinicApi.post<ApiResponse<PetSummary>>(
      `/clinics/${clinicId}/users/${userId}/pets`,
      payload,
    );
    return res.data;
  },
};

export default clinicClientsService;
