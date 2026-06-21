import { describe, it, expect } from 'vitest';
import {
  hasClinicPermission,
  hasAnyClinicPermission,
  isPrivilegedClinicRole,
} from './clinicPermissions';
import { makeStaff, makeOwnerStaff, makeStaffWithPermissions } from '../test/factories';
import type { ClinicStaffPermission } from '../types/clinic.types';

// ─── isPrivilegedClinicRole ───────────────────────────────────────────────────

describe('isPrivilegedClinicRole', () => {
  it('returns true when role name contains "owner"', () => {
    expect(isPrivilegedClinicRole(makeOwnerStaff())).toBe(true);
  });

  it('is case-insensitive for owner detection', () => {
    expect(isPrivilegedClinicRole(makeStaff({ role: { id: 1, name: 'OWNER', permissions: [] } }))).toBe(true);
    expect(isPrivilegedClinicRole(makeStaff({ role: { id: 1, name: 'Clinic Owner', permissions: [] } }))).toBe(true);
    expect(isPrivilegedClinicRole(makeStaff({ role: { id: 1, name: 'co-owner', permissions: [] } }))).toBe(true);
  });

  it('returns false for non-owner roles', () => {
    expect(isPrivilegedClinicRole(makeStaff({ role: { id: 1, name: 'Receptionist', permissions: [] } }))).toBe(false);
    expect(isPrivilegedClinicRole(makeStaff({ role: { id: 1, name: 'Doctor', permissions: [] } }))).toBe(false);
    expect(isPrivilegedClinicRole(makeStaff({ role: { id: 1, name: 'Admin', permissions: [] } }))).toBe(false);
  });

  it('returns false for null staff', () => {
    expect(isPrivilegedClinicRole(null)).toBe(false);
  });

  it('returns false when staff has no role', () => {
    expect(isPrivilegedClinicRole(makeStaff({ role: undefined }))).toBe(false);
  });
});

// ─── hasClinicPermission ──────────────────────────────────────────────────────

describe('hasClinicPermission', () => {
  it('returns false for null staff', () => {
    expect(hasClinicPermission(null, 'appointments.read')).toBe(false);
  });

  it('returns true for owner bypassing all permission checks', () => {
    const owner = makeOwnerStaff({ role: { id: 1, name: 'Clinic Owner', permissions: [] } });
    expect(hasClinicPermission(owner, 'appointments.read')).toBe(true);
    expect(hasClinicPermission(owner, 'clinics.delete')).toBe(true);
    expect(hasClinicPermission(owner, 'clinic-staff.delete')).toBe(true);
  });

  it('returns false when staff has no matching permission', () => {
    const staff = makeStaffWithPermissions(['clinics.read']);
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(false);
  });

  it('matches permission by slug field in role.permissions', () => {
    const staff = makeStaffWithPermissions(['appointments.read']);
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(true);
  });

  it('matches permission by name field', () => {
    const staff = makeStaff({
      role: { id: 1, name: 'Staff', permissions: [{ name: 'appointments.read' }] },
    });
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(true);
  });

  it('matches permission by token field', () => {
    const staff = makeStaff({
      role: { id: 1, name: 'Staff', permissions: [{ token: 'appointments.read' }] },
    });
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(true);
  });

  it('matches permission when it is a plain string in array', () => {
    const staff = makeStaff({
      role: { id: 1, name: 'Staff', permissions: ['appointments.read'] },
    });
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(true);
  });

  it('matches permission from staff.permissions (not role.permissions)', () => {
    const staff = makeStaff({
      role: { id: 1, name: 'Staff', permissions: [] },
      permissions: [{ slug: 'appointments.create' }],
    });
    expect(hasClinicPermission(staff, 'appointments.create')).toBe(true);
  });

  it('is case-insensitive for permission matching', () => {
    const staff = makeStaff({
      role: { id: 1, name: 'Staff', permissions: [{ slug: 'APPOINTMENTS.READ' }] },
    });
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(true);
  });

  it('ignores unknown object shapes in permissions array', () => {
    const unknownPerm = { unknown: 'appointments.read' } as unknown as ClinicStaffPermission;
    const staff = makeStaff({
      role: { id: 1, name: 'Staff', permissions: [unknownPerm] },
    });
    expect(hasClinicPermission(staff, 'appointments.read')).toBe(false);
  });

  it('returns false when role.permissions is empty', () => {
    const staff = makeStaff({ role: { id: 1, name: 'Staff', permissions: [] } });
    expect(hasClinicPermission(staff, 'clinics.read')).toBe(false);
  });

  it('does not grant one permission when only another is present', () => {
    const staff = makeStaffWithPermissions(['appointments.read']);
    expect(hasClinicPermission(staff, 'appointments.create')).toBe(false);
    expect(hasClinicPermission(staff, 'clinic-staff.read')).toBe(false);
  });

  it('handles all 22 permission slugs', () => {
    const ALL_SLUGS = [
      'clinics.read', 'clinics.create', 'clinics.update', 'clinics.delete', 'clinics.approve',
      'clinic-branches.read', 'clinic-branches.create', 'clinic-branches.update', 'clinic-branches.delete',
      'clinic-services.read', 'clinic-services.create', 'clinic-services.update', 'clinic-services.delete',
      'clinic-staff.read', 'clinic-staff.create', 'clinic-staff.update', 'clinic-staff.delete',
      'clinic-staff.assignments', 'clinic-staff-roles.read', 'clinic-staff-roles.update',
      'appointments.read', 'appointments.create',
    ] as const;

    ALL_SLUGS.forEach((slug) => {
      const staff = makeStaffWithPermissions([slug]);
      expect(hasClinicPermission(staff, slug), `should match slug: ${slug}`).toBe(true);
    });
  });
});

// ─── hasAnyClinicPermission ───────────────────────────────────────────────────

describe('hasAnyClinicPermission', () => {
  it('returns true if staff has at least one of the listed permissions', () => {
    const staff = makeStaffWithPermissions(['appointments.read']);
    expect(hasAnyClinicPermission(staff, ['clinics.read', 'appointments.read'])).toBe(true);
  });

  it('returns false if staff has none of the listed permissions', () => {
    const staff = makeStaffWithPermissions(['clinics.read']);
    expect(hasAnyClinicPermission(staff, ['appointments.read', 'appointments.create'])).toBe(false);
  });

  it('returns false for null staff', () => {
    expect(hasAnyClinicPermission(null, ['appointments.read'])).toBe(false);
  });

  it('returns true for owner regardless of permission list', () => {
    const owner = makeOwnerStaff();
    expect(hasAnyClinicPermission(owner, ['appointments.create'])).toBe(true);
  });

  it('returns false for empty permissions list', () => {
    const staff = makeStaffWithPermissions(['appointments.read']);
    expect(hasAnyClinicPermission(staff, [])).toBe(false);
  });
});
