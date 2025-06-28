/**
 * Jest Test Setup
 * 
 * This file runs before all tests to set up the test environment
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.OATS_TEST = 'true';

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
  toBeValidConfig(received: any) {
    const { validateConfig } = require('../config/schema');
    const result = validateConfig(received);
    
    return {
      pass: result.valid,
      message: () => {
        if (result.valid) {
          return `Expected configuration to be invalid`;
        } else {
          const errors = result.errors.map(e => `${e.path}: ${e.message}`).join('\n');
          return `Expected configuration to be valid, but got errors:\n${errors}`;
        }
      },
    };
  },
  
  toHaveConfigError(received: any, expectedPath: string) {
    const { validateConfig } = require('../config/schema');
    const result = validateConfig(received);
    const hasError = result.errors.some(e => e.path === expectedPath);
    
    return {
      pass: hasError,
      message: () => {
        if (hasError) {
          return `Expected configuration not to have error at path "${expectedPath}"`;
        } else {
          return `Expected configuration to have error at path "${expectedPath}"`;
        }
      },
    };
  },
});

// Extend Jest matchers TypeScript definitions
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidConfig(): R;
      toHaveConfigError(path: string): R;
    }
  }
}

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

jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: '',
  }));
});

jest.mock('inquirer', () => ({
  prompt: jest.fn(),
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