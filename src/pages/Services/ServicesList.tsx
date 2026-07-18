import { useCallback, useEffect, useRef, useState } from 'react';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicCatalogService from '../../services/clinic/clinicCatalogService';
import clinicServiceCategoriesService from '../../services/clinic/clinicServiceCategoriesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import { ApiError } from '../../services/clinic/clinicApi';
import type { ClinicService, ClinicServiceCategory } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import styles from './Services.module.scss';

type ServiceRow = ClinicService & Record<string, unknown>;

const LIMIT = 20;

export default function ServicesList() {
  const { clinicId, staff } = useClinicAuth();

  const canRead   = hasClinicPermission(staff, 'clinic-services.read');
  const canCreate = hasClinicPermission(staff, 'clinic-services.create');
  const canUpdate = hasClinicPermission(staff, 'clinic-services.update');
  const canDelete = hasClinicPermission(staff, 'clinic-services.delete');

  const [services, setServices]     = useState<ServiceRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const [loading, setLoading]       = useState(true);
  const [hasLoaded, setHasLoaded]   = useState(false);
  const [error, setError]           = useState('');

  const [categories, setCategories]         = useState<ClinicServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // ── Modals ─────────────────────────────────────────────────────────────────
  type ModalMode = 'create' | 'edit' | 'delete' | null;
  const [modal, setModal]           = useState<ModalMode>(null);
  const [selected, setSelected]     = useState<ClinicService | null>(null);

  const [formName, setFormName]         = useState('');
  const [formNameAr, setFormNameAr]     = useState('');
  const [formDesc, setFormDesc]         = useState('');
  const [formDescAr, setFormDescAr]     = useState('');
  const [formLogoUrl, setFormLogoUrl]   = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formHomeService, setFormHomeService] = useState(false);
  const [formNameError, setFormNameError] = useState('');
  const [formCategoryError, setFormCategoryError] = useState('');
  const [formError, setFormError]       = useState('');
  const [saving, setSaving]             = useState(false);

  const [uploading, setUploading]       = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // ── Search debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchServices = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    try {
      const result = await clinicCatalogService.list(clinicId, {
        page,
        limit: LIMIT,
        search: debouncedSearch || undefined,
        categoryId: filterCategoryId || undefined,
        scope: 'clinic',
      });
      setServices(result.items as ServiceRow[]);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  }, [clinicId, page, debouncedSearch, filterCategoryId]);

  useEffect(() => {
    if (!clinicId || !canRead) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchServices flags loading, then fetches
    fetchServices();
  }, [canRead, clinicId, fetchServices]);

  // Category picker — a flat, unpaginated list used for both the create/edit form and the list filter.
  useEffect(() => {
    if (!canRead) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: flags loading, then fetches
    setLoadingCategories(true);
    clinicServiceCategoriesService.list({ limit: 100 })
      .then((res) => setCategories(res.items))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCategories(false));
  }, [canRead]);

  // ── Open modals ────────────────────────────────────────────────────────────
  function openCreate() {
    setFormName(''); setFormNameAr(''); setFormDesc(''); setFormDescAr(''); setFormLogoUrl('');
    setFormCategoryId(''); setFormHomeService(false);
    setFormNameError(''); setFormCategoryError(''); setFormError('');
    setSelected(null);
    setModal('create');
  }

  function openEdit(service: ClinicService) {
    setFormName(service.name);
    setFormNameAr(service.nameAr ?? '');
    setFormDesc(service.description ?? '');
    setFormDescAr(service.descriptionAr ?? '');
    setFormLogoUrl(service.logoUrl ?? '');
    setFormCategoryId(
      service.clinicServiceCategoryId != null
        ? String(service.clinicServiceCategoryId)
        : service.category?.id != null
          ? String(service.category.id)
          : '',
    );
    setFormHomeService(service.homeServiceAvailable ?? false);
    setFormNameError(''); setFormCategoryError(''); setFormError('');
    setSelected(service);
    setModal('edit');
  }

  function openDelete(service: ClinicService) {
    setSelected(service);
    setFormError('');
    setModal('delete');
  }

  function closeModal() {
    setModal(null);
    setSelected(null);
  }

  // ── Image upload ───────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await clinicCatalogService.uploadLogo(file);
      setFormLogoUrl(uploaded.publicUrl);
    } catch {
      setFormError('Image upload failed. Try pasting a URL instead.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Submit handlers ────────────────────────────────────────────────────────
  async function handleCreate() {
    let hasError = false;
    if (!formName.trim()) { setFormNameError('Service name is required.'); hasError = true; }
    if (!formCategoryId) { setFormCategoryError('Category is required.'); hasError = true; }
    if (hasError) return;
    setSaving(true); setFormError('');
    try {
      await clinicCatalogService.create(clinicId!, {
        name: formName.trim(),
        nameAr: formNameAr.trim() || null,
        description: formDesc.trim() || null,
        descriptionAr: formDescAr.trim() || null,
        logoUrl: formLogoUrl.trim() || null,
        homeServiceAvailable: formHomeService,
        clinicServiceCategoryId: Number(formCategoryId),
      });
      closeModal();
      setPage(1);
      fetchServices();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create service.';
      if (msg.toLowerCase().includes('already exists')) {
        setFormNameError('A service with this name already exists.');
      } else if (msg.toLowerCase().includes('category')) {
        setFormCategoryError(msg);
      } else {
        setFormError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    let hasError = false;
    if (!formName.trim()) { setFormNameError('Service name is required.'); hasError = true; }
    if (!formCategoryId) { setFormCategoryError('Category is required.'); hasError = true; }
    if (hasError) return;
    setSaving(true); setFormError('');
    try {
      await clinicCatalogService.update(clinicId!, selected!.id, {
        name: formName.trim(),
        nameAr: formNameAr.trim() || null,
        description: formDesc.trim() || null,
        descriptionAr: formDescAr.trim() || null,
        logoUrl: formLogoUrl.trim() || null,
        homeServiceAvailable: formHomeService,
        clinicServiceCategoryId: Number(formCategoryId),
      });
      closeModal();
      fetchServices();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update service.';
      if (err instanceof ApiError && err.status === 403) {
        setFormError('Platform services cannot be modified from the clinic portal.');
      } else if (msg.toLowerCase().includes('already exists')) {
        setFormNameError('A service with this name already exists.');
      } else if (msg.toLowerCase().includes('category')) {
        setFormCategoryError(msg);
      } else {
        setFormError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true); setFormError('');
    try {
      await clinicCatalogService.delete(clinicId!, selected!.id);
      closeModal();
      fetchServices();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete service.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<ServiceRow>[] = [
    {
      key: 'name',
      label: 'Service',
      width: '240px',
      render: (row) => (
        <div className={styles.serviceCell}>
          {row.logoUrl
            ? <img src={String(row.logoUrl)} alt="" className={styles.serviceThumb} />
            : <div className={styles.serviceThumbPlaceholder}><i className="bi bi-scissors" /></div>
          }
          <div>
            <span className={styles.serviceName}>{row.name}</span>
            {row.nameAr && <span className={styles.serviceNameAr} dir="rtl">{row.nameAr}</span>}
            {row.isPlatform && (
              <span className={styles.platformBadge}>
                <i className="bi bi-shield-check" /> Platform
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: '30%',
      render: (row) => row.description
        ? <span className={styles.descText}>{String(row.description)}</span>
        : <span className={styles.noData}>—</span>,
    },
    {
      key: 'category',
      label: 'Category',
      width: '150px',
      render: (row) => row.category
        ? <span className={styles.categoryBadge}>{row.category.name}</span>
        : <span className={styles.noData}>—</span>,
    },
    {
      key: 'homeServiceAvailable',
      label: 'Home Service',
      width: '110px',
      render: (row) => row.homeServiceAvailable
        ? <span className={styles.homeServiceYes}><i className="bi bi-house-check" /> Yes</span>
        : <span className={styles.noData}>—</span>,
    },
  ];

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (!clinicId) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account.</p>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Services access restricted</h2>
        <p>Your current role does not include permission to view services.</p>
      </div>
    );
  }

  const isInitialLoad = loading && !hasLoaded;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Services</h1>
            <p className={styles.pageSubtitle}>
              {total > 0 ? `${total} service${total !== 1 ? 's' : ''} in catalog` : 'Manage your clinic service catalog'}
            </p>
          </div>
          {canCreate && (
            <Button variant="primary" icon="bi-plus-lg" onClick={openCreate}>
              Add Service
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className={`alert alert-danger py-2 ${styles.alert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error}
        </div>
      )}

      {!isInitialLoad && (
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <i className="bi bi-search" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search services…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className={styles.clearSearch} onClick={() => setSearch('')}>
                <i className="bi bi-x" />
              </button>
            )}
          </div>

          <select
            className={styles.filterSelect}
            value={filterCategoryId}
            onChange={(e) => { setFilterCategoryId(e.target.value); setPage(1); }}
            disabled={loadingCategories}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>

          <div className={styles.infoHint}>
            <i className="bi bi-info-circle" /> This catalog only shows services your clinic created. Platform-wide services can be offered per branch from Branch settings.
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={services}
        loading={loading}
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        onEdit={(row) => {
          if (!canUpdate) return;
          if (row.isPlatform) { setFormError(''); setSelected(row as ClinicService); setModal('delete'); return; }
          openEdit(row as unknown as ClinicService);
        }}
        onDelete={(row) => {
          if (!canDelete || row.isPlatform) return;
          openDelete(row as unknown as ClinicService);
        }}
        emptyMessage={
          debouncedSearch ? 'No services match your search.' : 'No services in catalog yet.'
        }
      />

      {/* ── Create / Edit Modal ── */}
      {(modal === 'create' || modal === 'edit') && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{modal === 'create' ? 'Add Service' : 'Edit Service'}</h2>
              <button className={styles.modalClose} onClick={closeModal}><i className="bi bi-x-lg" /></button>
            </div>

            <div className={styles.modalBody}>
              {formError && <div className="alert alert-danger py-2">{formError}</div>}

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Service Name <span className={styles.required}>*</span></label>
                  <input
                    className={`${styles.input} ${formNameError ? styles.inputError : ''}`}
                    value={formName}
                    onChange={(e) => { setFormName(e.target.value); setFormNameError(''); }}
                    placeholder="e.g. Dental Cleaning"
                    disabled={saving}
                  />
                  {formNameError && <span className={styles.errorMsg}>{formNameError}</span>}
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Name (Arabic)</label>
                  <input
                    className={styles.input}
                    dir="rtl"
                    value={formNameAr}
                    onChange={(e) => setFormNameAr(e.target.value)}
                    placeholder="اسم الخدمة"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Category <span className={styles.required}>*</span></label>
                <select
                  className={`${styles.input} ${formCategoryError ? styles.inputError : ''}`}
                  value={formCategoryId}
                  onChange={(e) => { setFormCategoryId(e.target.value); setFormCategoryError(''); }}
                  disabled={saving || loadingCategories}
                >
                  <option value="">{loadingCategories ? 'Loading categories…' : 'Select a category'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                {formCategoryError && <span className={styles.errorMsg}>{formCategoryError}</span>}
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Description</label>
                  <textarea
                    className={styles.textarea}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Optional description…"
                    rows={2}
                    disabled={saving}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Description (Arabic)</label>
                  <textarea
                    className={styles.textarea}
                    dir="rtl"
                    value={formDescAr}
                    onChange={(e) => setFormDescAr(e.target.value)}
                    placeholder="وصف اختياري…"
                    rows={2}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formHomeService}
                    onChange={(e) => setFormHomeService(e.target.checked)}
                    disabled={saving}
                  />
                  Home service available
                </label>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Logo</label>
                <div className={styles.logoRow}>
                  <input
                    className={styles.input}
                    value={formLogoUrl}
                    onChange={(e) => setFormLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png or upload below"
                    disabled={saving || uploading}
                  />
                  <button
                    type="button"
                    className={styles.uploadBtn}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving || uploading}
                  >
                    {uploading ? <i className="bi bi-arrow-repeat" /> : <i className="bi bi-upload" />}
                    {uploading ? ' Uploading…' : ' Upload'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
                {formLogoUrl && (
                  <img
                    src={formLogoUrl}
                    alt="Preview"
                    className={styles.logoPreview}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={closeModal} disabled={saving}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={modal === 'create' ? handleCreate : handleEdit}
                disabled={saving || uploading}
              >
                {saving ? 'Saving…' : modal === 'create' ? 'Add Service' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {modal === 'delete' && (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={`${styles.modal} ${styles.modalSm}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delete Service</h2>
              <button className={styles.modalClose} onClick={closeModal}><i className="bi bi-x-lg" /></button>
            </div>
            <div className={styles.modalBody}>
              {formError && <div className="alert alert-danger py-2">{formError}</div>}
              <p>Delete <strong>{selected?.name}</strong>? Branches that currently use this service may be affected.</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={closeModal} disabled={saving}>Cancel</button>
              <button className={styles.btnDanger} onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
