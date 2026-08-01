import { useEffect, useState } from 'react';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import type { Appointment, AppointmentCancellationReason } from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import styles from './Appointments.module.scss';

interface CancelAppointmentModalProps {
  appointmentId: string | number;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: (updated: Appointment) => void;
}

export default function CancelAppointmentModal({
  appointmentId, isOpen, onClose, onCancelled,
}: CancelAppointmentModalProps) {
  const [reasons, setReasons] = useState<AppointmentCancellationReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Reset and fetch fresh every time the modal opens for a (possibly different) appointment.
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flags loading, resets the form, then fetches
    setLoading(true);
    setLoadError('');
    setSubmitError('');
    setSelectedReasonId(null);
    setReasonText('');
    clinicAppointmentService.listCancellationReasons()
      .then(setReasons)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load cancellation reasons.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  function selectReason(reason: AppointmentCancellationReason) {
    setSelectedReasonId(reason.id);
    setReasonText(reason.description);
  }

  async function handleConfirm() {
    if (!selectedReasonId) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const updated = await clinicAppointmentService.cancel(appointmentId, {
        appointmentCancellationReasonId: selectedReasonId,
        reason: reasonText.trim() || undefined,
      });
      onCancelled(updated);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to cancel appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Appointment"
      size="medium"
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Back
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={submitting}
            disabled={submitting || loading || !selectedReasonId}
          >
            Confirm Cancellation
          </Button>
        </>
      )}
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <PawLoader size="medium" />
        </div>
      ) : loadError ? (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {loadError}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {submitError && (
            <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
              <i className="bi bi-exclamation-circle-fill" /> {submitError}
            </div>
          )}

          <div>
            <label className={styles.fieldLabel}>
              Reason for cancellation <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            {reasons.length === 0 ? (
              <p className={styles.noData}>No predefined reasons are configured for this clinic.</p>
            ) : (
              <div className={styles.serviceCheckList}>
                {reasons.map((r) => {
                  const checked = selectedReasonId === r.id;
                  return (
                    <label
                      key={r.id}
                      className={`${styles.serviceCheckItem} ${checked ? styles.checked : ''}`}
                    >
                      <input
                        type="radio"
                        name="cancellationReason"
                        checked={checked}
                        onChange={() => selectReason(r)}
                      />
                      <span className={styles.serviceCheckName}>{r.title}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className={styles.fieldLabel}>Message to the client</label>
            <textarea
              className={styles.textInput}
              style={{ width: '100%', resize: 'vertical', minHeight: '90px' }}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Select a reason above to load its default message, then edit it if needed"
              disabled={!selectedReasonId}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
