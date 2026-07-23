import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicDashboardService from '../../services/clinic/clinicDashboardService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  DashboardGrain,
  DashboardKpis,
  DashboardRevenue,
  DashboardServiceItem,
  DashboardServices,
} from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import StatCard from '../../components/common/StatCard/StatCard';
import Meter from '../../components/common/Meter/Meter';
import SplitBar from '../../components/common/SplitBar/SplitBar';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import styles from './Analytics.module.scss';

// Emphasis palette: one accent hue + neutral gray per split — safe by construction
// (no categorical CVD pairing needed since gray carries no hue to confuse).
const NEUTRAL = '#cbd5e1';

type ServiceRow = DashboardServiceItem & { id: number } & Record<string, unknown>;
type SortColumn = 'bookings' | 'profit';

// Consistent with the accent hexes already used across ClinicDashboard.tsx —
// no categorical chart palette exists in variables.css yet.
const SERIES_COLORS = ['#0d9aff', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];

function formatBucketLabel(bucket: string, grain: DashboardGrain): string {
  const parts = bucket.split('-').map(Number);
  if (grain === 'monthly') {
    const [year, month] = parts;
    return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
      .format(new Date(Date.UTC(year, (month ?? 1) - 1, 1)));
  }
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)));
}

function formatCurrency(value: number): string {
  return `EGP ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function noShowSubLabel(kpis: DashboardKpis): string | undefined {
  if (kpis.period === null) return 'All time';
  if (kpis.noShowRateDelta == null) return undefined;
  const arrow = kpis.noShowRateDelta > 0 ? '▲' : kpis.noShowRateDelta < 0 ? '▼' : '→';
  return `${arrow} ${Math.abs(kpis.noShowRateDelta).toFixed(1)} pts vs prev period`;
}

export default function AnalyticsDashboard() {
  const { clinicId, staff } = useClinicAuth();

  const canViewOverview = hasClinicPermission(staff, 'dashboard.overview.read');
  const canViewFinance = hasClinicPermission(staff, 'dashboard.finance.read');

  // ── Date range filter — both dates or neither; a single date never fires a request ──
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const bothFilled = Boolean(startDate && endDate);
  const bothEmpty = !startDate && !endDate;
  const dateRangeValid = bothEmpty || bothFilled;

  function clearRange() {
    setStartDate('');
    setEndDate('');
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [kpisError, setKpisError] = useState('');

  const fetchKpis = useCallback(async (signal?: AbortSignal) => {
    if (!clinicId) return;
    setKpisLoading(true);
    setKpisError('');
    try {
      const result = await clinicDashboardService.getKpis(
        clinicId,
        bothFilled ? { startDate, endDate } : {},
        { signal },
      );
      setKpis(result);
    } catch (err) {
      if (signal?.aborted) return;
      setKpisError(err instanceof Error ? err.message : 'Failed to load KPIs.');
    } finally {
      if (!signal?.aborted) setKpisLoading(false);
    }
  }, [clinicId, bothFilled, startDate, endDate]);

  useEffect(() => {
    if (!canViewOverview || !dateRangeValid) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchKpis flags loading, then fetches
    fetchKpis(controller.signal);
    return () => controller.abort();
  }, [canViewOverview, dateRangeValid, fetchKpis]);

  // ── Revenue ────────────────────────────────────────────────────────────────
  const [revenue, setRevenue] = useState<DashboardRevenue | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState('');

  const fetchRevenue = useCallback(async (signal?: AbortSignal) => {
    if (!clinicId) return;
    setRevenueLoading(true);
    setRevenueError('');
    try {
      const result = await clinicDashboardService.getRevenue(
        clinicId,
        bothFilled ? { startDate, endDate } : {},
        { signal },
      );
      setRevenue(result);
    } catch (err) {
      if (signal?.aborted) return;
      setRevenueError(err instanceof Error ? err.message : 'Failed to load revenue.');
    } finally {
      if (!signal?.aborted) setRevenueLoading(false);
    }
  }, [clinicId, bothFilled, startDate, endDate]);

  useEffect(() => {
    if (!canViewFinance || !dateRangeValid) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchRevenue flags loading, then fetches
    fetchRevenue(controller.signal);
    return () => controller.abort();
  }, [canViewFinance, dateRangeValid, fetchRevenue]);

  // ── Services performance ──────────────────────────────────────────────────
  const [services, setServices] = useState<DashboardServices | null>(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');
  const [sortBy, setSortBy] = useState<SortColumn>('profit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  function toggleSort(column: SortColumn) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }

  const fetchServices = useCallback(async (signal?: AbortSignal) => {
    if (!clinicId) return;
    setServicesLoading(true);
    setServicesError('');
    try {
      const result = await clinicDashboardService.getServices(
        clinicId,
        { ...(bothFilled ? { startDate, endDate } : {}), sortBy, sortOrder },
        { signal },
      );
      setServices(result);
    } catch (err) {
      if (signal?.aborted) return;
      setServicesError(err instanceof Error ? err.message : 'Failed to load services performance.');
    } finally {
      if (!signal?.aborted) setServicesLoading(false);
    }
  }, [clinicId, bothFilled, startDate, endDate, sortBy, sortOrder]);

  useEffect(() => {
    if (!canViewFinance || !dateRangeValid) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchServices flags loading, then fetches
    fetchServices(controller.signal);
    return () => controller.abort();
  }, [canViewFinance, dateRangeValid, fetchServices]);

  // ── Branch count (for the "hide per-branch chart on single-branch clinics" rule) ──
  // Prefer the KPI response's `branches` count (no extra request); only finance-only
  // users (no overview permission, so no KPI response) fall back to a small branch fetch.
  const [branchCountFallback, setBranchCountFallback] = useState<number | null>(null);
  const fetchBranchCountFallback = useCallback(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 2)
      .then((res) => setBranchCountFallback(res.meta.total))
      .catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    if (canViewOverview || !canViewFinance) return;
    fetchBranchCountFallback();
  }, [canViewOverview, canViewFinance, fetchBranchCountFallback]);

  const branchCount = kpis?.branches ?? branchCountFallback;
  const showPerBranch = (branchCount ?? 0) > 1;

  // ── Render guards ──────────────────────────────────────────────────────────
  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  if (!canViewOverview && !canViewFinance) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Analytics access restricted</h2>
        <p>Your current role does not include permission to view clinic analytics.</p>
      </div>
    );
  }

  const isInitialLoad =
    (canViewOverview && kpisLoading && !kpis) ||
    (canViewFinance && revenueLoading && !revenue);

  // ── Revenue chart data ─────────────────────────────────────────────────────
  const branchMeta = new Map<number, string>();
  revenue?.points.forEach((p) => p.byBranch.forEach((b) => branchMeta.set(b.clinicBranchId, b.branchTitle)));
  const branchIds = Array.from(branchMeta.keys());

  const chartData = revenue?.points.map((p) => {
    const row: Record<string, number | string> = {
      bucket: formatBucketLabel(p.bucket, revenue.grain),
      revenue: p.revenue,
    };
    branchIds.forEach((id) => {
      row[`branch_${id}`] = p.byBranch.find((b) => b.clinicBranchId === id)?.revenue ?? 0;
    });
    return row;
  }) ?? [];

  // ── Services table columns ────────────────────────────────────────────────
  const serviceRows: ServiceRow[] = (services?.items ?? []).map((item) => ({
    ...item,
    id: item.clinicServiceId,
  }));

  const columns: Column<ServiceRow>[] = [
    {
      key: 'name',
      label: 'Service',
      render: (row) => (
        <div className={styles.serviceNameCell}>
          <span>{row.name}</span>
          {row.nameAr && <small dir="rtl">{row.nameAr}</small>}
        </div>
      ),
    },
    {
      key: 'bookings',
      label: (
        <button type="button" className={styles.sortToggleBtn} onClick={() => toggleSort('bookings')}>
          Bookings
          {sortBy === 'bookings' && <i className={`bi ${sortOrder === 'desc' ? 'bi-arrow-down' : 'bi-arrow-up'}`} />}
        </button>
      ),
      width: '130px',
      render: (row) => <span className={styles.cellText}>{row.bookings}</span>,
    },
    {
      key: 'profit',
      label: (
        <button type="button" className={styles.sortToggleBtn} onClick={() => toggleSort('profit')}>
          Profit
          {sortBy === 'profit' && <i className={`bi ${sortOrder === 'desc' ? 'bi-arrow-down' : 'bi-arrow-up'}`} />}
        </button>
      ),
      width: '150px',
      render: (row) => <span className={styles.costCell}>{formatCurrency(row.profit)}</span>,
    },
  ];

  return (
    <div className={styles.page}>
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Analytics</h1>
              <p className={styles.pageSubtitle}>Clinic performance, revenue, and top services</p>
            </div>

            <div>
              <div className={styles.dateRange}>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-label="Start date"
                />
                <span className={styles.dateRangeSep}>to</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="End date"
                />
                <button
                  type="button"
                  className={styles.clearRangeBtn}
                  onClick={clearRange}
                  disabled={bothEmpty}
                >
                  Clear
                </button>
              </div>
              {!dateRangeValid && (
                <p className={styles.dateRangeHint}>
                  <i className="bi bi-exclamation-triangle" /> Pick both a start and end date, or clear both.
                </p>
              )}
            </div>
          </div>

          {/* ── KPIs ── */}
          {canViewOverview && (
            <div className={styles.section}>
              {kpisError ? (
                <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
                  <i className="bi bi-exclamation-circle-fill" /> {kpisError}
                </div>
              ) : kpisLoading ? (
                <div className={styles.statsGrid}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={styles.statSkeletonCard}>
                      <Skeleton variant="circular" width="40px" height="40px" />
                      <div style={{ marginTop: '12px' }}><Skeleton width="60px" height="26px" /></div>
                      <div style={{ marginTop: '6px' }}><Skeleton width="90px" height="12px" /></div>
                      {i > 0 && <div style={{ marginTop: '12px', width: '100%' }}><Skeleton width="100%" height="8px" /></div>}
                    </div>
                  ))}
                </div>
              ) : kpis && (
                <div className={styles.statsGrid}>
                  <StatCard
                    icon="bi-calendar2-check-fill"
                    iconBg="rgba(139,92,246,0.10)"
                    iconColor="#8b5cf6"
                    value={kpis.totalAppointments}
                    label="Total Appointments"
                    subLabel={kpis.period === null ? 'All time' : undefined}
                  />
                  <Meter
                    icon="bi-graph-down-arrow"
                    iconBg="rgba(231,76,60,0.10)"
                    iconColor="#e74c3c"
                    value={kpis.noShowRate}
                    label="No-Show Rate"
                    subLabel={noShowSubLabel(kpis)}
                  />
                  <SplitBar
                    icon="bi-phone"
                    iconBg="rgba(13,154,255,0.10)"
                    iconColor="#0d9aff"
                    label="App vs Manual Bookings"
                    segments={[
                      { label: 'App', percent: kpis.appointmentSources.appPercent, color: '#0d9aff' },
                      { label: 'Manual', percent: kpis.appointmentSources.manualPercent, color: NEUTRAL },
                    ]}
                  />
                  <SplitBar
                    icon="bi-arrow-repeat"
                    iconBg="rgba(16,185,129,0.10)"
                    iconColor="#10b981"
                    label="Returning Clients"
                    segments={[
                      { label: 'Returning', percent: kpis.clientComposition.returningPercent, color: '#10b981' },
                      { label: 'New', percent: kpis.clientComposition.newPercent, color: NEUTRAL },
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Revenue ── */}
          {canViewFinance && (
            <div className={styles.section}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Revenue Over Time</h2>
                  {revenue && (
                    <span className={styles.cardMeta}>
                      {revenue.grain === 'daily' ? 'Daily' : 'Monthly'} · {revenue.period.startDate} to {revenue.period.endDate}
                    </span>
                  )}
                </div>

                {revenueError ? (
                  <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
                    <i className="bi bi-exclamation-circle-fill" /> {revenueError}
                  </div>
                ) : revenueLoading ? (
                  <Skeleton variant="rectangular" width="100%" height="280px" />
                ) : chartData.length === 0 ? (
                  <div className={styles.chartEmpty}>
                    <i className="bi bi-graph-up" />
                    <p>No revenue recorded for this period.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} width={70} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Total Revenue"
                        stroke="#0d9aff"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      {showPerBranch && branchIds.map((id, i) => (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={`branch_${id}`}
                          name={branchMeta.get(id) ?? `Branch ${id}`}
                          stroke={SERIES_COLORS[(i + 1) % SERIES_COLORS.length]}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* ── Services performance ── */}
          {canViewFinance && (
            <div className={styles.section}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Top Services</h2>
                </div>

                {servicesError ? (
                  <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
                    <i className="bi bi-exclamation-circle-fill" /> {servicesError}
                  </div>
                ) : (
                  <DataTable
                    columns={columns}
                    data={serviceRows}
                    loading={servicesLoading}
                    currentPage={1}
                    totalPages={1}
                    totalItems={serviceRows.length}
                    pageSize={serviceRows.length || 1}
                    onPageChange={() => {}}
                    emptyMessage="No profitable services in this period."
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
