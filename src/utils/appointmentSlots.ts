import type { BranchWorkingHour, ClinicBranch, ClinicStaff } from '../types/clinic.types';

export function generateSlots(start: string, end: string, step = 30): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur < endMin) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
    cur += step;
  }
  return slots;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// null  = no workingHours data on this staff object → show manual time input
// []    = doctor (or the branch) is off this day, or their hours don't overlap at all
// [...] = available time slots, clamped to the branch's hours when the branch has any
//         configured (matches the backend's now-authoritative "staff hours intersected
//         with branch hours" rule — booking outside this window gets rejected server-side)
export function getSlotsForDate(doctor: ClinicStaff, date: string, branchHours?: BranchWorkingHour[]): string[] | null {
  if (!doctor.workingHours?.length) return null;
  const dow = new Date(date + 'T12:00:00').getDay();
  const wh = doctor.workingHours.find((h: BranchWorkingHour) => h.dayOfWeek === dow);
  if (!wh) return [];

  // A branch with no hours configured at all imposes no constraint — same as the
  // backend's assertWithinBranchWorkingHours, which skips enforcement in that case.
  if (!branchHours?.length) return generateSlots(wh.startTime, wh.endTime);

  const branchWh = branchHours.find((h) => h.dayOfWeek === dow);
  if (!branchWh) return []; // branch has hours configured but is closed this day

  const start = Math.max(toMinutes(wh.startTime), toMinutes(branchWh.startTime));
  const end = Math.min(toMinutes(wh.endTime), toMinutes(branchWh.endTime));
  if (start >= end) return [];
  return generateSlots(fromMinutes(start), fromMinutes(end));
}

// null    = branch has no hours configured at all → no constraint to apply
// 'closed' = branch has hours configured, but not for this day
// [entry]  = the branch's open/close window for this day
export function getBranchHoursForDate(
  branchHours: BranchWorkingHour[] | undefined,
  date: string,
): BranchWorkingHour | 'closed' | null {
  if (!branchHours?.length) return null;
  const dow = new Date(date + 'T12:00:00').getDay();
  return branchHours.find((h) => h.dayOfWeek === dow) ?? 'closed';
}

// Used for the manual time-entry fallback (a doctor with no workingHours data at all),
// which — unlike the generated slot buttons — isn't already clamped to branch hours by
// construction. Lets the picker itself reject an out-of-range time instead of only
// finding out via a 400 at submit.
export function isTimeWithinBranchHours(time: string, branchDayHours: BranchWorkingHour | 'closed' | null): boolean {
  if (!branchDayHours) return true;
  if (branchDayHours === 'closed') return false;
  const t = toMinutes(time);
  return t >= toMinutes(branchDayHours.startTime) && t < toMinutes(branchDayHours.endTime);
}

export function fmt(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export interface NormalizedBranchService {
  clinicServiceId: number;
  cost: number;
  name?: string;
}

// Shared by normalizeBranchServices and normalizeAppointmentServices — the backend is
// inconsistent about whether a service-like object's id comes back as `clinicServiceId`,
// `serviceId`, nested under `clinicService`/`service`, or plain `id` (see the branch
// comment below), and this same ambiguity turned out to affect an appointment's own
// `services[]` too. Returns null for anything that isn't a valid positive integer id —
// Number(x) on a non-numeric value is NaN, and a plain "<= 0" check alone lets that
// through as NaN, which then JSON-serializes to `null` and gets rejected server-side as
// "not a positive integer" with no indication of which service caused it.
function extractServiceRow(raw: unknown): NormalizedBranchService | null {
  const s = raw as Record<string, unknown>;
  const nestedClinicService = s.clinicService as Record<string, unknown> | undefined;
  const nestedService = s.service as Record<string, unknown> | undefined;
  const id = s.clinicServiceId ?? s.serviceId ?? nestedClinicService?.id ?? nestedService?.id ?? s.id;
  const numericId = Number(id as number | string);
  if (id == null || !Number.isFinite(numericId) || numericId <= 0) return null;
  const name = (s.name ?? nestedClinicService?.name ?? nestedService?.name ?? undefined) as string | undefined;
  return {
    clinicServiceId: numericId,
    cost: s.cost != null ? Number(s.cost as number | string) : 0,
    name,
  };
}

// The branch-detail GET returns `services` as full ClinicService-like objects
// ({ id, name, cost, ... }) — `id` IS the clinic service id here, not `clinicServiceId`
// (that field name only applies to the create/update payload shape). Same normalization
// BranchForm.tsx already has to apply for the same reason.
export function normalizeBranchServices(rawServices?: ClinicBranch['services']): NormalizedBranchService[] {
  if (!Array.isArray(rawServices) || rawServices.length === 0) return [];
  return (rawServices as unknown[])
    .map(extractServiceRow)
    .filter((row): row is NormalizedBranchService => row !== null);
}

// An appointment's own embedded `services[]` is typed as { clinicServiceId, name?, cost }
// but hits the exact same field-naming ambiguity live — run it through the same
// extraction rather than trusting `clinicServiceId` directly, so a pre-existing selection
// reliably matches the branch catalog's (also-normalized) ids in the edit UI instead of
// silently failing to pre-check, and so a malformed id never reaches the update payload.
export function normalizeAppointmentServices(rawServices: unknown[]): NormalizedBranchService[] {
  if (!Array.isArray(rawServices) || rawServices.length === 0) return [];
  return rawServices
    .map(extractServiceRow)
    .filter((row): row is NormalizedBranchService => row !== null);
}
