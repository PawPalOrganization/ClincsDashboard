import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import clinicStaffRolesService from '../../services/clinic/clinicStaffRolesService';
import clinicStaffService from '../../services/clinic/clinicStaffService';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { hasAnyClinicPermission, hasClinicPermission } from '../../utils/clinicPermissions';
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

export default function DoctorInfo() {
  const { clinicId, staff: authStaff } = useClinicAuth();
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const canViewStaff = hasClinicPermission(authStaff, 'clinic-staff.read');
  const canUpdateStaff = hasClinicPermission(authStaff, 'clinic-staff.update');
  const canUpdateAssignments = hasClinicPermission(authStaff, 'clinic-staff.assignments');
  const canOpenStaffDetails = hasAnyClinicPermission(authStaff, [
    'clinic-staff.update',
    'clinic-staff.assignments',
  ]);

  const [doctor, setDoctor] = useState<ClinicStaff | null>(null);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [roles, setRoles] = useState<ClinicStaffRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!clinicId || !staffId || !canViewStaff) {
      setLoading(false);
      return;
    }

    async function loadDoctor() {
      setLoading(true);
      setLoadError('');

      const [staffRes, branchesRes, rolesRes] = await Promise.allSettled([
        clinicStaffService.getOne(staffId!),
        clinicBranchesService.list(clinicId!, 1, 100),
        clinicStaffRolesService.list(),
      ]);

      if (staffRes.status === 'fulfilled') {
        setDoctor(staffRes.value);
      } else {
        setLoadError('Could not load doctor profile.');
      }

      if (branchesRes.status === 'fulfilled') {
        setBranches(branchesRes.value.items);
      }

      if (rolesRes.status === 'fulfilled') {
        setRoles(rolesRes.value);
      }

      setLoading(false);
    }

    loadDoctor();
  }, [canViewStaff, clinicId, staffId]);

  async function handleSubmit(payload: CreateClinicStaffPayload | UpdateClinicStaffPayload) {
    if (!staffId) return;
    setSaving(true);
    setServerError('');

    try {
      await clinicStaffService.update(staffId, payload as UpdateClinicStaffPayload);
      navigate('/staff/doctors', { state: { successMsg: 'Doctor profile updated successfully.' } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save doctor profile.');
      setSaving(false);
    }
  }

  if (!clinicId || !staffId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic or doctor profile was found for this page.</p>
      </div>
    );
  }

  if (!canViewStaff || !canOpenStaffDetails) {
    return (
      <div className={styles.accessDenied}>
        <i className="bi bi-shield-lock" />
        <h2>Access restricted</h2>
        <p>Your current clinic role does not include permission to edit doctor profiles.</p>
        <Button variant="outline" icon="bi-arrow-left" onClick={() => navigate('/staff/doctors')}>
          Back to Doctors
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
            {loading ? (
              <>
                <Skeleton width="180px" height="26px" />
                <div style={{ marginTop: '6px' }}>
                  <Skeleton width="260px" height="14px" />
                </div>
              </>
            ) : (
              <>
                <h1 className={styles.pageTitle}>
                  {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Doctor Info'}
                </h1>
                <p className={styles.pageSubtitle}>
                  Manage professional profile and clinic assignments.
                </p>
              </>
            )}
          </div>
          <Button
            variant="outline"
            icon="bi-arrow-left"
            onClick={() => navigate('/staff/doctors')}
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

        {!loading && doctor && (
          <StaffForm
            mode="edit"
            defaultValues={doctor}
            branches={branches}
            roles={roles}
            saving={saving}
            serverError={serverError}
            readOnly={!canUpdateStaff}
            onSubmit={handleSubmit}
            childrenBeforeSubmit={
              <StaffAssignments
                staff={doctor}
                branches={branches}
                disabled={saving || !canUpdateAssignments}
                canEdit={canUpdateAssignments}
              />
            }
          />
        )}
      </div>
    </>
  );
}
