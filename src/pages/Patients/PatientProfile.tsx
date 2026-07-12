import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicPatientsService from '../../services/clinic/clinicPatientsService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  Appointment,
  AppointmentStatus,
  ClinicBranch,
  PatientClinicProfile,
} from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import styles from './Patients.module.scss';

type AppRow = Appointment & Record<string, unknown>;
type Tab = 'overview' | 'timeline';

const LIMIT = 10;

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function AppointmentRow({ appt }: { appt: Appointment }) {
  return (
    <div className={styles.appointmentRow}>
      <div>
        <p className={styles.appointmentRowDate}>{formatDateTime(appt.scheduledAt)}</p>
        {appt.doctor && (
          <p className={styles.appointmentRowDoctor}>
            Dr. {appt.doctor.firstName} {appt.doctor.lastName}
            {appt.doctor.role ? ` · ${appt.doctor.role.name}` : ''}
          </p>
        )}
        {appt.services.length > 0 && (
          <p className={styles.appointmentRowServices}>
            {appt.services.map((s) => s.name ?? `#${s.clinicServiceId}`).join(', ')}
          </p>
        )}
      </div>
      {Number(appt.totalCost) > 0 && (
        <span className={styles.appointmentRowCost}>EGP {Number(appt.totalCost).toFixed(2)}</span>
      )}
    </div>
  );
}

