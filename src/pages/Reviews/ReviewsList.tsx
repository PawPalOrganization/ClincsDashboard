import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicReviewsService from '../../services/clinic/clinicReviewsService';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicProfileService from '../../services/clinic/clinicProfileService';
import { useClinicPusher } from '../../hooks/useClinicPusher';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type { ClinicBranch, Review, ReviewListParams } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import styles from './Reviews.module.scss';

type ReviewRow = Review & Record<string, unknown>;
type SortOption = NonNullable<ReviewListParams['sort']>;

const LIMIT = 15;

function reviewerName(row: Review): string {
  if (row.reviewerName) return row.reviewerName;
  const full = row.user ? `${row.user.firstName ?? ''} ${row.user.lastName ?? ''}`.trim() : '';
  if (full) return full;
  if (row.userId) return `User #${row.userId}`;
  return 'Anonymous';
}

// The backend's nested-branch field on a review row isn't pinned down by the Postman
// collection (no saved example responses) — the admin dashboard hit the same gap and
// found the field is sometimes `clinicBranch`, not `branch`. Check both, then fall back
// to looking the id up in the branches list this page already loads for the filter
// dropdown — that only needs `clinicBranchId`, which is reliably present, so it works
// regardless of what (or whether) the backend names the nested relation.
function branchTitleFor(row: Review, branchesById: Map<string, string>): string | undefined {
  const nested = row.branch?.title
    ?? (row as unknown as { clinicBranch?: { title?: string } }).clinicBranch?.title;
  if (nested) return nested;
  if (row.clinicBranchId != null) return branchesById.get(String(row.clinicBranchId));
  return undefined;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function StarRating({ value, size }: { value: number; size?: 'lg' }) {
  const rounded = Math.round(value);
  return (
    <span className={`${styles.stars} ${size === 'lg' ? styles.starsLg : ''}`} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= rounded ? 'bi-star-fill' : 'bi-star'}`} />
      ))}
    </span>
  );
}

export default function ReviewsList() {
  const { clinicId, staff: authStaff, token, branchId: authBranchId } = useClinicAuth();
  const queryClient = useQueryClient();

  const canView = hasClinicPermission(authStaff, 'reviews.read');

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [sort, setSort] = useState<SortOption>('latest');

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');

  // Reused React Query key — the sidebar already fetches/caches this, so this page
  // rides the same cache instead of firing a duplicate request most of the time.
  const { data: clinic } = useQuery({
    queryKey: ['clinicProfile', clinicId],
    queryFn: () => clinicProfileService.get(clinicId!),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!clinicId) return;
    clinicBranchesService.list(clinicId, 1, 100)
      .then((res) => setBranches(res.items))
      .catch(() => {})
      .finally(() => setLoadingBranches(false));
  }, [clinicId]);

  const fetchReviews = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    try {
      const result = selectedBranchId
        ? await clinicReviewsService.listForBranch(clinicId, selectedBranchId, { page, limit: LIMIT, sort })
        : await clinicReviewsService.listForClinic(clinicId, { page, limit: LIMIT, sort });
      setReviews(result.items as ReviewRow[]);
      setTotal(result.meta.total);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [clinicId, selectedBranchId, sort, page]);

  useEffect(() => {
    if (!clinicId || !canView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchReviews flags loading, then fetches
    fetchReviews();
  }, [canView, clinicId, fetchReviews]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  // A review event only matters to what's on screen if it belongs to the branch
  // currently filtered (or no filter is set, i.e. viewing the whole clinic) — refetch
  // the list plus the rating summary (clinic profile + branch list) when that's the case.
  const handleReviewEvent = useCallback((event: { clinicBranchId?: number }) => {
    if (selectedBranchId && String(event.clinicBranchId) !== String(selectedBranchId)) return;
    fetchReviews();
    queryClient.invalidateQueries({ queryKey: ['clinicProfile', clinicId] });
    if (clinicId) {
      clinicBranchesService.list(clinicId, 1, 100).then((res) => setBranches(res.items)).catch(() => {});
    }
  }, [selectedBranchId, fetchReviews, queryClient, clinicId]);

  useClinicPusher({
    token,
    staff: authStaff,
    branchId: authBranchId,
    onNotification: () => {},
    onReviewCreated: handleReviewEvent,
    onReviewUpdated: handleReviewEvent,
    onReviewDeleted: handleReviewEvent,
  });

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.id) === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const branchesById = useMemo(
    () => new Map(branches.map((b) => [String(b.id), b.title])),
    [branches],
  );

  const headerAvgRating = selectedBranch ? selectedBranch.avgRating : clinic?.avgRating;
  const headerReviewsCount = selectedBranch ? selectedBranch.reviewsCount : clinic?.reviewsCount;
  const headerReviewsEnabled = selectedBranch ? selectedBranch.reviewsEnabled : clinic?.reviewsEnabled;

  const columns: Column<ReviewRow>[] = [
    {
      key: 'reviewer',
      label: 'Reviewer',
      width: '190px',
      render: (row) => (
        <div className={styles.reviewerCell}>
          <div className={styles.avatar}>{reviewerName(row).slice(0, 2).toUpperCase()}</div>
          <span>{reviewerName(row)}</span>
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      width: '140px',
      render: (row) => <StarRating value={row.rating} />,
    },
    {
      key: 'comment',
      label: 'Comment',
      render: (row) => row.comment
        ? <span className={styles.commentText}>{row.comment}</span>
        : <span className={styles.noData}>No comment</span>,
    },
    ...(selectedBranchId ? [] : [{
      key: 'branch',
      label: 'Branch',
      width: '160px',
      render: (row: ReviewRow) => {
        const title = branchTitleFor(row, branchesById);
        return title
          ? <span className={styles.branchPill}>{title}</span>
          : <span className={styles.noData}>—</span>;
      },
    }]),
    {
      key: 'createdAt',
      label: 'Date',
      width: '120px',
      render: (row) => <span className={styles.cellText}>{formatDate(row.createdAt)}</span>,
    },
  ];

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Reviews access restricted</h2>
        <p>Your current clinic role does not include permission to view reviews.</p>
      </div>
    );
  }

  const isInitialLoad = loading && !hasLoaded;

  return (
    <div className={styles.page}>
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Reviews</h1>
            <p className={styles.pageSubtitle}>
              {selectedBranch ? `Reviews for ${selectedBranch.title}` : 'Reviews across all your branches'}
            </p>
          </div>

          <div className={styles.ratingSummary}>
            <StarRating value={headerAvgRating ?? 0} size="lg" />
            <div className={styles.ratingSummaryText}>
              <span className={styles.ratingValue}>
                {headerAvgRating != null ? headerAvgRating.toFixed(1) : '—'}
              </span>
              <span className={styles.ratingCount}>
                {headerReviewsCount ? `${headerReviewsCount} review${headerReviewsCount !== 1 ? 's' : ''}` : 'No reviews yet'}
              </span>
            </div>
            {headerReviewsEnabled === false && (
              <span className={styles.reviewsDisabledBadge}>
                <i className="bi bi-eye-slash" /> Reviews disabled
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error}
        </div>
      )}

      {!isInitialLoad && (
        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={selectedBranchId}
            onChange={(e) => { setSelectedBranchId(e.target.value); setPage(1); }}
            disabled={loadingBranches}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>{b.title}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
          >
            <option value="latest">Sort: Latest</option>
            <option value="highest">Sort: Highest rated</option>
            <option value="lowest">Sort: Lowest rated</option>
          </select>
        </div>
      )}

      {isInitialLoad ? (
        <TablePageSkeleton columns={4} rows={6} />
      ) : (
        <DataTable
          columns={columns}
          data={reviews}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
          emptyMessage={selectedBranchId ? 'No reviews for this branch yet.' : 'No reviews yet.'}
        />
      )}
    </div>
  );
}
