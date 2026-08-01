import { useEffect, useState } from 'react';
import clinicPetService from '../../services/clinic/clinicPetService';
import { honorificFor } from '../../utils/staffRoles';
import { useClinicStaffDirectory } from '../../hooks/useClinicStaffDirectory';
import type { PetProfile, PetMedicine, Appointment } from '../../types/clinic.types';
import Modal from '../../components/common/Modal/Modal';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import styles from './Appointments.module.scss';

interface PetDetailModalProps {
  petId: number;
  clinicId: string;
  branchId?: string;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'medicines' | 'history';

const MEDICINE_CATEGORY_LABELS: Record<string, string> = {
  vaccine: 'Vaccine',
  medicine: 'Medicine',
  other: 'Other',
};

const MEDICINE_CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  vaccine: { bg: '#dcfce7', color: '#15803d' },
  medicine: { bg: '#e0f2fe', color: '#0369a1' },
  other: { bg: '#f3f4f6', color: '#374151' },
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PetDetailModal({ petId, clinicId, branchId, isOpen, onClose }: PetDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const staffDirectory = useClinicStaffDirectory(clinicId);

  // Profile
  const [profile, setProfile] = useState<PetProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Medicines
  const [medicines, setMedicines] = useState<PetMedicine[]>([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [medicinesError, setMedicinesError] = useState('');
  const [medicineCategory, setMedicineCategory] = useState<'' | 'vaccine' | 'medicine' | 'other'>('');

  // History
  const [history, setHistory] = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Load profile on open
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flag loading, then fetch
    setProfileLoading(true);
    setProfileError('');
    clinicPetService.getProfile(petId, clinicId)
      .then(setProfile)
      .catch((err) => setProfileError(err instanceof Error ? err.message : 'Failed to load pet profile.'))
      .finally(() => setProfileLoading(false));
  }, [isOpen, petId, clinicId]);

  // Load medicines when tab selected
  useEffect(() => {
    if (!isOpen || activeTab !== 'medicines') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flag loading, then fetch
    setMedicinesLoading(true);
    setMedicinesError('');
    clinicPetService.listMedicines(petId, clinicId, medicineCategory || undefined)
      .then(setMedicines)
      .catch((err) => setMedicinesError(err instanceof Error ? err.message : 'Failed to load medicines.'))
      .finally(() => setMedicinesLoading(false));
  }, [isOpen, activeTab, petId, clinicId, medicineCategory]);

  // Load history when tab selected or page changes
  useEffect(() => {
    if (!isOpen || activeTab !== 'history') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flag loading, then fetch
    setHistoryLoading(true);
    setHistoryError('');
    clinicPetService.listAppointments(petId, clinicId, { branchId, status: 'finished', page: historyPage, limit: 10 })
      .then((res) => {
        setHistory(Array.isArray(res.items) ? res.items : []);
        setHistoryTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch((err) => setHistoryError(err instanceof Error ? err.message : 'Failed to load visit history.'))
      .finally(() => setHistoryLoading(false));
  }, [isOpen, activeTab, petId, clinicId, branchId, historyPage]);

  // Reset tabs on close
  function handleClose() {
    setActiveTab('profile');
    setMedicineCategory('');
    setHistoryPage(1);
    onClose();
  }

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--color-primary, #0d9aff)' : '2px solid transparent',
    background: 'none',
    color: activeTab === tab ? 'var(--color-primary, #0d9aff)' : '#6b7280',
    fontWeight: activeTab === tab ? 600 : 400,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'color 0.12s, border-color 0.12s',
    whiteSpace: 'nowrap',
  });

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Pet Profile" size="large">
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e4e7ec', marginBottom: '1.25rem', gap: '0' }}>
        <button type="button" style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>
          <i className="bi bi-heart" /> Profile
        </button>
        <button type="button" style={tabStyle('medicines')} onClick={() => setActiveTab('medicines')}>
          <i className="bi bi-capsule" /> Medicines
        </button>
        <button type="button" style={tabStyle('history')} onClick={() => setActiveTab('history')}>
          <i className="bi bi-clock-history" /> Visit History
        </button>
      </div>

      {/* ── Profile tab ── */}
      {activeTab === 'profile' && (
        <div>
          {profileLoading && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <Skeleton width="100%" height="80px" variant="rectangular" />
              <Skeleton width="60%" height="16px" />
              <Skeleton width="40%" height="16px" />
            </div>
          )}
          {profileError && (
            <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`}>
              <i className="bi bi-exclamation-circle-fill" /> {profileError}
            </div>
          )}
          {!profileLoading && profile && (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {/* Pet identity */}
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {profile.imageUrl ? (
                  <img src={profile.imageUrl} alt={profile.name} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e4e7ec' }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(13,154,255,0.1)', color: 'var(--color-primary, #0d9aff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
                    <i className="bi bi-heart-fill" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{profile.name}</h3>
                  {profile.petType && (
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {profile.petType.name}{profile.breed ? ` · ${profile.breed.name}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                {[
                  { label: 'Gender', value: profile.gender },
                  { label: 'Age', value: profile.age },
                  { label: 'Size', value: profile.size },
                  { label: 'Weight', value: profile.weight ? `${profile.weight} kg` : undefined },
                  { label: 'Birthdate', value: formatDate(profile.birthdate) },
                ].map(({ label, value }) => value ? (
                  <div key={label} className={styles.detailRow} style={{ marginBottom: 0 }}>
                    <label>{label}</label>
                    <span style={{ textTransform: 'capitalize' }}>{value}</span>
                  </div>
                ) : null)}
              </div>

              {profile.notes && (
                <div className={styles.detailRow} style={{ marginBottom: 0 }}>
                  <label>Notes</label>
                  <span>{profile.notes}</span>
                </div>
              )}

              {/* Owner card */}
              {profile.owner && (
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.5rem' }}>Owner</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {profile.owner.firstName} {profile.owner.lastName}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{profile.owner.phoneNumber}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Medicines tab ── */}
      {activeTab === 'medicines' && (
        <div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {(['', 'vaccine', 'medicine', 'other'] as const).map((cat) => (
              <button
                key={cat || 'all'}
                type="button"
                onClick={() => setMedicineCategory(cat)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: medicineCategory === cat ? 'var(--color-primary, #0d9aff)' : '#d1d5db',
                  background: medicineCategory === cat ? 'rgba(13,154,255,0.08)' : '#fff',
                  color: medicineCategory === cat ? 'var(--color-primary, #0d9aff)' : '#374151',
                  fontSize: '0.8rem',
                  fontWeight: medicineCategory === cat ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {cat === '' ? 'All' : MEDICINE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {medicinesLoading && (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="64px" variant="rectangular" />)}
            </div>
          )}
          {medicinesError && (
            <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`}>
              <i className="bi bi-exclamation-circle-fill" /> {medicinesError}
            </div>
          )}
          {!medicinesLoading && medicines.length === 0 && !medicinesError && (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>No records found.</p>
          )}
          {!medicinesLoading && medicines.length > 0 && (
            <div style={{ display: 'grid', gap: '0.625rem' }}>
              {medicines.map((med) => {
                const cat = med.category;
                const colors = MEDICINE_CATEGORY_COLORS[cat] ?? MEDICINE_CATEGORY_COLORS.other;
                return (
                  <div key={med.id} style={{ border: '1px solid #e4e7ec', borderRadius: '0.625rem', padding: '0.875rem 1rem', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: colors.bg, color: colors.color, flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.1rem' }}>
                        {MEDICINE_CATEGORY_LABELS[cat] ?? cat}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.2rem', fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{med.name}</p>
                        {med.dosageSchedule && (
                          <p style={{ margin: '0 0 0.2rem', fontSize: '0.78rem', color: '#6b7280' }}>
                            {[med.dosageSchedule.amount, med.dosageSchedule.unit, med.dosageSchedule.frequencyLabel].filter(Boolean).join(' ')}
                          </p>
                        )}
                        {(med.batchNumber || med.lotNumber) && (
                          <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                            {med.batchNumber ? `Batch: ${med.batchNumber}` : ''}
                            {med.batchNumber && med.lotNumber ? ' · ' : ''}
                            {med.lotNumber ? `Lot: ${med.lotNumber}` : ''}
                          </p>
                        )}
                        {med.startDate && (
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                            {formatDate(med.startDate)}
                            {med.isActive ? <span style={{ marginLeft: '0.4rem', color: '#15803d' }}>· Active</span> : ''}
                          </p>
                        )}
                        {med.notes && <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#374151' }}>{med.notes}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Visit History tab ── */}
      {activeTab === 'history' && (
        <div>
          {historyLoading && (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="64px" variant="rectangular" />)}
            </div>
          )}
          {historyError && (
            <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`}>
              <i className="bi bi-exclamation-circle-fill" /> {historyError}
            </div>
          )}
          {!historyLoading && history.length === 0 && !historyError && (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>No visit history found.</p>
          )}
          {!historyLoading && history.length > 0 && (
            <div style={{ display: 'grid', gap: '0.625rem' }}>
              {history.map((appt) => (
                <div key={appt.id} style={{ border: '1px solid #e4e7ec', borderRadius: '0.625rem', padding: '0.875rem 1rem', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: '0 0 0.15rem', fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                        {formatDateTime(appt.scheduledAt)}
                      </p>
                      {appt.doctor && (() => {
                        const fullStaff = staffDirectory.get(String(appt.doctor.id));
                        const roleName = fullStaff?.role?.name ?? appt.doctor.role?.name;
                        return (
                          <p style={{ margin: '0 0 0.15rem', fontSize: '0.78rem', color: '#6b7280' }}>
                            {honorificFor(fullStaff ?? appt.doctor)}{appt.doctor.firstName} {appt.doctor.lastName}
                            {roleName ? ` · ${roleName}` : ''}
                          </p>
                        );
                      })()}
                      {(appt.services ?? []).length > 0 && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                          {(appt.services ?? []).map((s) => s.name ?? `#${s.clinicServiceId}`).join(', ')}
                        </p>
                      )}
                    </div>
                    {Number(appt.totalCost) > 0 && (
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827', flexShrink: 0 }}>
                        EGP {Number(appt.totalCost).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" disabled={historyPage === 1} onClick={() => setHistoryPage((p) => p - 1)}
                style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: historyPage === 1 ? 'not-allowed' : 'pointer', color: historyPage === 1 ? '#9ca3af' : '#374151', fontSize: '0.8rem' }}>
                ‹ Prev
              </button>
              <span style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                {historyPage} / {historyTotalPages}
              </span>
              <button type="button" disabled={historyPage === historyTotalPages} onClick={() => setHistoryPage((p) => p + 1)}
                style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: historyPage === historyTotalPages ? 'not-allowed' : 'pointer', color: historyPage === historyTotalPages ? '#9ca3af' : '#374151', fontSize: '0.8rem' }}>
                Next ›
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
