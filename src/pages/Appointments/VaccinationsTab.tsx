import { useEffect, useState } from 'react';
import clinicVaccinationService from '../../services/clinic/clinicVaccinationService';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import { honorificFor } from '../../utils/staffRoles';
import type { ClinicStaff, Vaccination, VaccinationListStatus, VaccinationPlan } from '../../types/clinic.types';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import VaccinationPlanFormModal from './VaccinationPlanFormModal';
import VaccinationDoseModal from './VaccinationDoseModal';
import styles from './Appointments.module.scss';

interface VaccinationsTabProps {
  petId: number;
  clinicId: string;
  branchId?: string;
  staffDirectory: Map<string, ClinicStaff>;
}

const STATUS_FILTERS: Array<{ value: '' | VaccinationListStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  completed: { bg: '#dcfce7', color: '#15803d' },
  upcoming: { bg: '#e0f2fe', color: '#0369a1' },
  overdue: { bg: '#fee2e2', color: '#b91c1c' },
  done: { bg: '#dcfce7', color: '#15803d' },
  pending: { bg: '#e0f2fe', color: '#0369a1' },
  missed: { bg: '#f3f4f6', color: '#374151' },
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid #e4e7ec',
    background: '#fff',
    color,
    cursor: 'pointer',
    fontSize: '0.85rem',
    flexShrink: 0,
  };
}

// Strips a constructed dose title like "Rabies (2/5)" down to the series name, for use
// in the delete-series confirmation copy.
function seriesLabel(doseTitle: string): string {
  return doseTitle.replace(/\s*\(\d+\/\d+\)\s*$/, '');
}

type ConfirmTarget = { type: 'occurrence' | 'plan'; id: number; label: string };

