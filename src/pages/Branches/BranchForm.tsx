import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import LocationLinkInput from '../../components/common/LocationLinkInput/LocationLinkInput';
import clinicCatalogService from '../../services/clinic/clinicCatalogService';
import type {
  BranchService,
  BranchWorkingHour,
  ClinicBranch,
  ClinicService,
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
  services?: ClinicBranch['services'];
  tags?: ClinicBranch['tags'];
  workingHours?: BranchWorkingHour[];
}

interface ServiceRow {
  clinicServiceId: string;
  cost: string;
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
  readOnly?: boolean;
  clinicId?: string | number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type TagItem = string | number | { id?: string | number; name?: string; title?: string };

function tagItemLabel(item: TagItem): string {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return item.name ?? item.title ?? (item.id != null ? String(item.id) : '');
}

function buildDefaultServices(rawServices?: BranchService[] | null): ServiceRow[] {
  if (!Array.isArray(rawServices) || rawServices.length === 0) return [];
  return (rawServices as unknown[])
    .map((raw) => {
      // The API returns branch services as full ClinicService objects: { id, name, cost, ... }
      // The `id` here IS the clinic service ID. We also handle other possible shapes for safety.
      const s = raw as Record<string, unknown>;
      const nestedClinicService = s.clinicService as Record<string, unknown> | undefined;
      const nestedService = s.service as Record<string, unknown> | undefined;
      const id = s.clinicServiceId   // standard field we send in update payload
        ?? s.serviceId               // alternative naming
        ?? nestedClinicService?.id   // nested clinicService join
        ?? nestedService?.id         // nested service join
        ?? s.id;                     // actual API shape: full service object with top-level id
      if (id == null || Number(id as number | string) <= 0) return null;
      return {
        clinicServiceId: String(id),
        cost: s.cost != null ? String(s.cost) : '0',
      };
    })
    .filter((row): row is ServiceRow => row !== null);
}

function parseAddressParts(address?: string): { city: string; area: string; street: string } {
  if (!address?.trim()) return { city: '', area: '', street: '' };
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return { street: parts[0], area: parts[1], city: parts.slice(2).join(', ') };
  if (parts.length === 2) return { street: '', area: parts[0], city: parts[1] };
  return { street: '', area: parts[0], city: '' };
}

function stripSeconds(t?: string): string {
  if (!t) return '';
  return t.length > 5 ? t.slice(0, 5) : t;
}

function buildDefaultHours(workingHours?: BranchWorkingHour[]): HourEntry[] {
  return ([0, 1, 2, 3, 4, 5, 6] as const).map((d) => {
    const existing = workingHours?.find((h) => h.dayOfWeek === d);
    return {
      dayOfWeek: d,
      enabled: !!existing,
      startTime: existing ? stripSeconds(existing.startTime) || '09:00' : '09:00',
      endTime:   existing ? stripSeconds(existing.endTime)   || '17:00' : '17:00',
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
  readOnly = false,
  clinicId,
}: BranchFormProps) {
  const [catalog, setCatalog] = useState<ClinicService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flag loading, then fetch
    setCatalogLoading(true);
    clinicCatalogService.list(clinicId, { limit: 100 })
      .then((res) => setCatalog(res.items))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [clinicId]);
  const [title, setTitle]             = useState(defaultValues?.title ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [logoUrl, setLogoUrl]         = useState(defaultValues?.logoUrl ?? '');
  const [isMainBranch, setIsMainBranch] = useState(defaultValues?.isMainBranch ?? false);
  const [isActive, setIsActive]       = useState(defaultValues?.isActive ?? true);
  const [phoneNumber, setPhoneNumber] = useState(defaultValues?.phoneNumber ?? '');
  const [lat, setLat]                 = useState<number | null>(defaultValues?.lat != null ? Number(defaultValues.lat) : null);
  const [lng, setLng]                 = useState<number | null>(defaultValues?.lng != null ? Number(defaultValues.lng) : null);
  const [addressCity, setAddressCity]   = useState(() => parseAddressParts(defaultValues?.address).city);
  const [addressArea, setAddressArea]   = useState(() => parseAddressParts(defaultValues?.address).area);
  const [addressStreet, setAddressStreet] = useState(() => parseAddressParts(defaultValues?.address).street);
  const [tags, setTags]               = useState<string[]>(() =>
    (defaultValues?.tags ?? []).map(tagItemLabel).filter(Boolean),
  );
  const [tagInput, setTagInput]       = useState('');
  const [services, setServices]       = useState<ServiceRow[]>(() => buildDefaultServices(defaultValues?.services));
  const [hours, setHours]             = useState<HourEntry[]>(() => buildDefaultHours(defaultValues?.workingHours));

  const [titleError, setTitleError] = useState('');

  function commitTag() {
    const value = tagInput.trim().replace(/,+$/, '').trim();
    if (value && !tags.includes(value)) {
      setTags((prev) => [...prev, value]);
    }
    setTagInput('');
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  function addServiceRow() {
    setServices((prev) => [...prev, { clinicServiceId: '', cost: '' }]);
  }

  function updateServiceRow(index: number, field: 'clinicServiceId' | 'cost', value: string) {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeServiceRow(index: number) {
    setServices((prev) => prev.filter((_, i) => i !== index));
  }

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

    if (!valid) return;

    const workingHours: BranchWorkingHour[] = hours
      .filter((h) => h.enabled)
      .map((h) => ({ dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime }));

    const committedTags = tagInput.trim() ? [...tags, tagInput.trim()] : tags;

    const builtServices: BranchService[] = services
      .filter((s) => s.clinicServiceId.trim() !== '')
      .map((s) => ({
        clinicServiceId: parseInt(s.clinicServiceId, 10),
        cost: parseFloat(s.cost) || 0,
      }));

    const shared: UpdateBranchPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      isMainBranch,
      phoneNumber: phoneNumber.trim() || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      address: [addressStreet, addressArea, addressCity].map((p) => p.trim()).filter(Boolean).join(', ') || undefined,
      services: builtServices.length > 0 ? builtServices : undefined,
      tags: committedTags.length > 0 ? committedTags : undefined,
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
          disabled={saving || readOnly}
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
            disabled={saving || readOnly}
          />
        </div>

        <Input
          label="Logo URL"
          name="logoUrl"
          type="url"
          placeholder="https://example.com/logo.png"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          disabled={saving || readOnly}
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
              disabled={saving || readOnly}
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
                disabled={saving || readOnly}
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

        <Input
          label="Phone Number"
          name="phoneNumber"
          type="tel"
          placeholder="+1 555 000 0000"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          icon="bi-telephone"
          disabled={saving || readOnly}
        />

        <div className={styles.twoCol}>
          <Input
            label="City"
            name="addressCity"
            type="text"
            placeholder="e.g. Cairo, Giza, Alexandria"
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            icon="bi-building-fill"
            disabled={saving || readOnly}
          />
          <Input
            label="Area / District"
            name="addressArea"
            type="text"
            placeholder="e.g. Maadi, Zamalek, Nasr City"
            value={addressArea}
            onChange={(e) => setAddressArea(e.target.value)}
            icon="bi-map"
            disabled={saving || readOnly}
          />
        </div>

        <Input
          label="Street / Building"
          name="addressStreet"
          type="text"
          placeholder="e.g. 12 Ahmed Orabi St, Floor 3"
          value={addressStreet}
          onChange={(e) => setAddressStreet(e.target.value)}
          icon="bi-signpost"
          disabled={saving || readOnly}
        />

        <LocationLinkInput
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
          disabled={saving || readOnly}
        />
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
                  disabled={saving || readOnly}
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
                  />
                  <span className={styles.timeSep}>to</span>
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={entry.endTime}
                    onChange={(e) => updateHour(entry.dayOfWeek, 'endTime', e.target.value)}
                    disabled={saving || readOnly}
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
          <div className={`${styles.tagInputWrap} ${(saving || readOnly) ? styles.tagInputDisabled : ''}`}>
            {tags.map((tag, i) => (
              <span key={i} className={styles.tagChip}>
                {tag}
                {!readOnly && (
                  <button
                    type="button"
                    className={styles.tagChipRemove}
                    onClick={() => removeTag(i)}
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {!readOnly && (
              <input
                type="text"
                className={styles.tagChipInput}
                placeholder={tags.length === 0 ? 'e.g. emergency, 24h, cats…' : 'Add tag…'}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={commitTag}
                disabled={saving}
              />
            )}
          </div>
          {!readOnly && <p className={styles.fieldHint}>Press Enter or comma to add each tag. Backspace removes the last one.</p>}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Services & Pricing</label>

          {catalog.length > 0 ? (
            <>
              {catalog.map((svc) => {
                const existingIdx = services.findIndex((s) => s.clinicServiceId === String(svc.id));
                const isSelected = existingIdx >= 0;
                return (
                  <div key={String(svc.id)} className={styles.catalogServiceRow}>
                    <label className={styles.catalogServiceCheck}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={saving || readOnly}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setServices((prev) => [...prev, { clinicServiceId: String(svc.id), cost: '' }]);
                          } else {
                            setServices((prev) => prev.filter((s) => s.clinicServiceId !== String(svc.id)));
                          }
                        }}
                      />
                      <span className={styles.catalogServiceName}>
                        {svc.name}
                        {svc.isPlatform && <span className={styles.catalogPlatformBadge}>Platform</span>}
                      </span>
                    </label>
                    {isSelected && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>EGP</span>
                        <input
                          type="number"
                          className={`${styles.serviceCostInput} ${services[existingIdx]?.cost === '' || services[existingIdx]?.cost === '0' ? styles.serviceCostEmpty : ''}`}
                          placeholder="e.g. 150"
                          min={0}
                          step="0.01"
                          value={services[existingIdx]?.cost ?? ''}
                          onChange={(e) => updateServiceRow(existingIdx, 'cost', e.target.value)}
                          disabled={saving || readOnly}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <p className={styles.fieldHint}>
                <i className="bi bi-exclamation-circle" style={{ color: '#f59e0b' }} /> Enter the cost (EGP) for each selected service — this will appear to staff when booking appointments.
              </p>
            </>
          ) : (
            <>
              {catalogLoading && (
                <p className={styles.fieldHint}><i className="bi bi-arrow-repeat" /> Loading service catalog…</p>
              )}
              {!catalogLoading && services.map((row, index) => (
                <div key={index} className={styles.serviceRow}>
                  <input
                    type="number"
                    className={styles.serviceIdInput}
                    placeholder="Service ID"
                    min={1}
                    value={row.clinicServiceId}
                    onChange={(e) => updateServiceRow(index, 'clinicServiceId', e.target.value)}
                    disabled={saving || readOnly}
                  />
                  <input
                    type="number"
                    className={styles.serviceCostInput}
                    placeholder="Cost"
                    min={0}
                    step="0.01"
                    value={row.cost}
                    onChange={(e) => updateServiceRow(index, 'cost', e.target.value)}
                    disabled={saving || readOnly}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className={styles.serviceRowRemove}
                      onClick={() => removeServiceRow(index)}
                      aria-label="Remove service"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {!catalogLoading && !readOnly && (
                <button
                  type="button"
                  className={styles.addServiceBtn}
                  onClick={addServiceRow}
                  disabled={saving}
                >
                  <i className="bi bi-plus-circle" /> Add Service
                </button>
              )}
              {!catalogLoading && (
                <p className={styles.fieldHint}>
                  <i className="bi bi-info-circle" /> Service IDs are assigned in the admin dashboard. Your admin must add services to the catalog before they appear here.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Submit ── */}
      {!readOnly && (
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
      )}

    </form>
  );
}
