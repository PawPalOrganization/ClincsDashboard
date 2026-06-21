import { createPortal } from 'react-dom';
import styles from './PawLoader.module.css';

type Size = 'small' | 'medium' | 'large';

interface PawLoaderProps {
  size?: Size;
  overlay?: boolean;
  label?: string;
  color?: string;
}

const SIZE_PX: Record<Size, number> = {
  small: 40,
  medium: 90,
  large: 140,
};

function PawSVG({ px, color }: { px: number; color?: string }) {
  const style = color ? ({ '--paw-color': color } as React.CSSProperties) : undefined;

  return (
    <svg
      width={px}
      height={px}
      /*
        viewBox is expanded by 8 px on each side (-8 -8 116 116) so the
        spinning ring (r=53, centered at 50,50) is never clipped by the
        SVG viewport box — overflow:visible handles the rest.
      */
      viewBox="-8 -8 116 116"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.paw}
      style={style}
      aria-label="Loading…"
      role="img"
    >
      {/*
        Single group containing everything.
        During the ring phase (63–88 % of the 3 s cycle) the whole group
        rotates 360°, so the paw and the arc spin together as one unit.
        transform-origin is the paw centre in SVG user-space coordinates.
      */}
      <g className={styles.pawGroup}>

        {/*
          Thin arc — always centred on the paw, arc starts at 12 o'clock
          (stroke-dashoffset shifts it from the default 3 o'clock position).
          Fades in when the group starts rotating, fades out with the toes.
        */}
        <circle className={styles.ring} cx="50" cy="50" r="53" />

        {/* Main central pad — always solid */}
        <path
          className={styles.mainPad}
          d="
            M 50 88
            C 37 88, 17 77, 17 63
            C 17 53, 27 51, 39 51
            C 43 51, 46 49, 50 49
            C 54 49, 57 51, 61 51
            C 73 51, 83 53, 83 63
            C 83 77, 63 88, 50 88 Z
          "
        />

        {/* Toe 1 — far-left, angled outward */}
        <ellipse
          className={`${styles.toe} ${styles.toe1}`}
          cx="19" cy="38" rx="7" ry="9"
          transform="rotate(-20 19 38)"
        />

        {/* Toe 2 — upper-left centre */}
        <ellipse
          className={`${styles.toe} ${styles.toe2}`}
          cx="37" cy="25" rx="8" ry="10"
        />

        {/* Toe 3 — upper-right centre */}
        <ellipse
          className={`${styles.toe} ${styles.toe3}`}
          cx="63" cy="25" rx="8" ry="10"
        />

        {/* Toe 4 — far-right, angled outward */}
        <ellipse
          className={`${styles.toe} ${styles.toe4}`}
          cx="81" cy="38" rx="7" ry="9"
          transform="rotate(20 81 38)"
        />

      </g>
    </svg>
  );
}

export default function PawLoader({
  size = 'medium',
  overlay = false,
  label,
  color,
}: PawLoaderProps) {
  const px = SIZE_PX[size];

  if (overlay) {
    return createPortal(
      <div className={styles.overlay}>
        <PawSVG px={px} color={color} />
        {label && <span className={styles.overlayLabel}>{label}</span>}
      </div>,
      document.body,
    );
  }

  return <PawSVG px={px} color={color} />;
}
