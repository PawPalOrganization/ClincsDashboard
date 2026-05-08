import Skeleton from './Skeleton';
import styles from './TablePageSkeleton.module.scss';

interface TablePageSkeletonProps {
  columns?: number;
  rows?: number;
}

export default function TablePageSkeleton({ columns = 6, rows = 8 }: TablePageSkeletonProps) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeader}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className={styles.headerCell}>
            <Skeleton width="70%" height="14px" />
          </div>
        ))}
        <div className={styles.headerCell}>
          <Skeleton width="60px" height="14px" />
        </div>
      </div>

      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className={styles.tableRow}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className={styles.tableCell}>
              <Skeleton
                width={colIndex === 0 ? '85%' : colIndex === 1 ? '75%' : '65%'}
                height="14px"
              />
            </div>
          ))}
          <div className={styles.tableCell}>
            <div className={styles.actions}>
              <Skeleton width="32px" height="32px" variant="circular" />
              <Skeleton width="32px" height="32px" variant="circular" />
            </div>
          </div>
        </div>
      ))}

      <div className={styles.tableFooter}>
        <Skeleton width="180px" height="16px" />
        <div className={styles.pagination}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="36px" height="36px" variant="rectangular" />
          ))}
        </div>
      </div>
    </div>
  );
}
