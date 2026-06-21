import type { ClinicStaff, Appointment } from '../types/clinic.types';

// ─── Staff factories ───────────────────────────────────────────────────────────

export function makeStaff(overrides: Partial<ClinicStaff> = {}): ClinicStaff {
  return {
    id: 1,
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@clinic.com',
    role: {
      id: 1,
      name: 'Receptionist',
      permissions: [],
    },
    permissions: [],
    ...overrides,
  };
}

export function makeOwnerStaff(overrides: Partial<ClinicStaff> = {}): ClinicStaff {
  return makeStaff({
    role: { id: 1, name: 'Clinic Owner', permissions: [] },
    ...overrides,
  });
}

export function makeStaffWithPermissions(
  permissions: string[],
  overrides: Partial<ClinicStaff> = {},
): ClinicStaff {
  return makeStaff({
    role: {
      id: 1,
      name: 'Staff',
      permissions: permissions.map((p) => ({ slug: p })),
    },
    ...overrides,
  });
}

// ─── Appointment factories ─────────────────────────────────────────────────────

export function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    clinicBranchId: 1,
    clinicStaffId: 1,
    scheduledAt: '2026-06-21T10:00:00.000Z',
    status: 'reserved',
    services: [],
    totalCost: 150,
    contactName: 'Marco Reus',
    contactPhone: '+201011177644',
    doctor: {
      id: 2,
      firstName: 'Mohamed',
      lastName: 'Hany',
      role: { name: 'Doctor' },
    },
    ...overrides,
  };
}

// ─── Auth response factories ───────────────────────────────────────────────────

export function makeLoginResponse(staff?: Partial<ClinicStaff>) {
  const s = makeStaff(staff);
  return {
    data: {
      token: 'test-jwt-token',
      staff: {
        ...s,
        branches: [{ id: 10, clinicId: 5, title: 'Main Branch' }],
      },
    },
  };
}

// ─── Fetch mock helpers ────────────────────────────────────────────────────────

export function mockFetchOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

export function mockFetchError(status: number, body: unknown) {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}
