import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type { CreateBranchPayload, UpdateBranchPayload } from '../../types/clinic.types';
import BranchForm from './BranchForm';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import styles from './Branches.module.scss';

export default function CreateBranch() {
  const { clinicId, staff, updateStaff } = useClinicAuth();
  const navigate = useNavigate();
  const canCreateBranch = hasClinicPermission(staff, 'clinic-branches.create');

  const [saving, setSaving]           = useState(false);
  const [serverError, setServerError] = useState('');

  async function handleSubmit(payload: CreateBranchPayload | UpdateBranchPayload) {
    if (!clinicId) return;
    setSaving(true);
    setServerError('');
    try {
      const created = await clinicBranchesService.create(clinicId, payload as CreateBranchPayload);

      // The creator isn't automatically assigned to the branch they just made — without
      // this, they'd have no access to it until someone else manually assigns them.
      // Owners are excluded: the assignments endpoint explicitly rejects touching an
      // owner's own assignment set (owners already have clinic-wide access some other
      // way), so there's nothing to add for them here.
      if (staff && !staff.isOwner) {
        try {
          const existingBranchIds = (staff.branches ?? []).map((b) => Number(b.id));
          const refreshedStaff = await clinicStaffService.updateAssignments(staff.id, {
            clinicBranchIds: [...existingBranchIds, Number(created.id)],
          });
          updateStaff(refreshedStaff);
        } catch {
          // The branch itself was already created successfully — don't fail the whole
          // flow over the self-assignment step; worst case matches the old behavior
          // (someone assigns them to it after the fact).
        }
      }

      navigate('/branches', { state: { successMsg: 'Branch created successfully.' } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create branch.');
      setSaving(false);
    }
  }

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  if (!canCreateBranch) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Create branch is restricted</h2>
        <p>Your current role does not include permission to create branches.</p>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/branches')}>
          Back to Branches
        </Button>
      </div>
    );
  }

  return (
    <>
      {saving && <PawLoader size="large" overlay />}

      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>New Branch</h1>
            <p className={styles.pageSubtitle}>Add a new location to your clinic</p>
          </div>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => navigate('/branches')}
            disabled={saving}
          >
            Back
          </Button>
        </div>

        <BranchForm
          mode="create"
          onSubmit={handleSubmit}
          saving={saving}
          serverError={serverError}
          clinicId={clinicId ?? undefined}
        />
      </div>
    </>
  );
}
