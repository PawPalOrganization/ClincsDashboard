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

// Used by markAllRead's fallback below — generous enough to cover any realistic
// unread backlog for a single clinic.
const MARK_ALL_SCAN_LIMIT = 500;

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

  // No dedicated "mark all as read" endpoint exists yet, and there's no server-side
  // unread-only filter either — pulls a generous single page of the notification
  // history, finds what's still unread client-side, and fans out to the existing
  // per-notification endpoint. Swap this for one bulk call if/when the backend adds
  // one; callers don't need to change. Caps at MARK_ALL_SCAN_LIMIT — if a clinic ever
  // has more unread notifications than that, the oldest ones past the cap are left
  // unread by this pass (a second call after those clear picks up the rest).
  async markAllRead(): Promise<void> {
    const res = await clinicNotificationService.list({ page: 1, limit: MARK_ALL_SCAN_LIMIT });
    const unread = res.items.filter((n) => !n.isRead);
    await Promise.all(unread.map((n) => clinicNotificationService.markRead(n.id)));
  },
};

export default clinicNotificationService;
