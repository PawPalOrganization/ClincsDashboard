import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicApi from '../../services/clinic/clinicApi';
import type {
  ApiResponse,
  Clinic,
  ClinicBranch,
  ClinicStaff,
  PaginatedResponse,
} from '../../types/clinic.types';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import styles from './ClinicDashboard.module.scss';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className={styles.page}>
      {/* banner */}
      <div className={`${styles.welcomeBanner} ${styles.welcomeBannerSkeleton}`}>
        <Skeleton width="240px" height="30px" />
        <div style={{ marginTop: '10px' }}>
          <Skeleton width="160px" height="16px" />
        </div>
        <div style={{ marginTop: '6px' }}>
          <Skeleton width="120px" height="12px" />
        </div>
      </div>

      {/* stat cards */}
      <div className={styles.statsGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.statCard}>
            <Skeleton variant="circular" width="52px" height="52px" />
            <div style={{ marginTop: '14px' }}>
              <Skeleton width="56px" height="32px" />
            </div>
            <div style={{ marginTop: '8px' }}>
              <Skeleton width="80px" height="13px" />
            </div>
          </div>
        ))}
      </div>

      {/* action cards */}
      <Skeleton width="120px" height="16px" />
      <div className={styles.actionsGrid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.actionCard} style={{ pointerEvents: 'none' }}>
            <Skeleton variant="rectangular" width="48px" height="48px" />
            <div className={styles.actionBody}>
              <Skeleton width="130px" height="16px" />
              <div style={{ marginTop: '6px' }}>
                <Skeleton width="170px" height="12px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── No clinic state ──────────────────────────────────────────────────────────

