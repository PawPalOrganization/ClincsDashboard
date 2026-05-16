import React, { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicProfileService from '../../services/clinic/clinicProfileService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type { UpdateClinicPayload } from '../../types/clinic.types';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import styles from './ClinicSettings.module.scss';

// ─── Form shape ───────────────────────────────────────────────────────────────

interface SettingsForm {
  title: string;
  titleInArabic: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  email: string;
  website: string;
}

const EMPTY_FORM: SettingsForm = {
  title: '',
  titleInArabic: '',
  description: '',
  logoUrl: '',
  coverUrl: '',
  email: '',
  website: '',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <Skeleton width="180px" height="26px" />
          <div style={{ marginTop: '8px' }}>
            <Skeleton width="280px" height="14px" />
          </div>
        </div>
        <Skeleton width="110px" height="40px" variant="rectangular" />
      </div>

      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.section}>
          <div>
            <Skeleton width="160px" height="18px" />
            <div style={{ marginTop: '6px' }}>
              <Skeleton width="240px" height="13px" />
            </div>
          </div>
          <div className={styles.card}>
            {[0, 1].map((j) => (
              <div key={j} style={{ marginBottom: '1rem' }}>
                <Skeleton width="120px" height="13px" />
                <div style={{ marginTop: '6px' }}>
                  <Skeleton width="100%" height="40px" variant="rectangular" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClinicSettings() {
  const { clinicId, staff } = useClinicAuth();
  const canViewClinic   = hasClinicPermission(staff, 'clinics.read');
  const canUpdateClinic = hasClinicPermission(staff, 'clinics.update');
  const readOnly = !canUpdateClinic;

  const [form, setForm]           = useState<SettingsForm>(EMPTY_FORM);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [titleError, setTitleError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    async function fetchClinic() {
      try {
        const clinic = await clinicProfileService.get(clinicId!);
        setForm({
          title:         clinic.title          ?? '',
          titleInArabic: clinic.titleInArabic  ?? '',
          description:   clinic.description    ?? '',
          logoUrl:       clinic.logoUrl        ?? '',
          coverUrl:      clinic.coverUrl       ?? '',
          email:         clinic.email          ?? '',
          website:       clinic.website        ?? '',
        });
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Failed to load clinic profile.',
        );
      } finally {
        setLoading(false);
      }
    }

    fetchClinic();
  }, [clinicId]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'title' && value.trim()) setTitleError('');
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setTitleError('Clinic name is required.');
      return;
    }

    if (!clinicId) return;

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const payload: UpdateClinicPayload = {
      title:         form.title.trim(),
      titleInArabic: form.titleInArabic.trim() || undefined,
      description:   form.description.trim()   || undefined,
      logoUrl:       form.logoUrl.trim()        || undefined,
      coverUrl:      form.coverUrl.trim()       || undefined,
      email:         form.email.trim()          || undefined,
      website:       form.website.trim()        || undefined,
    };

    try {
      await clinicProfileService.update(clinicId, payload);
      setSuccessMsg('Clinic profile updated successfully.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save changes. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SettingsSkeleton />;

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  if (!canViewClinic) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Settings access is restricted</h2>
        <p>Your current role does not include permission to view clinic settings.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <form onSubmit={handleSubmit} noValidate className={styles.form}>

        {/* ── Page header ── */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Clinic Settings</h1>
            <p className={styles.pageSubtitle}>
              Update your clinic's public profile information
            </p>
          </div>
          {!readOnly && (
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>

        {/* ── Feedback banners ── */}
        {successMsg && (
          <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} role="alert">
            <i className="bi bi-check-circle-fill" /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
            <i className="bi bi-exclamation-circle-fill" /> {errorMsg}
          </div>
        )}

        {/* ── Basic information ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-info-circle" /> Basic Information
            </h2>
            <p className={styles.sectionDesc}>
              The primary details shown on your clinic's public profile.
            </p>
          </div>
          <Input
            label="Clinic Name"
            name="title"
            type="text"
            placeholder="Enter clinic name"
            value={form.title}
            onChange={handleInputChange}
            error={titleError}
            required
            disabled={saving || readOnly}
          />
          <Input
            label="Name in Arabic"
            name="titleInArabic"
            type="text"
            placeholder="الاسم بالعربية"
            value={form.titleInArabic}
            onChange={handleInputChange}
            disabled={saving || readOnly}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              name="description"
              className={styles.textarea}
              placeholder="Describe your clinic, services, and specialties…"
              value={form.description}
              onChange={handleTextareaChange}
              rows={4}
              disabled={saving || readOnly}
            />
          </div>
        </div>

        {/* ── Contact details ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-envelope" /> Contact Details
            </h2>
            <p className={styles.sectionDesc}>
              How patients and partners can reach your clinic.
            </p>
          </div>
          <div className={styles.twoCol}>
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="clinic@example.com"
              value={form.email}
              onChange={handleInputChange}
              icon="bi-envelope"
              disabled={saving || readOnly}
            />
            <Input
              label="Website"
              name="website"
              type="url"
              placeholder="https://yourclinic.com"
              value={form.website}
              onChange={handleInputChange}
              icon="bi-globe"
              disabled={saving || readOnly}
            />
          </div>
        </div>

        {/* ── Media URLs ── */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-image" /> Media
            </h2>
            <p className={styles.sectionDesc}>
              Enter direct image URLs for your clinic logo and cover photo.
            </p>
          </div>
          <div className={styles.twoCol}>

            <div className={styles.mediaField}>
              <Input
                label="Logo URL"
                name="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={form.logoUrl}
                onChange={handleInputChange}
                disabled={saving || readOnly}
              />
              {form.logoUrl.trim() && (
                <div className={styles.previewBox}>
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className={styles.logoImg}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className={styles.mediaField}>
              <Input
                label="Cover URL"
                name="coverUrl"
                type="url"
                placeholder="https://example.com/cover.jpg"
                value={form.coverUrl}
                onChange={handleInputChange}
                disabled={saving || readOnly}
              />
              {form.coverUrl.trim() && (
                <div className={styles.previewBoxWide}>
                  <img
                    src={form.coverUrl}
                    alt="Cover preview"
                    className={styles.coverImg}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Bottom save ── */}
        {!readOnly && (
          <div className={styles.bottomSave}>
            <Button
              type="submit"
              variant="primary"
              size="large"
              fullWidth
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        )}

      </form>
    </div>
  );
}
