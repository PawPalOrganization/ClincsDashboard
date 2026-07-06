import { describe, it, expect } from 'vitest';
import { formatPatientDisplayName } from './formatPatientDisplayName';

describe('formatPatientDisplayName', () => {
  it('prefers contactName when present (walk-in booking)', () => {
    expect(formatPatientDisplayName('Jane Walk-in', { firstName: 'John', lastName: 'Doe' }, 5)).toBe('Jane Walk-in');
  });

  it('uses the user full name when populated', () => {
    expect(formatPatientDisplayName(undefined, { firstName: 'John', lastName: 'Doe' }, 5)).toBe('John Doe');
  });

  it('falls back to User #id when the user object is redacted (empty strings)', () => {
    expect(formatPatientDisplayName(undefined, { firstName: '', lastName: '' }, 42)).toBe('User #42');
  });

  it('falls back to "Private patient" when redacted and no userId is known', () => {
    expect(formatPatientDisplayName(undefined, { firstName: '', lastName: '' }, undefined)).toBe('Private patient');
  });

  it('falls back to User #id when user is null/absent', () => {
    expect(formatPatientDisplayName(undefined, null, 7)).toBe('User #7');
  });

  it('falls back to "Private patient" when everything is missing', () => {
    expect(formatPatientDisplayName(undefined, undefined, undefined)).toBe('Private patient');
  });
});
