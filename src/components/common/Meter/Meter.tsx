import { memo } from 'react';
import type { ReactNode } from 'react';
import styles from './Meter.module.css';

// Reserved status scale — never repurposed for series identity, always paired
// with the icon + numeric label so meaning never rides on color alone.
const SEVERITY_COLORS = {
  good: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
} as const;

type Severity = keyof typeof SEVERITY_COLORS;

function severityFor(value: number, goodMax: number, warningMax: number): Severity {
  if (value < goodMax) return 'good';
  if (value < warningMax) return 'warning';
  return 'danger';
}

export interface MeterProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  /** 0–100 */
  value: number;
  label: string;
  subLabel?: ReactNode;
  error?: string;
  /** Below this the meter reads "good" (green). Default 10. */
  goodMax?: number;
  /** Below this the meter reads "warning" (amber); at/above reads "danger" (red). Default 25. */
  warningMax?: number;
}

const Meter = memo(function Meter({
  icon, iconBg, iconColor, value, label, subLabel, error, goodMax = 10, warningMax = 25,
}: MeterProps) {
  const severity = severityFor(value, goodMax, warningMax);
  const color = SEVERITY_COLORS[severity];
  const fillWidth = Math.max(0, Math.min(100, value));

  return (
    <div className={styles.card}>
      <div className={styles.icon} style={{ background: iconBg, color: iconColor }}>
        <i className={`bi ${icon}`} />
      </div>
      {error ? (
        <div className={styles.noData}>No data to display</div>
      ) : (
        <>
          <div className={styles.value}>{value}%</div>
          <div className={styles.track} style={{ background: `${color}22` }}>
            <div className={styles.fill} style={{ width: `${fillWidth}%`, background: color }} />
          </div>
        </>
      )}
      <div className={styles.label}>{label}</div>
      {!error && subLabel && <div className={styles.subLabel}>{subLabel}</div>}
    </div>
  );
});

export default Meter;
