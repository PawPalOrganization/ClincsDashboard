import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { hasAnyClinicPermission, hasClinicPermission } from '../../utils/clinicPermissions';
import type { ClinicBranch, ClinicStaff } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import TabBar from '../../components/common/TabBar/TabBar';
import styles from './Staff.module.scss';

type StaffRow = ClinicStaff & Record<string, unknown>;

const LIMIT = 10;

const STAFF_TABS = [
  { label: 'Staff', to: '/staff' },
  { label: 'Doctors', to: '/staff/doctors' },
];

const DOCTOR_ROLE_KEYWORDS = ['doctor', 'vet', 'physician', 'surgeon', 'specialist'];

function isDoctorRole(roleName?: string): boolean {
  if (!roleName) return false;
  const lower = roleName.toLowerCase();
  return DOCTOR_ROLE_KEYWORDS.some((kw) => lower.includes(kw));
}

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

export default function DoctorList() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMsg = (location.state as { successMsg?: string } | null)?.successMsg ?? '';

  const [staff, setStaff] = useState<StaffRow[]>([]);
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
  const [branchesError, setBranchesError] = useState('');

  const canViewStaff = hasClinicPermission(authStaff, 'clinic-staff.read');
  const canCreateStaff = hasClinicPermission(authStaff, 'clinic-staff.create');
  const canOpenStaffDetails = hasAnyClinicPermission(authStaff, [
    'clinic-staff.update',
    'clinic-staff.assignments',
  ]);
  const canLoadBranches = hasClinicPermission(authStaff, 'clinic-branches.read');

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
    // `loadingFilters` directly controls the branch-select's disabled state below (not
    // masked by a full-page render guard), so this reset is load-bearing, not dead code.
    if (!clinicId || !canViewStaff || !canLoadBranches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingFilters(false);
      return;
    }

    async function loadFilters() {
      setLoadingFilters(true);
      setBranchesError('');
      try {
        const res = await clinicBranchesService.list(clinicId!, 1, 100);
        setBranches(res.items);
      } catch {
        setBranchesError('Could not load branch filter options.');
      } finally {
        setLoadingFilters(false);
      }
    }

    loadFilters();
  }, [canViewStaff, canLoadBranches, clinicId]);

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

      const doctors = (result.items as StaffRow[]).filter((s) =>
        isDoctorRole(s.role?.name ?? undefined),
      );

      setStaff(doctors);
      setTotal(result.meta.total);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setHasLoadedStaff(true);
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Failed to load doctors.');
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
            <span>Dr. {fullName(row)}</span>
            {row.id && <small>ID {String(row.id)}</small>}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      width: '220px',
      render: (row) => (
        <span className={styles.cellText}>
          <i className="bi bi-envelope" /> {row.email || '—'}
        </span>
      ),
    },
    {
      key: 'specialty',
      label: 'Specialty',
      width: '170px',
      render: (row) => {
        const roleName = row.role?.name;
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
      width: '230px',
      render: (row) => {
        const assignedBranches =
          row.branches && row.branches.length > 0
            ? row.branches
            : row.clinicBranchId && branchById.has(String(row.clinicBranchId))
              ? [branchById.get(String(row.clinicBranchId))!]
              : [];

        if (assignedBranches.length === 0) return <span className={styles.noData}>—</span>;

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
      width: '120px',
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
      width: '140px',
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
              {staff.length > 0
                ? `${staff.length} doctor${staff.length !== 1 ? 's' : ''} in your clinic`
                : 'Manage your clinic doctors'}
            </p>
          </div>
          {canCreateStaff && (
            <Button
              variant="primary"
              icon="bi-plus-lg"
              onClick={() => navigate('/staff/doctors/create')}
            >
              Add Doctor
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
              placeholder="Search doctors"
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
          onEdit={canOpenStaffDetails ? (row) => navigate(`/staff/doctors/${row.id}`) : undefined}
          emptyMessage={
            debouncedSearch || selectedBranchId
              ? 'No doctors match your filters.'
              : 'No doctors found. Staff with doctor, vet, physician, surgeon, or specialist roles appear here.'
          }
        />
      )}
    </div>
  );
}
