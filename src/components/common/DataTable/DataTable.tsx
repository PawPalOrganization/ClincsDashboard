import { memo } from 'react';
import type { ReactNode } from 'react';
import TablePageSkeleton from '../Skeleton/TablePageSkeleton';
import styles from './DataTable.module.scss';

export interface DataRow {
  id?: string | number;
  [key: string]: unknown;
}

export interface Column<T extends DataRow> {
  key: string;
  label: ReactNode;
  width?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends DataRow> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  /** Rows per page, used only for the "Showing X to Y of Z" footer caption. Defaults to 10. */
  pageSize?: number;
  onPageChange: (page: number) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyMessage?: string;
}

function DataTableInner<T extends DataRow>({
  columns,
  data,
  loading = false,
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onEdit,
  onDelete,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  function renderPagination(): ReactNode {
    if (totalPages <= 1) return null;

    const maxVisiblePages = 4;
    const jumpSize = 10;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) pages.push(i);

    return (
      <div className={`${styles.pagination} ${loading ? styles.paginationLoading : ''}`}>
        <button
          className={styles.pageButton}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage === 1}
          title="Previous page"
        >
          <i className="bi bi-chevron-left" />
        </button>

        {startPage > 1 && (
          <>
            <button className={styles.pageButton} onClick={() => onPageChange(1)} disabled={loading}>
              1
            </button>
            {startPage > 2 && (
              <button
                className={styles.jumpButton}
                onClick={() => onPageChange(Math.max(1, startPage - jumpSize))}
                disabled={loading}
                title={`Back ${jumpSize} pages`}
              >
                <i className="bi bi-chevron-double-left" />
              </button>
            )}
          </>
        )}

        {pages.map((page) => (
          <button
            key={page}
            className={[
              styles.pageButton,
              currentPage === page ? styles.active : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onPageChange(page)}
            disabled={loading}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <button
                className={styles.jumpButton}
                onClick={() => onPageChange(Math.min(totalPages, endPage + jumpSize))}
                disabled={loading}
                title={`Forward ${jumpSize} pages`}
              >
                <i className="bi bi-chevron-double-right" />
              </button>
            )}
            <button
              className={styles.pageButton}
              onClick={() => onPageChange(totalPages)}
              disabled={loading}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          className={styles.pageButton}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage === totalPages}
          title="Next page"
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    );
  }

  if (loading && (!data || data.length === 0)) {
    return <TablePageSkeleton columns={columns.length} rows={8} />;
  }

  if (!loading && (!data || data.length === 0)) {
    return (
      <div className={styles.emptyContainer}>
        <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#7F8C8D' }} />
        <p className={styles.emptyMessage}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete) && <th style={{ width: '120px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody className={loading ? styles.tbodyLoading : ''}>
            {data.map((row, index) => (
              <tr key={row.id != null ? String(row.id) : index}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : (row[col.key] as ReactNode)}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td>
                    <div className={styles.actions}>
                      {onEdit && (
                        <button
                          className={`${styles.actionButton} ${styles.edit}`}
                          onClick={() => onEdit(row)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className={`${styles.actionButton} ${styles.delete}`}
                          onClick={() => onDelete(row)}
                          title="Delete"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFooter}>
        <div className={styles.itemsInfo}>
          Showing {(currentPage - 1) * pageSize + 1} to{' '}
          {Math.min(currentPage * pageSize, totalItems)} of {totalItems} items
        </div>
        {renderPagination()}
      </div>
    </div>
  );
}

// memo wrapper — generic components can't be directly passed to memo, so we cast
const DataTable = memo(DataTableInner) as typeof DataTableInner;
export default DataTable;
