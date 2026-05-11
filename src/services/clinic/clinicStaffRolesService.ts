import clinicApi from './clinicApi';
import type { ApiResponse, ClinicStaffRole } from '../../types/clinic.types';

type RolesResponse = ApiResponse<ClinicStaffRole[]> | ApiResponse<{ items: ClinicStaffRole[] }>;

const clinicStaffRolesService = {
  async list(): Promise<ClinicStaffRole[]> {
    const res = await clinicApi.get<RolesResponse>('/clinic-staff-roles');
    const raw = res.data;
    return Array.isArray(raw) ? raw : raw.items;
  },
};

export default clinicStaffRolesService;
