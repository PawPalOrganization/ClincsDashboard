import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { useClinicPusher } from '../../hooks/useClinicPusher';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicCatalogService from '../../services/clinic/clinicCatalogService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import clinicUserSearchService from '../../services/clinic/clinicUserSearchService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  BranchWorkingHour,
  ClinicBranch,
  ClinicService,
  ClinicStaff,
  PetSummary,
} from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import styles from './Appointments.module.scss';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOCTOR_KEYWORDS = ['doctor', 'vet', 'physician', 'surgeon', 'specialist'];
function isDoctor(s: ClinicStaff) {
  return DOCTOR_KEYWORDS.some((kw) => s.role?.name?.toLowerCase().includes(kw));
}

function generateSlots(start: string, end: string, step = 30): string[] {
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

// null  = no workingHours data on this staff object → show manual time input
// []    = has data, but doctor is off on this day
// [...] = available time slots
function getSlotsForDate(doctor: ClinicStaff, date: string): string[] | null {
  if (!doctor.workingHours?.length) return null;
  const dow = new Date(date + 'T12:00:00').getDay();
  const wh = doctor.workingHours.find((h: BranchWorkingHour) => h.dayOfWeek === dow);
  if (!wh) return [];
  return generateSlots(wh.startTime, wh.endTime);
}

function fmt(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

interface NormalizedBranchService {
  clinicServiceId: number;
  cost: number;
  name?: string;
}

// The branch-detail GET returns `services` as full ClinicService-like objects
// ({ id, name, cost, ... }) — `id` IS the clinic service id here, not `clinicServiceId`
// (that field name only applies to the create/update payload shape). Same normalization
// BranchForm.tsx already has to apply for the same reason.
function normalizeBranchServices(rawServices?: ClinicBranch['services']): NormalizedBranchService[] {
  if (!Array.isArray(rawServices) || rawServices.length === 0) return [];
  return rawServices
    .map((s: any): NormalizedBranchService | null => {
      const id = s.clinicServiceId ?? s.serviceId ?? s.clinicService?.id ?? s.service?.id ?? s.id;
      if (id == null || Number(id) <= 0) return null;
      const name: string | undefined = s.name ?? s.clinicService?.name ?? s.service?.name ?? undefined;
      return {
        clinicServiceId: Number(id),
        cost: s.cost != null ? Number(s.cost) : 0,
        name,
      };
    })
    .filter((row): row is NormalizedBranchService => row !== null);
}

const TODAY = new Date().toISOString().split('T')[0];

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Branch & Date', 'Doctor & Time', 'Patient', 'Services'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateAppointment() {
  const { clinicId, staff: authStaff, token, branchId: authBranchId } = useClinicAuth();
  const navigate = useNavigate();
  const canCreate = hasClinicPermission(authStaff, 'appointments.create');

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  // Step 1
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Step 2
  const [selectedBranchDetail, setSelectedBranchDetail] = useState<ClinicBranch | null>(null);
  const [doctors, setDoctors] = useState<ClinicStaff[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [manualTimes, setManualTimes] = useState<Record<string, string>>({});

  // Step 3 — consent-aware patient lookup
  type ConsentPhase = 'idle' | 'searching' | 'not_found' | 'none' | 'pending' | 'approved';
  type LookupMethod = 'code' | 'phone';
  const [isWalkIn, setIsWalkIn] = useState(false);
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
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const USER_HASH_RE = /^[a-z]+-[a-z]+-[a-z0-9]{4}$/;

  // Step 4
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [catalog, setCatalog] = useState<ClinicService[]>([]);

  // Lookup map: clinicServiceId → name from catalog
  const catalogMap = new Map(catalog.map((s) => [Number(s.id), s.name]));

  // Services to show in step 4 — must be services actually assigned to this branch
  // (Branch settings → Services). The backend rejects clinicServiceIds not configured
  // for the branch, so we must NOT fall back to the full platform catalog here.
  const validServices = normalizeBranchServices(selectedBranchDetail?.services);

  const doctorObj = doctors.find((d) => String(d.id) === selectedDoctor);
  const finalTime = selectedSlot || manualTimes[selectedDoctor] || '';

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100)
      .then((r) => setBranches(r.items))
      .catch(() => {});
    clinicCatalogService.list(clinicId, { limit: 100 })
      .then((r) => setCatalog(r.items))
      .catch(() => {});
  }, [clinicId]);

  // Fetch doctors + full branch detail (with services/costs) when branch changes
  useEffect(() => {
    if (!selectedBranch || !clinicId) { setDoctors([]); setSelectedBranchDetail(null); return; }
    setLoadingDoctors(true);
    setSelectedDoctor(''); setSelectedSlot(''); setManualTimes({});
    setSelectedServiceIds(new Set());
    clinicBranchesService.getOne(clinicId, selectedBranch)
      .then((b) => setSelectedBranchDetail(b))
      .catch(() => setSelectedBranchDetail(null));
    clinicStaffService.list({ page: 1, limit: 100, clinicBranchId: selectedBranch })
      .then((r) => setDoctors(r.items.filter(isDoctor)))
      .catch(() => {})
      .finally(() => setLoadingDoctors(false));
  }, [selectedBranch, clinicId]);

  // Reset doctor/slot when date changes
  useEffect(() => {
    setSelectedDoctor(''); setSelectedSlot(''); setManualTimes({});
  }, [selectedDate]);

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
        setConsentPhase('not_found');
        setIsWalkIn(true);
        if (lookupMethod === 'phone') setWalkInPhone(value);
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
      await clinicUserSearchService.requestShare({
        clinicId,
        userHash: foundIdentifier.type === 'userHash' ? foundIdentifier.value : undefined,
        phoneNumber: foundIdentifier.type === 'phoneNumber' ? foundIdentifier.value : undefined,
      });
      setConsentPhase('pending');
    } catch (err) {
      // 409 = already approved — re-fetch by userId (works regardless of which identifier found them)
      const status = (err as { status?: number }).status;
      if (status === 409 && pendingUserId) {
        try {
          const profile = await clinicUserSearchService.lookup({ clinicId, userId: pendingUserId });
          if (profile.found && profile.consentStatus === 'approved') {
            setConsentPhase('approved');
            setApprovedUser(profile);
            setSelectedPetId(null);
          }
        } catch {
          setShareRequestError('Failed to fetch consent status. Please retry.');
        }
      } else {
        setShareRequestError(err instanceof Error ? err.message : 'Failed to send request.');
      }
    } finally {
      setShareRequestLoading(false);
    }
  }

  // Asks the owner to expand an already-approved share to cover a pet not currently
  // in `approvedUser.pets`. Note: today's backend contract 409s "already approved" for
  // any repeat call to /users/share-request once consent is approved — there is no
  // documented endpoint yet for adding a pet to an existing share, so this always
  // surfaces the explanatory message below rather than a real pending state. Needs
  // backend support (either letting share-request succeed again, or a dedicated
  // "add pet to share" endpoint) to become a functional flow.
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
      setAdditionalPetShareMessage('Request sent — ask the owner to check their Paw-Pal app.');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        setAdditionalPetShareMessage(
          'This owner already has an active data-sharing approval on file. To share an additional pet, ask them to update sharing from their Paw-Pal app.',
        );
      } else {
        setAdditionalPetShareMessage(err instanceof Error ? err.message : 'Failed to send request.');
      }
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
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }

  function toggleService(id: number) {
    setSelectedServiceIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Patient/pet requirement from step 3 — re-checked at step 4 too, since consent can
  // flip (and selectedPetId reset to null) via Pusher/poll while the staff member has
  // already moved on to the services step.
  function isPatientStepValid(): boolean {
    if (isWalkIn) return !!walkInName.trim();
    return consentPhase === 'approved' && !!approvedUser && selectedPetId !== null;
  }

  function canAdvance(): boolean {
    if (step === 1) return !!selectedBranch && !!selectedDate;
    if (step === 2) return !!selectedDoctor && !!finalTime;
    if (step === 3) return isPatientStepValid();
    if (step === 4) return isPatientStepValid() && validServices.length > 0 && selectedServiceIds.size > 0;
    return false;
  }

  async function handleSubmit() {
    if (!finalTime) return;
    const serviceIds = Array.from(selectedServiceIds).filter((id) => id > 0);
    if (!serviceIds.length) { setServerError('Select at least one service.'); return; }
    if (!isPatientStepValid()) {
      setServerError(
        isWalkIn
          ? 'Enter the walk-in patient name.'
          : 'Select a pet for this patient before booking — consent status may have changed, go back to the Patient step.',
      );
      return;
    }
    setSaving(true);
    setServerError('');
    try {
      const appt = await clinicAppointmentService.create({
        clinicBranchId: Number(selectedBranch),
        clinicStaffId: Number(selectedDoctor),
        clinicServiceIds: serviceIds,
        userId: !isWalkIn && approvedUser ? approvedUser.userId : undefined,
        petId: !isWalkIn && approvedUser ? selectedPetId ?? undefined : undefined,
        contactName: isWalkIn ? walkInName.trim() || undefined : undefined,
        contactPhone: isWalkIn ? walkInPhone.trim() || undefined : undefined,
        scheduledAt: new Date(`${selectedDate}T${finalTime}:00`).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes.trim() || undefined,
      });
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
          <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/appointments')} disabled={saving}>
            Cancel
          </Button>
        </div>

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
            </div>
          </div>
        )}

        {/* ── Step 2 — Doctor & Time Slot ── */}
        {step === 2 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>
              Available doctors —{' '}
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>

            {loadingDoctors && (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>
                <i className="bi bi-hourglass-split" /> Loading doctors…
              </p>
            )}

            {!loadingDoctors && doctors.length === 0 && (
              <div className="alert alert-info py-2" style={{ fontSize: '0.875rem' }}>
                <i className="bi bi-info-circle" /> No doctors found for this branch.
              </div>
            )}

            {!loadingDoctors && doctors.length > 0 && (
              <div className={styles.doctorGrid}>
                {doctors.map((doc) => {
                  const slots = getSlotsForDate(doc, selectedDate);
                  const isSelected = selectedDoctor === String(doc.id);
                  const isOff = slots !== null && slots.length === 0;

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
                          <div className={styles.doctorName}>Dr. {doc.firstName} {doc.lastName}</div>
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
                        <div className={styles.manualTimeWrap}>
                          <span className={styles.manualTimeLabel}>
                            <i className="bi bi-clock" /> No schedule set — enter time manually
                          </span>
                          <input
                            type="time"
                            className={styles.timeInput}
                            value={manualTimes[String(doc.id)] ?? ''}
                            onChange={(e) => setManualTime(String(doc.id), e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3 — Patient ── */}
        {step === 3 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Who is this appointment for?</p>

            {/* ── Registered user — consent-aware lookup by code or phone ── */}
            {!isWalkIn && (
              <div style={{ display: 'grid', gap: '0.875rem' }}>

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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type={lookupMethod === 'code' ? 'text' : 'tel'}
                        className={styles.textInput}
                        placeholder={lookupMethod === 'code' ? 'firstname-lastname-1234' : '+201234567890'}
                        value={lookupValue}
                        onChange={(e) => setLookupValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !!lookupValue.trim() && handleLookup()}
                        style={{ flex: 1 }}
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
                    <i className="bi bi-info-circle" /> No account found for this {lookupMethod === 'code' ? 'code' : 'number'}. Use walk-in below, or{' '}
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
                          {approvedUser.pets.map((pet) => {
                            const isSelected = selectedPetId === pet.id;
                            return (
                              <button
                                key={pet.id}
                                type="button"
                                onClick={() => setSelectedPetId(pet.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                                  padding: '0.65rem 0.875rem',
                                  border: isSelected ? '2px solid var(--color-primary, #0d9aff)' : '1.5px solid #e4e7ec',
                                  borderRadius: '0.625rem',
                                  background: isSelected ? 'rgba(13,154,255,0.05)' : '#fff',
                                  cursor: 'pointer', textAlign: 'left', width: '100%',
                                  transition: 'border-color 0.12s, background 0.12s',
                                  boxShadow: isSelected ? '0 0 0 3px rgba(13,154,255,0.1)' : 'none',
                                }}
                              >
                                {pet.imageUrl ? (
                                  <img src={pet.imageUrl} alt={pet.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(13,154,255,0.1)', color: 'var(--color-primary, #0d9aff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                    <i className="bi bi-heart-fill" />
                                  </div>
                                )}
                                <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--color-primary, #0d9aff)' : '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {pet.name}
                                </span>
                                {isSelected && <i className="bi bi-check-circle-fill" style={{ color: 'var(--color-primary, #0d9aff)', flexShrink: 0, fontSize: '0.875rem' }} />}
                              </button>
                            );
                          })}
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
              </div>
            )}

            {/* ── Walk-in — manual details ── */}
            {isWalkIn && (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div>
                  <label className={styles.fieldLabel}>Patient Name <span style={{ color: '#e74c3c' }}>*</span></label>
                  <input type="text" className={styles.textInput} placeholder="Full name" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
                </div>
                <div>
                  <label className={styles.fieldLabel}>Phone Number</label>
                  <input type="tel" className={styles.textInput} placeholder="Optional" value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} />
                </div>
              </div>
            )}

            <label className={styles.walkInToggle}>
              <input
                type="checkbox"
                checked={isWalkIn}
                onChange={(e) => {
                  const walkIn = e.target.checked;
                  setIsWalkIn(walkIn);
                  if (walkIn) resetConsentState();
                  else { setWalkInName(''); setWalkInPhone(''); }
                }}
              />
              Walk-in (no registered user)
            </label>
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
                <span>Dr. {doctorObj?.firstName} {doctorObj?.lastName}{doctorObj?.role ? ` — ${doctorObj.role.name}` : ''}</span>
              </div>
              {(isWalkIn ? walkInName : approvedUser) && (
                <div className={styles.summaryRow}>
                  <i className="bi bi-person" />
                  <span>
                    {isWalkIn
                      ? walkInName
                      : `${approvedUser?.firstName} ${approvedUser?.lastName}`}
                    {!isWalkIn && selectedPetId && approvedUser?.pets && (() => {
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
            onClick={() => step > 1 ? setStep((p) => (p - 1) as Step) : navigate('/appointments')}
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
    </>
  );
}
