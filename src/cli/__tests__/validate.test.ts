/**
 * Validate Command Tests
 */

import { existsSync, readFileSync } from 'fs';

import chalk from 'chalk';
import ora from 'ora';

import { validateConfig } from '../../config/schema';
import { validate } from '../validate';

// Mock dependencies
jest.mock('fs');
jest.mock('ora');
jest.mock('../../config/schema', () => ({
  validateConfig: jest.fn().mockReturnValue({
    valid: true,
    errors: [],
    warnings: [],
  }),
}));

const mockFs = {
  existsSync: existsSync as jest.MockedFunction<typeof existsSync>,
  readFileSync: readFileSync as jest.MockedFunction<typeof readFileSync>,
};

const mockOra = ora as jest.MockedFunction<typeof ora>;

const mockValidateConfig = validateConfig as jest.MockedFunction<
  typeof validateConfig
>;

describe('Validate Command', () => {
  let mockSpinner: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      warn: jest.fn().mockReturnThis(),
      info: jest.fn().mockReturnThis(),
    };
    mockOra.mockReturnValue(mockSpinner);

    // Reset validateConfig mock to default valid state
    mockValidateConfig.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      // Don't actually exit, just return undefined
      return undefined as never;
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('with valid configuration', () => {
    it('should validate a correct configuration', async () => {
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

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      await validate({ config: 'oats.config.json' });

      // Debug: Print all console.log calls
      // console.log('Console log calls:', consoleLogSpy.mock.calls);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('\n✅ Configuration is fully valid!')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.dim('\nYou can now run: oatsjs start')
      );
    });

    it('should validate paths exist', async () => {
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

      // Mock path existence checks
      mockFs.existsSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('oats.config.json')) return true;
        if (pathStr.includes('backend')) return true;
        if (pathStr.includes('client')) return true;
        if (pathStr.includes('swagger.json')) return true;
        return false;
      });

      await validate({ config: 'oats.config.json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✅ Backend: ../backend')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✅ Client: ../client')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green(expect.stringContaining('✅ API Spec:'))
      );
    });

    it('should show warnings for suboptimal configuration', async () => {
      const configWithWarnings = {
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
            // Missing buildCommand - should warn
          },
        },
        sync: {
          strategy: 'aggressive', // Should warn
          debounceMs: 100, // Too low - should warn
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithWarnings));

      // Mock validateConfig to return warnings
      mockValidateConfig.mockReturnValue({
        valid: true,
        errors: [],
        warnings: [
          {
            code: 'low-debounce',
            path: 'sync.debounceMs',
            message: 'Low debounce value may cause excessive API regeneration',
            suggestion: 'Consider using at least 500ms',
          },
          {
            code: 'aggressive-sync',
            path: 'sync.strategy',
            message: 'Aggressive sync strategy may impact performance',
            suggestion: 'Use conservative strategy for better stability',
          },
        ],
      });

      await validate({ config: 'oats.config.json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.yellow('\n⚠️  Validation completed with warnings')
      );
    });
  });

  describe('with invalid configuration', () => {
    it('should fail validation for missing required fields', async () => {
      const invalidConfig = {
        services: {
          backend: {
            path: '../backend',
            // Missing startCommand and apiSpec
          },
          client: {
            path: '../client',
            // Missing packageName and generator
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

      // Mock validateConfig to return errors
      mockValidateConfig.mockReturnValue({
        valid: false,
        errors: [
          {
            code: 'required',
            path: 'services.backend.startCommand',
            message: 'Start command is required',
          },
          {
            code: 'required',
            path: 'services.backend.apiSpec',
            message: 'API spec is required',
          },
          {
            code: 'required',
            path: 'services.client.packageName',
            message: 'Package name is required',
          },
          {
            code: 'required',
            path: 'services.client.generator',
            message: 'Generator is required',
          },
        ],
        warnings: [],
      });

      await validate({ config: 'oats.config.json' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to validate configuration:')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail validation for invalid paths', async () => {
      const configWithInvalidPaths = {
        services: {
          backend: {
            path: '../nonexistent-backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'src/swagger.json' },
          },
          client: {
            path: '../nonexistent-client',
            packageName: '@test/client',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(configWithInvalidPaths)
      );

      // Mock path existence - only config file exists
      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('oats.config.json');
      });

      await validate({ config: 'oats.config.json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.red('❌ Backend: ../nonexistent-backend (not found - required)')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.red('❌ Client: ../nonexistent-client (not found - required)')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle invalid JSON', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json content');

      await validate({ config: 'oats.config.json' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to validate configuration:')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle missing configuration file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      try {
        await validate({ config: 'missing.config.json' });
      } catch (error) {
        // Expected
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to validate configuration:')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('strict mode', () => {
    it('should enforce stricter validation in strict mode', async () => {
      const configWithWarnings = {
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
            // Missing buildCommand
          },
        },
        sync: {
          strategy: 'aggressive',
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithWarnings));

      await validate({ config: 'oats.config.json', strict: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.red('\n❌ Validation completed with errors')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('dependency checking', () => {
    it('should check for required dependencies', async () => {
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
            generator: '@hey-api/openapi-ts',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('oats.config.json')) {
          return JSON.stringify(validConfig);
        }
        if (pathStr.includes('client/package.json')) {
          return JSON.stringify({
            dependencies: {
              '@hey-api/openapi-ts': '^0.27.0',
            },
          });
        }
        return '{}';
      });

      mockFs.existsSync.mockReturnValue(true);

      await validate({ config: 'oats.config.json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.green('✅ @hey-api/openapi-ts (generator)')
      );
    });

    it('should warn about missing dependencies', async () => {
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
            generator: '@hey-api/openapi-ts',
            generateCommand: 'npm run generate',
          },
        },
      };

      mockFs.readFileSync.mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr.includes('oats.config.json')) {
          return JSON.stringify(validConfig);
        }
        if (pathStr.includes('client/package.json')) {
          return JSON.stringify({
            dependencies: {
              // Missing @hey-api/openapi-ts
            },
          });
        }
        return '{}';
      });

      mockFs.existsSync.mockReturnValue(true);

      await validate({ config: 'oats.config.json' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        chalk.red('❌ @hey-api/openapi-ts (generator) - not installed')
      );
    });
  });
});
