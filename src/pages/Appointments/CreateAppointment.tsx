import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { useClinicPusher } from '../../hooks/useClinicPusher';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicCatalogService from '../../services/clinic/clinicCatalogService';
import clinicClientsService from '../../services/clinic/clinicClientsService';
import clinicPetTypesService from '../../services/clinic/clinicPetTypesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import clinicUserSearchService from '../../services/clinic/clinicUserSearchService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import { honorificFor, isDoctorStaff } from '../../utils/staffRoles';
import {
  fmt,
  getBranchHoursForDate,
  getSlotsForDate,
  isTimeWithinBranchHours,
  normalizeBranchServices,
} from '../../utils/appointmentSlots';
import {
  clearAppointmentDraft,
  isDraftEmpty,
  readAppointmentDraft,
  writeAppointmentDraft,
} from '../../utils/appointmentDraft';
import type { AppointmentDraft } from '../../utils/appointmentDraft';
import type {
  ClinicBranch,
  ClinicService,
  ClinicStaff,
  PetSummary,
  PetType,
} from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import Modal from '../../components/common/Modal/Modal';
import styles from './Appointments.module.scss';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isDoctor = isDoctorStaff;

// Egyptian mobile local part is always 10 digits after the country code (e.g.
// "1012345678" in +201012345678 / 01012345678) — take the last 10 digits regardless
// of which prefix format the source string used. Also used as the phone input's
// onChange filter, so pasted text in any format reduces to the right digits.
function egyptLocalDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

