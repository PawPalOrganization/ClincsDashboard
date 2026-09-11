import { useEffect, useState } from 'react';
import clinicVaccinationService from '../../services/clinic/clinicVaccinationService';
import type { Vaccination } from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import styles from './Appointments.module.scss';

interface VaccinationDoseModalProps {
  occurrence: Vaccination;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInputValue(value: string): string {
  return value?.length >= 10 ? value.slice(0, 10) : (value ?? '');
}

export default function VaccinationDoseModal({
  occurrence, isOpen, onClose, onSaved,
}: VaccinationDoseModalProps) {
  const isPending = occurrence.status === 'pending';

  const [clinicNotes, setClinicNotes] = useState(occurrence.clinicNotes ?? '');
  const [doseInfo, setDoseInfo] = useState(occurrence.doseInfo ?? '');
  const [date, setDate] = useState(toDateInputValue(occurrence.date));
  const [markDone, setMarkDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset to this occurrence's current values every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: resets the form to the current occurrence
    setClinicNotes(occurrence.clinicNotes ?? '');
    setDoseInfo(occurrence.doseInfo ?? '');
    setDate(toDateInputValue(occurrence.date));
    setMarkDone(false);
    setError('');
  }, [isOpen, occurrence]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await clinicVaccinationService.updateOccurrence(occurrence.id, {
        clinicNotes: clinicNotes.trim() || undefined,
        doseInfo: doseInfo.trim() || undefined,
        ...(isPending ? { date } : {}),
        ...(markDone ? { status: 'done' as const } : {}),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={occurrence.title}
      size="medium"
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
            Save Changes
          </Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: '1rem' }}>
        {error && (
          <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
            <i className="bi bi-exclamation-circle-fill" /> {error}
          </div>
        )}

        <div className={styles.detailRow} style={{ marginBottom: 0 }}>
          <label>Status</label>
          <span style={{ textTransform: 'capitalize' }}>{occurrence.listStatus ?? occurrence.status}</span>
        </div>

        <div>
          <label className={styles.fieldLabel}>Dose date</label>
          <input
            type="date"
            className={styles.dateInput}
            style={{ width: '100%' }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving || !isPending}
          />
          {!isPending && (
            <p className={styles.fieldHint}>Only a pending dose's date can be moved.</p>
          )}
        </div>

        <div>
          <label className={styles.fieldLabel}>Clinic notes</label>
          <textarea
            className={styles.textInput}
            style={{ width: '100%', resize: 'vertical', minHeight: '70px' }}
            value={clinicNotes}
            onChange={(e) => setClinicNotes(e.target.value)}
            disabled={saving}
            placeholder="e.g. Given left hind, no reaction observed"
          />
        </div>

        <div>
          <label className={styles.fieldLabel}>Dose info</label>
          <input
            type="text"
            className={styles.textInput}
            style={{ width: '100%' }}
            value={doseInfo}
            onChange={(e) => setDoseInfo(e.target.value)}
            disabled={saving}
            placeholder="e.g. 1 ml"
          />
        </div>

        {occurrence.petOwnerNotes && (
          <div>
            <label className={styles.fieldLabel}>Owner notes (read-only)</label>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
              {occurrence.petOwnerNotes}
            </p>
          </div>
        )}

        {isPending && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={markDone}
              onChange={(e) => setMarkDone(e.target.checked)}
              disabled={saving}
            />
            Mark this dose as done
            {markDone ? ' — the next dose in the series will be scheduled automatically.' : ''}
          </label>
        )}
      </div>
    </Modal>
  );
}
