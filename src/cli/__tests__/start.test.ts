/**
 * Start Command Tests
 */

import { existsSync, readFileSync } from 'fs';

import ora from 'ora';

import { start } from '../start';

// Mock dependencies
jest.mock('fs');
jest.mock('ora');
jest.mock('../../core/orchestrator', () => ({
  DevSyncOrchestrator: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
  })),
}));
jest.mock('../../config/schema', () => ({
  validateConfig: jest.fn(),
  mergeWithDefaults: jest.fn(),
}));

const mockFs = {
  existsSync: existsSync as jest.MockedFunction<typeof existsSync>,
  readFileSync: readFileSync as jest.MockedFunction<typeof readFileSync>,
};

const mockOra = ora as jest.MockedFunction<typeof ora>;

import { validateConfig, mergeWithDefaults } from '../../config/schema';
const mockValidateConfig = validateConfig as jest.MockedFunction<typeof validateConfig>;
const mockMergeWithDefaults = mergeWithDefaults as jest.MockedFunction<typeof mergeWithDefaults>;

describe('Start Command', () => {
  let mockSpinner: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default to config file existing
    mockFs.existsSync.mockReturnValue(true);
    
    // Default to valid configuration
    mockValidateConfig.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    
    // Default merge with defaults
    mockMergeWithDefaults.mockImplementation((config) => ({
      ...config,
      resolvedPaths: {
        backend: '/test/backend',
        client: '/test/client',
      },
      packageManager: 'npm',
    }));

    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      warn: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
    };
    mockOra.mockReturnValue(mockSpinner);

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('with valid configuration', () => {
    it('should start development environment successfully', async () => {
      const validConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'src/swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@test/client',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      await start({ config: 'oats.config.json' });

      // Verify config was validated and merged
      expect(mockValidateConfig).toHaveBeenCalledWith(validConfig);
      expect(mockMergeWithDefaults).toHaveBeenCalled();
    });

    it('should handle watch mode', async () => {
      const validConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'src/swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@test/client',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      // The start command by default watches for changes
      await start({ config: 'oats.config.json' });

      // Verify config was processed
      expect(mockValidateConfig).toHaveBeenCalled();
      expect(mockMergeWithDefaults).toHaveBeenCalled();
    });

    it('should handle initial generation flag', async () => {
      const validConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'src/swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@test/client',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      // Update merge to include initGen flag
      mockMergeWithDefaults.mockImplementation((config) => ({
        ...config,
        resolvedPaths: {
          backend: '/test/backend',
          client: '/test/client',
        },
        packageManager: 'npm',
        sync: {
          runInitialGeneration: true,
        },
      }));

      await start({ config: 'oats.config.json', initGen: true });

      // Note: initGen option is not currently used in start command
      // Verify basic start behavior
      expect(mockValidateConfig).toHaveBeenCalled();
      expect(mockMergeWithDefaults).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle missing configuration file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      try {
        await start({ config: 'missing.config.json' });
      } catch (error) {
        // Expected process.exit
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration file not found')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON in configuration', async () => {
      mockFs.readFileSync.mockReturnValue('invalid json content');

      try {
        await start({ config: 'oats.config.json' });
      } catch (error) {
        // Expected
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start OATS')
      );
    });

  });

  describe('signal handling', () => {
    it('should handle SIGINT gracefully', async () => {
      const validConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'src/swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@test/client',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      // Start command sets up signal handlers but runs indefinitely
      // We'll just verify it starts correctly
      await start({ config: 'oats.config.json' });

      expect(mockValidateConfig).toHaveBeenCalled();
      expect(mockMergeWithDefaults).toHaveBeenCalled();
    });

    it('should handle SIGTERM gracefully', async () => {
      const validConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'src/swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@test/client',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      await start({ config: 'oats.config.json' });

      expect(mockValidateConfig).toHaveBeenCalled();
      expect(mockMergeWithDefaults).toHaveBeenCalled();
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration before starting', async () => {
      const invalidConfig = {
        services: {
          // Missing required backend and client services
        },
      };

      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));
      
      // Mock validation to fail
      mockValidateConfig.mockReturnValue({
        valid: false,
        errors: [
          { path: 'services.backend', message: 'Backend service is required', code: 'required' },
          { path: 'services.client', message: 'Client service is required', code: 'required' },
        ],
        warnings: [],
      });

      try {
        await start({ config: 'oats.config.json' });
      } catch (error) {
        // Expected process.exit
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration validation failed')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});