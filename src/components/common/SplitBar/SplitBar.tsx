import { memo } from 'react';
import styles from './SplitBar.module.css';

export interface SplitBarSegment {
  label: string;
  percent: number;
  color: string;
}

export interface SplitBarProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  /** Exactly two segments — the first is the emphasized ("hero") one, shown as the headline value. */
  segments: [SplitBarSegment, SplitBarSegment];
  error?: string;
}

const SplitBar = memo(function SplitBar({ icon, iconBg, iconColor, label, segments, error }: SplitBarProps) {
  const [hero, other] = segments;

  return (
    <div className={styles.card}>
      <div className={styles.icon} style={{ background: iconBg, color: iconColor }}>
        <i className={`bi ${icon}`} />
      </div>
      {error ? (
        <div className={styles.noData}>No data to display</div>
      ) : (
        <div className={styles.value}>{hero.percent}%</div>
      )}
      <div className={styles.label}>{label}</div>
      {!error && (
        <>
          <div className={styles.track}>
            <div className={styles.segment} style={{ width: `${hero.percent}%`, background: hero.color }} />
            <div className={styles.segment} style={{ width: `${other.percent}%`, background: other.color }} />
          </div>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <i className={styles.dot} style={{ background: hero.color }} />
              {hero.label} <strong>{hero.percent}%</strong>
            </span>
            <span className={styles.legendItem}>
              <i className={styles.dot} style={{ background: other.color }} />
              {other.label} <strong>{other.percent}%</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
});

export default SplitBar;
