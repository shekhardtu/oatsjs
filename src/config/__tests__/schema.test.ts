/**
 * Configuration Schema Tests
 */

import { validateConfig, mergeWithDefaults, defaultConfig } from '../schema';
import type { OatsConfig } from '../../types/config.types';

describe('Configuration Schema', () => {
  describe('validateConfig', () => {
    it('should validate a minimal valid configuration', () => {
      const config: OatsConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: {
              path: 'src/swagger.json',
            },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      expect(config).toBeValidConfig();
    });

    it('should validate a complete configuration', () => {
      const config: OatsConfig = {
        version: '1.0.0',
        services: {
          backend: {
            path: '../backend',
            port: 4000,
            startCommand: 'yarn dev',
            readyPattern: 'Server started',
            apiSpec: {
              path: 'src/swagger.json',
              format: 'openapi3',
              watch: ['src/**/*.ts'],
            },
            env: {
              NODE_ENV: 'development',
            },
          },
          client: {
            path: '../api-client',
            packageName: '@myorg/api-client',
            generator: '@hey-api/openapi-ts',
            buildCommand: 'yarn build',
            linkCommand: 'yarn link',
            generatorConfig: {
              output: './src',
              client: 'axios',
            },
            postGenerate: 'yarn format',
            autoInstall: true,
          },
          frontend: {
            path: '.',
            port: 3000,
            startCommand: 'yarn dev',
            packageLinkCommand: 'yarn link',
            framework: 'react',
            readyPattern: 'compiled successfully',
            env: {
              REACT_APP_API_URL: 'http://localhost:4000',
            },
          },
        },
        sync: {
          strategy: 'smart',
          debounceMs: 1500,
          autoLink: true,
          notifications: true,
          retryAttempts: 5,
          retryDelayMs: 3000,
          runInitialGeneration: true,
          ignore: ['**/*.test.ts'],
        },
        log: {
          level: 'debug',
          colors: true,
          timestamps: true,
          file: './oats.log',
        },
        metadata: {
          customField: 'value',
        },
      };

      expect(config).toBeValidConfig();
    });

    it('should reject configuration without required fields', () => {
      const config = {
        services: {},
      };

      expect(config).toHaveConfigError('services.backend');
      expect(config).toHaveConfigError('services.client');
    });

    it('should reject invalid backend configuration', () => {
      const config = {
        services: {
          backend: {
            path: '../backend',
            // Missing startCommand and apiSpec
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      expect(config).toHaveConfigError('services.backend.startCommand');
      expect(config).toHaveConfigError('services.backend.apiSpec');
    });

    it('should reject invalid client configuration', () => {
      const config = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: {
              path: 'swagger.json',
            },
          },
          client: {
            path: '../client',
            // Missing packageName and generator
          },
        },
      };

      expect(config).toHaveConfigError('services.client.packageName');
      expect(config).toHaveConfigError('services.client.generator');
    });

    it('should require generateCommand for custom generator', () => {
      const config: OatsConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: {
              path: 'swagger.json',
            },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            // Missing generateCommand
          },
        },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_GENERATE_COMMAND',
          path: 'services.client.generateCommand',
        })
      );
    });

    it('should accept valid package names', () => {
      const validNames = [
        'my-package',
        '@org/package',
        '@org/my-package',
        'package123',
        'package-name',
      ];

      validNames.forEach((packageName) => {
        const config: OatsConfig = {
          services: {
            backend: {
              path: '../backend',
              startCommand: 'npm run dev',
              apiSpec: { path: 'swagger.json' },
            },
            client: {
              path: '../client',
              packageName,
              generator: 'custom',
              generateCommand: 'npm run generate',
            },
          },
        };

        expect(config).toBeValidConfig();
      });
    });

    it('should reject invalid package names', () => {
      const invalidNames = [
        'Package', // uppercase
        '_package', // starts with underscore
        '.package', // starts with dot
        'package name', // contains space
        '@org//package', // double slash
        '',
      ];

      invalidNames.forEach((packageName) => {
        const config = {
          services: {
            backend: {
              path: '../backend',
              startCommand: 'npm run dev',
              apiSpec: { path: 'swagger.json' },
            },
            client: {
              path: '../client',
              packageName,
              generator: 'custom',
              generateCommand: 'npm run generate',
            },
          },
        };

        expect(config).toHaveConfigError('services.client.packageName');
      });
    });

    it('should validate port numbers', () => {
      const config = {
        services: {
          backend: {
            path: '../backend',
            port: 70000, // Invalid port
            startCommand: 'npm run dev',
            apiSpec: { path: 'swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      expect(config).toHaveConfigError('services.backend.port');
    });

    it('should detect port conflicts', () => {
      const config: OatsConfig = {
        services: {
          backend: {
            path: '../backend',
            port: 3000,
            startCommand: 'npm run dev',
            apiSpec: { path: 'swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
          frontend: {
            path: '.',
            port: 3000, // Same as backend
            startCommand: 'npm run dev',
          },
        },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PORT_CONFLICT',
          message: 'Backend and frontend cannot use the same port',
        })
      );
    });

    it('should generate warnings for suboptimal configuration', () => {
      const config: OatsConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
            // No buildCommand
          },
        },
        sync: {
          strategy: 'aggressive',
          debounceMs: 100, // Too low
        },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(4); // No frontend, aggressive sync, low debounce, no build command
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'AGGRESSIVE_SYNC',
        })
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'LOW_DEBOUNCE',
        })
      );
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const userConfig: OatsConfig = {
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
      };

      const merged = mergeWithDefaults(userConfig);

      expect(merged.version).toBe('1.0.0');
      expect(merged.sync?.debounceMs).toBe(1000);
      expect(merged.sync?.retryAttempts).toBe(3);
      expect(merged.log?.level).toBe('info');
    });

    it('should not override user-provided values', () => {
      const userConfig: OatsConfig = {
        version: '2.0.0',
        services: {
          backend: {
            path: '../backend',
            startCommand: 'npm run dev',
            apiSpec: { path: 'swagger.json' },
          },
          client: {
            path: '../client',
            packageName: '@myorg/api',
            generator: 'custom',
            generateCommand: 'npm run generate',
          },
        },
        sync: {
          debounceMs: 2000,
          strategy: 'conservative',
        },
        log: {
          level: 'debug',
        },
      };

      const merged = mergeWithDefaults(userConfig);

      expect(merged.version).toBe('2.0.0');
      expect(merged.sync?.debounceMs).toBe(2000);
      expect(merged.sync?.strategy).toBe('conservative');
      expect(merged.log?.level).toBe('debug');
    });
  });
});