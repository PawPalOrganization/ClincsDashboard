import type { ApiResponse, PetType, PetTypeBreed } from '../../types/clinic.types';

// These hit the public /api/* endpoints (mobile-app catalog data), not /clinic/api —
// no clinic auth required, so this bypasses clinicApi's bearer-token base client and
// calls fetch directly. Relies on the /api/* proxy rule added alongside /clinic/api
// in vite.config.ts (dev) and vercel.json (prod).
const clinicPetTypesService = {
  async listPetTypes(search = ''): Promise<PetType[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/pet-types${qs}`);
    if (!res.ok) throw new Error('Failed to load pet types.');
    const json = (await res.json()) as ApiResponse<PetType[]>;
    return json.data;
  },

  async listBreeds(petTypeId: number, search = ''): Promise<PetTypeBreed[]> {
    const params = new URLSearchParams({ petTypeId: String(petTypeId) });
    if (search) params.set('search', search);
    const res = await fetch(`/api/pet-type-breeds?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load breeds.');
    const json = (await res.json()) as ApiResponse<PetTypeBreed[]>;
    return json.data;
  },
};

export default clinicPetTypesService;
