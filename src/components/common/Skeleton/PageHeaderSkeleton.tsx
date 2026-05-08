import Skeleton from './Skeleton';
import styles from './PageHeaderSkeleton.module.scss';

export default function PageHeaderSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Skeleton width="200px" height="28px" />
          <div style={{ marginTop: '8px' }}>
            <Skeleton width="150px" height="14px" />
          </div>
        </div>
        <Skeleton width="120px" height="42px" variant="rectangular" />
      </div>

      <div className={styles.searchBar}>
        <Skeleton width="400px" height="44px" variant="rectangular" />
      </div>
    </div>
  );
}
