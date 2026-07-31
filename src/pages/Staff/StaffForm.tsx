import React, { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ReactNode } from 'react';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import clinicFilesService from '../../services/clinic/clinicFilesService';
import { ApiError } from '../../services/clinic/clinicApi';
import type {
  BranchWorkingHour,
  ClinicBranch,
  ClinicStaff,
  ClinicStaffRole,
  CreateClinicStaffPayload,
  UpdateClinicStaffPayload,
} from '../../types/clinic.types';
import styles from './Staff.module.scss';

type StaffFormPayload = CreateClinicStaffPayload | UpdateClinicStaffPayload;

interface StaffFormProps {
  mode: 'create' | 'edit';
  defaultValues?: ClinicStaff;
  branches: ClinicBranch[];
  roles: ClinicStaffRole[];
  saving: boolean;
  serverError: string;
  readOnly?: boolean;
  childrenBeforeSubmit?: ReactNode;
  onSubmit: (payload: StaffFormPayload) => Promise<void>;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  clinicBranchId?: string;
  yearsOfExperience?: string;
}

function dateInputValue(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface HourEntry {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function stripSeconds(t?: string): string {
  if (!t) return '';
  return t.length > 5 ? t.slice(0, 5) : t;
}

function buildHoursState(workingHours?: BranchWorkingHour[]): HourEntry[] {
  return (Array.from({ length: 7 }) as undefined[]).map((_, i) => {
    const day = i as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const found = workingHours?.find((h) => h.dayOfWeek === day);
    return {
      dayOfWeek: day,
      enabled: !!found,
      startTime: found ? stripSeconds(found.startTime) || '09:00' : '09:00',
      endTime:   found ? stripSeconds(found.endTime)   || '17:00' : '17:00',
    };
  });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

interface DayAvailability {
  startTime: string;
  endTime: string;
}

// Per day, the widest start-to-end window across the given branches — used as a hint
// (min/max on the time inputs) and to disable days no assigned branch is open, so
// staff can't set hours that will be rejected by the backend's own working-hours
// validation only after clicking save. A day missing from the map means none of the
// branches are open then. Returns null (no constraint) if none of the branches have
// any hours configured at all — same skip condition the backend itself applies.
function unionBranchHoursByDay(relevantBranches: ClinicBranch[]): Map<number, DayAvailability> | null {
  if (!relevantBranches.some((b) => b.workingHours?.length)) return null;

  const byDay = new Map<number, DayAvailability>();
  for (let dow = 0; dow <= 6; dow++) {
    let start: number | null = null;
    let end: number | null = null;
    for (const branch of relevantBranches) {
      const wh = branch.workingHours?.find((h) => h.dayOfWeek === dow);
      if (!wh) continue;
      const s = toMinutes(wh.startTime);
      const e = toMinutes(wh.endTime);
      start = start === null ? s : Math.min(start, s);
      end = end === null ? e : Math.max(end, e);
    }
    if (start !== null && end !== null) byDay.set(dow, { startTime: fromMinutes(start), endTime: fromMinutes(end) });
  }
  return byDay;
}

export default function StaffForm({
  mode,
  defaultValues,
  branches,
  roles,
  saving,
  serverError,
  readOnly = false,
  childrenBeforeSubmit,
  onSubmit,
}: StaffFormProps) {
  const fieldDisabled = saving || readOnly;
  const [imageUrl, setProfilePhoto_] = useState(defaultValues?.imageUrl ?? '');
  const [imgLoadError, setImgLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  function setProfilePhoto(val: string) { setProfilePhoto_(val); setImgLoadError(false); }

  async function handlePhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await clinicFilesService.upload(file);
      setProfilePhoto(uploaded.publicUrl);
    } catch (err) {
      setUploadError(
        err instanceof ApiError
          ? `Upload failed: ${err.message} (${err.status})`
          : 'Image upload failed. Try pasting a URL instead.',
      );
    } finally {
      setUploading(false);
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    }
  }
  const [firstName, setFirstName] = useState(defaultValues?.firstName ?? '');
  const [lastName, setLastName] = useState(defaultValues?.lastName ?? '');
  const [bio, setBio] = useState(defaultValues?.bio ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState(dateInputValue(defaultValues?.birthDate));
  const [gender, setGender] = useState(defaultValues?.gender ?? '');
  const [clinicBranchId, setClinicBranchId] = useState(
    defaultValues?.clinicBranchId != null ? String(defaultValues.clinicBranchId) : '',
  );
  const [roleId, setRoleId] = useState(
    defaultValues?.roleId != null ? String(defaultValues.roleId) : '',
  );
  const [yearsOfExperience, setYearsOfExperience] = useState(
    defaultValues?.yearsOfExperience != null ? String(defaultValues.yearsOfExperience) : '',
  );
  const [joinedAt, setJoinedAt] = useState(dateInputValue(defaultValues?.joinedAt));
  const [errors, setErrors] = useState<FormErrors>({});
  const [hoursError, setHoursError] = useState('');
  const [hours, setHours] = useState<HourEntry[]>(() => buildHoursState(defaultValues?.workingHours));

  // Create mode: just the single branch being picked below. Edit mode: whichever
  // branches this staff member is already assigned to (assignment itself happens on
  // a separate page) — cross-referenced against `branches` for full workingHours data,
  // since `defaultValues.branches` may only carry a partial nested record.
  const relevantBranches: ClinicBranch[] =
    mode === 'create'
      ? branches.filter((b) => String(b.id) === clinicBranchId)
      : branches.filter((b) => defaultValues?.branches?.some((ab) => String(ab.id) === String(b.id)));
  const dayAvailability = unionBranchHoursByDay(relevantBranches);

  function toggleDay(dayOfWeek: number) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, enabled: !h.enabled } : h)),
    );
  }

  function updateHour(dayOfWeek: number, field: 'startTime' | 'endTime', value: string) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h)),
    );
  }

  function clearError(name: keyof FormErrors) {
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validate(): boolean {
    const next: FormErrors = {};

    if (!firstName.trim()) next.firstName = 'First name is required.';
    if (!lastName.trim()) next.lastName = 'Last name is required.';
    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      next.email = 'Email is invalid.';
    }

    if (mode === 'create' && !password.trim()) {
      next.password = 'Password is required.';
    }

    if (mode === 'create' && !clinicBranchId) {
      next.clinicBranchId = 'Choose an initial branch.';
    }

    if (yearsOfExperience.trim()) {
      const years = Number(yearsOfExperience);
      if (!Number.isInteger(years) || years < 0) {
        next.yearsOfExperience = 'Enter a whole number of years.';
      }
    }

    setErrors(next);

    // Belt-and-suspenders on top of the checkbox being disabled for closed days below
    // — catches hours set before an assigned branch's schedule changed out from under
    // them, rather than only surfacing it via the backend's 400 after Save.
    setHoursError('');
    if (dayAvailability) {
      const badDay = hours.find((h) => h.enabled && !dayAvailability.has(h.dayOfWeek));
      if (badDay) {
        setHoursError(`${DAY_NAMES[badDay.dayOfWeek]} hours won't be accepted — no assigned branch is open that day.`);
        return false;
      }
    }

    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    const builtHours: BranchWorkingHour[] = hours
      .filter((h) => h.enabled)
      .map((h) => ({ dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime }));

    // `null` (not `undefined`) so an intentionally cleared photo is actually sent to the
    // backend — `JSON.stringify` drops `undefined` keys, which would silently leave the
    // previous imageUrl untouched server-side and reappear after the next refetch.
    const resolvedImageUrl = imageUrl.trim() || null;

    const shared = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      imageUrl: resolvedImageUrl,
      bio: bio.trim() || undefined,
      email: email.trim(),
      password: password.trim() || undefined,
      gender: gender ? (gender as 'male' | 'female' | 'other') : undefined,
      roleId: roleId || undefined,
      workingHours: builtHours.length > 0 ? builtHours : undefined,
    };

    const payload: StaffFormPayload =
      mode === 'create'
        ? {
            ...shared,
            password: password.trim(),
            clinicBranchId,
          }
        : {
            ...shared,
            birthDate: birthDate || undefined,
            yearsOfExperience: yearsOfExperience.trim()
              ? Number(yearsOfExperience)
              : undefined,
            joinedAt: joinedAt || undefined,
          };

    await onSubmit(payload);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {serverError}
        </div>
      )}

      {readOnly && (
        <div className={styles.readOnlyNotice}>
          <i className="bi bi-eye" />
          <span>Your role can view this profile, but cannot edit staff profile fields.</span>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-person" /> Profile
          </h2>
          <p className={styles.sectionDesc}>Core staff identity and contact information.</p>
        </div>

        {/* ── Profile Photo ── */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Profile Photo</label>
          <div className={styles.photoRow}>
            {imageUrl && !imgLoadError ? (
              <img
                src={imageUrl}
                alt="Profile"
                className={styles.photoPreview}
                onError={() => setImgLoadError(true)}
              />
            ) : (
              <div className={styles.photoPlaceholder}>
                {(firstName[0] ?? '?').toUpperCase()}{(lastName[0] ?? '').toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className={styles.photoUrlRow}>
                <input
                  type="text"
                  className={styles.selectInput}
                  placeholder="https://example.com/photo.jpg or upload below"
                  value={imageUrl}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                  disabled={fieldDisabled || uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  icon={uploading ? 'bi-arrow-repeat' : 'bi-upload'}
                  onClick={() => photoFileInputRef.current?.click()}
                  disabled={fieldDisabled || uploading}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </Button>
                <input
                  ref={photoFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoFileChange}
                />
              </div>

              {uploadError && (
                <p className={styles.photoHint}>
                  <i className="bi bi-exclamation-triangle-fill" /> {uploadError}
                </p>
              )}

              {imgLoadError && imageUrl && (
                <p className={styles.photoHint}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  Could not load image from this URL. Make sure it's a direct link to an image (ends in .jpg, .png, etc.).
                </p>
              )}

              {imageUrl && !fieldDisabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="small"
                  icon="bi-trash"
                  onClick={() => setProfilePhoto('')}
                >
                  Remove photo
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.twoCol}>
          <Input
            label="First Name"
            name="firstName"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              clearError('firstName');
            }}
            error={errors.firstName}
            required
            disabled={fieldDisabled}
          />
          <Input
            label="Last Name"
            name="lastName"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              clearError('lastName');
            }}
            error={errors.lastName}
            required
            disabled={fieldDisabled}
          />
        </div>

        <div className={styles.twoCol}>
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
            error={errors.email}
            icon="bi-envelope"
            required
            disabled={fieldDisabled}
          />
          <Input
            label={mode === 'create' ? 'Password' : 'Password'}
            name="password"
            type="password"
            placeholder={mode === 'edit' ? 'Leave blank to keep current password' : ''}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
            }}
            error={errors.password}
            required={mode === 'create'}
            disabled={fieldDisabled}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Bio</label>
          <textarea
            className={styles.textarea}
            value={bio}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
            rows={3}
            placeholder="Short staff bio"
            disabled={fieldDisabled}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-shield-check" /> Access
          </h2>
          <p className={styles.sectionDesc}>
            Role and branch access available to this clinic portal.
          </p>
        </div>

        <div className={styles.twoCol}>
          {mode === 'create' && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Initial Branch <span className={styles.required}>*</span>
              </label>
              <select
                className={`${styles.selectInput} ${errors.clinicBranchId ? styles.invalid : ''}`}
                value={clinicBranchId}
                onChange={(e) => {
                  setClinicBranchId(e.target.value);
                  clearError('clinicBranchId');
                }}
                disabled={fieldDisabled}
                required
              >
                <option value="">Choose branch</option>
                {branches.map((branch) => (
                  <option key={String(branch.id)} value={String(branch.id)}>
                    {branch.title}
                  </option>
                ))}
              </select>
              {errors.clinicBranchId && (
                <span className={styles.errorMessage}>{errors.clinicBranchId}</span>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Role</label>
            <select
              className={styles.selectInput}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={fieldDisabled}
            >
              <option value="">
                {mode === 'create' ? 'Default Clinic Staff role' : 'No role selected'}
              </option>
              {roles.map((role) => (
                <option key={String(role.id)} value={String(role.id)}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Gender</label>
            <select
              className={styles.selectInput}
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              disabled={fieldDisabled}
            >
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {mode === 'edit' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-briefcase" /> Professional Details
            </h2>
            <p className={styles.sectionDesc}>Optional employment and profile metadata.</p>
          </div>

          <div className={styles.twoCol}>
            <Input
              label="Birth Date"
              name="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={fieldDisabled}
            />
            <Input
              label="Joined Date"
              name="joinedAt"
              type="date"
              value={joinedAt}
              onChange={(e) => setJoinedAt(e.target.value)}
              disabled={fieldDisabled}
            />
          </div>

          <Input
            label="Years of Experience"
            name="yearsOfExperience"
            type="number"
            min={0}
            step={1}
            value={yearsOfExperience}
            onChange={(e) => {
              setYearsOfExperience(e.target.value);
              clearError('yearsOfExperience');
            }}
            error={errors.yearsOfExperience}
            disabled={fieldDisabled}
          />
        </div>
      )}

      {/* ── Working Hours ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-clock" /> Working Hours
          </h2>
          <p className={styles.sectionDesc}>
            Availability schedule used for appointment booking.
          </p>
        </div>

        {hoursError && (
          <p className={styles.hoursWarning}>
            <i className="bi bi-exclamation-triangle-fill" /> {hoursError}
          </p>
        )}

        <div className={styles.hoursTable}>
          {hours.map((entry) => {
            const dayInfo = dayAvailability?.get(entry.dayOfWeek);
            // Only when branches have hours configured at all AND none of them are
            // open this day — if nothing's configured, there's nothing to enforce
            // (same skip condition the backend itself applies).
            const dayClosed = !!dayAvailability && !dayInfo;
            return (
              <div
                key={entry.dayOfWeek}
                className={`${styles.dayRow} ${entry.enabled ? styles.dayRowActive : ''}`}
              >
                <label className={styles.dayCheck}>
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={() => toggleDay(entry.dayOfWeek)}
                    // Already-enabled stale days (set before an assigned branch's
                    // schedule changed) stay togglable so staff can turn them off —
                    // only block turning a still-closed day ON.
                    disabled={saving || readOnly || (dayClosed && !entry.enabled)}
                  />
                  <span className={styles.dayName}>{DAY_NAMES[entry.dayOfWeek]}</span>
                </label>

                {entry.enabled ? (
                  <div className={styles.timeInputs}>
                    <input
                      type="time"
                      className={styles.timeInput}
                      value={entry.startTime}
                      onChange={(e) => updateHour(entry.dayOfWeek, 'startTime', e.target.value)}
                      disabled={saving || readOnly}
                      min={dayInfo?.startTime}
                      max={dayInfo?.endTime}
                    />
                    <span className={styles.timeSep}>to</span>
                    <input
                      type="time"
                      className={styles.timeInput}
                      value={entry.endTime}
                      onChange={(e) => updateHour(entry.dayOfWeek, 'endTime', e.target.value)}
                      disabled={saving || readOnly}
                      min={dayInfo?.startTime}
                      max={dayInfo?.endTime}
                    />
                    {dayClosed && (
                      <span className={styles.dayHoursWarning}>
                        <i className="bi bi-exclamation-triangle-fill" /> No assigned branch is open this day
                      </span>
                    )}
                  </div>
                ) : (
                  <span className={styles.dayClosed}>{dayClosed ? 'Branch closed' : 'Closed'}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {childrenBeforeSubmit}

      {!readOnly && (
        <div className={styles.bottomSave}>
          <Button type="submit" variant="primary" size="large" fullWidth disabled={saving}>
            {saving
              ? mode === 'create' ? 'Creating…' : 'Saving…'
              : mode === 'create' ? 'Create Staff' : 'Save Changes'}
          </Button>
        </div>
      )}
    </form>
  );
}
