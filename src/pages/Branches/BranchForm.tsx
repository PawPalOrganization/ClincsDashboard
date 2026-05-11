import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import type {
  BranchWorkingHour,
  ClinicBranch,
  CreateBranchPayload,
  UpdateBranchPayload,
} from '../../types/clinic.types';
import styles from './Branches.module.scss';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BranchFormInitialValues {
  title?: string;
  description?: string;
  logoUrl?: string;
  isMainBranch?: boolean;
  isActive?: boolean;
  phoneNumber?: string;
  lat?: number;
  lng?: number;
  address?: string;
  serviceIds?: ClinicBranch['serviceIds'];
  tags?: ClinicBranch['tags'];
  workingHours?: BranchWorkingHour[];
}

interface HourEntry {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface BranchFormProps {
  mode: 'create' | 'edit';
  defaultValues?: BranchFormInitialValues;
  onSubmit: (payload: CreateBranchPayload | UpdateBranchPayload) => Promise<void>;
  saving: boolean;
  serverError: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type DisplayItem = string | number | { id?: string | number; name?: string; title?: string };

function displayItemLabel(item: DisplayItem): string {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return item.name ?? item.title ?? (item.id != null ? String(item.id) : '');
}

function displayItemsToRaw(items?: DisplayItem[]): string {
  return items?.map(displayItemLabel).filter(Boolean).join(', ') ?? '';
}

function buildDefaultHours(workingHours?: BranchWorkingHour[]): HourEntry[] {
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => {
    const existing = workingHours?.find((h) => h.dayOfWeek === d);
    return {
      dayOfWeek: d,
      enabled: !!existing,
      startTime: existing?.startTime ?? '09:00',
      endTime: existing?.endTime ?? '17:00',
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BranchForm({
  mode,
  defaultValues,
  onSubmit,
  saving,
  serverError,
}: BranchFormProps) {
  const [title, setTitle]             = useState(defaultValues?.title ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [logoUrl, setLogoUrl]         = useState(defaultValues?.logoUrl ?? '');
  const [isMainBranch, setIsMainBranch] = useState(defaultValues?.isMainBranch ?? false);
  const [isActive, setIsActive]       = useState(defaultValues?.isActive ?? true);
  const [phoneNumber, setPhoneNumber] = useState(defaultValues?.phoneNumber ?? '');
  const [lat, setLat]                 = useState(defaultValues?.lat != null ? String(defaultValues.lat) : '');
  const [lng, setLng]                 = useState(defaultValues?.lng != null ? String(defaultValues.lng) : '');
  const [address, setAddress]         = useState(defaultValues?.address ?? '');
  const [tagsRaw, setTagsRaw]         = useState(displayItemsToRaw(defaultValues?.tags));
  const [serviceIdsRaw, setServiceIdsRaw] = useState(displayItemsToRaw(defaultValues?.serviceIds));
  const [hours, setHours]             = useState<HourEntry[]>(() => buildDefaultHours(defaultValues?.workingHours));

  const [titleError, setTitleError] = useState('');
  const [latError, setLatError]     = useState('');
  const [lngError, setLngError]     = useState('');

  // Re-populate when data arrives after mount (edit mode async fetch)
  useEffect(() => {
    if (!defaultValues) return;
    setTitle(defaultValues.title ?? '');
    setDescription(defaultValues.description ?? '');
    setLogoUrl(defaultValues.logoUrl ?? '');
    setIsMainBranch(defaultValues.isMainBranch ?? false);
    setIsActive(defaultValues.isActive ?? true);
    setPhoneNumber(defaultValues.phoneNumber ?? '');
    setLat(defaultValues.lat != null ? String(defaultValues.lat) : '');
    setLng(defaultValues.lng != null ? String(defaultValues.lng) : '');
    setAddress(defaultValues.address ?? '');
    setTagsRaw(displayItemsToRaw(defaultValues.tags));
    setServiceIdsRaw(displayItemsToRaw(defaultValues.serviceIds));
    setHours(buildDefaultHours(defaultValues.workingHours));
  }, [defaultValues]);

  // Derived: live tag chip preview
  const parsedTags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

  function toggleDay(day: number) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === day ? { ...h, enabled: !h.enabled } : h)),
    );
  }

  function updateHour(day: number, field: 'startTime' | 'endTime', value: string) {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === day ? { ...h, [field]: value } : h)),
    );
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    let valid = true;

    if (!title.trim()) {
      setTitleError('Branch name is required.');
      valid = false;
    } else {
      setTitleError('');
    }

    if (lat.trim()) {
      const n = parseFloat(lat);
      if (isNaN(n) || n < -90 || n > 90) {
        setLatError('Must be between -90 and 90.');
        valid = false;
      } else {
        setLatError('');
      }
    } else {
      setLatError('');
    }

    if (lng.trim()) {
      const n = parseFloat(lng);
      if (isNaN(n) || n < -180 || n > 180) {
        setLngError('Must be between -180 and 180.');
        valid = false;
      } else {
        setLngError('');
      }
    } else {
      setLngError('');
    }

    if (!valid) return;

    const workingHours: BranchWorkingHour[] = hours
      .filter((h) => h.enabled)
      .map((h) => ({ dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime }));

    const tags = parsedTags;
    const serviceIds = serviceIdsRaw.split(',').map((s) => s.trim()).filter(Boolean);