export default function PatientProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { clinicId, staff: authStaff } = useClinicAuth();
  const navigate = useNavigate();

  const canView = hasClinicPermission(authStaff, 'users.read');

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [profile, setProfile] = useState<PatientClinicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [branches, setBranches] = useState<ClinicBranch[]>([]);

  const [timeline, setTimeline] = useState<AppRow[]>([]);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelineTotalPages, setTimelineTotalPages] = useState(1);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelineStatus, setTimelineStatus] = useState<AppointmentStatus | ''>('');
  const [timelineBranchId, setTimelineBranchId] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- !clinicId/!canView already return early in render; !userId alone is unreachable (route-guaranteed by /patients/:userId) but not provably dead code
    if (!clinicId || !userId || !canView) { setProfileLoading(false); return; }
    setProfileLoading(true);
    setProfileError('');
    setProfileNotFound(false);
    clinicPatientsService.getClinicProfile(userId, clinicId)
      .then(setProfile)
      .catch((err) => {
        const status = (err as { status?: number }).status;
        if (status === 404) setProfileNotFound(true);
        else setProfileError(err instanceof Error ? err.message : 'Failed to load patient profile.');
      })
      .finally(() => setProfileLoading(false));
  }, [clinicId, userId, canView]);

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100).then((res) => setBranches(res.items)).catch(() => {});
  }, [clinicId]);

  const fetchTimeline = useCallback(async () => {
    if (!clinicId || !userId) return;
    setTimelineLoading(true);
    setTimelineError('');
    try {
      const result = await clinicPatientsService.listAppointments(userId, clinicId, {
        page: timelinePage,
        limit: LIMIT,
        status: (timelineStatus as AppointmentStatus) || undefined,
        branchId: timelineBranchId || undefined,
      });
      setTimeline(result.items as AppRow[]);
      setTimelineTotal(result.meta.total);
      setTimelinePage(result.meta.page);
      setTimelineTotalPages(result.meta.totalPages);
    } catch (err) {
      setTimelineError(err instanceof Error ? err.message : 'Failed to load appointment history.');
    } finally {
      setTimelineLoading(false);
    }
  }, [clinicId, userId, timelinePage, timelineStatus, timelineBranchId]);

  useEffect(() => {
    if (activeTab !== 'timeline' || !profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchTimeline flags loading, then fetches
    fetchTimeline();
  }, [activeTab, profile, fetchTimeline]);

  const timelineColumns: Column<AppRow>[] = [
    {
      key: 'scheduledAt',
      label: 'Date & Time',
      width: '200px',
      render: (row) => <span className={styles.cellText}>{formatDateTime(row.scheduledAt)}</span>,
    },
    {
      key: 'doctor',
      label: 'Doctor',
      width: '180px',
      render: (row) =>
        row.doctor
          ? <span className={styles.cellText}>Dr. {row.doctor.firstName} {row.doctor.lastName}</span>
          : <span className={styles.noData}>—</span>,
    },
    {
      key: 'services',
      label: 'Services',
      width: '220px',
      render: (row) =>
        row.services.length > 0
          ? <span className={styles.cellText}>{row.services.map((s) => s.name ?? `#${s.clinicServiceId}`).join(', ')}</span>
          : <span className={styles.noData}>—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => <span className={`${styles.statusPill} ${styles[`status_${row.status}`]}`}>{row.status}</span>,
    },
    {
      key: 'totalCost',
      label: 'Cost',
      width: '110px',
      render: (row) => Number(row.totalCost) > 0 ? <span>EGP {Number(row.totalCost).toFixed(2)}</span> : <span className={styles.noData}>—</span>,
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

  if (profileLoading) {
    return (
      <div className={styles.page}>
        <Skeleton width="240px" height="24px" />
        <Skeleton width="100%" height="120px" variant="rectangular" />
        <Skeleton width="100%" height="200px" variant="rectangular" />
      </div>
    );
  }

  if (profileNotFound) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-person-x" />
        <h2>Not shared with this clinic</h2>
        <p>This patient's data is no longer shared with your clinic — consent may have been revoked, or never granted.</p>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/patients')}>Back to Patients</Button>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-exclamation-circle" />
        <h2>Couldn't load patient</h2>
        <p>{profileError || 'Something went wrong.'}</p>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/patients')}>Back to Patients</Button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.profileHeader}>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/patients')}>Back</Button>
        <div className={styles.profileIdentity}>
          <div className={styles.avatarLarge}>
            {profile.firstName.slice(0, 1)}{profile.lastName.slice(0, 1)}
          </div>
          <div>
            <h1 className={styles.pageTitle}>{profile.firstName} {profile.lastName}</h1>
            <p className={styles.pageSubtitle}>
              <i className="bi bi-telephone" /> {profile.phoneNumber}
              {profile.userHash && <> &middot; <span className={styles.hashText}>{profile.userHash}</span></>}
              {' '}&middot; Consented {formatDate(profile.consentApprovedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statCardGrid}>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{profile.stats.appointments.total}</span>
          <span className={styles.statCardLabel}>Total appointments</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{profile.stats.appointments.upcoming}</span>
          <span className={styles.statCardLabel}>Upcoming</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{profile.stats.appointments.finished}</span>
          <span className={styles.statCardLabel}>Finished</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{profile.stats.appointments.cancelled}</span>
          <span className={styles.statCardLabel}>Cancelled</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>{formatDate(profile.stats.visits.lastVisitDate)}</span>
          <span className={styles.statCardLabel}>Last visit{profile.stats.visits.lastVisitBranch ? ` · ${profile.stats.visits.lastVisitBranch.title}` : ''}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardValue}>EGP {Number(profile.stats.spend.totalFinishedSpend).toFixed(2)}</span>
          <span className={styles.statCardLabel}>Total spend</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'timeline' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.card}>
            <p className={styles.sectionTitle}><i className="bi bi-heart-fill" /> Shared Pets</p>
            {profile.pets.length === 0 ? (
              <p className={styles.noData}>No shared pets.</p>
            ) : (
              <div className={styles.petPillList}>
                {profile.pets.map((pet) => (
                  <span key={pet.id} className={styles.petPillLarge}>
                    {pet.imageUrl && <img src={pet.imageUrl} alt="" />}
                    {pet.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.card}>
            <p className={styles.sectionTitle}><i className="bi bi-clock-history" /> Recent Appointments</p>
            {profile.recentAppointments.length === 0 ? (
              <p className={styles.noData}>No appointments yet.</p>
            ) : (
              <div className={styles.appointmentRowList}>
                {profile.recentAppointments.map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className={styles.card}>
          <div className={styles.timelineFilters}>
            <select
              className={styles.filterSelect}
              value={timelineStatus}
              onChange={(e) => { setTimelineStatus(e.target.value as AppointmentStatus | ''); setTimelinePage(1); }}
            >
              <option value="">All statuses</option>
              <option value="reserved">Reserved</option>
              <option value="finished">Finished</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              className={styles.filterSelect}
              value={timelineBranchId}
              onChange={(e) => { setTimelineBranchId(e.target.value); setTimelinePage(1); }}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
              ))}
            </select>
          </div>

          {timelineError && (
            <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
              <i className="bi bi-exclamation-circle-fill" /> {timelineError}
            </div>
          )}

          <DataTable
            columns={timelineColumns}
            data={timeline}
            loading={timelineLoading}
            currentPage={timelinePage}
            totalPages={timelineTotalPages}
            totalItems={timelineTotal}
            onPageChange={setTimelinePage}
            emptyMessage="No appointments match this filter."
          />
        </div>
      )}
    </div>
  );
}
