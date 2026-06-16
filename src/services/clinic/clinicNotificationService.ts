import clinicApi from './clinicApi';
import type {
  ApiResponse,
  ClinicNotification,
  PaginatedList,
  PaginatedResponse,
} from '../../types/clinic.types';

type NotificationListResponse =
  | PaginatedResponse<ClinicNotification>
  | ApiResponse<ClinicNotification[]>;

const clinicNotificationService = {
  async list(params?: { page?: number; limit?: number }): Promise<PaginatedList<ClinicNotification>> {
    const res = await clinicApi.get<NotificationListResponse>('/notifications', {
      page: params?.page,
      limit: params?.limit,
    });

    const raw = res.data;
    if (Array.isArray(raw)) {
      return {
        items: raw,
        meta: {
          total: raw.length,
          page: params?.page ?? 1,
          limit: params?.limit ?? raw.length,
          totalPages: 1,
        },
      };
    }
    return raw;
  },

  async markRead(id: string | number): Promise<ClinicNotification> {
    const res = await clinicApi.patch<ApiResponse<ClinicNotification>>(
      `/notifications/${id}/read`,
      {},
    );
    return res.data;
  },
};

export default clinicNotificationService;