    const shared: UpdateBranchPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      isMainBranch,
      phoneNumber: phoneNumber.trim() || undefined,
      lat: lat.trim() ? parseFloat(lat) : undefined,
      lng: lng.trim() ? parseFloat(lng) : undefined,
      address: address.trim() || undefined,
      serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
      tags: tags.length > 0 ? tags : undefined,
      workingHours: workingHours.length > 0 ? workingHours : undefined,
    };

    const payload: CreateBranchPayload | UpdateBranchPayload =
      mode === 'create' ? { ...shared, isActive } : shared;

    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>

      {serverError && (
        <div className={`alert alert-danger py-2 ${styles.errorAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {serverError}
        </div>
      )}

      {/* ── Basic Information ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-building" /> Basic Information
          </h2>
          <p className={styles.sectionDesc}>Core details for this branch location.</p>
        </div>

        <Input
          label="Branch Name"
          name="title"
          type="text"
          placeholder="Enter branch name"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(''); }}
          error={titleError}
          required
          disabled={saving}
        />

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Description</label>
          <textarea
            className={styles.textarea}
            name="description"
            placeholder="Describe this branch — services offered, notes for patients…"
            value={description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={3}
            disabled={saving}
          />
        </div>

        <Input
          label="Logo URL"
          name="logoUrl"
          type="url"
          placeholder="https://example.com/logo.png"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          disabled={saving}
        />
        {logoUrl.trim() && (
          <div className={styles.previewBox}>
            <img
              src={logoUrl}
              alt="Logo preview"
              className={styles.logoImg}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div className={styles.togglesRow}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={isMainBranch}
              onChange={(e) => setIsMainBranch(e.target.checked)}
              disabled={saving}
            />
            <span className={styles.toggleLabel}>
              <strong>Main Branch</strong>
              <span>Mark as the clinic's primary location</span>
            </span>
          </label>

          {mode === 'create' && (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={saving}
              />
              <span className={styles.toggleLabel}>
                <strong>Active</strong>
                <span>Branch is open and visible to patients</span>
              </span>
            </label>
          )}
        </div>
      </div>

      {/* ── Contact & Location ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-geo-alt" /> Contact & Location
          </h2>
          <p className={styles.sectionDesc}>Phone number, address, and map coordinates.</p>
        </div>

        <div className={styles.twoCol}>
          <Input
            label="Phone Number"
            name="phoneNumber"
            type="tel"
            placeholder="+1 555 000 0000"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            icon="bi-telephone"
            disabled={saving}
          />
          <Input
            label="Address"
            name="address"
            type="text"
            placeholder="123 Main St, City, Country"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            icon="bi-map"
            disabled={saving}
          />
        </div>

        <div className={styles.twoCol}>
          <Input
            label="Latitude"
            name="lat"
            type="text"
            placeholder="e.g. 25.2048"
            value={lat}
            onChange={(e) => { setLat(e.target.value); setLatError(''); }}
            error={latError}
            disabled={saving}
          />
          <Input
            label="Longitude"
            name="lng"
            type="text"
            placeholder="e.g. 55.2708"
            value={lng}
            onChange={(e) => { setLng(e.target.value); setLngError(''); }}
            error={lngError}
            disabled={saving}
          />
        </div>
      </div>

      {/* ── Working Hours ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-clock" /> Working Hours
          </h2>
          <p className={styles.sectionDesc}>
            Enable each day this branch is open and set its operating hours.
          </p>
        </div>

        <div className={styles.hoursTable}>
          {hours.map((entry) => (
            <div
              key={entry.dayOfWeek}
              className={`${styles.dayRow} ${entry.enabled ? styles.dayRowActive : ''}`}
            >
              <label className={styles.dayCheck}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={() => toggleDay(entry.dayOfWeek)}
                  disabled={saving}
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
                    disabled={saving}
                  />
                  <span className={styles.timeSep}>to</span>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={entry.endTime}
                    onChange={(e) => updateHour(entry.dayOfWeek, 'endTime', e.target.value)}
                    disabled={saving}
                  />
                </div>
              ) : (
                <span className={styles.dayClosed}>Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tags & Services ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-tags" /> Tags & Services
          </h2>
          <p className={styles.sectionDesc}>
            Searchable tags and linked service IDs for this branch.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tags</label>
          <input
            type="text"
            className={styles.textInput}
            placeholder="e.g. emergency, 24h, cats, dogs"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            disabled={saving}
          />
          <p className={styles.fieldHint}>Separate tags with commas.</p>
          {parsedTags.length > 0 && (
            <div className={styles.tagList}>
              {parsedTags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Service IDs</label>
          <input
            type="text"
            className={styles.textInput}
            placeholder="e.g. uuid-1, uuid-2"
            value={serviceIdsRaw}
            onChange={(e) => setServiceIdsRaw(e.target.value)}
            disabled={saving}
          />
          <p className={styles.fieldHint}>
            <i className="bi bi-info-circle" />
            {' '}Service selection is unavailable in the clinic portal — enter IDs manually if known.
            {/* TODO: Replace with service picker when GET /clinic/api/services is available */}
          </p>
        </div>
      </div>

      {/* ── Submit ── */}
      <div className={styles.bottomSave}>
        <Button
          type="submit"
          variant="primary"
          size="large"
          fullWidth
          disabled={saving}
        >
          {saving
            ? (mode === 'create' ? 'Creating…' : 'Saving…')
            : (mode === 'create' ? 'Create Branch' : 'Save Changes')}
        </Button>
      </div>

    </form>
  );
}
