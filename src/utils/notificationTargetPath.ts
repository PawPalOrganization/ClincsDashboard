import type { ClinicNotification } from '../types/clinic.types';

export function notificationTargetPath(n: ClinicNotification): string {
  // Check the notification's own type first — a review notification can still
  // carry an appointmentId (a review is tied to the finished appointment it came
  // from), and that used to win, sending "new review" notifications to the
  // appointment page instead of Reviews.
  if (n.type?.startsWith('review_')) return '/reviews';
  if (n.data?.appointmentId) return `/appointments/${n.data.appointmentId}`;
  return '/appointments';
}