function NoClinic() {
  return (
    <div className={styles.noClinic}>
      <i className="bi bi-exclamation-circle" />
      <h3>Clinic not assigned</h3>
      <p>Your account is not assigned to a clinic or branch yet. Contact your administrator.</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClinicDashboard() {
  const { staff: authStaff, clinicId, branchId } = useClinicAuth();

  const [loading, setLoading]           = useState(true);
  const [clinic, setClinic]             = useState<Clinic | null>(null);
  const [branches, setBranches]         = useState<ClinicBranch[]>([]);
  const [totalBranches, setTotalBranches] = useState(0);
  const [staffList, setStaffList]       = useState<ClinicStaff[]>([]);
  const [totalStaff, setTotalStaff]     = useState(0);
  const [errors, setErrors]             = useState<{
    clinic?: string;
    branches?: string;
    staff?: string;
  }>({});

  const staffFirstName = authStaff?.firstName ?? 'Staff';

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    async function load() {
      const [clinicRes, branchesRes, staffRes] = await Promise.allSettled([
        clinicApi.get<ApiResponse<Clinic>>(`/clinics/${clinicId}`),
        clinicApi.get<PaginatedResponse<ClinicBranch>>(`/clinics/${clinicId}/branches`),
        clinicApi.get<PaginatedResponse<ClinicStaff>>('/clinic-staff', { page: 1, limit: 5 }),
      ]);

      const nextErrors: typeof errors = {};

      if (clinicRes.status === 'fulfilled') {
        setClinic(clinicRes.value.data);
      } else {
        nextErrors.clinic = 'Could not load clinic info.';
      }

      if (branchesRes.status === 'fulfilled') {
        const raw = branchesRes.value.data;
        const items = Array.isArray(raw) ? (raw as ClinicBranch[]) : raw.items;
        const count = Array.isArray(raw) ? raw.length : raw.meta.total;
        setBranches(items);
        setTotalBranches(count);
      } else {
        nextErrors.branches = 'Could not load branches.';
      }

      if (staffRes.status === 'fulfilled') {
        const raw = staffRes.value.data;
        const items = Array.isArray(raw) ? (raw as ClinicStaff[]) : raw.items;
        const count = Array.isArray(raw) ? raw.length : raw.meta.total;
        setStaffList(items);
        setTotalStaff(count);
      } else {
        nextErrors.staff = 'Could not load staff.';
      }

      setErrors(nextErrors);
      setLoading(false);
    }

    load();
  }, [clinicId]);

  if (loading) return <DashboardSkeleton />;
  if (!clinicId) return <NoClinic />;

  const myBranch = branches.find((b) => b.id === branchId);
  const myBranchLabel = myBranch?.title ?? (branchId ? '—' : 'Not assigned');

  const quickActions = [
    {
      to: '/branches',
      icon: 'bi-building',
      title: 'Manage Branches',
      desc: 'View and manage clinic branches',
      accent: '#0d9aff',
    },
    {
      to: '/staff',
      icon: 'bi-people-fill',
      title: 'Manage Staff',
      desc: 'View and manage clinic staff members',
      accent: '#10b981',
    },
    {
      to: '/settings',
      icon: 'bi-gear-fill',
      title: 'Clinic Settings',
      desc: 'Update clinic information and details',
      accent: '#f59e0b',
    },
  ] as const;

  return (
    <div className={styles.page}>

      {/* ── Welcome banner ── */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeContent}>
          <div>
            <h1 className={styles.greeting}>
              {getGreeting()}, {staffFirstName}
            </h1>
            {errors.clinic ? (
              <p className={styles.clinicError}>
                <i className="bi bi-exclamation-circle" /> {errors.clinic}
              </p>
            ) : (
              <p className={styles.clinicName}>
                <i className="bi bi-heart-pulse-fill" />
                {clinic?.title ?? '—'}
              </p>
            )}
            <p className={styles.portalTag}>Clinic Staff Portal</p>
          </div>
          <div className={styles.welcomeDecor} aria-hidden>
            <i className="bi bi-hospital" />
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={styles.statsGrid}>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(13,154,255,0.10)', color: '#0d9aff' }}>
            <i className="bi bi-building" />
          </div>
          {errors.branches ? (
            <div className={styles.statNoData}>No data to display</div>
          ) : totalBranches === 0 ? (
            <div className={styles.statNoData}>No branches yet</div>
          ) : (
            <div className={styles.statNumber}>{totalBranches}</div>
          )}
          <div className={styles.statLabel}>Branches</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>
            <i className="bi bi-people-fill" />
          </div>
          {errors.staff ? (
            <div className={styles.statNoData}>No data to display</div>
          ) : totalStaff === 0 ? (
            <div className={styles.statNoData}>No staff yet</div>
          ) : (
            <div className={styles.statNumber}>{totalStaff}</div>
          )}
          <div className={styles.statLabel}>Staff Members</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>
            <i className="bi bi-geo-alt-fill" />
          </div>
          {myBranchLabel === 'Not assigned' ? (
            <div className={styles.statNoData}>Not assigned</div>
          ) : (
            <div className={`${styles.statNumber} ${styles.statNumberSm}`}>{myBranchLabel}</div>
          )}
          <div className={styles.statLabel}>My Branch</div>
        </div>

      </div>

      {/* ── Quick actions ── */}
      <h2 className={styles.sectionTitle}>Quick Actions</h2>
      <div className={styles.actionsGrid}>
        {quickActions.map(({ to, icon, title, desc, accent }) => (
          <Link
            key={to}
            to={to}
            className={styles.actionCard}
          >
            <div
              className={styles.actionIcon}
              style={{ background: `${accent}1a`, color: accent }}
            >
              <i className={`bi ${icon}`} />
            </div>
            <div className={styles.actionBody}>
              <div className={styles.actionTitle}>{title}</div>
              <div className={styles.actionDesc}>{desc}</div>
            </div>
            <i className={`bi bi-chevron-right ${styles.actionChevron}`} />
          </Link>
        ))}
      </div>

      {/* ── Recent staff ── */}
      <h2 className={styles.sectionTitle}>Recent Staff</h2>
      <div className={styles.staffCard}>

        {(errors.staff || staffList.length === 0) && (
          <div className={styles.emptyState}>
            <i className="bi bi-people" />
            <p>No data to display.</p>
          </div>
        )}

        {!errors.staff && staffList.map((member) => (
          <div key={member.id} className={styles.staffRow}>
            <div className={styles.staffAvatar}>
              {initials(member.firstName, member.lastName)}
            </div>
            <div className={styles.staffInfo}>
              <div className={styles.staffName}>
                {member.firstName} {member.lastName}
              </div>
              <div className={styles.staffEmail}>{member.email}</div>
            </div>
            {member.role && (
              <span className={styles.roleBadge}>{member.role.name}</span>
            )}
          </div>
        ))}

        {!errors.staff && totalStaff > 5 && (
          <Link to="/staff" className={styles.viewAll}>
            View all {totalStaff} staff members
            <i className="bi bi-arrow-right" />
          </Link>
        )}

      </div>

    </div>
  );
}
