import clinicApi from './clinicApi';
import type { ApiResponse, Clinic, UpdateClinicPayload } from '../../types/clinic.types';

const clinicProfileService = {
  async get(clinicId: string): Promise<Clinic> {
    const res = await clinicApi.get<ApiResponse<Clinic>>(`/clinics/${clinicId}`);
    return res.data;
  },

  async update(clinicId: string, payload: UpdateClinicPayload): Promise<Clinic> {
    const res = await clinicApi.put<ApiResponse<Clinic>>(`/clinics/${clinicId}`, payload);
    return res.data;
  },
};

export default clinicProfileService;
