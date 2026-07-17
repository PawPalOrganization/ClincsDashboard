import { createPortal } from 'react-dom';
import loaderLeft from '../../../assets/images/loader-pp-left.png';
import loaderRight from '../../../assets/images/loader-pp-right.png';
import styles from './PawLoader.module.css';

type Size = 'small' | 'medium' | 'large';

interface PawLoaderProps {
  size?: Size;
  overlay?: boolean;
  label?: string;
}

const SIZE_PX: Record<Size, number> = {
  small: 40,
  medium: 90,
  large: 140,
};

// ─── Small inline spinner (buttons, inline status rows) — three bouncing paw
// icons, matching the admin dashboard's PawLoader so both apps feel consistent.
function PawDots({ px }: { px: number }) {
  return (
    <span className={styles.pawDots} style={{ height: px * 0.35 }} aria-label="Loading…" role="img">
      {[0, 1, 2].map((i) => (
        <svg key={i} className={styles.pawDot} style={{ animationDelay: `${i * 0.2}s` }} viewBox="0 0 512 512" fill="currentColor">
          <path d="M226.5 92.9c14.3 42.9-.3 86.2-32.6 96.8s-70.1-15.6-84.4-58.5.3-86.2 32.6-96.8 70.1 15.6 84.4 58.5zM100.4 198.6c18.9 32.4 14.3 70.1-10.2 84.1s-59.7-.9-78.5-33.3S-2.7 179.3 21.8 165.3s59.7.9 78.6 33.3zM69.2 401.2C121.6 259.9 214.7 224 256 224s134.4 35.9 186.8 177.2c3.6 9.7 5.2 20.1 5.2 30.5v1.6c0 25.8-20.9 46.7-46.7 46.7-11.5 0-22.9-1.4-34-4.2l-88-22c-15.3-3.8-31.3-3.8-46.6 0l-88 22c-11.1 2.8-22.5 4.2-34 4.2-25.8 0-46.7-20.9-46.7-46.7v-1.6c0-10.4 1.6-20.8 5.2-30.5zM318 128.4c-14.3-42.9.3-86.2 32.6-96.8s70.1 15.6 84.4 58.5-.3 86.2-32.6 96.8-70.1-15.6-84.4-58.5zm131.4 163.3c-18.9-32.4-14.3-70.1 10.2-84.1s59.7.9 78.5 33.3 14.3 70.1-10.2 84.1-59.7-.9-78.5-33.3z" />
        </svg>
      ))}
    </span>
  );
}

// ─── Main overlay indicator — the PP mark splitting apart and rejoining ──────
function PpLogoLoader({ px }: { px: number }) {
  return (
    <span className={styles.ppLoader} style={{ width: px, height: px }} aria-label="Loading…" role="img">
      <img src={loaderLeft} alt="" className={`${styles.ppHalf} ${styles.ppLeft}`} />
      <img src={loaderRight} alt="" className={`${styles.ppHalf} ${styles.ppRight}`} />
    </span>
  );
}

export default function PawLoader({
  size = 'medium',
  overlay = false,
  label,
}: PawLoaderProps) {
  const px = SIZE_PX[size];

  if (overlay) {
    return createPortal(
      <div className={styles.overlay}>
        <PpLogoLoader px={px} />
        {label && <span className={styles.overlayLabel}>{label}</span>}
      </div>,
      document.body,
    );
  }

  return <PawDots px={px} />;
}
