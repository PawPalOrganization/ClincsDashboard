import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import { formatPatientDisplayName } from '../../utils/formatPatientDisplayName';
import { honorificFor } from '../../utils/staffRoles';
import { useClinicStaffDirectory } from '../../hooks/useClinicStaffDirectory';
import type {
  Appointment,
  AppointmentStatus,
  ClinicBranch,
} from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import styles from './Appointments.module.scss';

type AppRow = Appointment & Record<string, unknown>;

const LIMIT = 10;

function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cls =
    status === 'reserved'
      ? styles.statusReserved
      : status === 'finished'
        ? styles.statusFinished
        : styles.statusCancelled;
  const icon =
    status === 'reserved'
      ? 'bi-clock'
      : status === 'finished'
        ? 'bi-check-circle'
        : 'bi-x-circle';
  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <i className={`bi ${icon}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AppointmentsList() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();
  const staffDirectory = useClinicStaffDirectory(clinicId);

  const canView = hasClinicPermission(authStaff, 'appointments.read');
  const canCreate = hasClinicPermission(authStaff, 'appointments.create');

  const [appointments, setAppointments] = useState<AppRow[]>([]);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDeferredValue(search);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | ''>('');
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

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

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await clinicAppointmentService.list({
        page,
        limit: LIMIT,
        branchId: filterBranch || undefined,
        status: (filterStatus as AppointmentStatus) || undefined,
        date: filterDate || undefined,
        name: debouncedSearch.trim() || undefined,
        sortBy: 'scheduledAt',
        sortOrder,
      });
      // Re-sort the page locally too: this keeps ordering correct within the page even
      // if the backend doesn't yet honor sortBy/sortOrder, though it can't fix ordering
      // *across* pages — that requires the backend to actually apply it before paginating.
      const sorted = [...result.items].sort((a, b) => {
        const diff = new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        return sortOrder === 'desc' ? -diff : diff;
      });
      setAppointments(sorted as AppRow[]);
      setTotal(result.meta.total);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [page, filterBranch, filterStatus, filterDate, debouncedSearch, sortOrder]);

  useEffect(() => {
    if (!clinicId || !canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchAppointments flags loading, then fetches
    fetchAppointments();
  }, [canView, clinicId, fetchAppointments]);

  const columns: Column<AppRow>[] = [
    {
      key: 'patient',
      label: 'Patient',
      width: '180px',
      render: (row) => (
        <div className={styles.doctorCell}>
          <span>{formatPatientDisplayName(row.contactName, row.user, row.userId)}</span>
          {(row.contactPhone || row.user?.phoneNumber) && (
            <small>{row.contactPhone || row.user?.phoneNumber}</small>
          )}
        </div>
      ),
    },
    {
      key: 'doctor',
      label: 'Staff',
      width: '180px',
      render: (row) => {
        if (!row.doctor) return <span className={styles.noData}>—</span>;
        // The appointment's embedded doctor often lacks role — resolve against the
        // full staff directory for an accurate honorific/role instead of guessing.
        const fullStaff = staffDirectory.get(String(row.doctor.id));
        const roleName = fullStaff?.role?.name ?? row.doctor.role?.name;
        return (
          <div className={styles.doctorCell}>
            <span>{honorificFor(fullStaff ?? row.doctor)}{row.doctor.firstName} {row.doctor.lastName}</span>
            {roleName && <small>{roleName}</small>}
          </div>
        );
      },
    },
    {
      key: 'services',
      label: 'Services',
      width: '200px',
      render: (row) => {
        const svc = row.services ?? [];
        if (svc.length === 0) return <span className={styles.noData}>—</span>;
        return (
          <div className={styles.serviceList}>
            {svc.slice(0, 2).map((s, i) => (
              <span key={i} className={styles.servicePill}>{s.name ?? `#${s.clinicServiceId}`}</span>
            ))}
            {svc.length > 2 && <span className={styles.serviceMore}>+{svc.length - 2}</span>}
          </div>
        );
      },
    },
    {
      key: 'scheduledAt',
      label: (
        <button
          type="button"
          className={styles.sortToggleBtn}
          onClick={() => { setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc')); setPage(1); }}
        >
          Scheduled
          <i className={`bi ${sortOrder === 'desc' ? 'bi-arrow-down' : 'bi-arrow-up'}`} />
        </button>
      ),
      width: '175px',
      render: (row) => {
        const dt = formatDateTime(row.scheduledAt);
        return dt ? (
          <span className={styles.cellText}>
            <i className="bi bi-calendar3" /> {dt}
          </span>
        ) : (
          <span className={styles.noData}>—</span>
        );
      },
    },
    {
      key: 'totalCost',
      label: 'Total',
      width: '100px',
      render: (row) => (
        <span className={styles.costCell}>{row.totalCost != null ? `EGP ${Number(row.totalCost).toFixed(2)}` : '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (row) => <StatusBadge status={row.status} />,
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
        <h2>Appointments access restricted</h2>
        <p>Your current role does not include permission to view appointments.</p>
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
            <h1 className={styles.pageTitle}>Appointments</h1>
            <p className={styles.pageSubtitle}>
              {total > 0 ? `${total} appointment${total !== 1 ? 's' : ''}` : 'Manage clinic appointments'}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="outline"
              icon="bi-list-check"
              onClick={() => navigate('/appointments/today')}
            >
              Today's Queue
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                icon="bi-plus-lg"
                onClick={() => navigate('/appointments/create')}
              >
                New Appointment
              </Button>
            )}
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
              placeholder="Search by patient name"
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
            value={filterBranch}
            onChange={(e) => { setFilterBranch(e.target.value); setPage(1); }}
            disabled={loadingBranches}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as AppointmentStatus | ''); setPage(1); }}
          >
            <option value="">All statuses</option>
            <option value="reserved">Reserved</option>
            <option value="finished">Finished</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <input
            type="date"
            className={styles.filterDate}
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        data={appointments}
        loading={loading}
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
        onEdit={(row) => navigate(`/appointments/${row.id}`)}
        emptyMessage={
          debouncedSearch.trim() || filterBranch || filterStatus || filterDate
            ? 'No appointments match your filters.'
            : 'No appointments found.'
        }
      />
    </div>
  );
}
