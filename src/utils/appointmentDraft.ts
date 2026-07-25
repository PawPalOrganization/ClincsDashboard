import type { PetSummary } from '../types/clinic.types';

export interface AppointmentDraft {
  savedAt: number; // Date.now()
  step: 1 | 2 | 3 | 4;
  selectedBranch: string;
  selectedDate: string;
  selectedDoctor: string;
  selectedSlot: string;
  manualTimes: Record<string, string>;
  lookupMethod: 'code' | 'phone';
  lookupValue: string;
  consentPhase: 'idle' | 'searching' | 'not_found' | 'none' | 'pending' | 'approved';
  pendingUserId: number | null;
  foundIdentifier: { type: 'userHash' | 'phoneNumber'; value: string } | null;
  approvedUser: {
    userId: number;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    pets: PetSummary[];
  } | null;
  selectedPetId: number | null;
  selectedServiceIds: number[]; // Set serialized to array
  notes: string;
}

const DRAFT_EXPIRY_MS = 30 * 60 * 1000;

function draftKey(clinicId: string, staffId: string | number): string {
  return `pawclinics:appointmentDraft:${clinicId}:${staffId}`;
}

/** Reads a saved draft for this clinic+staff, discarding (and clearing) it if stale or corrupted. */
export function readAppointmentDraft(clinicId: string, staffId: string | number): AppointmentDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(clinicId, staffId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as AppointmentDraft;
    if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
      sessionStorage.removeItem(draftKey(clinicId, staffId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function writeAppointmentDraft(clinicId: string, staffId: string | number, draft: AppointmentDraft): void {
  try {
    sessionStorage.setItem(draftKey(clinicId, staffId), JSON.stringify(draft));
  } catch {
    // sessionStorage full/unavailable (private browsing, etc.) — draft persistence
    // degrades gracefully to today's behavior, not a hard failure.
  }
}

export function clearAppointmentDraft(clinicId: string, staffId: string | number): void {
  sessionStorage.removeItem(draftKey(clinicId, staffId));
}

/** Nothing worth saving/resuming — an untouched, still-blank step 1. */
export function isDraftEmpty(
  draft: Pick<AppointmentDraft, 'step' | 'selectedBranch' | 'selectedDate' | 'lookupValue'>,
): boolean {
  return draft.step === 1 && !draft.selectedBranch && !draft.selectedDate && !draft.lookupValue;
}
