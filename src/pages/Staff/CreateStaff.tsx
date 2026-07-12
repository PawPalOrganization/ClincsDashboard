import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffRolesService from '../../services/clinic/clinicStaffRolesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { hasClinicPermission } from '../../utils/clinicPermissions';
import type {
  ClinicBranch,
  ClinicStaffRole,
  CreateClinicStaffPayload,
  UpdateClinicStaffPayload,
} from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import StaffForm from './StaffForm';
import styles from './Staff.module.scss';

export default function CreateStaff() {
  const { clinicId, staff } = useClinicAuth();
  const navigate = useNavigate();
  const canCreateStaff = hasClinicPermission(staff, 'clinic-staff.create');

  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [roles, setRoles] = useState<ClinicStaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!clinicId || !canCreateStaff) return;

    async function loadOptions() {
      setLoading(true);
      setLoadError('');

      const [branchesRes, rolesRes] = await Promise.allSettled([
        clinicBranchesService.list(clinicId!, 1, 100),
        clinicStaffRolesService.list(),
      ]);

      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.items);
      } else {
        setLoadError('Could not load branch options.');
      }

      if (rolesRes.status === 'fulfilled') {
        setRoles(rolesRes.value);
      } else {
        setLoadError((prev) =>
          prev ? `${prev} Could not load role options.` : 'Could not load role options.',
        );
      }

      setLoading(false);
    }

    loadOptions();
  }, [canCreateStaff, clinicId]);

  async function handleSubmit(payload: CreateClinicStaffPayload | UpdateClinicStaffPayload) {
    setSaving(true);
    setServerError('');

    try {
      await clinicStaffService.create(payload as CreateClinicStaffPayload);
      navigate('/staff', { state: { successMsg: 'Staff member created successfully.' } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create staff member.');
      setSaving(false);
    }
  }

  if (!clinicId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic is assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  if (!canCreateStaff) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Create staff is restricted</h2>
        <p>Your current clinic role can view staff, but cannot create new staff members.</p>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/staff')}>
          Back to Staff
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
            <h1 className={styles.pageTitle}>Create Staff</h1>
            <p className={styles.pageSubtitle}>Add a staff member to one visible branch</p>
          </div>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => navigate('/staff')}
            disabled={saving}
          >
            Back
          </Button>
        </div>

        {loadError && (
          <div className={`alert alert-danger py-2 ${styles.feedbackAlert}`} role="alert">
            <i className="bi bi-exclamation-circle-fill" /> {loadError}
          </div>
        )}

        {loading ? (
          <TablePageSkeleton columns={2} rows={4} />
        ) : (
          <StaffForm
            mode="create"
            branches={branches}
            roles={roles}
            saving={saving}
            serverError={serverError}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </>
  );
}
