import { useEffect, useState } from 'react';
import clinicVaccinationService from '../../services/clinic/clinicVaccinationService';
import type {
  CreateVaccinationPlanPayload,
  UpdateVaccinationPlanPayload,
  VaccinationPlan,
  VaccinationRecurrenceType,
  VaccinationType,
} from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import styles from './Appointments.module.scss';

interface VaccinationPlanFormModalProps {
  mode: 'create' | 'edit';
  petId: number;
  clinicId: string;
  branchId?: string;
  plan?: VaccinationPlan;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const RECURRENCE_OPTIONS: Array<{ value: VaccinationRecurrenceType; label: string }> = [
  { value: 'one_time', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
];

export default function VaccinationPlanFormModal({
  mode, petId, clinicId, branchId, plan, isOpen, onClose, onSaved,
}: VaccinationPlanFormModalProps) {
  const [types, setTypes] = useState<VaccinationType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState('');

  const [vaccinationTypeId, setVaccinationTypeId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<VaccinationRecurrenceType>('one_time');
  const [recurrenceCount, setRecurrenceCount] = useState('1');
  const [date, setDate] = useState('');
  const [shouldBeNotified, setShouldBeNotified] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset to the target plan's current values (or blank, for create) every time the
  // modal opens, and load the type catalog fresh — create-only, since edit can't change it.
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: resets the form, then fetches the type catalog
    setError('');
    setVaccinationTypeId(plan ? String(plan.vaccinationTypeId) : '');
    setTitle(plan?.title ?? '');
    setNotes(plan?.notes ?? '');
    setRecurrenceType(plan?.recurrenceType ?? 'one_time');
    setRecurrenceCount(String(plan?.recurrenceCount ?? 1));
    setDate('');
    setShouldBeNotified(true);

    if (mode === 'create') {
      setTypesLoading(true);
      setTypesError('');
      clinicVaccinationService.listTypes({ limit: 100 })
        .then((res) => setTypes(res.items))
        .catch((err) => setTypesError(err instanceof Error ? err.message : 'Failed to load vaccination types.'))
        .finally(() => setTypesLoading(false));
    }
  }, [isOpen, mode, plan]);

  function canSave(): boolean {
    if (mode === 'create' && (!vaccinationTypeId || !date || !branchId)) return false;
    if (recurrenceType !== 'one_time') {
      const count = parseInt(recurrenceCount, 10);
      if (!Number.isInteger(count) || count < 1 || count > 24) return false;
    }
    return true;
  }

  async function handleSave() {
    if (!canSave()) return;
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        if (!branchId) throw new Error('This pet has no branch context to create a vaccination plan against.');
        const payload: CreateVaccinationPlanPayload = {
          vaccinationTypeId: Number(vaccinationTypeId),
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          clinicBranchId: Number(branchId),
          clinicId: Number(clinicId),
          recurrenceType,
          recurrenceCount: recurrenceType === 'one_time' ? 1 : parseInt(recurrenceCount, 10),
          date,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          shouldBeNotified,
        };
        await clinicVaccinationService.createPlan(petId, payload);
      } else if (plan) {
        const payload: UpdateVaccinationPlanPayload = {
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          recurrenceType,
          recurrenceCount: recurrenceType === 'one_time' ? 1 : parseInt(recurrenceCount, 10),
        };
        await clinicVaccinationService.updatePlan(plan.id, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the vaccination plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New Vaccination Plan' : 'Edit Vaccination Series'}
      size="medium"
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving || !canSave()}>
            {mode === 'create' ? 'Create Plan' : 'Save Changes'}
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

        {mode === 'create' && (
          <div>
            <label className={styles.fieldLabel}>
              Vaccination Type <span style={{ color: '#e74c3c' }}>*</span>
            </label>
            {typesLoading ? (
              <p className={styles.fieldHint}><i className="bi bi-arrow-repeat" /> Loading catalog…</p>
            ) : typesError ? (
              <p className={styles.fieldHint} style={{ color: '#e74c3c' }}>{typesError}</p>
            ) : (
              <select
                className={styles.filterSelect}
                style={{ width: '100%' }}
                value={vaccinationTypeId}
                onChange={(e) => setVaccinationTypeId(e.target.value)}
                disabled={saving}
              >
                <option value="">Select a type…</option>
                {types.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label className={styles.fieldLabel}>Title</label>
          <input
            type="text"
            className={styles.textInput}
            style={{ width: '100%' }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to the vaccine type name"
            disabled={saving}
          />
        </div>

        <div>
          <label className={styles.fieldLabel}>Series notes</label>
          <textarea
            className={styles.textInput}
            style={{ width: '100%', resize: 'vertical', minHeight: '70px' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: recurrenceType === 'one_time' ? '1fr' : '1fr 1fr' }}>
          <div>
            <label className={styles.fieldLabel}>Recurrence</label>
            <select
              className={styles.filterSelect}
              style={{ width: '100%' }}
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value as VaccinationRecurrenceType)}
              disabled={saving}
            >
              {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {recurrenceType !== 'one_time' && (
            <div>
              <label className={styles.fieldLabel}>Number of doses (1–24)</label>
              <input
                type="number"
                className={styles.textInput}
                style={{ width: '100%' }}
                min={1}
                max={24}
                value={recurrenceCount}
                onChange={(e) => setRecurrenceCount(e.target.value)}
                disabled={saving}
              />
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <p className={styles.fieldHint}>
            <i className="bi bi-info-circle" /> Changing recurrence is blocked once any dose in this series has been marked done.
          </p>
        )}

        {mode === 'create' && (
          <>
            <div>
              <label className={styles.fieldLabel}>
                First dose date <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <input
                type="date"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
              />
              <p className={styles.fieldHint}>
                Today or an earlier date logs the first dose as already given; a future date schedules it as pending.
              </p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={shouldBeNotified}
                onChange={(e) => setShouldBeNotified(e.target.checked)}
                disabled={saving}
              />
              Remind the pet owner before this dose is due
            </label>

            {!branchId && (
              <p className={styles.fieldHint} style={{ color: '#e74c3c' }}>
                <i className="bi bi-exclamation-circle-fill" /> No branch context available — open this pet from an appointment to create a vaccination plan.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
