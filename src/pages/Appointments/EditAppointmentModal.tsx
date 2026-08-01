import { useEffect, useState } from 'react';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicPatientsService from '../../services/clinic/clinicPatientsService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { honorificFor } from '../../utils/staffRoles';
import {
  fmt,
  getBranchHoursForDate,
  getSlotsForDate,
  isTimeWithinBranchHours,
  normalizeAppointmentServices,
  normalizeBranchServices,
} from '../../utils/appointmentSlots';
import type { Appointment, ClinicBranch, ClinicStaff, PetSummary } from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import styles from './Appointments.module.scss';

interface EditAppointmentModalProps {
  appointment: Appointment;
  clinicId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Appointment) => void;
}

// Runs the appointment's own services through the same id-normalization the branch
// catalog gets, so a pre-existing selection reliably matches validServices' (also
// normalized) ids below — otherwise a field-naming mismatch leaves a service that
// really was booked showing as unchecked, and only a "changed" service gets saved.
function initialServiceIds(appointment: Appointment): Set<number> {
  return new Set(normalizeAppointmentServices(appointment.services).map((s) => s.clinicServiceId));
}

function splitScheduledAt(scheduledAt: string): { date: string; time: string } {
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function EditAppointmentModal({
  appointment, clinicId, isOpen, onClose, onSaved,
}: EditAppointmentModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [branchDetail, setBranchDetail] = useState<ClinicBranch | null>(null);
  const [staffPool, setStaffPool] = useState<ClinicStaff[]>([]);
  const [patientPets, setPatientPets] = useState<PetSummary[] | null>(null);

  const initial = splitScheduledAt(appointment.scheduledAt);
  const [selectedDoctor, setSelectedDoctor] = useState(String(appointment.clinicStaffId));
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [manualTime, setManualTime] = useState(initial.time);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<number>>(
    initialServiceIds(appointment),
  );
  const [notes, setNotes] = useState(appointment.notes ?? '');
  const [petId, setPetId] = useState(appointment.petId != null ? String(appointment.petId) : '');
  const [contactName, setContactName] = useState(appointment.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(appointment.contactPhone ?? '');
  const [contactAddress, setContactAddress] = useState(appointment.contactAddress ?? '');

  const isVisitor = !appointment.userId;

  // Reset to the appointment's current values and fetch the branch's staff/services
  // (and the patient's shared pets, for a registered user) fresh every time the modal
  // opens — the appointment may have been edited elsewhere since it was last loaded.
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flags loading, resets the form, then fetches
    setLoading(true);
    setLoadError('');
    setSaveError('');
    const split = splitScheduledAt(appointment.scheduledAt);
    setSelectedDoctor(String(appointment.clinicStaffId));
    setSelectedDate(split.date);
    setSelectedSlot('');
    setManualTime(split.time);
    setSelectedServiceIds(initialServiceIds(appointment));
    setNotes(appointment.notes ?? '');
    setPetId(appointment.petId != null ? String(appointment.petId) : '');
    setContactName(appointment.contactName ?? '');
    setContactPhone(appointment.contactPhone ?? '');
    setContactAddress(appointment.contactAddress ?? '');
    setPatientPets(null);

    Promise.all([
      clinicBranchesService.getOne(clinicId, String(appointment.clinicBranchId)),
      clinicStaffService.list({ page: 1, limit: 100, clinicBranchId: appointment.clinicBranchId }),
      appointment.userId
        ? clinicPatientsService.getClinicProfile(appointment.userId, clinicId).then((p) => p.pets).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([branch, staff, pets]) => {
        setBranchDetail(branch);
        setStaffPool(staff.items);
        setPatientPets(pets);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load appointment details.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only needs to re-run when the modal opens for a (possibly different) appointment, not on every appointment object identity change
  }, [isOpen, appointment.id]);

  // Clear the time selection when either the doctor or date changes — a slot picked
  // for the old doctor/day isn't necessarily valid for the new one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSlot('');
  }, [selectedDoctor, selectedDate]);

  const doctorObj = staffPool.find((d) => String(d.id) === selectedDoctor);
  const finalTime = selectedSlot || manualTime;
  const branchDayHours = getBranchHoursForDate(branchDetail?.workingHours, selectedDate);
  const slots = doctorObj ? getSlotsForDate(doctorObj, selectedDate, branchDetail?.workingHours) : null;
  const manualTimeInvalid = !!manualTime && !selectedSlot && !isTimeWithinBranchHours(manualTime, branchDayHours);
  const validServices = normalizeBranchServices(branchDetail?.services);

  function toggleService(id: number) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function canSave(): boolean {
    if (!selectedDoctor || !finalTime) return false;
    if (!selectedSlot && manualTimeInvalid) return false;
    if (selectedServiceIds.size === 0) return false;
    if (isVisitor && !contactName.trim()) return false;
    return true;
  }

  async function handleSave() {
    if (!canSave()) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await clinicAppointmentService.update(appointment.id, {
        clinicStaffId: Number(selectedDoctor),
        clinicServiceIds: Array.from(selectedServiceIds).filter((id) => Number.isInteger(id) && id > 0),
        scheduledAt: new Date(`${selectedDate}T${finalTime}:00`).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notes: notes.trim() || undefined,
        ...(patientPets ? { petId: petId ? Number(petId) : undefined } : {}),
        ...(isVisitor ? {
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim() || undefined,
          contactAddress: contactAddress.trim() || undefined,
        } : {}),
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Appointment"
      size="large"
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving || loading || !canSave()}>
            Save Changes
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
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {saveError && (
            <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
              <i className="bi bi-exclamation-circle-fill" /> {saveError}
            </div>
          )}

          {/* ── Doctor & date ── */}
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className={styles.fieldLabel}>Staff <span style={{ color: '#e74c3c' }}>*</span></label>
              <select
                className={styles.filterSelect}
                style={{ width: '100%' }}
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
              >
                {staffPool.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {honorificFor(s)}{s.firstName} {s.lastName}{s.role ? ` — ${s.role.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.fieldLabel}>Date <span style={{ color: '#e74c3c' }}>*</span></label>
              <input
                type="date"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* ── Time ── */}
          <div>
            <label className={styles.fieldLabel}>Time <span style={{ color: '#e74c3c' }}>*</span></label>
            {slots !== null && slots.length > 0 && (
              <div className={styles.slotGrid}>
                {slots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`${styles.slotBtn} ${finalTime === slot ? styles.slotBtnSelected : ''}`}
                    onClick={() => { setSelectedSlot(slot); setManualTime(slot); }}
                  >
                    {fmt(slot)}
                  </button>
                ))}
              </div>
            )}
            {slots !== null && slots.length === 0 && (
              <p className={styles.doctorOffLabel}>
                <i className="bi bi-calendar-x" /> This staff member isn't working this day.
              </p>
            )}
            {slots === null && (
              branchDayHours === 'closed' ? (
                <p className={styles.doctorOffLabel}>
                  <i className="bi bi-calendar-x" /> Branch is closed this day — no time can be booked.
                </p>
              ) : (
                <div className={styles.manualTimeWrap}>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={manualTime}
                    onChange={(e) => { setManualTime(e.target.value); setSelectedSlot(''); }}
                  />
                  {manualTimeInvalid && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#e74c3c', width: '100%' }}>
                      <i className="bi bi-exclamation-circle" /> Outside branch hours — this time can't be booked.
                    </p>
                  )}
                </div>
              )
            )}
          </div>

          {/* ── Pet (registered patients) / contact info (visitors) ── */}
          {!isVisitor && patientPets && patientPets.length > 0 && (
            <div>
              <label className={styles.fieldLabel}>Pet</label>
              <select
                className={styles.filterSelect}
                style={{ width: '100%' }}
                value={petId}
                onChange={(e) => setPetId(e.target.value)}
              >
                <option value="">No pet on file</option>
                {patientPets.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {isVisitor && (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label className={styles.fieldLabel}>Contact Name <span style={{ color: '#e74c3c' }}>*</span></label>
                <input
                  type="text"
                  className={styles.textInput}
                  style={{ width: '100%' }}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div>
                <label className={styles.fieldLabel}>Contact Phone</label>
                <input
                  type="tel"
                  className={styles.textInput}
                  style={{ width: '100%' }}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className={styles.fieldLabel}>Contact Address</label>
                <input
                  type="text"
                  className={styles.textInput}
                  style={{ width: '100%' }}
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── Services ── */}
          <div>
            <label className={styles.fieldLabel}>Services <span style={{ color: '#e74c3c' }}>*</span></label>
            {validServices.length === 0 ? (
              <div className="alert alert-info py-2" style={{ fontSize: '0.875rem' }}>
                <i className="bi bi-info-circle" /> This branch has no services configured.
              </div>
            ) : (
              <div className={styles.serviceCheckList}>
                {validServices.map((s) => {
                  const checked = selectedServiceIds.has(s.clinicServiceId);
                  return (
                    <label key={s.clinicServiceId} className={`${styles.serviceCheckItem} ${checked ? styles.checked : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleService(s.clinicServiceId)} />
                      <span className={styles.serviceCheckName}>{s.name ?? `Service #${s.clinicServiceId}`}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div>
            <label className={styles.fieldLabel}>Notes</label>
            <textarea
              className={styles.textInput}
              style={{ width: '100%', resize: 'vertical', minHeight: '80px' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
