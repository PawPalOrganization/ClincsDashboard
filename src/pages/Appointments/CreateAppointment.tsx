import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
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
  UserSearchResult,
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

const TODAY = new Date().toISOString().split('T')[0];

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ['Branch & Date', 'Doctor & Time', 'Patient', 'Services'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateAppointment() {
  const { clinicId, staff: authStaff } = useClinicAuth();
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

  // Step 3
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Step 4
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [catalog, setCatalog] = useState<ClinicService[]>([]);

  // Lookup map: clinicServiceId → name from catalog
  const catalogMap = new Map(catalog.map((s) => [Number(s.id), s.name]));

  // Services to show in step 4: use full branch detail (has costs), fallback to catalog
  const branchServices = (selectedBranchDetail?.services ?? [])
    .filter((s) => s.clinicServiceId != null && Number(s.clinicServiceId) > 0);
  const validServices = branchServices.length > 0
    ? branchServices
    : catalog.map((s) => ({ clinicServiceId: Number(s.id), cost: 0 }));

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

  useEffect(() => {
    if (isWalkIn || userQuery.trim().length < 2) { setUserResults([]); return; }
    const t = window.setTimeout(() => {
      clinicUserSearchService.search(userQuery.trim()).then(setUserResults).catch(() => {});
    }, 300);
    return () => window.clearTimeout(t);
  }, [userQuery, isWalkIn]);

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

  function toggleService(id: number) {
    setSelectedServiceIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function canAdvance(): boolean {
    if (step === 1) return !!selectedBranch && !!selectedDate;
    if (step === 2) return !!selectedDoctor && !!finalTime;
    if (step === 3) return isWalkIn ? !!walkInName.trim() : !!selectedUser;
    if (step === 4) return validServices.length > 0 && selectedServiceIds.size > 0;
    return false;
  }

  async function handleSubmit() {
    if (!finalTime) return;
    const serviceIds = Array.from(selectedServiceIds).filter((id) => id > 0);
    if (!serviceIds.length) { setServerError('Select at least one service.'); return; }
    setSaving(true);
    setServerError('');
    try {
      const appt = await clinicAppointmentService.create({
        clinicBranchId: Number(selectedBranch),
        clinicStaffId: Number(selectedDoctor),
        clinicServiceIds: serviceIds,
        userId: !isWalkIn && selectedUser ? selectedUser.id : undefined,
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

            {!isWalkIn && (
              <div style={{ position: 'relative' }}>
                <div className={styles.searchWrap}>
                  <i className="bi bi-search" />
                  <input
                    type="search"
                    className={styles.searchInput}
                    placeholder="Search by name or phone…"
                    value={userQuery}
                    onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }}
                  />
                </div>
                {userResults.length > 0 && !selectedUser && (
                  <div className={styles.userSearchResults}>
                    {userResults.map((u) => (
                      <div
                        key={String(u.id)}
                        className={styles.userSearchItem}
                        onClick={() => { setSelectedUser(u); setUserQuery(`${u.firstName} ${u.lastName}`); setUserResults([]); }}
                      >
                        <div className={styles.userSearchAvatar}>{u.firstName[0]}{u.lastName[0]}</div>
                        <div>
                          <div className={styles.userSearchName}>{u.firstName} {u.lastName}</div>
                          {u.phoneNumber && <div className={styles.userSearchPhone}>{u.phoneNumber}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} style={{ marginTop: '0.75rem' }}>
                    <i className="bi bi-person-check-fill" /> <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>
                    {' '}<button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setSelectedUser(null); setUserQuery(''); }}>Change</button>
                  </div>
                )}
              </div>
            )}

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
                onChange={(e) => { setIsWalkIn(e.target.checked); setSelectedUser(null); setUserQuery(''); setUserResults([]); }}
              />
              Walk-in (no registered user)
            </label>
          </div>
        )}

        {/* ── Step 4 — Services & Confirm ── */}
        {step === 4 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Services & confirm</p>

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
              {(isWalkIn ? walkInName : selectedUser) && (
                <div className={styles.summaryRow}>
                  <i className="bi bi-person" />
                  <span>{isWalkIn ? walkInName : `${selectedUser?.firstName} ${selectedUser?.lastName}`}</span>
                </div>
              )}
            </div>

            {/* Services */}
            {validServices.length === 0 && (
              <div className="alert alert-info py-2" style={{ fontSize: '0.875rem', marginTop: '1.25rem' }}>
                <i className="bi bi-info-circle" /> No services available for this branch yet.
              </div>
            )}
            {validServices.length > 0 && validServices.every((s) => Number(s.cost) === 0) && (
              <div className="alert alert-warning py-2" style={{ fontSize: '0.825rem', marginTop: '1rem' }}>
                <i className="bi bi-exclamation-triangle" /> Service costs are not set for this branch. Go to <strong>Branches → Edit</strong> and enter a price for each service.
              </div>
            )}
            <div className={styles.serviceCheckList} style={{ marginTop: '1.25rem' }}>
              {validServices.map((s) => {
                const checked = selectedServiceIds.has(s.clinicServiceId);
                const name = catalogMap.get(s.clinicServiceId) ?? `Service #${s.clinicServiceId}`;
                return (
                  <label key={s.clinicServiceId} className={`${styles.serviceCheckItem} ${checked ? styles.checked : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleService(s.clinicServiceId)} />
                    <span className={styles.serviceCheckName}>{name}</span>
                    <span className={styles.serviceCheckCost}>EGP {Number(s.cost).toFixed(2)}</span>
                  </label>
                );
              })}
            </div>

            {selectedServiceIds.size > 0 && (() => {
              const total = validServices
                .filter((s) => selectedServiceIds.has(s.clinicServiceId))
                .reduce((sum, s) => sum + Number(s.cost), 0);
              return (
                <div className={styles.totalRow}>
                  <span>Estimated total</span>
                  {total > 0
                    ? <span>EGP {total.toFixed(2)}</span>
                    : <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Calculated at checkout</span>
                  }
                </div>
              );
            })()}

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
