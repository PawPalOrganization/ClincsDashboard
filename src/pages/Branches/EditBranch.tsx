import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import type { ClinicBranch, CreateBranchPayload, UpdateBranchPayload } from '../../types/clinic.types';
import BranchForm from './BranchForm';
import type { BranchFormInitialValues } from './BranchForm';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import Skeleton from '../../components/common/Skeleton/Skeleton';
import TablePageSkeleton from '../../components/common/Skeleton/TablePageSkeleton';
import styles from './Branches.module.scss';

export default function EditBranch() {
  const { clinicId }          = useClinicAuth();
  const { branchId }          = useParams<{ branchId: string }>();
  const navigate              = useNavigate();

  const [branch, setBranch]           = useState<ClinicBranch | null>(null);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!clinicId || !branchId) {
      setLoading(false);
      return;
    }

    async function fetchBranch() {
      try {
        const data = await clinicBranchesService.getOne(clinicId!, branchId!);
        setBranch(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load branch.');
      } finally {
        setLoading(false);
      }
    }

    fetchBranch();
  }, [clinicId, branchId]);

  async function handleSubmit(payload: CreateBranchPayload | UpdateBranchPayload) {
    if (!clinicId || !branchId) return;
    setSaving(true);
    setServerError('');
    try {
      await clinicBranchesService.update(clinicId, branchId, payload as UpdateBranchPayload);
      navigate('/branches', { state: { successMsg: 'Branch updated successfully.' } });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to save changes.');
      setSaving(false);
    }
  }

  if (!clinicId || !branchId) {
    return (
      <div className={styles.noClinic}>
        <i className="bi bi-exclamation-circle" />
        <p>No clinic assigned to your account. Contact your administrator.</p>
      </div>
    );
  }

  const defaultValues: BranchFormInitialValues | undefined = branch
    ? {
        title:        branch.title,
        description:  branch.description,
        logoUrl:      branch.logoUrl,
        isMainBranch: branch.isMainBranch,
        phoneNumber:  branch.phoneNumber,
        lat:          branch.lat,
        lng:          branch.lng,
        address:      branch.address,
        serviceIds:   branch.serviceIds,
        tags:         branch.tags,
        workingHours: branch.workingHours,
      }
    : undefined;

  return (
    <>
      {saving && <PawLoader size="large" overlay />}

      <div className={styles.page}>

        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <div>
            {loading ? (
              <>
                <Skeleton width="200px" height="26px" />
                <div style={{ marginTop: '6px' }}>
                  <Skeleton width="120px" height="14px" />
                </div>
              </>
            ) : (
              <>
                <h1 className={styles.pageTitle}>{branch?.title ?? 'Edit Branch'}</h1>
                <p className={styles.pageSubtitle}>Edit branch details</p>
              </>
            )}
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

        {/* ── Fetch error ── */}
        {fetchError && (
          <div className={`alert alert-danger py-2 ${styles.errorAlert}`} role="alert">
            <i className="bi bi-exclamation-circle-fill" /> {fetchError}
          </div>
        )}

        {/* ── Skeleton while loading ── */}
        {loading && <TablePageSkeleton columns={2} rows={5} />}

        {/* ── Form — only mounts once data is ready ── */}
        {!loading && !fetchError && (
          <BranchForm
            mode="edit"
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            saving={saving}
            serverError={serverError}
          />
        )}

      </div>
    </>
  );
}
