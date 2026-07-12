import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClinicNotification } from '../../../types/clinic.types';
import styles from './NotificationToast.module.scss';

export interface ToastItem {
  notification: ClinicNotification;
  key: string;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (key: string) => void;
  onNavigate: (n: ClinicNotification) => void;
}

export default function NotificationToast({ toasts, onDismiss, onNavigate }: Props) {
  return createPortal(
    <div className={styles.container}>
      {toasts.map((item) => (
        <ToastCard
          key={item.key}
          item={item}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      ))}
    </div>,
    document.body,
  );
}

const DURATION = 6000;

interface CardProps {
  item: ToastItem;
  onDismiss: (key: string) => void;
  onNavigate: (n: ClinicNotification) => void;
}

function ToastCard({ item, onDismiss, onNavigate }: CardProps) {
  const [exiting, setExiting] = useState(false);

  function dismiss() {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => onDismiss(item.key), 420);
  }

  function handleNavigate() {
    dismiss();
    onNavigate(item.notification);
  }

  // Latest-ref pattern: the mount-only timer below must always call the current
  // `dismiss` (with the current `exiting` check), not the one closed over at mount —
  // otherwise a manual dismiss just before the timer fires wouldn't be seen as
  // "already exiting" and onDismiss could fire twice.
  const dismissRef = useRef(dismiss);
  useLayoutEffect(() => {
    dismissRef.current = dismiss;
  });

  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), DURATION);
    return () => clearTimeout(t);
  }, []);

  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(item.notification.createdAt));

  const isBooked = item.notification.type === 'appointment_booked';

  return (
    <div
      className={`${styles.toast} ${exiting ? styles.exit : ''}`}
      onClick={handleNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
      title="View appointment"
    >
      {/* decorative paw watermark */}
      <span className={styles.pawWatermark} aria-hidden>🐾</span>

      <div className={styles.header}>
        <span className={styles.label}>
          <span className={styles.pawDot}>🐾</span>
          {isBooked ? 'Appointment booked' : 'Notification'}
        </span>
        <button
          className={styles.closeBtn}
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          aria-label="Dismiss"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <p className={styles.title}>{item.notification.title}</p>
      <p className={styles.body}>{item.notification.body}</p>

      <div className={styles.footer}>
        <span className={styles.time}>
          <i className="bi bi-clock" /> {time}
        </span>
        <span className={styles.viewLink}>
          View <i className="bi bi-arrow-right" />
        </span>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={styles.progressBar}
          style={{ animationDuration: `${DURATION}ms` }}
        />
      </div>
    </div>
  );
}
