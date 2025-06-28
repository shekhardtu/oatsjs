/**
 * Jest Test Setup
 *
 * This file runs before all tests to set up the test environment
 */

import { expect } from '@jest/globals';

import { validateConfig } from '../config/schema';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['OATS_TEST'] = 'true';

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers
expect.extend({
  toBeValidConfig(received) {
    const result = validateConfig(received);
    return {
      pass: result.valid,
      message: () =>
        result.valid
          ? 'Expected configuration to be invalid'
          : `Expected configuration to be valid, but got errors:\n${result.errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`,
    };
  },
  toHaveConfigError(received, expectedPath) {
    const result = validateConfig(received);
    const hasError = result.errors.some((e) => e.path === expectedPath);
    return {
      pass: hasError,
      message: () =>
        hasError
          ? `Expected configuration not to have error at path "${expectedPath}"`
          : `Expected configuration to have error at path "${expectedPath}"`,
    };
  },
});

// Mock file system for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    ...jest.requireActual('fs').promises,
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
  },
}));

// Mock child_process for tests
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn(),
  execSync: jest.fn(),
}));

// Mock external dependencies
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('ora', () => 
  jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: '',
  }))
);

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}));

jest.mock('chalk', () => ({
  default: {
    blue: jest.fn((str) => str),
    green: jest.fn((str) => str),
    red: jest.fn((str) => str),
    yellow: jest.fn((str) => str),
    gray: jest.fn((str) => str),
    bold: jest.fn((str) => str),
    dim: jest.fn((str) => str),
    cyan: jest.fn((str) => str),
    magenta: jest.fn((str) => str),
  },
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  bold: jest.fn((str) => str),
  dim: jest.fn((str) => str),
  cyan: jest.fn((str) => str),
  magenta: jest.fn((str) => str),
}));

jest.mock('execa', () => ({
  execa: jest.fn(),
}));

jest.mock('glob', () => ({
  glob: jest.fn(),
}));

// Helper to reset all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

// Cleanup after all tests
afterAll(() => {
  jest.restoreAllMocks();
});
