import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useClinicAuth } from '../../../context/ClinicAuthContext';
import { hasClinicPermission } from '../../../utils/clinicPermissions';
import type { ClinicPermissionSlug } from '../../../utils/clinicPermissions';
import clinicProfileService from '../../../services/clinic/clinicProfileService';
import clinicNotificationService from '../../../services/clinic/clinicNotificationService';
import { useClinicPusher } from '../../../hooks/useClinicPusher';
import NotificationToast from '../../common/NotificationToast/NotificationToast';
import type { ToastItem } from '../../common/NotificationToast/NotificationToast';
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
  permission?: ClinicPermissionSlug;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',    icon: 'bi-grid',              label: 'Dashboard'    },
  { path: '/branches',     icon: 'bi-building',          label: 'Branches',     permission: 'clinic-branches.read'  },
  { path: '/appointments', icon: 'bi-calendar-check',    label: 'Appointments', permission: 'appointments.read'     },
  { path: '/patients',     icon: 'bi-person-lines-fill', label: 'Patients',     permission: 'users.read'            },
  { path: '/services',     icon: 'bi-scissors',          label: 'Services',     permission: 'clinic-services.read'  },
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
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenIdsRef = useRef<Set<string | number>>(new Set());
  const initialLoadDoneRef = useRef(false);

  function dismissToast(key: string) {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }

  const loadNotifications = useCallback(async () => {
    try {
      const res = await clinicNotificationService.list({ limit: 10 });
      const items = res.items;

      if (initialLoadDoneRef.current) {
        // On subsequent polls, surface any unread IDs we haven't seen before
        const fresh = items.filter((n) => !n.isRead && !seenIdsRef.current.has(n.id));
        if (fresh.length > 0) {
          setToasts((prev) => [
            ...prev.slice(-(2)),          // keep at most 2 existing
            ...fresh.map((n) => ({ notification: n, key: `${n.id}-${Date.now()}` })),
          ]);
        }
      }

      items.forEach((n) => seenIdsRef.current.add(n.id));
      initialLoadDoneRef.current = true;

      setNotifications(items);
      setUnreadCount(
        (res.meta as unknown as Record<string, unknown>).unreadCount as number
          ?? items.filter((n) => !n.isRead).length,
      );
    } catch {
      // Silently ignore — the bell dropdown just stays empty until the next poll/Pusher event.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // ── Pusher real-time notifications ────────────────────────────────────────
  const handlePusherNotification = useCallback((n: ClinicNotification) => {
    // Prepend to the bell list
    setNotifications((prev) => [n, ...prev.slice(0, 19)]);
    // Increment badge
    setUnreadCount((prev) => prev + 1);
    // Show toast
    setToasts((prev) => [
      ...prev.slice(-2),
      { notification: n, key: `${n.id}-${Date.now()}` },
    ]);
  }, []);

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

  async function handleMarkRead(id: string | number) {
    try {
      await clinicNotificationService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently ignore — the notification stays unread in the UI; user can retry.
    }
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

  function notificationTargetPath(n: ClinicNotification): string {
    if (n.data?.appointmentId) return `/appointments/${n.data.appointmentId}`;
    if (n.type?.startsWith('review_')) return '/reviews';
    return '/appointments';
  }

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasClinicPermission(staff, item.permission),
  );
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
              {unreadCount > 0 && (
                <span className={styles.notifUnreadBadge}>{unreadCount} unread</span>
              )}
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
