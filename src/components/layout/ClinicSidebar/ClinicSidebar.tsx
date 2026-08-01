import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useClinicAuth } from '../../../context/ClinicAuthContext';
import { hasAnyClinicPermission, hasClinicPermission } from '../../../utils/clinicPermissions';
import type { ClinicPermissionSlug } from '../../../utils/clinicPermissions';
import clinicProfileService from '../../../services/clinic/clinicProfileService';
import { useClinicPusher } from '../../../hooks/useClinicPusher';
import {
  useClinicNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  usePrependNotification,
  unreadCountOf,
} from '../../../hooks/useClinicNotifications';
import NotificationToast from '../../common/NotificationToast/NotificationToast';
import type { ToastItem } from '../../common/NotificationToast/NotificationToast';
import { notificationTargetPath } from '../../../utils/notificationTargetPath';
import type { ClinicNotification } from '../../../types/clinic.types';
import styles from './ClinicSidebar.module.scss';

interface ClinicSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  path: string;
  icon: string;
  label: string;
  permission?: ClinicPermissionSlug | ClinicPermissionSlug[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',    icon: 'bi-grid',              label: 'Dashboard'    },
  { path: '/analytics',    icon: 'bi-graph-up',          label: 'Analytics',    permission: ['dashboard.overview.read', 'dashboard.finance.read'] },
  { path: '/branches',     icon: 'bi-building',          label: 'Branches',     permission: 'clinic-branches.read'  },
  { path: '/appointments', icon: 'bi-calendar-check',    label: 'Appointments', permission: 'appointments.read'     },
  { path: '/patients',     icon: 'bi-person-lines-fill', label: 'Patients',     permission: 'users.read'            },
  { path: '/services',     icon: 'bi-scissors',          label: 'Custom Services', permission: 'clinic-services.read' },
  { path: '/reviews',      icon: 'bi-star',              label: 'Reviews',      permission: 'reviews.read'          },
  { path: '/staff',        icon: 'bi-people',            label: 'Staff',        permission: 'clinic-staff.read'     },
  { path: '/settings',     icon: 'bi-gear',              label: 'Settings',     permission: 'clinics.read'          },
];

