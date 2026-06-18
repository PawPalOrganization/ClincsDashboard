import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type { Appointment, AppointmentStatus } from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import styles from './Appointments.module.scss';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cls =
    status === 'reserved'
      ? styles.statusReserved
      : status === 'finished'
        ? styles.statusFinished
        : styles.statusCancelled;
  const icon =
    status === 'reserved' ? 'bi-clock' : status === 'finished' ? 'bi-check-circle' : 'bi-x-circle';
  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <i className={`bi ${icon}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AppointmentDetail() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const successMsg = (location.state as { successMsg?: string } | null)?.successMsg ?? '';

  const canView = hasClinicPermission(authStaff, 'appointments.read');
  const canUpdate = hasClinicPermission(authStaff, 'appointments.update');
  const canCancel = hasClinicPermission(authStaff, 'appointments.cancel');

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!id || !canView) { setLoading(false); return; }
    clinicAppointmentService.getOne(id)
      .then(setAppointment)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load appointment.'))
      .finally(() => setLoading(false));
  }, [id, canView]);

  async function handleFinish() {
    if (!id) return;
    setActing(true);
    setActionError('');
    try {
      const updated = await clinicAppointmentService.finish(id);
      setAppointment(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to finish appointment.');
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    if (!id) return;
    setActing(true);
    setActionError('');
    try {
      const updated = await clinicAppointmentService.cancel(id);
      setAppointment(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel appointment.');
    } finally {
      setActing(false);
    }
  }

  if (!clinicId || !id) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>Appointment not found.</p>
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          {loading ? (
            <>
              <Skeleton width="200px" height="26px" />
              <div style={{ marginTop: '6px' }}><Skeleton width="140px" height="14px" /></div>
            </>
          ) : (
            <>
              <h1 className={styles.pageTitle}>
                Appointment #{appointment?.id ?? id}
              </h1>
              <p className={styles.pageSubtitle}>
                {appointment ? formatDateTime(appointment.scheduledAt) : ''}
              </p>
            </>
          )}
        </div>
        <Button
          variant="outline"
          icon="bi-arrow-left"
          onClick={() => navigate('/appointments')}
          disabled={acting}
        >
          Back
        </Button>
      </div>

      {successMsg && (
        <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-check-circle-fill" /> {successMsg}
        </div>
      )}

      {loadError && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {loadError}
        </div>
      )}

      {actionError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> {actionError}
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <Skeleton width="100%" height="160px" variant="rectangular" />
          <Skeleton width="100%" height="160px" variant="rectangular" />
        </div>
      )}

      {!loading && appointment && (
        <>
          <div className={styles.detailGrid}>
            {/* Patient */}
            <div className={styles.detailCard}>
              <p className={styles.detailCardTitle}>Patient</p>
              <div className={styles.detailRow}>
                <label>Name</label>
                <span>
                  {appointment.contactName
                    ?? (appointment.user ? `${appointment.user.firstName} ${appointment.user.lastName}` : null)
                    ?? (appointment.userId ? `User #${appointment.userId}` : '—')}
                </span>
              </div>
              {appointment.user?.phoneNumber && (
                <div className={styles.detailRow}>
                  <label>Phone</label>
                  <span>{appointment.user.phoneNumber}</span>
                </div>
              )}
              {appointment.contactPhone && !appointment.user?.phoneNumber && (
                <div className={styles.detailRow}>
                  <label>Phone</label>
                  <span>{appointment.contactPhone}</span>
                </div>
              )}
              {appointment.contactAddress && (
                <div className={styles.detailRow}>
                  <label>Address</label>
                  <span>{appointment.contactAddress}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <label>Queue #</label>
                <span>{appointment.visitorOrder ?? '—'}</span>
              </div>
            </div>

            {/* Doctor */}
            <div className={styles.detailCard}>
              <p className={styles.detailCardTitle}>Doctor</p>
              {appointment.doctor ? (
                <>
                  <div className={styles.detailRow}>
                    <label>Name</label>
                    <span>Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}</span>
                  </div>
                  {appointment.doctor.role && (
                    <div className={styles.detailRow}>
                      <label>Specialty</label>
                      <span>{appointment.doctor.role.name}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className={styles.noData}>No doctor assigned</span>
              )}
            </div>

            {/* Schedule */}
            <div className={styles.detailCard}>
              <p className={styles.detailCardTitle}>Schedule</p>
              <div className={styles.detailRow}>
                <label>Date & Time</label>
                <span>{formatDateTime(appointment.scheduledAt)}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Status</label>
                <span><StatusBadge status={appointment.status} /></span>
              </div>
              {appointment.cancellationReason && (
                <div className={styles.detailRow}>
                  <label>Cancellation reason</label>
                  <span>{appointment.cancellationReason}</span>
                </div>
              )}
              {appointment.notes && (
                <div className={styles.detailRow}>
                  <label>Notes</label>
                  <span>{appointment.notes}</span>
                </div>
              )}
            </div>

            {/* Services */}
            <div className={styles.detailCard}>
              <p className={styles.detailCardTitle}>Services & Cost</p>
              {appointment.services.length > 0 ? (
                <>
                  {appointment.services.map((s, i) => (
                    <div key={i} className={styles.serviceRow}>
                      <span className={styles.serviceName}>
                        {s.name ?? `Service #${s.clinicServiceId}`}
                      </span>
                      <span className={styles.serviceCost}>
                        {Number(s.cost) > 0
                          ? `EGP ${Number(s.cost).toFixed(2)}`
                          : <span className={styles.costIncluded}>included</span>}
                      </span>
                    </div>
                  ))}
                  <div className={styles.totalRow}>
                    <span>Total</span>
                    <span>
                      {Number(appointment.totalCost) > 0
                        ? `EGP ${Number(appointment.totalCost).toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </>
              ) : (
                <span className={styles.noData}>No services recorded</span>
              )}
            </div>
          </div>

          {(canUpdate || canCancel) && appointment.status === 'reserved' && (
            <div className={styles.detailActions}>
              {canUpdate && (
                <Button
                  variant="primary"
                  icon="bi-check-lg"
                  onClick={handleFinish}
                  disabled={acting}
                >
                  Mark as Finished
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  icon="bi-x-lg"
                  onClick={handleCancel}
                  disabled={acting}
                >
                  Cancel Appointment
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
