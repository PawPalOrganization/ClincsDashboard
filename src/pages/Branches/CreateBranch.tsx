import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import clinicBranchesService from '../../services/clinic/clinicBranchesService';
import type { CreateBranchPayload, UpdateBranchPayload } from '../../types/clinic.types';
import BranchForm from './BranchForm';
import Button from '../../components/common/Button/Button';
import PawLoader from '../../components/common/PawLoader/PawLoader';
import styles from './Branches.module.scss';

export default function CreateBranch() {
  const { clinicId } = useClinicAuth();
  const navigate = useNavigate();

  const [saving, setSaving]           = useState(false);
  const [serverError, setServerError] = useState('');

  async function handleSubmit(payload: CreateBranchPayload | UpdateBranchPayload) {
    if (!clinicId) return;
    setSaving(true);
    setServerError('');
    try {
      await clinicBranchesService.create(clinicId, payload as CreateBranchPayload);
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
        />
      </div>
    </>
  );
}
