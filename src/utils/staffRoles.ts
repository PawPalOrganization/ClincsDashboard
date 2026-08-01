const DOCTOR_ROLE_KEYWORDS = ['doctor', 'vet', 'physician', 'surgeon', 'specialist'];

export function isDoctorRoleName(roleName?: string): boolean {
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  return DOCTOR_ROLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isDoctorStaff(staff?: { role?: { name?: string } } | null): boolean {
  return isDoctorRoleName(staff?.role?.name);
}

type HonorificStaff = {
  role?: { name?: string };
  gender?: 'male' | 'female' | 'other';
};

// "Dr." only for staff whose role actually matches a doctor keyword; everyone else
// gets a gender-based honorific when we know their gender, and no prefix at all when
// we don't (never guess — an unknown/other gender staying unprefixed is safer than
// a wrong Mr./Mrs.). Needs the full staff record (role + gender) — the slim doctor
// object embedded on an appointment often only has id/firstName/lastName, so callers
// should resolve through a staff directory lookup rather than passing appointment.doctor
// straight in.
export function honorificFor(staff?: HonorificStaff | null): string {
  if (!staff) return '';
  if (isDoctorRoleName(staff.role?.name)) return 'Dr. ';
  if (staff.gender === 'male') return 'Mr. ';
  if (staff.gender === 'female') return 'Mrs. ';
  return '';
}
