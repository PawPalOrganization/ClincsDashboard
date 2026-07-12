import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicPatientsService from '../../services/clinic/clinicPatientsService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type { ClinicBranch, PatientDirectoryItem, PatientDirectoryListParams } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import styles from './Patients.module.scss';

type PatientRow = PatientDirectoryItem & Record<string, unknown>;
type SortOption = NonNullable<PatientDirectoryListParams['sort']>;

const LIMIT = 10;

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function fullName(patient: PatientDirectoryItem): string {
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
}

export default function PatientsList() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();

  const canView = hasClinicPermission(authStaff, 'users.read');

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDeferredValue(search);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [sort, setSort] = useState<SortOption>('lastVisit');
  const [hasUpcoming, setHasUpcoming] = useState(false);

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [error, setError] = useState('');

  // Reset to page 1 whenever the (deferred) search text actually changes — the other
  // filters already reset page directly in their onChange handlers below. Adjusting
  // state during render (rather than a dedicated effect) avoids an extra render pass.
  const [prevDebouncedSearch, setPrevDebouncedSearch] = useState(debouncedSearch);
  if (debouncedSearch !== prevDebouncedSearch) {
    setPrevDebouncedSearch(debouncedSearch);
    setPage(1);
  }

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100)
      .then((res) => setBranches(res.items))
      .catch(() => {})
      .finally(() => setLoadingBranches(false));
  }, [clinicId]);

  const fetchPatients = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    try {
      const result = await clinicPatientsService.list(clinicId, {
        page,
        limit: LIMIT,
        search: debouncedSearch.trim() || undefined,
        sort,
        branchId: selectedBranchId || undefined,
        hasUpcoming: hasUpcoming || undefined,
      });
      setPatients(result.items as PatientRow[]);
      setTotal(result.meta.total);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, [clinicId, page, debouncedSearch, sort, selectedBranchId, hasUpcoming]);

  useEffect(() => {
    if (!clinicId || !canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchPatients flags loading, then fetches
    fetchPatients();
  }, [canView, clinicId, fetchPatients]);

  const columns: Column<PatientRow>[] = [
    {
      key: 'name',
      label: 'Patient',
      width: '220px',
      render: (row) => (
        <div className={styles.patientNameCell}>
          <div className={styles.avatar}>{fullName(row).slice(0, 2).toUpperCase()}</div>
          <div className={styles.nameText}>
            <span>{fullName(row)}</span>
            {row.userHash && <small>{row.userHash}</small>}
          </div>
        </div>
      ),
    },
    {
      key: 'phoneNumber',
      label: 'Phone',
      width: '160px',
      render: (row) => (
        <span className={styles.cellText}>
          <i className="bi bi-telephone" /> {row.phoneNumber || '—'}
        </span>
      ),
    },
    {
      key: 'sharedPets',
      label: 'Shared Pets',
      width: '220px',
      render: (row) => {
        const preview = row.sharedPetsPreview ?? [];
        if (preview.length === 0) {
          return <span className={styles.noData}>—</span>;
        }
        return (
          <div className={styles.petPillList}>
            {preview.map((pet) => (
              <span key={pet.id} className={styles.petPill}>{pet.name}</span>
            ))}
            {row.sharedPetsCount > preview.length && (
              <span className={styles.petPillMore}>+{row.sharedPetsCount - preview.length}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'stats',
      label: 'Appointments',
      width: '180px',
      render: (row) => (
        <div className={styles.statBadgeGroup}>
          <span className={styles.countBadge}>{row.stats.totalAppointments} total</span>
          {row.stats.upcomingAppointments > 0 && (
            <span className={styles.upcomingBadge}>{row.stats.upcomingAppointments} upcoming</span>
          )}
        </div>
      ),
    },
    {
      key: 'lastVisit',
      label: 'Last Visit',
      width: '130px',
      render: (row) => {
        const date = formatDate(row.stats.lastVisitDate);
        return date
          ? <span className={styles.cellText}><i className="bi bi-calendar3" /> {date}</span>
          : <span className={styles.noData}>—</span>;
      },
    },
  ];

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Patients access restricted</h2>
        <p>Your current clinic role does not include permission to view the patient directory.</p>
      </div>
    );
  }

  const isInitialLoad = loading && !hasLoaded;

  return (
    <div className={styles.page}>
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Patients</h1>
            <p className={styles.pageSubtitle}>
              {total > 0
                ? `${total} patient${total !== 1 ? 's' : ''} with approved data sharing`
                : 'Browse patients who have shared their data with your clinic'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
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
              placeholder="Search by name, phone, or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className={styles.clearSearch} onClick={() => setSearch('')} aria-label="Clear">
                <i className="bi bi-x" />
              </button>
            )}
          </div>

          <select
            className={styles.filterSelect}
            value={selectedBranchId}
            onChange={(e) => { setSelectedBranchId(e.target.value); setPage(1); }}
            disabled={loadingBranches}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
          >
            <option value="lastVisit">Sort: Last visit</option>
            <option value="name">Sort: Name</option>
            <option value="totalAppointments">Sort: Total appointments</option>
            <option value="consentApprovedAt">Sort: Consent date</option>
          </select>

          <label className={styles.checkboxFilter}>
            <input
              type="checkbox"
              checked={hasUpcoming}
              onChange={(e) => { setHasUpcoming(e.target.checked); setPage(1); }}
            />
            Has upcoming
          </label>
        </div>
      )}

      {isInitialLoad ? (
        <TablePageSkeleton columns={5} rows={6} />
      ) : (
        <DataTable
          columns={columns}
          data={patients}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          onEdit={(row) => navigate(`/patients/${row.userId}`)}
          emptyMessage={
            debouncedSearch || selectedBranchId || hasUpcoming
              ? 'No patients match your filters.'
              : 'No patients have shared their data with your clinic yet.'
          }
        />
      )}
    </div>
  );
}
