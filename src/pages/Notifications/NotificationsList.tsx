import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import {
  useClinicNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  unreadCountOf,
} from '../../hooks/useClinicNotifications';
import { notificationTargetPath } from '../../utils/notificationTargetPath';
import type { ClinicNotification } from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import styles from './Notifications.module.scss';

const LIMIT = 20;

// Same three shapes the sidebar bell/toast already distinguish (see NotificationToast.tsx) —
// gives each row a type-colored icon instead of a flat bullet, so the feed reads at a
// glance instead of every row looking identical.
function iconFor(n: ClinicNotification): { icon: string; bg: string; color: string } {
  if (n.type === 'appointment_cancelled') {
    return { icon: 'bi-calendar-x-fill', bg: 'rgba(231,76,60,0.10)', color: '#e74c3c' };
  }
  if (n.type === 'appointment_booked') {
    return { icon: 'bi-calendar-check-fill', bg: 'rgba(13,154,255,0.10)', color: '#0d9aff' };
  }
  if (n.type?.startsWith('review_')) {
    return { icon: 'bi-star-fill', bg: 'rgba(243,156,18,0.12)', color: '#f39c12' };
  }
  return { icon: 'bi-bell-fill', bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export default function NotificationsList() {
  const { clinicId } = useClinicAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error } = useClinicNotifications(page, LIMIT, {
    enabled: !!clinicId,
  });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = data?.items ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const unreadTotal = unreadCountOf(data);

  function handleOpen(n: ClinicNotification) {
    if (!n.isRead) markReadMutation.mutate(n.id);
    navigate(notificationTargetPath(n));
  }

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  const isInitialLoad = isLoading && !data;

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
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
            disabled={markAllReadMutation.isPending || unreadTotal === 0}
          >
            Mark all as read
          </Button>
        </div>
      )}

      {error && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error instanceof Error ? error.message : 'Failed to load notifications.'}
        </div>
      )}

      {markReadMutation.isError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> Failed to mark notification as read.
        </div>
      )}

      {markAllReadMutation.isError && (
        <div className={`alert alert-warning py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-triangle-fill" /> Failed to mark all notifications as read.
        </div>
      )}

      {!isInitialLoad && notifications.length === 0 ? (
        <div className={styles.empty}>
          <i className="bi bi-bell-slash" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className={`list-group ${styles.feed} ${isFetching ? styles.feedLoading : ''}`}>
          {notifications.map((n) => {
            const meta = iconFor(n);
            const markingThis = markReadMutation.isPending && markReadMutation.variables === n.id;
            return (
              <div
                key={String(n.id)}
                className={`list-group-item list-group-item-action ${styles.row} ${!n.isRead ? styles.rowUnread : ''}`}
                onClick={() => handleOpen(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleOpen(n)}
              >
                <span className={styles.rowIcon} style={{ background: meta.bg, color: meta.color }}>
                  <i className={`bi ${meta.icon}`} />
                </span>

                <div className={styles.rowBody}>
                  <div className={styles.rowTop}>
                    {/* Plain text only — do NOT change to dangerouslySetInnerHTML */}
                    <span className={styles.rowTitle}>{n.title}</span>
                    {!n.isRead && <span className={`badge rounded-pill ${styles.newBadge}`}>New</span>}
                  </div>
                  <p className={styles.rowText}>{n.body}</p>
                  <span className={styles.rowTime}>{formatDateTime(n.createdAt)}</span>
                </div>

                {!n.isRead && (
                  <button
                    type="button"
                    className={styles.markReadBtn}
                    onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(n.id); }}
                    disabled={markingThis}
                    title="Mark as read"
                  >
                    <i className={`bi ${markingThis ? 'bi-hourglass-split' : 'bi-check2'}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            <i className="bi bi-chevron-left" /> Newer
          </button>
          <span className={styles.pagerLabel}>Page {page} of {totalPages}</span>
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isFetching}
          >
            Older <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
