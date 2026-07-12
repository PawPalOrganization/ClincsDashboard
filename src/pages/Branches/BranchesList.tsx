import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type { ClinicBranch } from '../../types/clinic.types';
import type { Column } from '../../components/common/DataTable/DataTable';
import DataTable from '../../components/common/DataTable/DataTable';
import Button from '../../components/common/Button/Button';
import PageHeaderSkeleton from '../../components/common/Skeleton/PageHeaderSkeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import styles from './Branches.module.scss';

type BranchRow = ClinicBranch & Record<string, unknown>;

const LIMIT = 10;

type DisplayItem = string | number | { id?: string | number; name?: string; title?: string };

function asDisplayItems(value: unknown): DisplayItem[] {
  return Array.isArray(value) ? (value as DisplayItem[]) : [];
}

function displayItemKey(item: DisplayItem, index: number): string {
  if (typeof item === 'object' && item !== null && item.id != null) {
    return String(item.id);
  }
  return `${String(displayItemLabel(item))}-${index}`;
}

function displayItemLabel(item: DisplayItem): string {
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return item.name ?? item.title ?? (item.id != null ? String(item.id) : 'Unnamed');
}

export default function BranchesList() {
  const { clinicId, staff } = useClinicAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const canViewBranches   = hasClinicPermission(staff, 'clinic-branches.read');
  const canCreateBranch   = hasClinicPermission(staff, 'clinic-branches.create');
  const canUpdateBranch   = hasClinicPermission(staff, 'clinic-branches.update');
  const successMsg = (location.state as { successMsg?: string } | null)?.successMsg ?? '';

  const [branches, setBranches]       = useState<BranchRow[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(true);
  const [hasLoaded, setHasLoaded]     = useState(false);
  const [error, setError]             = useState('');

  const fetchBranches = useCallback(async (targetPage: number) => {
    if (!clinicId) return;
    setLoading(true);
    setError('');
    try {
      const result = await clinicBranchesService.list(clinicId, targetPage, LIMIT);
      setBranches(result.items as BranchRow[]);
      setTotal(result.meta.total);
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch pattern: fetchBranches flags loading, then fetches
    fetchBranches(1);
  }, [fetchBranches]);

  const columns: Column<BranchRow>[] = [
    {
      key: 'title',
      label: 'Branch Name',
      width: '200px',
      render: (row) => (
        <div className={styles.branchName}>
          <span className={styles.nameText}>{row.title}</span>
          {row.isMainBranch && (
            <span className={styles.mainBadge}>Main</span>
          )}
        </div>
      ),
    },
    {
      key: 'phoneNumber',
      label: 'Phone',
      width: '150px',
      render: (row) =>
        row.phoneNumber ? (
          <span className={styles.cellText}>
            <i className="bi bi-telephone" /> {row.phoneNumber}
          </span>
        ) : (
          <span className={styles.noData}>—</span>
        ),
    },
    {
      key: 'address',
      label: 'Address',
      render: (row) =>
        row.address ? (
          <span className={styles.addressText} title={row.address}>
            <i className="bi bi-geo-alt" /> {row.address}
          </span>
        ) : (
          <span className={styles.noData}>—</span>
        ),
    },
    {
      key: 'services',
      label: 'Services',
      width: '90px',
      render: (row) => {
        const services = asDisplayItems(row.services);
        return (
          <span className={styles.countBadge}>
            <i className="bi bi-grid" /> {services.length}
          </span>
        );
      },
    },
    {
      key: 'workingHours',
      label: 'Days Open',
      width: '100px',
      render: (row) => {
        const count = row.workingHours?.length ?? 0;
        return count > 0 ? (
          <span className={styles.countBadge}>
            <i className="bi bi-clock" /> {count} day{count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className={styles.noData}>—</span>
        );
      },
    },
    {
      key: 'tags',
      label: 'Tags',
      width: '180px',
      render: (row) => {
        const tags = asDisplayItems(row.tags);
        return tags.length > 0 ? (
          <div className={styles.tagList}>
            {tags.slice(0, 3).map((tag, index) => (
              <span key={displayItemKey(tag, index)} className={styles.tag}>
                {displayItemLabel(tag)}
              </span>
            ))}
            {tags.length > 3 && (
              <span className={styles.tagMore}>+{tags.length - 3}</span>
            )}
          </div>
        ) : (
          <span className={styles.noData}>—</span>
        );
      },
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

  if (!canViewBranches) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Branches access is restricted</h2>
        <p>Your current role does not include permission to view branches.</p>
      </div>
    );
  }

  const isInitialLoad = loading && !hasLoaded;

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      {isInitialLoad ? (
        <PageHeaderSkeleton />
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Branches</h1>
            <p className={styles.pageSubtitle}>
              {total > 0
                ? `${total} branch${total !== 1 ? 'es' : ''} in your clinic`
                : 'Manage your clinic branches'}
            </p>
          </div>
          {canCreateBranch && (
            <Button
              variant="primary"
              icon="bi-plus-lg"
              onClick={() => navigate('/branches/create')}
            >
              New Branch
            </Button>
          )}
        </div>
      )}

      {/* ── Success banner (from create / edit navigation) ── */}
      {successMsg && (
        <div className={`alert alert-success py-2 ${styles.errorAlert}`} role="alert">
          <i className="bi bi-check-circle-fill" /> {successMsg}
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className={`alert alert-danger py-2 ${styles.errorAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {error}
        </div>
      )}

      {/* ── Table / skeleton ── */}
      {isInitialLoad ? (
        <TablePageSkeleton columns={6} rows={6} />
      ) : (
        <DataTable
          columns={columns}
          data={branches}
          loading={loading}
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={(p) => fetchBranches(p)}
          onEdit={canUpdateBranch ? (row) => navigate(`/branches/${row.id}`) : undefined}
          emptyMessage="No branches found. Create your first branch to get started."
        />
      )}

    </div>
  );
}
