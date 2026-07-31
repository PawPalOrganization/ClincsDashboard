import { memo } from 'react';
import type { ReactNode } from 'react';
import styles from './RingSplit.module.css';

const SIZE = 84;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface RingSplitSegment {
  label: string;
  percent: number;
  color: string;
}

export interface RingSplitProps {
  label: string;
  subLabel?: ReactNode;
  /** Exactly two segments — the first is the emphasized ("hero") one, shown as the centered ring value. */
  segments: [RingSplitSegment, RingSplitSegment];
  error?: string;
}

// Draws one segment's arc: `offsetPercent` of the circle is skipped (transparent)
// before the colored `percent` portion begins, so two of these stacked back to
// back (offsets 0 and hero.percent) tile the full ring with no gap or overlap.
function arc(percent: number, offsetPercent: number) {
  const len = (CIRCUMFERENCE * Math.max(0, Math.min(100, percent))) / 100;
  const offset = (CIRCUMFERENCE * offsetPercent) / 100;
  return { strokeDasharray: `${len} ${CIRCUMFERENCE - len}`, strokeDashoffset: -offset };
}

const RingSplit = memo(function RingSplit({ label, subLabel, segments, error }: RingSplitProps) {
  const [hero, other] = segments;

  return (
    <div className={styles.card}>
      {error ? (
        <div className={styles.noData}>No data to display</div>
      ) : (
        <>
          <div className={styles.ringWrap}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={other.color}
                strokeWidth={STROKE}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                {...arc(other.percent, hero.percent)}
              />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={hero.color}
                strokeWidth={STROKE}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                {...arc(hero.percent, 0)}
              />
            </svg>
            <div className={styles.ringValue}>{hero.percent}%</div>
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
      <div className={styles.label}>{label}</div>
      {!error && subLabel && <div className={styles.subLabel}>{subLabel}</div>}
    </div>
  );
});

export default RingSplit;
