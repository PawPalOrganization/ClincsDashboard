import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clinicNotificationService from '../services/clinic/clinicNotificationService';
import type { ClinicNotification, PaginatedList } from '../types/clinic.types';

// A single query-key prefix shared by every notifications fetch (the sidebar's latest-10
// and the full /notifications page's paginated view alike) — the actual fix for "the bell
// and the page don't agree on what's read": both mark-read paths invalidate this same
// prefix, so whichever of the two is currently mounted refetches and shows the same state.
export const NOTIFICATIONS_QUERY_KEY = 'clinicNotifications';

export function useClinicNotifications(
  page: number,
  limit: number,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY, page, limit],
    queryFn: () => clinicNotificationService.list({ page, limit }),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

// meta.unreadCount is the clinic-wide count when the backend sends it; falls back to
// counting unread items in this response only otherwise.
export function unreadCountOf(result: PaginatedList<ClinicNotification> | undefined): number {
  if (!result) return 0;
  const metaUnread = (result.meta as unknown as Record<string, unknown>).unreadCount;
  return typeof metaUnread === 'number' ? metaUnread : result.items.filter((n) => !n.isRead).length;
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string | number) => clinicNotificationService.markRead(id),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => clinicNotificationService.markAllRead(),
    onSuccess: invalidate,
  });
}

// Called when a Pusher `notification.created` event arrives — splices the new
// notification straight into every currently-cached notifications page for an instant
// update (no network round trip for the common case), then invalidates so
// meta.unreadCount and pagination reconcile against the server right after.
export function usePrependNotification() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateNotifications();
  return (n: ClinicNotification) => {
    queryClient.setQueriesData<PaginatedList<ClinicNotification> | undefined>(
      { queryKey: [NOTIFICATIONS_QUERY_KEY] },
      (old) => {
        if (!old || old.items.some((existing) => existing.id === n.id)) return old;
        return { ...old, items: [n, ...old.items] };
      },
    );
    invalidate();
  };
}
