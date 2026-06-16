import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import clinicUserSearchService from '../../services/clinic/clinicUserSearchService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  ClinicBranch,
  ClinicStaff,
  UserSearchResult,
} from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import styles from './Appointments.module.scss';

const DOCTOR_KEYWORDS = ['doctor', 'vet', 'physician', 'surgeon', 'specialist'];
function isDoctor(staff: ClinicStaff) {
  const name = staff.role?.name?.toLowerCase() ?? '';
  return DOCTOR_KEYWORDS.some((kw) => name.includes(kw));
}

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ['Patient', 'Branch & Doctor', 'Services', 'Schedule'];

export default function CreateAppointment() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();
  const canCreate = hasClinicPermission(authStaff, 'appointments.create');

  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  // Step 1 — patient
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Step 2 — branch & doctor
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [doctors, setDoctors] = useState<ClinicStaff[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // Step 3 — services
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<number>>(new Set());

  // Step 4 — schedule
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100)
      .then((res) => setBranches(res.items))
      .catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    if (!selectedBranch) { setDoctors([]); return; }
    setLoadingDoctors(true);
    setSelectedServiceIds(new Set());
    clinicStaffService.list({ page: 1, limit: 100, clinicBranchId: selectedBranch })
      .then((res) => setDoctors(res.items.filter(isDoctor)))
      .catch(() => {})
      .finally(() => setLoadingDoctors(false));
  }, [selectedBranch]);

  useEffect(() => {
    if (isWalkIn || userQuery.trim().length < 2) { setUserResults([]); return; }
    const t = window.setTimeout(() => {
      clinicUserSearchService.search(userQuery.trim())
        .then(setUserResults)
        .catch(() => {});
    }, 300);
    return () => window.clearTimeout(t);
  }, [userQuery, isWalkIn]);

  function toggleService(clinicServiceId: number) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      next.has(clinicServiceId) ? next.delete(clinicServiceId) : next.add(clinicServiceId);
      return next;
    });
  }

  async function handleSubmit() {
    if (!selectedBranch || !selectedDoctor || !scheduledAt) return;
    setSaving(true);
    setServerError('');
    try {
      const appt = await clinicAppointmentService.create({
        clinicBranchId: Number(selectedBranch),
        clinicStaffId: Number(selectedDoctor),
        clinicServiceIds: selectedServiceIds.size > 0
          ? Array.from(selectedServiceIds).filter((id) => id != null && id > 0)
          : undefined,
        userId: !isWalkIn && selectedUser ? selectedUser.id : undefined,
        contactName: isWalkIn ? walkInName.trim() || undefined : undefined,
        contactPhone: isWalkIn ? walkInPhone.trim() || undefined : undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes.trim() || undefined,
      });
      navigate(`/appointments/${appt.id}`, {
        state: { successMsg: 'Appointment created successfully.' },
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create appointment.');
      setSaving(false);
    }
  }

  function canAdvance(): boolean {
    if (step === 1) return isWalkIn ? !!walkInName.trim() : !!selectedUser;
    if (step === 2) return !!selectedBranch && !!selectedDoctor;
    if (step === 3) return true;
    if (step === 4) return !!scheduledAt;
    return false;
  }

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account.</p>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Access restricted</h2>
        <p>Your role does not include permission to create appointments.</p>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/appointments')}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <>
      {saving && <PawLoader size="large" overlay />}

      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>New Appointment</h1>
            <p className={styles.pageSubtitle}>Book an appointment in {STEP_LABELS.length} steps.</p>
          </div>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => navigate('/appointments')}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>

        {/* Stepper */}
        <div className={styles.stepper}>
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step;
            const isActive = n === step;
            const isDone = n < step;
            return (
              <div
                key={n}
                className={`${styles.step} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}
              >
                <span className={styles.stepNumber}>
                  {isDone ? <i className="bi bi-check" /> : n}
                </span>
                {label}
              </div>
            );
          })}
        </div>

        {serverError && (
          <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
            <i className="bi bi-exclamation-circle-fill" /> {serverError}
          </div>
        )}

        {/* Step 1 — Patient */}
        {step === 1 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Who is this appointment for?</p>

            {!isWalkIn && (
              <>
                <div style={{ position: 'relative' }}>
                  <div className={styles.searchWrap}>
                    <i className="bi bi-search" />
                    <input
                      type="search"
                      className={styles.searchInput}
                      placeholder="Search by name or phone"
                      value={userQuery}
                      onChange={(e) => {
                        setUserQuery(e.target.value);
                        setSelectedUser(null);
                      }}
                    />
                  </div>
                  {userResults.length > 0 && !selectedUser && (
                    <div className={styles.userSearchResults}>
                      {userResults.map((u) => (
                        <div
                          key={String(u.id)}
                          className={styles.userSearchItem}
                          onClick={() => {
                            setSelectedUser(u);
                            setUserQuery(`${u.firstName} ${u.lastName}`);
                            setUserResults([]);
                          }}
                        >
                          <div className={styles.userSearchAvatar}>
                            {u.firstName.slice(0, 1)}{u.lastName.slice(0, 1)}
                          </div>
                          <div>
                            <div className={styles.userSearchName}>{u.firstName} {u.lastName}</div>
                            {u.phoneNumber && <div className={styles.userSearchPhone}>{u.phoneNumber}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedUser && (
                  <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} role="alert" style={{ marginTop: '0.75rem' }}>
                    <i className="bi bi-person-check-fill" /> Selected: <strong>{selectedUser.firstName} {selectedUser.lastName}</strong>
                    {' '}<button type="button" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setSelectedUser(null); setUserQuery(''); }}>Change</button>
                  </div>
                )}
              </>
            )}

            {isWalkIn && (
              <>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                      Patient Name <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                      placeholder="Full name"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                      placeholder="Optional"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <label className={styles.walkInToggle}>
              <input
                type="checkbox"
                checked={isWalkIn}
                onChange={(e) => {
                  setIsWalkIn(e.target.checked);
                  setSelectedUser(null);
                  setUserQuery('');
                  setUserResults([]);
                }}
              />
              Walk-in (no registered user)
            </label>
          </div>
        )}

        {/* Step 2 — Branch & Doctor */}
        {step === 2 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Select branch and doctor</p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                  Branch <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <select
                  className={styles.filterSelect}
                  style={{ width: '100%' }}
                  value={selectedBranch}
                  onChange={(e) => { setSelectedBranch(e.target.value); setSelectedDoctor(''); }}
                >
                  <option value="">Choose branch</option>
                  {branches.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                  Doctor <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <select
                  className={styles.filterSelect}
                  style={{ width: '100%' }}
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  disabled={!selectedBranch || loadingDoctors}
                >
                  <option value="">
                    {loadingDoctors ? 'Loading…' : 'Choose doctor'}
                  </option>
                  {doctors.map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      Dr. {d.firstName} {d.lastName}{d.role ? ` — ${d.role.name}` : ''}
                    </option>
                  ))}
                </select>
                {selectedBranch && !loadingDoctors && doctors.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.4rem' }}>
                    No doctors found in this branch.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Services */}
        {step === 3 && (() => {
          const branchServices = (branches.find((b) => String(b.id) === selectedBranch)?.services ?? [])
            .filter((s) => s.clinicServiceId != null && s.clinicServiceId > 0);
          const total = branchServices
            .filter((s) => selectedServiceIds.has(s.clinicServiceId))
            .reduce((sum, s) => sum + s.cost, 0);

          return (
            <div className={styles.stepCard}>
              <p className={styles.stepCardTitle}>Select services</p>

              {branchServices.length === 0 ? (
                <div className={`alert alert-info py-2`} role="alert" style={{ fontSize: '0.875rem' }}>
                  <i className="bi bi-info-circle-fill" /> No services configured for this branch yet. You can continue without selecting a service.
                </div>
              ) : (
                <>
                  <div className={styles.serviceCheckList}>
                    {branchServices.map((s) => {
                      const checked = selectedServiceIds.has(s.clinicServiceId);
                      const label = `Service #${s.clinicServiceId}`;
                      return (
                        <label
                          key={s.clinicServiceId}
                          className={`${styles.serviceCheckItem} ${checked ? styles.checked : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(s.clinicServiceId)}
                          />
                          <span className={styles.serviceCheckName}>{label}</span>
                          <span className={styles.serviceCheckCost}>${s.cost}</span>
                        </label>
                      );
                    })}
                  </div>

                  {selectedServiceIds.size > 0 && (
                    <div className={styles.totalRow}>
                      <span>Estimated total</span>
                      <span>${total}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Step 4 — Schedule */}
        {step === 4 && (
          <div className={styles.stepCard}>
            <p className={styles.stepCardTitle}>Date, time & notes</p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                  Scheduled date & time <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.4rem' }}>
                  Notes
                </label>
                <textarea
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', resize: 'vertical', minHeight: '90px' }}
                  placeholder="Any additional notes for the appointment"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className={styles.stepNav}>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => step > 1 ? setStep((prev) => (prev - 1) as Step) : navigate('/appointments')}
            disabled={saving}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 4 ? (
            <Button
              variant="primary"
              onClick={() => setStep((prev) => (prev + 1) as Step)}
              disabled={!canAdvance()}
            >
              Continue <i className="bi bi-arrow-right" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canAdvance() || saving}
            >
              {saving ? 'Booking…' : 'Book Appointment'}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
