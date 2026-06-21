import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Auto-clean React tree after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// Silence console.error output from API error logging during tests
// Tests that assert on console.error should re-enable it explicitly
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});
afterEach(() => {
  console.error = originalConsoleError;
});
