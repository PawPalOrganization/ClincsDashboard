/**
 * Resolves the display name for an appointment's patient, handling the case where
 * `user` is present but redacted (empty firstName/lastName because data-share consent
 * isn't approved for this clinic) — a truthy-but-blank name must not win over the
 * userId/placeholder fallback.
 */
export function formatPatientDisplayName(
  contactName?: string,
  user?: { firstName: string; lastName: string } | null,
  userId?: string | number,
): string {
  if (contactName) return contactName;
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  if (fullName) return fullName;
  if (userId) return `User #${userId}`;
  return 'Private patient';
}
