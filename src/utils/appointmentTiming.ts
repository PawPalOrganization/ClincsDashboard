const FINISH_WINDOW_MS = 60 * 60 * 1000;

// Staff shouldn't be able to mark an appointment finished before it has actually
// happened — this opens up starting 1 hour before the scheduled time, so an early
// arrival can still be closed out without waiting for the exact minute to tick over.
export function canFinishAppointment(scheduledAt: string): boolean {
  const scheduledMs = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduledMs)) return true;
  return Date.now() >= scheduledMs - FINISH_WINDOW_MS;
}
