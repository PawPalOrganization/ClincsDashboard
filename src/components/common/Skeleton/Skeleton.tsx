import type { CSSProperties } from 'react';
import styles from './Skeleton.module.scss';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: SkeletonVariant;
  className?: string;
  maxWidth?: string;
}

export default function Skeleton({
  width = '100%',
  height = '16px',
  variant = 'text',
  className = '',
  maxWidth,
}: SkeletonProps) {
  const style: CSSProperties = { width, height };
  if (maxWidth) style.maxWidth = maxWidth;

  return (
    <div
      className={[styles.skeleton, styles[variant], className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    />
  );
}
