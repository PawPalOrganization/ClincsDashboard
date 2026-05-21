import type { ClinicStaff } from '../types/clinic.types';

export type ClinicPermissionSlug =
  | 'clinics.read'
  | 'clinics.create'
  | 'clinics.update'
  | 'clinics.delete'
  | 'clinics.approve'
  | 'clinic-branches.read'
  | 'clinic-branches.create'
  | 'clinic-branches.update'
  | 'clinic-branches.delete'
  | 'clinic-services.read'
  | 'clinic-services.create'
  | 'clinic-services.update'
  | 'clinic-services.delete'
  | 'clinic-staff.read'
  | 'clinic-staff.create'
  | 'clinic-staff.update'
  | 'clinic-staff.delete'
  | 'clinic-staff.assignments'
  | 'clinic-staff-roles.read'
  | 'clinic-staff-roles.update';

const PRIVILEGED_ROLE_WORDS = ['owner'];

function normalized(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

function canonicalPermission(value?: string): string {
  return normalized(value)
    .replace(/&/g, ' and ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function permissionTexts(permission: unknown): string[] {
  if (typeof permission === 'string') return [permission];
  if (!permission || typeof permission !== 'object') return [];

  const record = permission as Record<string, unknown>;
  const values = [
    record.token,
    record.slug,
    record.name,
    record.title,
    record.key,
    record.code,
    record.permission,
  ];

  return values.filter((value): value is string => typeof value === 'string');
}

export function isPrivilegedClinicRole(staff: ClinicStaff | null): boolean {
  const roleName = normalized(staff?.role?.name);
  return PRIVILEGED_ROLE_WORDS.some((word) => roleName.includes(word));
}

export function hasClinicPermission(
  staff: ClinicStaff | null,
  permission: ClinicPermissionSlug,
): boolean {
  if (!staff) return false;
  if (isPrivilegedClinicRole(staff)) return true;

  const expected = canonicalPermission(permission);
  const permissions = [
    ...(staff.role?.permissions ?? []),
    ...(staff.permissions ?? []),
  ];

  return permissions.some((p) =>
    permissionTexts(p).some((text) => canonicalPermission(text) === expected),
  );
}

export function hasAnyClinicPermission(
  staff: ClinicStaff | null,
  permissions: ClinicPermissionSlug[],
): boolean {
  return permissions.some((permission) => hasClinicPermission(staff, permission));
}
