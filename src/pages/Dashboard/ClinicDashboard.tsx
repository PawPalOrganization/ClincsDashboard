import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicApi from '../../services/clinic/clinicApi';
import clinicAppointmentService from '../../services/clinic/clinicAppointmentService';
import clinicDashboardService from '../../services/clinic/clinicDashboardService';
import { hasAnyClinicPermission, hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  ApiResponse,
  Appointment,
  Clinic,
  ClinicStaff,
  DashboardKpis,
  PaginatedList,
} from '../../types/clinic.types';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import StatCard from '../../components/common/StatCard/StatCard';
import RingSplit from '../../components/common/RingSplit/RingSplit';
import styles from './ClinicDashboard.module.scss';

// Each ring's non-hero segment gets its own hue rather than a flat gray — a gray
// "other" reads as an empty/broken ring once it fills most or all of the circle
// (e.g. a 0% no-show rate leaves "Completed" as a full gray ring). Colors are pulled
// from the app's theme tokens (src/styles/variables.css), same pairs as
// AnalyticsDashboard, validated with the dataviz skill's CVD checker.
const COMPLETED_COLOR = '#0D9AFF'; // --color-primary, paired against No-Show danger '#E74C3C'
const MANUAL_COLOR = '#F39C12'; // --color-warning, paired against App primary '#0D9AFF'

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
  const canViewOverviewKpis  = hasClinicPermission(authStaff, 'dashboard.overview.read');
  const canViewAnalytics     = hasAnyClinicPermission(authStaff, ['dashboard.overview.read', 'dashboard.finance.read']);

  const [loadingStats, setLoadingStats]           = useState(true);
  const [loadingBookings, setLoadingBookings]     = useState(true);
  const [clinic, setClinic]                       = useState<Clinic | null>(null);
  const [totalBranches, setTotalBranches]         = useState(0);
  const [totalStaff, setTotalStaff]               = useState(0);
  const [todayBookings, setTodayBookings]         = useState<Appointment[]>([]);
  const [totalTodayBookings, setTotalTodayBookings] = useState(0);
  const [kpis, setKpis]                           = useState<DashboardKpis | null>(null);
  const [errors, setErrors]                       = useState<{
    clinic?: string;
    branches?: string;
    staff?: string;
    appointments?: string;
    kpis?: string;
  }>({});

  const staffFirstName = authStaff?.firstName ?? 'Staff';

  useEffect(() => {
    if (!clinicId) return;

    const SKIP  = Promise.resolve(null);
    const today = new Date().toISOString().split('T')[0];

    // ── Stats (clinic + branches + staff + KPIs) — shown as soon as these resolve ──
    Promise.allSettled([
      canViewClinic      ? clinicApi.get<ApiResponse<Clinic>>(`/clinics/${clinicId}`) : SKIP,
      canViewBranches    ? clinicApi.get<ApiResponse<{ items: unknown[]; meta: { total: number } } | unknown[]>>(`/clinics/${clinicId}/branches`) : SKIP,
      canViewStaff       ? clinicApi.get<{ data: { meta?: { total: number }; items?: ClinicStaff[] } | ClinicStaff[] }>('/clinic-staff', { page: 1, limit: 1 }) : SKIP,
      canViewOverviewKpis ? clinicDashboardService.getKpis(clinicId) : SKIP,
    ]).then(([clinicRes, branchesRes, staffRes, kpisRes]) => {
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

      if (canViewOverviewKpis) {
        if (kpisRes.status === 'fulfilled' && kpisRes.value) {
          setKpis(kpisRes.value as DashboardKpis);
        } else if (kpisRes.status === 'rejected') {
          nextErrors.kpis = 'Could not load analytics.';
        }
      }

      setErrors((prev) => ({ ...prev, ...nextErrors }));
      setLoadingStats(false);
    });

    // ── Bookings — resolves independently, shows inline skeleton until done ──
    (canViewAppointments
      ? clinicAppointmentService.list({ date: today, limit: 5, page: 1 })
      : Promise.resolve(null)
    )
      .then((result) => {
        if (result) {
          setTodayBookings((result as PaginatedList<Appointment>).items);
          setTotalTodayBookings((result as PaginatedList<Appointment>).meta.total);
        }
      })
      .catch(() => {
        setErrors((prev) => ({ ...prev, appointments: "Could not load today's appointments." }));
      })
      .finally(() => setLoadingBookings(false));

  }, [clinicId, canViewClinic, canViewBranches, canViewStaff, canViewAppointments, canViewOverviewKpis]);

  if (loadingStats) return <DashboardSkeleton />;
  if (!clinicId) return <NoClinic />;

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
          <StatCard
            icon="bi-building"
            iconBg="rgba(13,154,255,0.10)"
            iconColor="#0d9aff"
            value={totalBranches}
            label="Branches"
            error={errors.branches}
            emptyLabel="No branches yet"
          />
        )}
        {canViewStaff && (
          <StatCard
            icon="bi-people-fill"
            iconBg="rgba(16,185,129,0.10)"
            iconColor="#10b981"
            value={totalStaff}
            label="Staff Members"
            error={errors.staff}
            emptyLabel="No staff yet"
          />
        )}
        {canViewAppointments && (
          <StatCard
            icon="bi-calendar2-check-fill"
            iconBg="rgba(139,92,246,0.10)"
            iconColor="#8b5cf6"
            value={totalTodayBookings}
            label="Appointments Today"
            error={errors.appointments}
          />
        )}
        {canViewOverviewKpis && (
          <RingSplit
            label="No-Show Rate"
            subLabel="All time"
            error={errors.kpis}
            segments={[
              { label: 'No-Show', percent: kpis?.noShowRate ?? 0, color: '#e74c3c' },
              { label: 'Completed', percent: Number((100 - (kpis?.noShowRate ?? 0)).toFixed(1)), color: COMPLETED_COLOR },
            ]}
          />
        )}
        {canViewOverviewKpis && (
          <RingSplit
            label="App vs Manual Bookings"
            error={errors.kpis}
            segments={[
              { label: 'App', percent: kpis?.appointmentSources.appPercent ?? 0, color: '#0d9aff' },
              { label: 'Manual', percent: kpis?.appointmentSources.manualPercent ?? 0, color: MANUAL_COLOR },
            ]}
          />
        )}
      </div>

      {/* ── Analytics teaser ── */}
      {canViewAnalytics && (
        <Link to="/analytics" className={styles.actionCard}>
          <div className={styles.actionIcon} style={{ background: 'rgba(13,154,255,0.10)', color: '#0d9aff' }}>
            <i className="bi bi-graph-up" />
          </div>
          <div className={styles.actionBody}>
            <div className={styles.actionTitle}>View Full Analytics</div>
            <div className={styles.actionDesc}>Revenue, KPIs, and top services</div>
          </div>
          <i className={`bi bi-chevron-right ${styles.actionChevron}`} />
        </Link>
      )}

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
            {loadingBookings && (
              <>
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
              </>
            )}

            {!loadingBookings && errors.appointments && (
              <div className={styles.staffError}>
                <i className="bi bi-exclamation-circle" /> {errors.appointments}
              </div>
            )}

            {!loadingBookings && !errors.appointments && todayBookings.length === 0 && (
              <div className={styles.emptyState}>
                <i className="bi bi-calendar2-x" />
                <p>No appointments scheduled for today.</p>
              </div>
            )}

            {!loadingBookings && !errors.appointments && todayBookings.map((booking) => (
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

            {!loadingBookings && !errors.appointments && totalTodayBookings > 5 && (
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
