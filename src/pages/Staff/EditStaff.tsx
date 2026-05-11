import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffRolesService from '../../services/clinic/clinicStaffRolesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import type {
  ClinicBranch,
  ClinicStaff,
  ClinicStaffRole,
  CreateClinicStaffPayload,
  UpdateClinicStaffPayload,
} from '../../types/clinic.types';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import StaffForm from './StaffForm';
import StaffAssignments from './StaffAssignments';
import styles from './Staff.module.scss';

export default function EditStaff() {
  const { clinicId } = useClinicAuth();
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();

  const [staff, setStaff] = useState<ClinicStaff | null>(null);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [roles, setRoles] = useState<ClinicStaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!clinicId || !staffId) {
      setLoading(false);
      return;
    }

    async function loadStaffPage() {
      setLoading(true);
      setLoadError('');

      const [staffRes, branchesRes, rolesRes] = await Promise.allSettled([
        clinicStaffService.getOne(staffId!),
        clinicBranchesService.list(clinicId!, 1, 100),
        clinicStaffRolesService.list(),
      ]);

      if (staffRes.status === 'fulfilled') {
        setStaff(staffRes.value);
      } else {
        setLoadError('Could not load staff member.');
      }

      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.items);
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

    loadStaffPage();
  }, [clinicId, staffId]);

  async function handleSubmit(payload: CreateClinicStaffPayload | UpdateClinicStaffPayload) {
    if (!staffId) return;
    setSaving(true);
    setServerError('');

    try {
      await clinicStaffService.update(staffId, payload as UpdateClinicStaffPayload);
      navigate('/staff', { state: { successMsg: 'Staff member updated successfully.' } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save staff member.');
      setSaving(false);
    }
  }

  if (!clinicId || !staffId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic or staff member was found for this page.</p>
      </div>
    );
  }

  return (
    <>
      {saving && <PawLoader size="large" overlay />}

      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            {loading ? (
              <>
                <Skeleton width="180px" height="26px" />
                <div style={{ marginTop: '6px' }}>
                  <Skeleton width="140px" height="14px" />
                </div>
              </>
            ) : (
              <>
                <h1 className={styles.pageTitle}>
                  {staff ? `${staff.firstName} ${staff.lastName}` : 'Edit Staff'}
                </h1>
                <p className={styles.pageSubtitle}>Edit staff profile fields</p>
              </>
            )}
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

        {loading && <TablePageSkeleton columns={2} rows={5} />}

        {!loading && staff && (
          <>
            <StaffForm
              mode="edit"
              defaultValues={staff}
              branches={branches}
              roles={roles}
              saving={saving}
              serverError={serverError}
              onSubmit={handleSubmit}
              childrenBeforeSubmit={
                <StaffAssignments
                  staff={staff}
                  branches={branches}
                  disabled={saving}
                />
              }
            />
          </>
        )}
      </div>
    </>
  );
}
