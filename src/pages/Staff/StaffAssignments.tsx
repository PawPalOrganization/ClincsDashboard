import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button/Button';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import type { ClinicBranch, ClinicStaff } from '../../types/clinic.types';
import styles from './Staff.module.scss';

interface StaffAssignmentsProps {
  staff: ClinicStaff;
  branches: ClinicBranch[];
  disabled?: boolean;
}

function getInitialBranchIds(staff: ClinicStaff, branches: ClinicBranch[]): string[] {
  const visibleIds = new Set(branches.map((branch) => String(branch.id)));
  const assignedIds =
    staff.branches && staff.branches.length > 0
      ? staff.branches.map((branch) => String(branch.id))
      : staff.clinicBranchId != null
        ? [String(staff.clinicBranchId)]
        : [];

  return assignedIds.filter((id) => visibleIds.has(id));
}

export default function StaffAssignments({
  staff,
  branches,
  disabled = false,
}: StaffAssignmentsProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    getInitialBranchIds(staff, branches),
  );
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const visibleBranchIds = useMemo(
    () => new Set(branches.map((branch) => String(branch.id))),
    [branches],
  );

  useEffect(() => {
    setSelectedIds(getInitialBranchIds(staff, branches));
    setSuccessMsg('');
    setErrorMsg('');
  }, [staff, branches]);

  function toggleBranch(branchId: string) {
    if (!visibleBranchIds.has(branchId)) return;

    setSelectedIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
    setSuccessMsg('');
    setErrorMsg('');
  }

  async function handleSave() {
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await clinicStaffService.updateAssignments(staff.id, {
        clinicBranchIds: selectedIds,
      });
      setSuccessMsg('Branch assignments updated successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update branch assignments.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-diagram-3" /> Branch Assignments
        </h2>
        <p className={styles.sectionDesc}>
          Choose from the branches this portal account is allowed to assign.
        </p>
      </div>

      <div className={styles.assignmentScopeNote}>
        <i className="bi bi-info-circle" />
        <span>
          Only branches returned by the clinic portal API appear here. If the admin dashboard
          has more branches, an admin or backend permission change is needed before they can be
          assigned from this portal.
        </span>
      </div>

      {successMsg && (
        <div className={`alert alert-success py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-check-circle-fill" /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
          <i className="bi bi-exclamation-circle-fill" /> {errorMsg}
        </div>
      )}

      {branches.length === 0 ? (
        <div className={styles.assignmentEmpty}>
          <i className="bi bi-building" />
          <p>No visible branches are available for assignment.</p>
        </div>
      ) : (
        <>
          <div className={styles.assignmentList}>
            {branches.map((branch) => {
              const branchId = String(branch.id);
              const checked = selectedIds.includes(branchId);

              return (
                <label
                  key={branchId}
                  className={`${styles.assignmentOption} ${
                    checked ? styles.assignmentOptionActive : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBranch(branchId)}
                    disabled={disabled || saving}
                  />
                  <span className={styles.assignmentText}>
                    <strong>{branch.title}</strong>
                    {branch.address && <small>{branch.address}</small>}
                  </span>
                  {branch.isMainBranch && <span className={styles.mainBranchBadge}>Main</span>}
                </label>
              );
            })}
          </div>

          <p className={styles.assignmentHint}>
            Saving sends the full checked branch list and replaces the current assignments.
          </p>

          <div className={styles.assignmentActions}>
            <Button
              type="button"
              variant="primary"
              loading={saving}
              disabled={disabled || saving}
              onClick={handleSave}
            >
              Save Assignments
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