const TODAY = new Date().toISOString().split('T')[0];

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Branch & Date', 'Doctor & Time', 'Patient', 'Services'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateAppointment() {
  const { clinicId, staff: authStaff, token, branchId: authBranchId } = useClinicAuth();
  const navigate = useNavigate();
  const canCreate = hasClinicPermission(authStaff, 'appointments.create');
  // Both permissions are required — a new client isn't bookable without a pet, so
  // there's no point exposing the entry point with only one of the two.
  const canCreateClient =
    hasClinicPermission(authStaff, 'users.create') && hasClinicPermission(authStaff, 'pets.create');

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  // Step 1
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  // Which half of the branch roster step 2 offers — doctors/vets, or everyone else
  // (groomers and any other non-clinical role). Kept as an explicit choice rather than
  // one merged list so "Dr." labeling downstream stays correct for whichever half is shown.
  const [bookingType, setBookingType] = useState<'doctor' | 'other'>('doctor');

  // Step 2
  const [selectedBranchDetail, setSelectedBranchDetail] = useState<ClinicBranch | null>(null);
  // Full, unfiltered branch roster — `doctors` (below) derives the half bookingType asks for.
  const [staffPool, setStaffPool] = useState<ClinicStaff[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [manualTimes, setManualTimes] = useState<Record<string, string>>({});

  // Step 3 — consent-aware patient lookup
  type ConsentPhase = 'idle' | 'searching' | 'not_found' | 'none' | 'pending' | 'approved';
  type LookupMethod = 'code' | 'phone';
  const [lookupMethod, setLookupMethod] = useState<LookupMethod>('code');
  const [lookupValue, setLookupValue] = useState('');
  const [lookupFormatError, setLookupFormatError] = useState('');
  const [consentPhase, setConsentPhase] = useState<ConsentPhase>('idle');
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  // The identifier that successfully found the user — share-request needs this, not userId.
  const [foundIdentifier, setFoundIdentifier] = useState<
    { type: 'userHash' | 'phoneNumber'; value: string } | null
  >(null);
  const [approvedUser, setApprovedUser] = useState<{
    userId: number; firstName: string; lastName: string; phoneNumber: string; pets: PetSummary[];
  } | null>(null);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [shareRequestError, setShareRequestError] = useState('');
  const [shareRequestLoading, setShareRequestLoading] = useState(false);
  const [additionalPetShareLoading, setAdditionalPetShareLoading] = useState(false);
  const [additionalPetShareMessage, setAdditionalPetShareMessage] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 — "New client" onboarding (unclaimed user, walk-ins not yet on the app).
  // Resolves into the same approvedUser/selectedPetId/consentPhase state the
  // search-and-consent path above produces, so nothing downstream needs to know
  // this patient came from here instead of a lookup.
  type NewClientPhase = 'idle' | 'user_form' | 'pet_step' | 'pet_form';
  const [newClientPhase, setNewClientPhase] = useState<NewClientPhase>('idle');
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [newClientError, setNewClientError] = useState('');
  const [newClientFieldErrors, setNewClientFieldErrors] = useState<{ email?: string }>({});
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPetName, setNewPetName] = useState('');
  const [newPetTypeId, setNewPetTypeId] = useState('');
  const [newClientUserId, setNewClientUserId] = useState<number | null>(null);
  // Pre-existing pets on file if the phone number matched an already-created
  // unclaimed record (e.g. a returning off-app client from a prior walk-in visit).
  const [newClientPets, setNewClientPets] = useState<PetSummary[]>([]);
  const [petTypes, setPetTypes] = useState<PetType[]>([]);
  const [petTypesLoading, setPetTypesLoading] = useState(false);
  const [petTypesError, setPetTypesError] = useState('');

  const USER_HASH_RE = /^[a-z]+-[a-z]+-[a-z0-9]{4}$/;

  // Step 4
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [catalog, setCatalog] = useState<ClinicService[]>([]);

  // ── Resumable draft ────────────────────────────────────────────────────────
  const [pendingDraft, setPendingDraft] = useState<AppointmentDraft | null>(null);
  // Computed once, when the draft is detected (not at render time — `Date.now()` is
  // an impure call and isn't allowed in the render path) rather than a live-ticking
  // clock; an approximate "N min ago" at detection time is all the banner needs.
  const [pendingDraftMinutesAgo, setPendingDraftMinutesAgo] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  // A ref, not state: the three reset-guard effects below need to read whether a
  // restore is in progress WITHOUT re-running every time that flag itself changes —
  // if it were state in their dependency arrays, flipping it back off after the
  // restore would re-trigger those same effects with the guard now open, wiping the
  // very selection they were just told to preserve (this was FE_02 — a resumed
  // doctor/time/manual-time selection getting silently cleared right after resume).
  const isRestoringDraftRef = useRef(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Lookup map: clinicServiceId → name from catalog
  const catalogMap = new Map(catalog.map((s) => [Number(s.id), s.name]));

  // Services to show in step 4 — must be services actually assigned to this branch
  // (Branch settings → Services). The backend rejects clinicServiceIds not configured
  // for the branch, so we must NOT fall back to the full platform catalog here.
  const validServices = normalizeBranchServices(selectedBranchDetail?.services);

  const doctors = staffPool.filter((s) => (bookingType === 'doctor' ? isDoctor(s) : !isDoctor(s)));
  const doctorObj = doctors.find((d) => String(d.id) === selectedDoctor);
  const finalTime = selectedSlot || manualTimes[selectedDoctor] || '';

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100)
      .then((r) => setBranches(r.items))
      .catch(() => {});
    clinicCatalogService.list(clinicId, { limit: 100, scope: 'all' })
      .then((r) => setCatalog(r.items))
      .catch(() => {});
  }, [clinicId]);

  // Fetch doctors + full branch detail (with services/costs) when branch changes.
  // Resets doctor/slot/service selections tied to the previous branch — kept as a
  // single effect (not split into a render-time adjustment) since the reset and the
  // fetch it guards must stay atomic for booking correctness, and this path has no
  // test coverage to safety-net a restructure. The reset is skipped while a saved
  // draft is being restored (isRestoringDraftRef) — otherwise this effect would wipe
  // the very doctor/slot/service selections the draft just set, since restoring
  // `selectedBranch` from '' is a real dependency change like any other. The
  // fetches still run either way — a fresh doctors list/branch detail is needed
  // regardless of how selectedBranch was set.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedBranch || !clinicId) { setStaffPool([]); setSelectedBranchDetail(null); return; }
    setLoadingDoctors(true);
    if (!isRestoringDraftRef.current) {
      setSelectedDoctor(''); setSelectedSlot(''); setManualTimes({});
      setSelectedServiceIds(new Set());
    }
    clinicBranchesService.getOne(clinicId, selectedBranch)
      .then((b) => setSelectedBranchDetail(b))
      .catch(() => setSelectedBranchDetail(null));
    clinicStaffService.list({ page: 1, limit: 100, clinicBranchId: selectedBranch })
      .then((r) => setStaffPool(r.items))
      .catch(() => {})
      .finally(() => setLoadingDoctors(false));
  }, [selectedBranch, clinicId]);

  // Switching between "Doctor / Vet" and "Other Staff" swaps which half of staffPool
  // step 2 shows — clear any selection made under the other half so a stale, now-hidden
  // staff id can't linger into submission. Skipped while restoring a draft, same reason
  // as the branch-change effect above: handleResumeDraft sets bookingType and
  // selectedDoctor together, and this effect would otherwise wipe the restored selection.
  useEffect(() => {
    if (isRestoringDraftRef.current) return;
    setSelectedDoctor(''); setSelectedSlot(''); setManualTimes({});
  }, [bookingType]);

  // Reset doctor/slot when date changes — also skipped while restoring a draft, for
  // the same reason as the branch effect above.
  useEffect(() => {
    if (isRestoringDraftRef.current) return;
    setSelectedDoctor(''); setSelectedSlot(''); setManualTimes({});
  }, [selectedDate]);

  // Clears the restore flag once the three guarded effects above have run for this
  // commit and had a chance to read it as true — runs after every commit (no
  // dependency array) rather than being keyed off the flag's own value, precisely so
  // that clearing it does NOT itself count as a dependency change that re-triggers
  // those effects (a ref mutation triggers nothing on its own; this effect is what
  // would, if it were state-driven, which is exactly the bug this replaced).
  useEffect(() => {
    isRestoringDraftRef.current = false;
  });

  // Look for a resumable draft once, on mount — surfaced via the resume banner
  // rather than applied automatically (see handleResumeDraft), so a different staff
  // member opening this page on a shared terminal isn't silently dropped into
  // someone else's half-filled booking.
  useEffect(() => {
    if (!clinicId || !authStaff) return;
    const draft = readAppointmentDraft(clinicId, authStaff.id);
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingDraft(draft);
      setPendingDraftMinutesAgo(Math.max(1, Math.round((Date.now() - draft.savedAt) / 60000)));
    } else {
      setDraftReady(true);
    }
  }, [clinicId, authStaff]);

  // Auto-save the in-progress booking so it survives navigating away and back —
  // only once the resume/start-over decision from the effect above is resolved,
  // so this can't stomp an unresumed draft with blank initial state first.
  useEffect(() => {
    if (!draftReady || !clinicId || !authStaff) return;
    const draft: AppointmentDraft = {
      savedAt: Date.now(),
      step, selectedBranch, selectedDate, bookingType, selectedDoctor, selectedSlot, manualTimes,
      lookupMethod, lookupValue, consentPhase, pendingUserId, foundIdentifier,
      approvedUser, selectedPetId,
      selectedServiceIds: Array.from(selectedServiceIds), notes,
    };
    if (isDraftEmpty(draft)) { clearAppointmentDraft(clinicId, authStaff.id); return; }
    writeAppointmentDraft(clinicId, authStaff.id, draft);
  }, [
    draftReady, clinicId, authStaff, step, selectedBranch, selectedDate, bookingType, selectedDoctor,
    selectedSlot, manualTimes, lookupMethod, lookupValue, consentPhase,
    pendingUserId, foundIdentifier, approvedUser, selectedPetId,
    selectedServiceIds, notes,
  ]);

  // Poll every 3 s while waiting for owner to approve a data-share request.
  // Fallback for staff without a live Pusher connection — see useClinicPusher subscription below,
  // which resolves this instantly when it's available.
  useEffect(() => {
    if (consentPhase !== 'pending' || !pendingUserId || !clinicId) return;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await clinicUserSearchService.lookup({ clinicId, userId: pendingUserId });
        if (res.found && res.consentStatus === 'approved') {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setConsentPhase('approved');
          setApprovedUser(res);
          setSelectedPetId(null);
        }
      } catch {
        // silent — keep polling
      }
    }, 3000);
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [consentPhase, pendingUserId, clinicId]);

  // Live update — short-circuits the 3s poll the instant the owner approves/denies via Pusher.
  useClinicPusher({
    token,
    staff: authStaff,
    branchId: authBranchId,
    onNotification: () => {},
    onDataShareApproved: (event) => {
      if (event.userId !== pendingUserId) return;
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      setConsentPhase('approved');
      setApprovedUser(event);
      setSelectedPetId(null);
    },
    onDataShareDenied: (event) => {
      if (event.userId !== pendingUserId) return;
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      setConsentPhase('none');
      setShareRequestError('The owner declined the sharing request. You can send another request.');
    },
  });

  // Lazily load the pet-type dropdown options the first time the "add pet" form
  // for a new client is opened — no need to fetch this on every page load.
  useEffect(() => {
    if (newClientPhase !== 'pet_form' || petTypes.length > 0 || petTypesLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-demand pattern, same as the branch/doctors effect above
    setPetTypesLoading(true);
    setPetTypesError('');
    clinicPetTypesService.listPetTypes()
      .then(setPetTypes)
      .catch(() => setPetTypesError('Failed to load pet types. Check your connection and try again.'))
      .finally(() => setPetTypesLoading(false));
  }, [newClientPhase, petTypes.length, petTypesLoading]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  function pickSlot(doctorId: string, slot: string) {
    setSelectedDoctor(doctorId);
    setSelectedSlot(slot);
    setManualTimes((p) => { const n = { ...p }; delete n[doctorId]; return n; });
  }

  function setManualTime(doctorId: string, time: string) {
    setSelectedDoctor(doctorId);
    setSelectedSlot('');
    setManualTimes((p) => ({ ...p, [doctorId]: time }));
  }

  async function handleLookup() {
    if (!clinicId || !lookupValue.trim()) return;
    const value = lookupMethod === 'code' ? lookupValue.trim().toLowerCase() : lookupValue.trim();

    if (lookupMethod === 'code' && !USER_HASH_RE.test(value)) {
      setLookupFormatError('Invalid code format. Expected something like "firstname-lastname-1234".');
      return;
    }
    setLookupFormatError('');
    setConsentPhase('searching');
    setShareRequestError('');
    setApprovedUser(null);
    setSelectedPetId(null);
    setPendingUserId(null);
    setFoundIdentifier(null);
    try {
      const res = await clinicUserSearchService.lookup({
        clinicId,
        userHash: lookupMethod === 'code' ? value : undefined,
        phoneNumber: lookupMethod === 'phone' ? value : undefined,
      });
      if (!res.found) {
        // Surface the "no account found" message and let staff choose what to do
        // next (retry, or register them as a new walk-in client) rather than guessing.
        setConsentPhase('not_found');
      } else {
        setPendingUserId(res.userId);
        setFoundIdentifier({ type: lookupMethod === 'code' ? 'userHash' : 'phoneNumber', value });
        if (res.consentStatus === 'approved') {
          setConsentPhase('approved');
          setApprovedUser(res);
        } else if (res.consentStatus === 'pending') {
          setConsentPhase('pending');
        } else {
          setConsentPhase('none');
        }
      }
    } catch (err) {
      setConsentPhase('idle');
      const status = (err as { status?: number }).status;
      if (status === 400) {
        setShareRequestError('Invalid lookup format. Double-check the code or phone number.');
      } else if (status === 403) {
        setShareRequestError('Your role does not have permission to search patients. Contact your clinic administrator.');
      } else if (status === 500) {
        setShareRequestError('Server error (500) — the backend may need a database migration. Contact your backend team.');
      } else {
        setShareRequestError('Lookup failed. Please try again.');
      }
    }
  }

  async function handleRequestShare() {
    if (!clinicId || !foundIdentifier) return;
    setShareRequestLoading(true);
    setShareRequestError('');
    try {
      const res = await clinicUserSearchService.requestShare({
        clinicId,
        userHash: foundIdentifier.type === 'userHash' ? foundIdentifier.value : undefined,
        phoneNumber: foundIdentifier.type === 'phoneNumber' ? foundIdentifier.value : undefined,
      });
      // The owner may have already approved this clinic between page load and this
      // click (stale FE state) — the backend reports that directly via consentStatus
      // now instead of 409ing, so re-fetch the full profile in that case rather than
      // showing a "pending" state that will never resolve.
      if (res.consentStatus === 'approved' && pendingUserId) {
        const profile = await clinicUserSearchService.lookup({ clinicId, userId: pendingUserId });
        if (profile.found && profile.consentStatus === 'approved') {
          setConsentPhase('approved');
          setApprovedUser(profile);
          setSelectedPetId(null);
        } else {
          setConsentPhase('pending');
        }
      } else {
        setConsentPhase('pending');
      }
    } catch (err) {
      setShareRequestError(err instanceof Error ? err.message : 'Failed to send request.');
    } finally {
      setShareRequestLoading(false);
    }
  }

  // Asks the owner to expand an already-approved share to cover a pet not currently
  // in `approvedUser.pets`. A repeat call to /users/share-request once consent is
  // already approved now returns 200 and notifies the owner to share an additional pet
  // (throttled server-side) instead of 409ing.
  async function handleRequestAdditionalPetShare() {
    if (!clinicId || !foundIdentifier) return;
    setAdditionalPetShareLoading(true);
    setAdditionalPetShareMessage('');
    try {
      await clinicUserSearchService.requestShare({
        clinicId,
        userHash: foundIdentifier.type === 'userHash' ? foundIdentifier.value : undefined,
        phoneNumber: foundIdentifier.type === 'phoneNumber' ? foundIdentifier.value : undefined,
      });
      setAdditionalPetShareMessage('The owner has been notified to share an additional pet from their PawPal app.');
    } catch (err) {
      setAdditionalPetShareMessage(err instanceof Error ? err.message : 'Failed to send request.');
    } finally {
      setAdditionalPetShareLoading(false);
    }
  }

  function resetConsentState() {
    setConsentPhase('idle');
    setLookupValue('');
    setLookupFormatError('');
    setPendingUserId(null);
    setFoundIdentifier(null);
    setApprovedUser(null);
    setSelectedPetId(null);
    setShareRequestError('');
    setAdditionalPetShareMessage('');
    resetNewClientFields();
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  function resetNewClientFields() {
    setNewClientPhase('idle');
    setNewClientSaving(false);
    setNewClientError('');
    setNewClientFieldErrors({});
    setNewFirstName('');
    setNewLastName('');
    setNewPhoneNumber('');
    setNewEmail('');
    setNewPetName('');
    setNewPetTypeId('');
    setNewClientUserId(null);
    setNewClientPets([]);
  }

  async function handleCreateClientUser() {
    if (!clinicId) return;
    if (!newFirstName.trim() || !newLastName.trim() || newPhoneNumber.length !== 10) {
      setNewClientError('First name, last name, and a full 10-digit phone number are required.');
      return;
    }
    setNewClientSaving(true);
    setNewClientError('');
    setNewClientFieldErrors({});
    try {
      const user = await clinicClientsService.createUser(clinicId, {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phoneNumber: `0${newPhoneNumber}`,
        email: newEmail.trim() || undefined,
      });
      setNewClientUserId(user.id);
      // The phone may have matched an already-created unclaimed record (backend
      // reuses it rather than erroring) — re-check via the existing lookup to pick
      // up any pets already on file from a prior walk-in visit.
      try {
        const profile = await clinicUserSearchService.lookup({ clinicId, userId: user.id });
        setNewClientPets(profile.found && profile.consentStatus === 'approved' ? profile.pets : []);
      } catch {
        setNewClientPets([]);
      }
      setNewClientPhase('pet_step');
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : 'Failed to create client.';
      if (status === 409 && /claimed/i.test(message)) {
        setNewClientError('This phone number belongs to a registered app user. Use Lookup by Code or Phone instead.');
      } else if (status === 409 && /email/i.test(message)) {
        setNewClientFieldErrors({ email: 'This email is already in use by another account.' });
      } else {
        setNewClientError(message);
      }
    } finally {
      setNewClientSaving(false);
    }
  }

  // Finalizes either an existing pet (picked from newClientPets) or a freshly
  // created one into the same approvedUser/selectedPetId/consentPhase state the
  // search-and-consent path produces — everything downstream (validation, submit
  // payload, step-4 summary, draft persistence) treats this identically.
  function finalizeNewClient(pet: PetSummary) {
    setApprovedUser({
      userId: newClientUserId!,
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      phoneNumber: `0${newPhoneNumber}`,
      pets: newClientPets.some((p) => p.id === pet.id) ? newClientPets : [...newClientPets, pet],
    });
    setSelectedPetId(pet.id);
    setConsentPhase('approved');
    resetNewClientFields();
  }

  async function handleCreateClientPet() {
    if (!clinicId || newClientUserId == null) return;
    if (!newPetName.trim() || !newPetTypeId) {
      setNewClientError('Pet name and type are required.');
      return;
    }
    setNewClientSaving(true);
    setNewClientError('');
    try {
      const pet = await clinicClientsService.createPet(clinicId, newClientUserId, {
        name: newPetName.trim(),
        petTypeId: Number(newPetTypeId),
      });
      finalizeNewClient(pet);
    } catch (err) {
      setNewClientError(err instanceof Error ? err.message : 'Failed to create pet.');
    } finally {
      setNewClientSaving(false);
    }
  }

  function petCard(pet: PetSummary, selected: boolean, onClick: () => void) {
    return (
      <button
        key={pet.id}
        type="button"
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.65rem 0.875rem',
          border: selected ? '2px solid var(--color-primary, #0d9aff)' : '1.5px solid #e4e7ec',
          borderRadius: '0.625rem',
          background: selected ? 'rgba(13,154,255,0.05)' : '#fff',
          cursor: 'pointer', textAlign: 'left', width: '100%',
          transition: 'border-color 0.12s, background 0.12s',
          boxShadow: selected ? '0 0 0 3px rgba(13,154,255,0.1)' : 'none',
        }}
      >
        {pet.imageUrl ? (
          <img src={pet.imageUrl} alt={pet.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(13,154,255,0.1)', color: 'var(--color-primary, #0d9aff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
            <i className="bi bi-heart-fill" />
          </div>
        )}
        <span style={{ fontSize: '0.875rem', fontWeight: selected ? 600 : 500, color: selected ? 'var(--color-primary, #0d9aff)' : '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {pet.name}
        </span>
        {selected && <i className="bi bi-check-circle-fill" style={{ color: 'var(--color-primary, #0d9aff)', flexShrink: 0, fontSize: '0.875rem' }} />}
      </button>
    );
  }

  function handleResumeDraft() {
    if (!pendingDraft || !clinicId) return;
    isRestoringDraftRef.current = true;
    setStep(pendingDraft.step);
    setSelectedBranch(pendingDraft.selectedBranch);
    setSelectedDate(pendingDraft.selectedDate);
    // Drafts saved before the doctor/other-staff toggle existed have no bookingType —
    // default those to 'doctor' so they resume into the same behavior they were saved with.
    setBookingType(pendingDraft.bookingType ?? 'doctor');
    setSelectedDoctor(pendingDraft.selectedDoctor);
    setSelectedSlot(pendingDraft.selectedSlot);
    setManualTimes(pendingDraft.manualTimes);
    setLookupMethod(pendingDraft.lookupMethod);
    setLookupValue(pendingDraft.lookupValue);
    setSelectedServiceIds(new Set(pendingDraft.selectedServiceIds));
    setNotes(pendingDraft.notes);
    setPendingUserId(pendingDraft.pendingUserId);
    setFoundIdentifier(pendingDraft.foundIdentifier);
    setConsentPhase(pendingDraft.consentPhase);
    setApprovedUser(pendingDraft.approvedUser);
    setSelectedPetId(pendingDraft.selectedPetId);

    // Re-validate rather than trust stale consent — it may have been revoked, or the
    // pet list changed, since the draft was saved.
    if (
      pendingDraft.pendingUserId &&
      (pendingDraft.consentPhase === 'approved' || pendingDraft.consentPhase === 'pending')
    ) {
      clinicUserSearchService.lookup({ clinicId, userId: pendingDraft.pendingUserId })
        .then((res) => {
          if (res.found && res.consentStatus === 'approved') {
            setApprovedUser(res);
            setConsentPhase('approved');
            if (!res.pets?.some((p) => p.id === pendingDraft.selectedPetId)) setSelectedPetId(null);
          } else if (res.found && res.consentStatus === 'pending') {
            setConsentPhase('pending');
          } else {
            setConsentPhase('none');
            setApprovedUser(null);
            setSelectedPetId(null);
            setShareRequestError('This patient’s consent status changed since you started this booking — please check again.');
          }
        })
        .catch(() => {}); // keep the optimistically-restored state if the re-check itself fails
    }

    setPendingDraft(null);
    setDraftReady(true);
  }

  function handleDiscardDraft() {
    if (clinicId && authStaff) clearAppointmentDraft(clinicId, authStaff.id);
    setPendingDraft(null);
    setDraftReady(true);
  }

  function toggleService(id: number) {
    setSelectedServiceIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  // Patient/pet requirement from step 3 — re-checked at step 4 too, since consent can
  // flip (and selectedPetId reset to null) via Pusher/poll while the staff member has
  // already moved on to the services step.
  function isPatientStepValid(): boolean {
    return consentPhase === 'approved' && !!approvedUser && selectedPetId !== null;
  }

  function canAdvance(): boolean {
    if (step === 1) return !!selectedBranch && !!selectedDate;
    if (step === 2) {
      if (!selectedDoctor || !finalTime) return false;
      // Generated slot buttons are already clamped to branch hours by construction —
      // only a manually-entered time (no slot selected) needs this extra check.
      if (!selectedSlot) {
        const branchDayHours = getBranchHoursForDate(selectedBranchDetail?.workingHours, selectedDate);
        return isTimeWithinBranchHours(finalTime, branchDayHours);
      }
      return true;
    }
    if (step === 3) return isPatientStepValid();
    if (step === 4) return isPatientStepValid() && validServices.length > 0 && selectedServiceIds.size > 0;
    return false;
  }

  async function handleSubmit() {
    if (!finalTime) return;
    // Re-check alongside the patient/consent re-check below — branch hours can't
    // change mid-booking the way consent can, but this keeps the same "don't trust
    // step-2 state blindly by the time we're on step 4" posture as isPatientStepValid.
    if (!selectedSlot) {
      const branchDayHours = getBranchHoursForDate(selectedBranchDetail?.workingHours, selectedDate);
      if (!isTimeWithinBranchHours(finalTime, branchDayHours)) {
        setServerError('This time is outside the branch\'s working hours. Go back to the Doctor & Time step and pick a valid time.');
        return;
      }
    }
    const serviceIds = Array.from(selectedServiceIds).filter((id) => Number.isInteger(id) && id > 0);
    if (!serviceIds.length) { setServerError('Select at least one service.'); return; }
    if (!isPatientStepValid()) {
      setServerError('Select a pet for this patient before booking — consent status may have changed, go back to the Patient step.');
      return;
    }
    setSaving(true);
    setServerError('');
    try {
      const appt = await clinicAppointmentService.create({
        clinicBranchId: Number(selectedBranch),
        clinicStaffId: Number(selectedDoctor),
        clinicServiceIds: serviceIds,
        userId: approvedUser?.userId,
        petId: selectedPetId ?? undefined,
        scheduledAt: new Date(`${selectedDate}T${finalTime}:00`).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes.trim() || undefined,
      });
      if (clinicId && authStaff) clearAppointmentDraft(clinicId, authStaff.id);
      navigate(`/appointments/${appt.id}`, { state: { successMsg: 'Appointment booked.' } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create appointment.');
      setSaving(false);
    }
  }

  // ─── Guards ─────────────────────────────────────────────────────────────────

  if (!clinicId) return (
    <div className={styles.noClinic}>
      <i className="bi bi-exclamation-circle" />
      <p>No clinic is assigned to your account.</p>
    </div>
  );

  if (!canCreate) return (
    <div className={styles.accessDenied}>
      <i className="bi bi-shield-lock" />
      <h2>Access restricted</h2>
      <p>Your role does not include permission to create appointments.</p>
      <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/appointments')}>Back</Button>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {saving && <PawLoader size="large" overlay />}
      <div className={styles.page}>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>New Appointment</h1>
            <p className={styles.pageSubtitle}>Book an appointment in {STEP_LABELS.length} steps.</p>
          </div>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => {
              if (isDraftEmpty({ step, selectedBranch, selectedDate, lookupValue })) {
                navigate('/appointments');
              } else {
                setShowDiscardConfirm(true);
              }
            }}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>

        {pendingDraft && (
          <div
            className={`alert alert-info py-2 ${styles.feedbackAlert}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}
          >
            <span>
              <i className="bi bi-info-circle" /> You have an appointment in progress from{' '}
              {pendingDraftMinutesAgo} min ago
              {' '}(Step {pendingDraft.step}: {STEP_LABELS[pendingDraft.step - 1]}).
            </span>
            <span style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <Button variant="outline" size="small" onClick={handleDiscardDraft}>Start Over</Button>
              <Button variant="primary" size="small" onClick={handleResumeDraft}>Resume</Button>
            </span>
          </div>
        )}

        {/* Stepper */}
        <div className={styles.stepper}>
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            return (
              <div key={n} className={`${styles.step} ${n === step ? styles.stepActive : ''} ${n < step ? styles.stepDone : ''}`}>
                <span className={styles.stepNumber}>{n < step ? <i className="bi bi-check" /> : n}</span>
                <span className={styles.stepLabel}>{label}</span>
              </div>
            );
          })}
        </div>
        {/* Mobile-only: shows active step name below the bubble track */}
        <div className={styles.stepperMobileLabel}>
          Step {step} of {STEP_LABELS.length} &mdash; <strong>{STEP_LABELS[step - 1]}</strong>
        </div>

        {serverError && (
          <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
            <i className="bi bi-exclamation-circle-fill" /> {serverError}
          </div>
        )}

        {/* ── Step 1 — Branch & Date ── */}
        {step === 1 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>When and where?</p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label className={styles.fieldLabel}>Branch <span style={{ color: '#e74c3c' }}>*</span></label>
                <select
                  className={styles.filterSelect}
                  style={{ width: '100%' }}
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="">Choose branch…</option>
                  {branches.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Date <span style={{ color: '#e74c3c' }}>*</span></label>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={selectedDate}
                  min={TODAY}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div>
                <label className={styles.fieldLabel}>What kind of appointment?</label>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button
                    type="button"
                    className={`${styles.slotBtn} ${bookingType === 'doctor' ? styles.slotBtnSelected : ''}`}
                    onClick={() => setBookingType('doctor')}
                  >
                    Doctor / Vet Visit
                  </button>
                  <button
                    type="button"
                    className={`${styles.slotBtn} ${bookingType === 'other' ? styles.slotBtnSelected : ''}`}
                    onClick={() => setBookingType('other')}
                  >
                    Other Service (Groomer, etc.)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 — Doctor & Time Slot ── */}
        {step === 2 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>
              {bookingType === 'doctor' ? 'Available doctors' : 'Available staff'} —{' '}
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>

            {loadingDoctors && (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                <i className="bi bi-hourglass-split" /> {bookingType === 'doctor' ? 'Loading doctors…' : 'Loading staff…'}
              </p>
            )}

            {!loadingDoctors && doctors.length === 0 && (
              <div className="alert alert-info py-2" style={{ fontSize: '0.875rem' }}>
                <i className="bi bi-info-circle" />{' '}
                {bookingType === 'doctor'
                  ? 'No doctors found for this branch.'
                  : 'No other staff found for this branch.'}
              </div>
            )}

            {!loadingDoctors && doctors.length > 0 && (
              <div className={styles.doctorGrid}>
                {(() => {
                  const branchDayHours = getBranchHoursForDate(selectedBranchDetail?.workingHours, selectedDate);
                  return doctors.map((doc) => {
                  const slots = getSlotsForDate(doc, selectedDate, selectedBranchDetail?.workingHours);
                  const isSelected = selectedDoctor === String(doc.id);
                  const isOff = slots !== null && slots.length === 0;
                  const manualTime = manualTimes[String(doc.id)] ?? '';
                  const manualTimeInvalid = !!manualTime && !isTimeWithinBranchHours(manualTime, branchDayHours);

                  return (
                    <div
                      key={String(doc.id)}
                      className={[
                        styles.doctorCard,
                        isSelected ? styles.doctorCardSelected : '',
                        isOff ? styles.doctorCardOff : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {/* Header row */}
                      <div className={styles.doctorCardHeader}>
                        <div className={styles.doctorAvatar}>
                          {doc.imageUrl
                            ? <img src={doc.imageUrl} alt="" className={styles.doctorAvatarPhoto} />
                            : <>{doc.firstName[0]}{doc.lastName[0]}</>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className={styles.doctorName}>{honorificFor(doc)}{doc.firstName} {doc.lastName}</div>
                          {doc.role && <div className={styles.doctorRole}>{doc.role.name}</div>}
                        </div>
                        {isSelected && finalTime && (
                          <div className={styles.doctorSelectedBadge}>
                            <i className="bi bi-check-circle-fill" /> {fmt(finalTime)}
                          </div>
                        )}
                      </div>

                      {/* Slots from working hours */}
                      {slots !== null && slots.length > 0 && (
                        <div className={styles.slotGrid}>
                          {slots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              className={`${styles.slotBtn} ${isSelected && selectedSlot === slot ? styles.slotBtnSelected : ''}`}
                              onClick={() => pickSlot(String(doc.id), slot)}
                            >
                              {fmt(slot)}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Off today */}
                      {isOff && (
                        <p className={styles.doctorOffLabel}>
                          <i className="bi bi-calendar-x" /> Not working on this day
                        </p>
                      )}

                      {/* No schedule data — manual fallback */}
                      {slots === null && (
                        branchDayHours === 'closed' ? (
                          <p className={styles.doctorOffLabel}>
                            <i className="bi bi-calendar-x" /> Branch is closed this day — no time can be booked.
                          </p>
                        ) : (
                          <div className={styles.manualTimeWrap}>
                            <span className={styles.manualTimeLabel}>
                              <i className="bi bi-clock" />
                              {branchDayHours
                                ? ` Enter a time within branch hours (${fmt(branchDayHours.startTime)}–${fmt(branchDayHours.endTime)})`
                                : ' No schedule set — enter time manually'}
                            </span>
                            <input
                              type="time"
                              className={styles.timeInput}
                              value={manualTime}
                              min={branchDayHours ? branchDayHours.startTime : undefined}
                              max={branchDayHours ? branchDayHours.endTime : undefined}
                              onChange={(e) => setManualTime(String(doc.id), e.target.value)}
                            />
                            {manualTimeInvalid && (
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#e74c3c', width: '100%' }}>
                                <i className="bi bi-exclamation-circle" /> Outside branch hours — this time can't be booked.
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3 — Patient ── */}
        {step === 3 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Who is this appointment for?</p>

            {/* ── Registered user — consent-aware lookup by code or phone ── */}
            <div style={{ display: 'grid', gap: '0.875rem' }}>
              {newClientPhase === 'idle' ? (
                <>

                {/* Lookup method toggle + input + Search button */}
                {(consentPhase === 'idle' || consentPhase === 'not_found') && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        className={`${styles.slotBtn} ${lookupMethod === 'code' ? styles.slotBtnSelected : ''}`}
                        onClick={() => { setLookupMethod('code'); setLookupValue(''); setLookupFormatError(''); }}
                      >
                        Lookup by Code
                      </button>
                      <button
                        type="button"
                        className={`${styles.slotBtn} ${lookupMethod === 'phone' ? styles.slotBtnSelected : ''}`}
                        onClick={() => { setLookupMethod('phone'); setLookupValue(''); setLookupFormatError(''); }}
                      >
                        Lookup by Phone
                      </button>
                    </div>
                    <label className={styles.fieldLabel}>
                      {lookupMethod === 'code' ? 'Patient Lookup Code' : 'Patient Phone Number'}
                    </label>
                    <div className={styles.lookupRow}>
                      <input
                        type={lookupMethod === 'code' ? 'text' : 'tel'}
                        className={styles.textInput}
                        placeholder={lookupMethod === 'code' ? 'firstname-lastname-1234' : '+201234567890'}
                        value={lookupValue}
                        onChange={(e) => setLookupValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !!lookupValue.trim() && handleLookup()}
                      />
                      <Button
                        variant="outline"
                        icon="bi-search"
                        onClick={handleLookup}
                        disabled={!lookupValue.trim()}
                      >
                        Request Access
                      </Button>
                    </div>
                    {lookupFormatError && (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#e74c3c' }}>
                        <i className="bi bi-exclamation-circle" /> {lookupFormatError}
                      </p>
                    )}
                  </div>
                )}

                {canCreateClient && consentPhase === 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (lookupMethod === 'phone' && lookupValue.trim()) setNewPhoneNumber(egyptLocalDigits(lookupValue));
                      setNewClientPhase('user_form');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary, #0d9aff)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.8rem', padding: 0, textAlign: 'left', width: 'fit-content' }}
                  >
                    <i className="bi bi-person-plus" /> Walk-in (not on the app)
                  </button>
                )}

                {shareRequestError && (
                  <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} style={{ marginBottom: 0 }}>
                    <i className="bi bi-exclamation-circle-fill" /> {shareRequestError}
                  </div>
                )}

                {/* Looking up patient */}
                {consentPhase === 'searching' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    <PawLoader size="small" />
                    Looking up patient…
                  </div>
                )}

                {/* No account found */}
                {consentPhase === 'not_found' && (
                  <div className={`alert alert-info py-2 ${styles.feedbackAlert}`} style={{ marginBottom: 0 }}>
                    <i className="bi bi-info-circle" /> No account found for this {lookupMethod === 'code' ? 'code' : 'number'}.{' '}
                    {canCreateClient && (
                      <>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                          onClick={() => {
                            if (lookupMethod === 'phone' && lookupValue.trim()) setNewPhoneNumber(egyptLocalDigits(lookupValue));
                            setNewClientPhase('user_form');
                          }}
                        >
                          Book them as a walk-in
                        </button>
                        , or{' '}
                      </>
                    )}
                    <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }} onClick={resetConsentState}>
                      try again
                    </button>.
                  </div>
                )}

                {/* Account exists but no consent yet */}
                {consentPhase === 'none' && (
                  <div style={{ border: '1px solid #e4e7ec', borderRadius: '0.75rem', padding: '1rem', background: '#fafbff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <i className="bi bi-shield-lock" style={{ fontSize: '1.25rem', color: '#9ca3af', flexShrink: 0, marginTop: '0.1rem' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                          Account found — consent required
                        </p>
                        <p style={{ margin: '0 0 0.875rem', fontSize: '0.8rem', color: '#6b7280' }}>
                          This patient has a Paw-Pal account. Request their permission before viewing their information or booking on their behalf.
                        </p>
                        {hasClinicPermission(authStaff, 'users.share-request') ? (
                          <Button
                            variant="primary"
                            size="small"
                            icon="bi-send"
                            onClick={handleRequestShare}
                            loading={shareRequestLoading}
                            disabled={shareRequestLoading}
                          >
                            Request Access
                          </Button>
                        ) : (
                          <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>
                            <i className="bi bi-lock" /> Your role cannot send consent requests.
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={resetConsentState} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Waiting for owner approval */}
                {consentPhase === 'pending' && (
                  <div style={{ border: '1px dashed #93c5fd', borderRadius: '0.75rem', padding: '1rem', background: '#eff6ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <PawLoader size="small" />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.2rem', fontWeight: 600, fontSize: '0.875rem', color: '#1e40af' }}>
                          Waiting for owner approval
                        </p>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#3b82f6' }}>
                          A notification was sent to the patient. This page updates automatically when they approve.
                        </p>
                      </div>
                      <button type="button" onClick={resetConsentState} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Approved — show profile + pet picker */}
                {consentPhase === 'approved' && approvedUser && (
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <i className="bi bi-person-check-fill" />{' '}
                        <strong>{approvedUser.firstName} {approvedUser.lastName}</strong>
                        {' '}&middot; {approvedUser.phoneNumber}
                      </span>
                      <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }} onClick={resetConsentState}>
                        Change
                      </button>
                    </div>

                    {/* Pet selection */}
                    <div>
                      <label className={styles.fieldLabel}>
                        Select Pet <span style={{ color: '#e74c3c' }}>*</span>
                      </label>
                      {approvedUser.pets.length === 0 ? (
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                          No shared pets. The owner has not added any pets to their account.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
                          {approvedUser.pets.map((pet) =>
                            petCard(pet, selectedPetId === pet.id, () => setSelectedPetId(pet.id)),
                          )}
                        </div>
                      )}
                    </div>

                    {/* Owner may have pets not yet shared with this clinic */}
                    {hasClinicPermission(authStaff, 'users.share-request') && (
                      <div>
                        <button
                          type="button"
                          onClick={handleRequestAdditionalPetShare}
                          disabled={additionalPetShareLoading}
                          style={{ background: 'none', border: 'none', color: 'var(--color-primary, #0d9aff)', textDecoration: 'underline', cursor: additionalPetShareLoading ? 'default' : 'pointer', fontSize: '0.8rem', padding: 0 }}
                        >
                          {additionalPetShareLoading ? 'Sending…' : "Don't see the pet you need? Request sharing for another pet"}
                        </button>
                        {additionalPetShareMessage && (
                          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.35rem 0 0' }}>
                            <i className="bi bi-info-circle" /> {additionalPetShareMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </>
              ) : (
                <>
                  {newClientError && (
                    <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} style={{ marginBottom: 0 }}>
                      <i className="bi bi-exclamation-circle-fill" /> {newClientError}
                    </div>
                  )}

                  {/* ── New client — create an unclaimed user ── */}
                  {newClientPhase === 'user_form' && (
                    <div style={{ border: '1px solid #e4e7ec', borderRadius: '0.75rem', padding: '1rem', background: '#fafbff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                          <i className="bi bi-person-plus" /> New client
                        </p>
                        <button type="button" onClick={resetNewClientFields} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: '0.625rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                          <div>
                            <label className={styles.fieldLabel}>First Name <span style={{ color: '#e74c3c' }}>*</span></label>
                            <input type="text" className={styles.textInput} value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
                          </div>
                          <div>
                            <label className={styles.fieldLabel}>Last Name <span style={{ color: '#e74c3c' }}>*</span></label>
                            <input type="text" className={styles.textInput} value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>Phone Number <span style={{ color: '#e74c3c' }}>*</span></label>
                          <div className={styles.phoneInputRow}>
                            <span className={styles.phonePrefix}>+20</span>
                            <input
                              type="tel"
                              inputMode="numeric"
                              className={styles.textInput}
                              placeholder="1012345678"
                              value={newPhoneNumber}
                              onChange={(e) => setNewPhoneNumber(egyptLocalDigits(e.target.value))}
                            />
                          </div>
                          {newPhoneNumber && newPhoneNumber.length < 10 && (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#e74c3c' }}>
                              <i className="bi bi-exclamation-circle" /> Enter all 10 digits after +20.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>Email</label>
                          <input type="email" className={styles.textInput} placeholder="Optional" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                          {newClientFieldErrors.email && (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#e74c3c' }}>
                              <i className="bi bi-exclamation-circle" /> {newClientFieldErrors.email}
                            </p>
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                          The owner can claim this account later in the PawPal app using this phone number or email.
                        </p>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={handleCreateClientUser}
                          loading={newClientSaving}
                          disabled={newClientSaving || !newFirstName.trim() || !newLastName.trim() || newPhoneNumber.length !== 10}
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── New client — pick an existing pet or add a new one ── */}
                  {newClientPhase === 'pet_step' && (
                    <div style={{ border: '1px solid #e4e7ec', borderRadius: '0.75rem', padding: '1rem', background: '#fafbff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                          <i className="bi bi-heart" /> {newFirstName} {newLastName} — select or add a pet
                        </p>
                        <button type="button" onClick={resetNewClientFields} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                      {newClientPets.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          {newClientPets.map((pet) => petCard(pet, false, () => finalizeNewClient(pet)))}
                        </div>
                      )}
                      <Button variant="outline" size="small" icon="bi-plus-lg" onClick={() => setNewClientPhase('pet_form')}>
                        Add new pet
                      </Button>
                    </div>
                  )}

                  {/* ── New client — create a pet ── */}
                  {newClientPhase === 'pet_form' && (
                    <div style={{ border: '1px solid #e4e7ec', borderRadius: '0.75rem', padding: '1rem', background: '#fafbff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                          <i className="bi bi-heart-fill" /> Add pet
                        </p>
                        <button type="button" onClick={resetNewClientFields} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: '0.625rem' }}>
                        <div>
                          <label className={styles.fieldLabel}>Pet Name <span style={{ color: '#e74c3c' }}>*</span></label>
                          <input type="text" className={styles.textInput} value={newPetName} onChange={(e) => setNewPetName(e.target.value)} />
                        </div>
                        <div>
                          <label className={styles.fieldLabel}>Pet Type <span style={{ color: '#e74c3c' }}>*</span></label>
                          <select
                            className={styles.filterSelect}
                            style={{ width: '100%' }}
                            value={newPetTypeId}
                            onChange={(e) => setNewPetTypeId(e.target.value)}
                            disabled={petTypesLoading}
                          >
                            <option value="">{petTypesLoading ? 'Loading…' : 'Choose type…'}</option>
                            {petTypes.map((t) => (
                              <option key={t.id} value={String(t.id)}>{t.name}</option>
                            ))}
                          </select>
                          {petTypesError && (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#e74c3c' }}>
                              <i className="bi bi-exclamation-circle" /> {petTypesError}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={handleCreateClientPet}
                          loading={newClientSaving}
                          disabled={newClientSaving || !newPetName.trim() || !newPetTypeId}
                        >
                          {newClientPets.length === 0 ? 'Create Pet & Continue' : 'Add Pet & Continue'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4 — Services & Confirm ── */}
        {step === 4 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Services & confirm</p>

            {!isPatientStepValid() && (
              <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
                <i className="bi bi-exclamation-triangle-fill" /> Patient selection is no longer valid
                (consent status may have changed).{' '}
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  onClick={() => setStep(3)}
                >
                  Go back to Patient step
                </button>.
              </div>
            )}

            {/* Summary */}
            <div className={styles.bookingSummary}>
              <div className={styles.summaryRow}>
                <i className="bi bi-building" />
                <span>{branches.find((b) => String(b.id) === selectedBranch)?.title ?? selectedBranch}</span>
              </div>
              <div className={styles.summaryRow}>
                <i className="bi bi-calendar-event" />
                <span>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {' at '}{fmt(finalTime)}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <i className="bi bi-person-badge" />
                <span>{honorificFor(doctorObj)}{doctorObj?.firstName} {doctorObj?.lastName}{doctorObj?.role ? ` — ${doctorObj.role.name}` : ''}</span>
              </div>
              {approvedUser && (
                <div className={styles.summaryRow}>
                  <i className="bi bi-person" />
                  <span>
                    {approvedUser.firstName} {approvedUser.lastName}
                    {selectedPetId && approvedUser.pets && (() => {
                      const pet = approvedUser.pets.find((p) => p.id === selectedPetId);
                      return pet ? ` · ${pet.name}` : '';
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Services */}
            {validServices.length === 0 && (
              <div className="alert alert-info py-2" style={{ fontSize: '0.875rem', marginTop: '1.25rem' }}>
                <i className="bi bi-info-circle" /> This branch has no services configured yet.
                Add services under Branches → {branches.find((b) => String(b.id) === selectedBranch)?.title ?? 'this branch'} → Edit before booking.
              </div>
            )}
            <div className={styles.serviceCheckList} style={{ marginTop: '1.25rem' }}>
              {validServices.map((s) => {
                const checked = selectedServiceIds.has(s.clinicServiceId);
                const name = s.name ?? catalogMap.get(s.clinicServiceId) ?? `Service #${s.clinicServiceId}`;
                return (
                  <label key={s.clinicServiceId} className={`${styles.serviceCheckItem} ${checked ? styles.checked : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleService(s.clinicServiceId)} />
                    <span className={styles.serviceCheckName}>{name}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label className={styles.fieldLabel}>Notes</label>
              <textarea
                className={styles.textInput}
                style={{ resize: 'vertical', minHeight: '80px' }}
                placeholder="Any additional notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <div className={styles.stepNav}>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => {
              if (step > 1) { setStep((p) => (p - 1) as Step); return; }
              if (isDraftEmpty({ step, selectedBranch, selectedDate, lookupValue })) {
                navigate('/appointments');
              } else {
                setShowDiscardConfirm(true);
              }
            }}
            disabled={saving}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          {step < 4 ? (
            <Button variant="primary" onClick={() => setStep((p) => (p + 1) as Step)} disabled={!canAdvance()}>
              Continue <i className="bi bi-arrow-right" />
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} disabled={!canAdvance() || saving}>
              {saving ? 'Booking…' : 'Book Appointment'}
            </Button>
          )}
        </div>

      </div>

      <Modal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard this appointment?"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                handleDiscardDraft();
                setShowDiscardConfirm(false);
                navigate('/appointments');
              }}
            >
              Discard
            </Button>
          </>
        )}
      >
        <p style={{ margin: 0 }}>Your progress on this appointment will be lost.</p>
      </Modal>
    </>
  );
}
