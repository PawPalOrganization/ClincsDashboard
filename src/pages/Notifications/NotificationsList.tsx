import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicNotificationService from '../../services/clinic/clinicNotificationService';
import { notificationTargetPath } from '../../utils/notificationTargetPath';
import type { ClinicNotification } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import styles from './Notifications.module.scss';

type NotifRow = ClinicNotification & Record<string, unknown>;

const LIMIT = 20;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export default function NotificationsList() {
  const { clinicId } = useClinicAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  // Clinic-wide unread count, not just this page's — drives whether "Mark all as
  // read" is available regardless of which page is currently showing.
  const [unreadTotal, setUnreadTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [markingReadId, setMarkingReadId] = useState<string | number | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await clinicNotificationService.list({ page, limit: LIMIT });
      setNotifications(result.items as NotifRow[]);
      setTotal(result.meta.total);
      setTotalPages(result.meta.totalPages);
      // The list endpoint's meta carries a clinic-wide unreadCount on at least the
      // sidebar's fetch (see ClinicSidebar.tsx) — fall back to this page's own
      // unread count if that field isn't present.
      setUnreadTotal(
        (result.meta as unknown as Record<string, unknown>).unreadCount as number
          ?? result.items.filter((n) => !n.isRead).length,
      );
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!clinicId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchNotifications flags loading, then fetches
    fetchNotifications();
  }, [clinicId, fetchNotifications]);

  async function handleMarkRead(id: string | number) {
    setMarkingReadId(id);
    setActionError('');
    try {
      await clinicNotificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark notification as read.');
    } finally {
      setMarkingReadId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAllRead(true);
    setActionError('');
    try {
      await clinicNotificationService.markAllRead();
      await fetchNotifications();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to mark all notifications as read.');
    } finally {
      setMarkingAllRead(false);
    }
  }

  function handleOpen(n: NotifRow) {
    if (!n.isRead) handleMarkRead(n.id);
    navigate(notificationTargetPath(n));
  }

  const columns: Column<NotifRow>[] = [
    {
      key: 'notification',
      label: 'Notification',
      render: (row) => (
        <div className={styles.notifCell} onClick={() => handleOpen(row)}>
          {!row.isRead
            ? <span className={styles.notifDot} aria-label="Unread" />
            : <span className={styles.notifDotPlaceholder} />}
          <div>
            {/* Plain text only — do NOT change to dangerouslySetInnerHTML */}
            <div className={styles.notifTitle}>{row.title}</div>
            <div className={styles.notifBody}>{row.body}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      width: '190px',
      render: (row) => <span className={styles.cellText}>{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '130px',
      render: (row) => row.isRead ? (
        <span className={styles.readBadge}>Read</span>
      ) : (
        <button
          type="button"
          className={styles.markReadBtn}
          onClick={(e) => { e.stopPropagation(); handleMarkRead(row.id); }}
          disabled={markingReadId === row.id}
        >
          {markingReadId === row.id ? 'Marking…' : 'Mark read'}
        </button>
      ),
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

  const isInitialLoad = loading && !hasLoaded;

  return (
    <div className={styles.page}>
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Notifications</h1>
            <p className={styles.pageSubtitle}>
              {total > 0
                ? `${total} notification${total !== 1 ? 's' : ''}${unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''}`
                : 'No notifications yet'}
            </p>
          </div>
          <Button
            variant="outline"
            icon="bi-check2-all"
            onClick={handleMarkAllRead}
            loading={markingAllRead}
            disabled={markingAllRead || unreadTotal === 0}
          >
            Mark all as read
          </Button>
        </div>
      )}

      {error && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error}
        </div>
      )}

      {actionError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> {actionError}
        </div>
      )}

      <DataTable
        columns={columns}
        data={notifications}
        loading={loading}
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={LIMIT}
        onPageChange={setPage}
        emptyMessage="No notifications yet."
      />
    </div>
  );
}
