import { useEffect, useLayoutEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import type {
  ClinicNotification,
  ClinicStaff,
  DataShareApprovedEvent,
  DataShareDeniedEvent,
  Review,
  ReviewDeletedEvent,
} from '../types/clinic.types';

const PUSHER_KEY     = import.meta.env.VITE_PUSHER_KEY     as string | undefined;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined;

function getAccessibleBranchIds(
  staff: ClinicStaff | null,
  branchId: string | null,
): number[] {
  if (!staff) return [];

  // Multi-branch: branches array is populated on the staff object
  if (staff.branches && staff.branches.length > 0) {
    return staff.branches.map((b) => Number(b.id)).filter(Boolean);
  }

  // Single-branch staff
  if (staff.clinicBranchId) return [Number(staff.clinicBranchId)];

  // Auth-context fallback
  if (branchId) return [Number(branchId)];

  return [];
}

interface UseClinicPusherOptions {
  token: string | null;
  staff: ClinicStaff | null;
  branchId: string | null;
  onNotification: (n: ClinicNotification) => void;
  onDataShareApproved?: (event: DataShareApprovedEvent) => void;
  onDataShareDenied?: (event: DataShareDeniedEvent) => void;
  onReviewCreated?: (review: Review) => void;
  onReviewUpdated?: (review: Review) => void;
  onReviewDeleted?: (event: ReviewDeletedEvent) => void;
}

export function useClinicPusher({
  token,
  staff,
  branchId,
  onNotification,
  onDataShareApproved,
  onDataShareDenied,
  onReviewCreated,
  onReviewUpdated,
  onReviewDeleted,
}: UseClinicPusherOptions) {
  // Keep callback refs stable so the effect doesn't re-run when parent re-renders.
  // Synced via useLayoutEffect (not assigned during render) so refs never get
  // mutated during React's render phase — updated before the browser paints,
  // so no event can fire against a stale callback in between.
  const notificationRef = useRef(onNotification);
  const approvedRef = useRef(onDataShareApproved);
  const deniedRef = useRef(onDataShareDenied);
  const reviewCreatedRef = useRef(onReviewCreated);
  const reviewUpdatedRef = useRef(onReviewUpdated);
  const reviewDeletedRef = useRef(onReviewDeleted);

  useLayoutEffect(() => {
    notificationRef.current = onNotification;
    approvedRef.current = onDataShareApproved;
    deniedRef.current = onDataShareDenied;
    reviewCreatedRef.current = onReviewCreated;
    reviewUpdatedRef.current = onReviewUpdated;
    reviewDeletedRef.current = onReviewDeleted;
  });

  // Deduplicate events that arrive on multiple subscribed channels or on reconnect
  const seenIdsRef = useRef<Set<number | string>>(new Set());

  useEffect(() => {
    if (!token || !PUSHER_KEY || !PUSHER_CLUSTER) return;

    const branchIds = getAccessibleBranchIds(staff, branchId);
    const staffId = staff?.id ? Number(staff.id) : null;

    // Need at least one branch OR a staffId to bother connecting
    if (branchIds.length === 0 && !staffId) return;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: '/clinic/api/pusher/auth',
      auth: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // ── Branch channels — notifications ──────────────────────────────────────
    for (const id of branchIds) {
      const channel = pusher.subscribe(`private-branch-${id}`);

      channel.bind('notification.created', (data: ClinicNotification) => {
        if (!data?.id || seenIdsRef.current.has(data.id)) return;
        seenIdsRef.current.add(data.id);
        notificationRef.current(data);
      });

      channel.bind('review.created', (data: Review) => {
        reviewCreatedRef.current?.(data);
      });

      channel.bind('review.updated', (data: Review) => {
        reviewUpdatedRef.current?.(data);
      });

      channel.bind('review.deleted', (data: ReviewDeletedEvent) => {
        reviewDeletedRef.current?.(data);
      });

      channel.bind('pusher:subscription_error', (err: unknown) => {
        console.warn(`[Pusher] auth failed for private-branch-${id}`, err);
      });
    }

    // ── Staff channel — data-share consent events ─────────────────────────────
    if (staffId) {
      const staffChannel = pusher.subscribe(`private-staff-${staffId}`);

      staffChannel.bind('data_share.approved', (data: DataShareApprovedEvent) => {
        approvedRef.current?.(data);
      });

      staffChannel.bind('data_share.denied', (data: DataShareDeniedEvent) => {
        deniedRef.current?.(data);
      });

      staffChannel.bind('pusher:subscription_error', (err: unknown) => {
        console.warn(`[Pusher] auth failed for private-staff-${staffId}`, err);
      });
    }

    pusher.connection.bind('error', (err: unknown) => {
      console.warn('[Pusher] connection error — relying on REST polling', err);
    });

    return () => {
      for (const id of branchIds) {
        pusher.unsubscribe(`private-branch-${id}`);
      }
      if (staffId) pusher.unsubscribe(`private-staff-${staffId}`);
      pusher.disconnect();
    };
  // Re-connect when token or branch/staff access changes (e.g. after login)
  }, [token, staff, branchId]);
}
