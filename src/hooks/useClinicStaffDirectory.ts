import { useEffect, useState } from 'react';
import clinicStaffService from '../services/clinic/clinicStaffService';
import type { ClinicStaff } from '../types/clinic.types';

const LIMIT = 500;

// Appointment list/detail responses only embed a slim doctor sub-object
// (id/firstName/lastName, role often absent) — not enough to reliably tell a doctor
// from a groomer or to pick a gender-based honorific for either. This fetches the
// clinic's full staff roster once and exposes an id→ClinicStaff lookup so any page
// displaying an assigned staff member can resolve the authoritative role/gender
// instead of trusting whatever the appointment happened to embed.
export function useClinicStaffDirectory(clinicId: string | undefined | null): Map<string, ClinicStaff> {
  const [directory, setDirectory] = useState<Map<string, ClinicStaff>>(new Map());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: clear then refetch on clinicId change
    if (!clinicId) { setDirectory(new Map()); return; }
    clinicStaffService.list({ page: 1, limit: LIMIT })
      .then((r) => setDirectory(new Map(r.items.map((s) => [String(s.id), s]))))
      .catch(() => {});
  }, [clinicId]);

  return directory;
}
