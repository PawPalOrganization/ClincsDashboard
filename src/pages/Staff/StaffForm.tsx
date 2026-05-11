import React, { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { ReactNode } from 'react';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import type {
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

  useEffect(() => {
    if (!defaultValues) return;
    setFirstName(defaultValues.firstName ?? '');
    setLastName(defaultValues.lastName ?? '');
    setBio(defaultValues.bio ?? '');
    setEmail(defaultValues.email ?? '');
    setPassword('');
    setBirthDate(dateInputValue(defaultValues.birthDate));
    setGender(defaultValues.gender ?? '');
    setClinicBranchId(
      defaultValues.clinicBranchId != null ? String(defaultValues.clinicBranchId) : '',
    );
    setRoleId(defaultValues.roleId != null ? String(defaultValues.roleId) : '');
    setYearsOfExperience(
      defaultValues.yearsOfExperience != null ? String(defaultValues.yearsOfExperience) : '',
    );
    setJoinedAt(dateInputValue(defaultValues.joinedAt));
  }, [defaultValues]);

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
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    const shared = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      bio: bio.trim() || undefined,
      email: email.trim(),
      password: password.trim() || undefined,
      gender: gender ? (gender as 'male' | 'female' | 'other') : undefined,
      roleId: roleId || undefined,
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