export default function ClinicSidebar({ isOpen, onClose }: ClinicSidebarProps) {
  const { staff, clinicId, token, branchId, logout } = useClinicAuth();

  // React Query caches the clinic profile — sidebar remounts on mobile will
  // return the cached value instantly instead of refetching every time.
  const { data: clinic } = useQuery({
    queryKey: ['clinicProfile', clinicId],
    queryFn: () => clinicProfileService.get(clinicId!),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  // ── Notifications ──────────────────────────────────────────────────────────
  // Backed by React Query, same cache the full /notifications page reads from — this
  // is what keeps the two in sync: marking read from either place invalidates the
  // shared query key, so whichever surface is mounted (the sidebar always is) refetches
  // and shows the same read/unread state instead of drifting apart.
  const { data } = useClinicNotifications(1, 10, { refetchInterval: 60_000 });
  const notifications = data?.items ?? [];
  const unreadCount = unreadCountOf(data);

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const prependNotification = usePrependNotification();

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function dismissToast(key: string) {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }

  // ── Pusher real-time notifications ────────────────────────────────────────
  function handlePusherNotification(n: ClinicNotification) {
    prependNotification(n);
    setToasts((prev) => [
      ...prev.slice(-2),
      { notification: n, key: `${n.id}-${Date.now()}` },
    ]);
  }

  useClinicPusher({ token, staff, branchId, onNotification: handlePusherNotification });

  useEffect(() => {
    if (!bellOpen) return;
    function handleOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [bellOpen]);

  function handleMarkRead(id: string | number) {
    markReadMutation.mutate(id);
  }

  function handleMarkAllRead() {
    markAllReadMutation.mutate();
  }

  // ── Tab title + favicon — side effects driven by React Query's clinic data ──

  useEffect(() => {
    const link = (document.querySelector("link[rel~='icon']") as HTMLLinkElement)
      ?? Object.assign(document.createElement('link'), { rel: 'icon' });
    if (!link.parentNode) document.head.appendChild(link);

    if (clinic) {
      document.title = clinic.title ? `${clinic.title} | PawPal` : 'PawPal Clinics';
      link.href = clinic.logoUrl ?? '/favicon.ico';
    }

    return () => {
      document.title = 'PawPal Clinics';
      link.href = '/favicon.ico';
    };
  }, [clinic]);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true;
    return Array.isArray(item.permission)
      ? hasAnyClinicPermission(staff, item.permission)
      : hasClinicPermission(staff, item.permission);
  });
  const navigate = useNavigate();

  const staffName =
    [staff?.firstName, staff?.lastName].filter(Boolean).join(' ') || 'Staff';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleNavClick = () => {
    if (window.innerWidth <= 768) onClose();
  };

  return (
    <div className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>

      {/* Close button */}
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <i className="bi bi-x" />
      </button>

      {/* Logo */}
      <div className={styles.logo}>
        {clinic?.logoUrl
          ? <img src={clinic.logoUrl} alt={clinic.title} className={styles.logoImg} />
          : <i className="bi bi-heart-pulse" />
        }
        <span>{clinic?.title ?? 'PawPal Clinics'}</span>
      </div>

      {/* Main navigation */}
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {visibleNavItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
                onClick={handleNavClick}
              >
                <i className={`bi ${item.icon} ${styles.navIcon}`} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>


      
      {/* Notification bell */}
      <div ref={bellRef} className={styles.bellWrap}>
        <button
          className={styles.bellBtn}
          onClick={() => setBellOpen((prev) => !prev)}
          aria-label="Notifications"
        >
          <span className={styles.bellIconWrap}>
            <i className="bi bi-bell" />
            {unreadCount > 0 && (
              <span className={styles.bellBadge}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          <span>Notifications</span>
        </button>

        {bellOpen && (
          <div className={styles.notifDropdown}>
            <div className={styles.notifHeader}>
              <span>Notifications</span>
              <div className={styles.notifHeaderActions}>
                {unreadCount > 0 && (
                  <span className={styles.notifUnreadBadge}>{unreadCount} unread</span>
                )}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className={styles.notifMarkAllBtn}
                    onClick={handleMarkAllRead}
                    disabled={markAllReadMutation.isPending}
                  >
                    {markAllReadMutation.isPending ? 'Marking…' : 'Mark all read'}
                  </button>
                )}
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className={styles.notifEmpty}>No notifications yet</p>
            ) : (
              <ul className={styles.notifList}>
                {notifications.map((n) => (
                  <li
                    key={String(n.id)}
                    className={`${styles.notifItem} ${!n.isRead ? styles.notifItemUnread : ''}`}
                    onClick={() => {
                      if (!n.isRead) handleMarkRead(n.id);
                      setBellOpen(false);
                      navigate(notificationTargetPath(n));
                    }}
                  >
                    {/* Plain text only — do NOT change to dangerouslySetInnerHTML */}
                    <div className={styles.notifTitle}>{n.title}</div>
                    <div className={styles.notifBody}>{n.body}</div>
                    <div className={styles.notifTime}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }).format(new Date(n.createdAt))}
                    </div>
                    {!n.isRead && (
                      <span className={styles.notifDot} aria-label="Unread" />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className={styles.notifViewAllBtn}
              onClick={() => { setBellOpen(false); navigate('/notifications'); }}
            >
              View all notifications
            </button>
          </div>
        )}
      </div>

      {/* Toast notifications (portal → document.body) */}
      <NotificationToast
        toasts={toasts}
        onDismiss={dismissToast}
        onNavigate={(n) => navigate(notificationTargetPath(n))}
      />

      {/* Bottom: profile card + logout */}
      <div className={styles.bottomSection}>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {staff?.imageUrl
              ? <img src={staff.imageUrl} alt={staffName} className={styles.avatarPhoto} />
              : <i className="bi bi-person-circle" />
            }
          </div>
          <div className={styles.profileText}>
            <div className={styles.greeting}>Logged in as</div>
            <div className={styles.staffName}>{staffName}</div>
          </div>
        </div>

        <button className={styles.logoutButton} onClick={handleLogout}>
          <i className="bi bi-box-arrow-right" />
          <span>Log out</span>
        </button>
      </div>

    </div>
  );
}
