import { ApiError } from './clinicApi';
import type { ApiResponse, UploadedFile } from '../../types/clinic.types';

const clinicFilesService = {
  async upload(file: File): Promise<UploadedFile> {
    const token = localStorage.getItem('clinicStaffToken');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/clinic/api/files/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.message ?? 'Upload failed');
    }
    const json = await res.json() as ApiResponse<UploadedFile>;
    return json.data;
  },
};

export default clinicFilesService;
