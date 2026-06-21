import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicApi from '../../services/clinic/clinicApi';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  ApiResponse,
  Appointment,
  Clinic,
  ClinicStaff,
  PaginatedList,
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

function formatTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function patientLabel(b: Appointment): string {
  if (b.contactName) return b.contactName;
  if (b.user) return `${b.user.firstName} ${b.user.lastName}`;
  return 'Walk-in';
}

function patientInitials(b: Appointment): string {
  const name = patientLabel(b);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
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
        {[0, 1, 2, 3].map((i) => (
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

      {/* bookings skeleton */}
      <Skeleton width="150px" height="16px" />
      <div className={styles.staffCard}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.staffRow}>
            <Skeleton variant="circular" width="38px" height="38px" />
            <div className={styles.staffInfo}>
              <Skeleton width="140px" height="14px" />
              <div style={{ marginTop: '6px' }}>
                <Skeleton width="100px" height="12px" />
              </div>
            </div>
            <Skeleton width="70px" height="22px" />
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
  const { staff: authStaff, clinicId } = useClinicAuth();

  const canViewClinic        = hasClinicPermission(authStaff, 'clinics.read');
  const canViewBranches      = hasClinicPermission(authStaff, 'clinic-branches.read');
  const canViewStaff         = hasClinicPermission(authStaff, 'clinic-staff.read');
  const canViewAppointments  = hasClinicPermission(authStaff, 'appointments.read');

  const [loading, setLoading]                     = useState(true);
  const [clinic, setClinic]                       = useState<Clinic | null>(null);
  const [totalBranches, setTotalBranches]         = useState(0);
  const [totalStaff, setTotalStaff]               = useState(0);
  const [todayBookings, setTodayBookings]         = useState<Appointment[]>([]);
  const [totalTodayBookings, setTotalTodayBookings] = useState(0);
  const [errors, setErrors]                       = useState<{
    clinic?: string;
    branches?: string;
    staff?: string;
    appointments?: string;
  }>({});

  const staffFirstName = authStaff?.firstName ?? 'Staff';

  useEffect(() => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    async function load() {
      const SKIP  = Promise.resolve(null);
      const today = new Date().toISOString().split('T')[0];

      const [clinicRes, branchesRes, staffRes, bookingsRes] = await Promise.allSettled([
        canViewClinic        ? clinicApi.get<ApiResponse<Clinic>>(`/clinics/${clinicId}`) : SKIP,
        canViewBranches      ? clinicApi.get<ApiResponse<{ items: unknown[]; meta: { total: number } } | unknown[]>>(`/clinics/${clinicId}/branches`) : SKIP,
        canViewStaff         ? clinicApi.get<{ data: { meta?: { total: number }; items?: ClinicStaff[] } | ClinicStaff[] }>('/clinic-staff', { page: 1, limit: 1 }) : SKIP,
        canViewAppointments  ? clinicAppointmentService.list({ date: today, limit: 5, page: 1 }) : SKIP,
      ]);

      const nextErrors: typeof errors = {};

      if (canViewClinic) {
        if (clinicRes.status === 'fulfilled' && clinicRes.value) {
          setClinic((clinicRes.value as ApiResponse<Clinic>).data);
        } else if (clinicRes.status === 'rejected') {
          nextErrors.clinic = 'Could not load clinic info.';
        }
      }

      if (canViewBranches) {
        if (branchesRes.status === 'fulfilled' && branchesRes.value) {
          const raw = (branchesRes.value as ApiResponse<{ items: unknown[]; meta: { total: number } } | unknown[]>).data;
          const count = Array.isArray(raw) ? (raw as unknown[]).length : (raw as { meta: { total: number } }).meta.total;
          setTotalBranches(count);
        } else if (branchesRes.status === 'rejected') {
          nextErrors.branches = 'Could not load branches.';
        }
      }

      if (canViewStaff) {
        if (staffRes.status === 'fulfilled' && staffRes.value) {
          const raw = (staffRes.value as { data: { meta?: { total: number }; items?: ClinicStaff[] } | ClinicStaff[] }).data;
          const count = Array.isArray(raw) ? raw.length : (raw.meta?.total ?? 0);
          setTotalStaff(count);
        } else if (staffRes.status === 'rejected') {
          nextErrors.staff = 'Could not load staff.';
        }
      }

      if (canViewAppointments) {
        if (bookingsRes.status === 'fulfilled' && bookingsRes.value) {
          const result = bookingsRes.value as PaginatedList<Appointment>;
          setTodayBookings(result.items);
          setTotalTodayBookings(result.meta.total);
        } else if (bookingsRes.status === 'rejected') {
          nextErrors.appointments = "Could not load today's appointments.";
        }
      }

      setErrors(nextErrors);
      setLoading(false);
    }

    load();
  }, [clinicId, canViewClinic, canViewBranches, canViewStaff, canViewAppointments]);

  if (loading) return <DashboardSkeleton />;
  if (!clinicId) return <NoClinic />;

  const canViewSettings = hasClinicPermission(authStaff, 'clinics.read');

  const quickActions = [
    canViewAppointments && {
      to: '/appointments',
      icon: 'bi-calendar2-check-fill',
      title: 'Appointments',
      desc: 'Manage clinic appointments',
      accent: '#8b5cf6',
    },
    canViewBranches && {
      to: '/branches',
      icon: 'bi-building',
      title: 'Manage Branches',
      desc: 'View and manage clinic branches',
      accent: '#0d9aff',
    },
    canViewStaff && {
      to: '/staff',
      icon: 'bi-people-fill',
      title: 'Manage Staff',
      desc: 'View and manage clinic staff members',
      accent: '#10b981',
    },
    canViewSettings && {
      to: '/settings',
      icon: 'bi-gear-fill',
      title: 'Clinic Settings',
      desc: 'Update clinic information and details',
      accent: '#f59e0b',
    },
  ].filter(Boolean) as Array<{ to: string; icon: string; title: string; desc: string; accent: string }>;

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

        {canViewBranches && (
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
        )}

        {canViewStaff && (
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
        )}

        {canViewAppointments && (
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: 'rgba(139,92,246,0.10)', color: '#8b5cf6' }}>
              <i className="bi bi-calendar2-check-fill" />
            </div>
            {errors.appointments ? (
              <div className={styles.statNoData}>No data</div>
            ) : (
              <div className={styles.statNumber}>{totalTodayBookings}</div>
            )}
            <div className={styles.statLabel}>Appointments Today</div>
          </div>
        )}

      </div>

      {/* ── Quick actions ── */}
      <h2 className={styles.sectionTitle}>Quick Actions</h2>
      <div className={styles.actionsGrid}>
        {quickActions.map(({ to, icon, title, desc, accent }) => (
          <Link key={to} to={to} className={styles.actionCard}>
            <div className={styles.actionIcon} style={{ background: `${accent}1a`, color: accent }}>
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

      {/* ── Today's bookings ── */}
      {canViewAppointments && (
        <>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Today's Bookings</h2>
            {totalTodayBookings > 5 && (
              <Link to="/appointments" className={styles.sectionLink}>
                View all {totalTodayBookings} <i className="bi bi-arrow-right" />
              </Link>
            )}
          </div>

          <div className={styles.staffCard}>
            {errors.appointments && (
              <div className={styles.staffError}>
                <i className="bi bi-exclamation-circle" /> {errors.appointments}
              </div>
            )}

            {!errors.appointments && todayBookings.length === 0 && (
              <div className={styles.emptyState}>
                <i className="bi bi-calendar2-x" />
                <p>No appointments scheduled for today.</p>
              </div>
            )}

            {!errors.appointments && todayBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/appointments/${booking.id}`}
                className={styles.bookingRow}
              >
                <div className={styles.staffAvatar}>
                  {patientInitials(booking)}
                </div>
                <div className={styles.staffInfo}>
                  <div className={styles.staffName}>{patientLabel(booking)}</div>
                  <div className={styles.staffEmail}>
                    {formatTime(booking.scheduledAt)}
                    {booking.doctor && ` · Dr. ${booking.doctor.firstName} ${booking.doctor.lastName}`}
                  </div>
                </div>
                <span className={`${styles.bookingBadge} ${styles[`booking_${booking.status}`]}`}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </span>
              </Link>
            ))}

            {!errors.appointments && totalTodayBookings > 5 && (
              <Link to="/appointments" className={styles.viewAll}>
                View all {totalTodayBookings} appointments today
                <i className="bi bi-arrow-right" />
              </Link>
            )}
          </div>
        </>
      )}

    </div>
  );
}
