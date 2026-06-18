import { useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import type { ClinicNotification, ClinicStaff } from '../types/clinic.types';

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
}

export function useClinicPusher({
  token,
  staff,
  branchId,
  onNotification,
}: UseClinicPusherOptions) {
  // Keep callback ref stable so the effect doesn't re-run when the parent re-renders
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  // Deduplicate events that arrive on multiple subscribed channels or on reconnect
  const seenIdsRef = useRef<Set<number | string>>(new Set());

  useEffect(() => {
    if (!token || !PUSHER_KEY || !PUSHER_CLUSTER) return;

    const branchIds = getAccessibleBranchIds(staff, branchId);
    if (branchIds.length === 0) return;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: '/clinic/api/pusher/auth',
      auth: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    for (const id of branchIds) {
      const channel = pusher.subscribe(`private-branch-${id}`);

      channel.bind('notification.created', (data: ClinicNotification) => {
        if (!data?.id || seenIdsRef.current.has(data.id)) return;
        seenIdsRef.current.add(data.id);
        callbackRef.current(data);
      });

      // Log auth failures quietly — REST polling continues as fallback
      channel.bind('pusher:subscription_error', (err: unknown) => {
        console.warn(`[Pusher] auth failed for private-branch-${id}`, err);
      });
    }

    pusher.connection.bind('error', (err: unknown) => {
      console.warn('[Pusher] connection error — relying on REST polling', err);
    });

    return () => {
      for (const id of branchIds) {
        pusher.unsubscribe(`private-branch-${id}`);
      }
      pusher.disconnect();
    };
  // Re-connect when token or branch access changes (e.g. after login)
  }, [token, staff, branchId]);
}
