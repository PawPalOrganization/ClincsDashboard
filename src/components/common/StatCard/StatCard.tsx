import { memo } from 'react';
import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

export interface StatCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: number;
  label: string;
  error?: string;
  emptyLabel?: string;
  /** Preformatted string to render instead of the raw `value` (e.g. "4.2%", "62% app"). */
  displayValue?: string;
  /** Explicit override for the "no data" state. Defaults to `value === 0` when omitted —
   *  needed for metrics like a rate/percent where 0 is a real value, not emptiness. */
  isEmpty?: boolean;
  /** Optional small line below the label — a trend delta, "All time" badge, etc. */
  subLabel?: ReactNode;
}

const StatCard = memo(function StatCard({
  icon, iconBg, iconColor, value, label, error, emptyLabel, displayValue, isEmpty, subLabel,
}: StatCardProps) {
  const empty = isEmpty ?? value === 0;
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: iconBg, color: iconColor }}>
        <i className={`bi ${icon}`} />
      </div>
      {error ? (
        <div className={styles.statNoData}>No data to display</div>
      ) : empty ? (
        <div className={styles.statNoData}>{emptyLabel ?? 'No data yet'}</div>
      ) : (
        <div className={styles.statNumber}>{displayValue ?? value}</div>
      )}
      <div className={styles.statLabel}>{label}</div>
      {!error && !empty && subLabel && <div className={styles.statSubLabel}>{subLabel}</div>}
    </div>
  );
});

export default StatCard;
