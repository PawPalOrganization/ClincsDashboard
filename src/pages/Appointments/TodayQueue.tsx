import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import { canFinishAppointment } from '../../utils/appointmentTiming';
import { honorificFor } from '../../utils/staffRoles';
import { useClinicStaffDirectory } from '../../hooks/useClinicStaffDirectory';
import type { Appointment, ClinicBranch } from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import CancelAppointmentModal from './CancelAppointmentModal';
import styles from './Appointments.module.scss';

function formatTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function TodayQueue() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();
  const staffDirectory = useClinicStaffDirectory(clinicId);

  const canView = hasClinicPermission(authStaff, 'appointments.read');
  const canUpdate = hasClinicPermission(authStaff, 'appointments.update');
  const canCancel = hasClinicPermission(authStaff, 'appointments.cancel');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [cancelTargetId, setCancelTargetId] = useState<string | number | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100)
      .then((res) => {
        setBranches(res.items);
        if (res.items.length > 0) {
          setSelectedBranch(String(res.items[0].id));
        }
      })
      .catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    if (!selectedBranch) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flag loading, then fetch
    setLoading(true);
    setError('');
    clinicAppointmentService.getToday(selectedBranch)
      .then(setAppointments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load queue.'))
      .finally(() => setLoading(false));
  }, [selectedBranch]);

  async function handleFinish(id: string | number) {
    setActionError('');
    try {
      await clinicAppointmentService.finish(id);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'finished' as const } : a)),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to finish appointment.');
    }
  }

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account.</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Access restricted</h2>
        <p>Your role does not include permission to view appointments.</p>
      </div>
    );
  }

  const activeQueue = appointments.filter((a) => a.status === 'reserved');
  const done = appointments.filter((a) => a.status !== 'reserved');

  return (
    <div className={styles.page}>
      <CancelAppointmentModal
        appointmentId={cancelTargetId ?? ''}
        isOpen={cancelTargetId != null}
        onClose={() => setCancelTargetId(null)}
        onCancelled={(updated) => {
          setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          setCancelTargetId(null);
        }}
      />
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Today's Queue</h1>
          <p className={styles.pageSubtitle}>
            {activeQueue.length} active appointment{activeQueue.length !== 1 ? 's' : ''} today
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/appointments')}>
            All Appointments
          </Button>
        </div>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error}
        </div>
      )}

      {actionError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> {actionError}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading queue…</p>
      ) : (
        <>
          {activeQueue.length === 0 && done.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              No appointments scheduled today for this branch.
            </p>
          )}

          {activeQueue.length > 0 && (
            <>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                ACTIVE
              </p>
              <div className={styles.queueGrid}>
                {activeQueue.map((appt) => (
                  <div key={String(appt.id)} className={styles.queueCard}>
                    <div className={styles.queueOrder}>{appt.visitorOrder ?? '—'}</div>
                    <div className={styles.queueInfo}>
                      <strong>{appt.contactName ?? `User #${appt.userId ?? '?'}`}</strong>
                      <span>
                        {formatTime(appt.scheduledAt)}
                        {appt.doctor && ` · ${honorificFor(staffDirectory.get(String(appt.doctor.id)) ?? appt.doctor)}${appt.doctor.firstName} ${appt.doctor.lastName}`}
                        {appt.services.length > 0 && ` · ${appt.services.map((s) => s.name ?? `#${s.clinicServiceId}`).join(', ')}`}
                      </span>
                    </div>
                    {(canUpdate || canCancel) && (
                      <div className={styles.queueActions}>
                        {canUpdate && (
                          <button
                            type="button"
                            className={`${styles.queueActionBtn} ${styles.finish}`}
                            onClick={() => handleFinish(appt.id)}
                            disabled={!canFinishAppointment(appt.scheduledAt)}
                            title={canFinishAppointment(appt.scheduledAt) ? undefined : 'Available starting 1 hour before the scheduled time'}
                          >
                            <i className="bi bi-check-lg" /> Finish
                          </button>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            className={`${styles.queueActionBtn} ${styles.cancel}`}
                            onClick={() => setCancelTargetId(appt.id)}
                          >
                            <i className="bi bi-x-lg" /> Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {done.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                COMPLETED
              </p>
              <div className={styles.queueGrid}>
                {done.map((appt) => (
                  <div
                    key={String(appt.id)}
                    className={styles.queueCard}
                    style={{ opacity: 0.6 }}
                    onClick={() => navigate(`/appointments/${appt.id}`)}
                  >
                    <div className={styles.queueOrder} style={{ opacity: 0.5 }}>
                      {appt.visitorOrder ?? '—'}
                    </div>
                    <div className={styles.queueInfo}>
                      <strong>{appt.contactName ?? `User #${appt.userId ?? '?'}`}</strong>
                      <span>
                        {formatTime(appt.scheduledAt)} · {appt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
