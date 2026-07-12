import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffRolesService from '../../services/clinic/clinicStaffRolesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { hasAnyClinicPermission, hasClinicPermission } from '../../utils/clinicPermissions';
import type { ClinicBranch, ClinicStaff, ClinicStaffRole } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import TabBar from '../../components/common/TabBar/TabBar';
import styles from './Staff.module.scss';

const STAFF_TABS = [
  { label: 'Staff', to: '/staff' },
  { label: 'Doctors', to: '/staff/doctors' },
];

type StaffRow = ClinicStaff & Record<string, unknown>;

const LIMIT = 10;

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function fullName(member: ClinicStaff): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Unnamed staff';
}

export default function StaffList() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMsg = (location.state as { successMsg?: string } | null)?.successMsg ?? '';

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<ClinicStaffRole[]>([]);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loadingStaff, setLoadingStaff] = useState(true);
  const [hasLoadedStaff, setHasLoadedStaff] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [rolesError, setRolesError] = useState('');
  const [branchesError, setBranchesError] = useState('');

  const canViewStaff = hasClinicPermission(authStaff, 'clinic-staff.read');
  const canCreateStaff = hasClinicPermission(authStaff, 'clinic-staff.create');
  const canOpenStaffDetails = hasAnyClinicPermission(authStaff, [
    'clinic-staff.update',
    'clinic-staff.assignments',
  ]);
  const canLoadRoles    = hasClinicPermission(authStaff, 'clinic-staff-roles.read');
  const canLoadBranches = hasClinicPermission(authStaff, 'clinic-branches.read');

  const roleById = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => map.set(String(role.id), role.name));
    return map;
  }, [roles]);

  const branchById = useMemo(() => {
    const map = new Map<string, ClinicBranch>();
    branches.forEach((branch) => map.set(String(branch.id), branch));
    return map;
  }, [branches]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!clinicId || !canViewStaff) return;

    async function loadFilters() {
      setLoadingFilters(true);
      setRolesError('');
      setBranchesError('');

      const SKIP = Promise.resolve(null);

      const [rolesRes, branchesRes] = await Promise.allSettled([
        canLoadRoles    ? clinicStaffRolesService.list() : SKIP,
        canLoadBranches ? clinicBranchesService.list(clinicId!, 1, 100) : SKIP,
      ]);

      if (rolesRes.status === 'fulfilled' && rolesRes.value) {
        setRoles(rolesRes.value as Awaited<ReturnType<typeof clinicStaffRolesService.list>>);
      } else if (rolesRes.status === 'rejected') {
        setRolesError('Could not load staff roles.');
      }

      if (branchesRes.status === 'fulfilled' && branchesRes.value) {
        setBranches((branchesRes.value as Awaited<ReturnType<typeof clinicBranchesService.list>>).items);
      } else if (branchesRes.status === 'rejected') {
        setBranchesError('Could not load branch filter options.');
      }

      setLoadingFilters(false);
    }

    loadFilters();
  }, [canViewStaff, canLoadRoles, canLoadBranches, clinicId]);

  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true);
    setStaffError('');

    try {
      const result = await clinicStaffService.list({
        page,
        limit: LIMIT,
        search: debouncedSearch || undefined,
        clinicBranchId: selectedBranchId || undefined,
      });

      setStaff(result.items as StaffRow[]);
      setTotal(result.meta.total);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setHasLoadedStaff(true);
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Failed to load clinic staff.');
    } finally {
      setLoadingStaff(false);
    }
  }, [debouncedSearch, page, selectedBranchId]);

  useEffect(() => {
    if (!clinicId || !canViewStaff) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchStaff flags loading, then fetches
    fetchStaff();
  }, [canViewStaff, clinicId, fetchStaff]);

  const columns: Column<StaffRow>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '220px',
      render: (row) => (
        <div className={styles.staffNameCell}>
          {row.imageUrl ? (
            <img src={String(row.imageUrl)} alt="" className={styles.avatarPhoto} />
          ) : (
            <div className={styles.avatar}>{fullName(row).slice(0, 2).toUpperCase()}</div>
          )}
          <div className={styles.nameText}>
            <span>{fullName(row)}</span>
            {row.id && <small>ID {String(row.id)}</small>}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      width: '230px',
      render: (row) => (
        <span className={styles.cellText}>
          <i className="bi bi-envelope" /> {row.email || '—'}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: '170px',
      render: (row) => {
        const roleName = row.role?.name ?? (row.roleId ? roleById.get(String(row.roleId)) : '');
        return roleName ? (
          <span className={styles.roleBadge}>{roleName}</span>
        ) : (
          <span className={styles.noData}>—</span>
        );
      },
    },
    {
      key: 'branches',
      label: 'Assigned branches',
      width: '240px',
      render: (row) => {
        const assignedBranches =
          row.branches && row.branches.length > 0
            ? row.branches
            : row.clinicBranchId && branchById.has(String(row.clinicBranchId))
              ? [branchById.get(String(row.clinicBranchId))!]
              : [];

        if (assignedBranches.length === 0) {
          return <span className={styles.noData}>—</span>;
        }

        return (
          <div className={styles.branchList}>
            {assignedBranches.slice(0, 2).map((branch) => (
              <span key={String(branch.id)} className={styles.branchPill}>
                {branch.title}
              </span>
            ))}
            {assignedBranches.length > 2 && (
              <span className={styles.branchMore}>+{assignedBranches.length - 2}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'yearsOfExperience',
      label: 'Experience',
      width: '130px',
      render: (row) =>
        row.yearsOfExperience != null ? (
          <span className={styles.countBadge}>
            {row.yearsOfExperience} yr{row.yearsOfExperience === 1 ? '' : 's'}
          </span>
        ) : (
          <span className={styles.noData}>—</span>
        ),
    },
    {
      key: 'joinedAt',
      label: 'Joined date',
      width: '150px',
      render: (row) => {
        const joined = formatDate(row.joinedAt);
        return joined ? (
          <span className={styles.cellText}>
            <i className="bi bi-calendar3" /> {joined}
          </span>
        ) : (
          <span className={styles.noData}>—</span>
        );
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

  if (!canViewStaff) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Staff access is view-restricted</h2>
        <p>Your current clinic role does not include permission to view staff members.</p>
      </div>
    );
  }

  const isInitialLoad = loadingStaff && !hasLoadedStaff;

  return (
    <div className={styles.page}>
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Staff</h1>
            <p className={styles.pageSubtitle}>
              {total > 0
                ? `${total} staff member${total !== 1 ? 's' : ''} in your clinic`
                : 'Search and manage clinic staff'}
            </p>
          </div>
          {canCreateStaff && (
            <Button
              variant="primary"
              icon="bi-plus-lg"
              onClick={() => navigate('/staff/create')}
            >
              Create Staff
            </Button>
          )}
        </div>
      )}

      <TabBar tabs={STAFF_TABS} />

      {successMsg && (
        <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-check-circle-fill" /> {successMsg}
        </div>
      )}

      {!isInitialLoad && (
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <i className="bi bi-search" />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search staff"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className={styles.clearSearch}
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <i className="bi bi-x" />
              </button>
            )}
          </div>

          <select
            className={styles.branchSelect}
            value={selectedBranchId}
            onChange={(e) => { setSelectedBranchId(e.target.value); setPage(1); }}
            disabled={loadingFilters || !!branchesError}
          >
            <option value="">All visible branches</option>
            {branches.map((branch) => (
              <option key={String(branch.id)} value={String(branch.id)}>
                {branch.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {rolesError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> {rolesError}
        </div>
      )}

      {branchesError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> {branchesError}
        </div>
      )}

      {staffError && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {staffError}
        </div>
      )}

      {isInitialLoad ? (
        <TablePageSkeleton columns={6} rows={6} />
      ) : (
        <DataTable
          columns={columns}
          data={staff}
          loading={loadingStaff}
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          onEdit={canOpenStaffDetails ? (row) => navigate(`/staff/${row.id}`) : undefined}
          emptyMessage={
            debouncedSearch || selectedBranchId
              ? 'No staff members match your filters.'
              : 'No staff members found.'
          }
        />
      )}
    </div>
  );
}