export default function VaccinationsTab({ petId, clinicId, branchId, staffDirectory }: VaccinationsTabProps) {
  const { staff: authStaff } = useClinicAuth();
  const canCreate = hasClinicPermission(authStaff, 'vaccinations.create');
  const canUpdate = hasClinicPermission(authStaff, 'vaccinations.update');
  const canDelete = hasClinicPermission(authStaff, 'vaccinations.delete');

  const [occurrences, setOccurrences] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | VaccinationListStatus>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [planModal, setPlanModal] = useState<{ mode: 'create' | 'edit'; plan?: VaccinationPlan } | null>(null);
  const [doseModal, setDoseModal] = useState<Vaccination | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [actionError, setActionError] = useState('');

  function refetch() {
    setLoading(true);
    setError('');
    clinicVaccinationService.listForPet(petId, { clinicId, search: search || undefined, status: statusFilter || undefined })
      .then(setOccurrences)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load vaccinations.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flag loading, then fetch
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch closes over petId/clinicId/statusFilter/search, all already listed below
  }, [petId, clinicId, statusFilter, search]);

  function commitSearch() {
    setSearch(searchInput.trim());
  }

  async function handleConfirmedDelete() {
    if (!confirmTarget) return;
    setActionError('');
    try {
      if (confirmTarget.type === 'occurrence') {
        await clinicVaccinationService.deleteOccurrence(confirmTarget.id);
      } else {
        await clinicVaccinationService.deletePlan(confirmTarget.id);
      }
      setConfirmTarget(null);
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete.');
      setConfirmTarget(null);
    }
  }

  async function handleMarkDone(occ: Vaccination) {
    setActionError('');
    try {
      await clinicVaccinationService.updateOccurrence(occ.id, { status: 'done' });
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark this dose as done.');
    }
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: statusFilter === f.value ? 'var(--color-primary, #0d9aff)' : '#d1d5db',
                background: statusFilter === f.value ? 'rgba(13,154,255,0.08)' : '#fff',
                color: statusFilter === f.value ? 'var(--color-primary, #0d9aff)' : '#374151',
                fontSize: '0.8rem',
                fontWeight: statusFilter === f.value ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Button
            variant="primary"
            size="small"
            icon="bi-plus-lg"
            onClick={() => setPlanModal({ mode: 'create' })}
            disabled={!branchId}
            title={branchId ? undefined : 'No branch context available for this pet.'}
          >
            New Plan
          </Button>
        )}
      </div>

      <input
        type="text"
        placeholder="Search by name, type, or doctor…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commitSearch(); }}
        onBlur={commitSearch}
        style={{ width: '100%', padding: '0.45rem 0.75rem', border: '1px solid #dee2e6', borderRadius: '0.4rem', fontSize: '0.85rem', marginBottom: '1rem' }}
      />

      {actionError && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {actionError}
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="84px" variant="rectangular" />)}
        </div>
      )}
      {!loading && error && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error}
        </div>
      )}
      {!loading && !error && occurrences.length === 0 && (
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>No vaccination records found.</p>
      )}

      {!loading && !error && occurrences.length > 0 && (
        <div style={{ display: 'grid', gap: '0.625rem' }}>
          {occurrences.map((occ) => {
            const plan = occ.plan;
            const isOwnClinic = String(plan?.clinicId ?? occ.clinicId) === String(clinicId);
            const isPending = occ.status === 'pending';
            const chip = STATUS_COLORS[occ.listStatus ?? occ.status] ?? STATUS_COLORS.pending;
            const doctor = plan?.clinicStaffId != null ? staffDirectory.get(String(plan.clinicStaffId)) : undefined;

            return (
              <div key={occ.id} style={{ border: '1px solid #e4e7ec', borderRadius: '0.625rem', padding: '0.875rem 1rem', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{occ.title}</p>
                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: chip.bg, color: chip.color, textTransform: 'capitalize' }}>
                        {occ.listStatus ?? occ.status}
                      </span>
                      {!isOwnClinic && (
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
                          Other clinic
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                      {formatDate(occ.date)}
                      {doctor && ` · ${honorificFor(doctor)}${doctor.firstName} ${doctor.lastName}`}
                    </p>
                    {occ.clinicNotes && <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#374151' }}>{occ.clinicNotes}</p>}
                    {occ.doseInfo && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Dose: {occ.doseInfo}</p>}
                    {occ.petOwnerNotes && <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#6b7280', fontStyle: 'italic' }}>Owner: {occ.petOwnerNotes}</p>}
                  </div>

                  {isOwnClinic && (canUpdate || canDelete) && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {canUpdate && isPending && (
                        <button type="button" onClick={() => handleMarkDone(occ)} style={iconBtnStyle('#15803d')} title="Mark as done">
                          <i className="bi bi-check-lg" />
                        </button>
                      )}
                      {canUpdate && (
                        <button type="button" onClick={() => setDoseModal(occ)} style={iconBtnStyle('#0d9aff')} title="Edit this dose">
                          <i className="bi bi-pencil" />
                        </button>
                      )}
                      {canUpdate && plan && (
                        <button type="button" onClick={() => setPlanModal({ mode: 'edit', plan })} style={iconBtnStyle('#6b7280')} title="Edit series">
                          <i className="bi bi-list-check" />
                        </button>
                      )}
                      {canDelete && isPending && (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ type: 'occurrence', id: Number(occ.id), label: `this dose of ${occ.title}` })}
                          style={iconBtnStyle('#e74c3c')}
                          title="Delete this dose"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      )}
                      {canDelete && plan && (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ type: 'plan', id: Number(plan.id), label: `the whole ${seriesLabel(occ.title)} series` })}
                          style={iconBtnStyle('#e74c3c')}
                          title="Delete series"
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {planModal && (
        <VaccinationPlanFormModal
          mode={planModal.mode}
          petId={petId}
          clinicId={clinicId}
          branchId={branchId}
          plan={planModal.plan}
          isOpen
          onClose={() => setPlanModal(null)}
          onSaved={refetch}
        />
      )}

      {doseModal && (
        <VaccinationDoseModal
          occurrence={doseModal}
          isOpen
          onClose={() => setDoseModal(null)}
          onSaved={refetch}
        />
      )}

      <Modal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title="Confirm Delete"
        size="small"
        footer={(
          <>
            <Button variant="outline" onClick={() => setConfirmTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmedDelete}>Delete</Button>
          </>
        )}
      >
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>
          Delete {confirmTarget?.label}? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
