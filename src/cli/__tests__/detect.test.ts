/**
 * Detect Command Tests
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import ora from 'ora';

import { detect, detectProjectStructure } from '../detect';

// Mock modules
jest.mock('fs');
jest.mock('glob');
jest.mock('ora');

const mockFs = {
  existsSync: existsSync as jest.MockedFunction<typeof existsSync>,
  readFileSync: readFileSync as jest.MockedFunction<typeof readFileSync>,
  writeFileSync: writeFileSync as jest.MockedFunction<typeof writeFileSync>,
};

const mockGlob = glob as jest.MockedFunction<typeof glob>;
const mockOra = ora as jest.MockedFunction<typeof ora>;

describe('Detect Command', () => {
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

  describe('detect command', () => {
    it('should detect and create configuration', async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path.includes('oats.config.json')) return false;
        if (path.includes('backend/package.json')) return true;
        if (path.includes('client/package.json')) return true;
        if (path.includes('frontend/package.json')) return true;
        return false;
      });

      mockGlob.mockImplementation(async (pattern: string) => {
        if (pattern === '../*') {
          return ['../backend', '../client', '../frontend'];
        }
        if (pattern === 'swagger.json') {
          return ['swagger.json'];
        }
        return [];
      });

      mockFs.readFileSync.mockImplementation((path) => {
        if (path.includes('backend/package.json')) {
          return JSON.stringify({
            name: 'my-backend',
            dependencies: { express: '^4.18.0' },
            scripts: { dev: 'nodemon server.js' },
          });
        }
        if (path.includes('client/package.json')) {
          return JSON.stringify({
            name: '@myorg/api-client',
            scripts: { generate: 'openapi-ts' },
          });
        }
        if (path.includes('frontend/package.json')) {
          return JSON.stringify({
            name: 'my-frontend',
            dependencies: { react: '^18.0.0' },
            scripts: { dev: 'vite' },
          });
        }
        return '{}';
      });

      await detect({ output: 'oats.config.json' });

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Project structure detected!');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('oats.config.json'),
        expect.stringContaining('"path": "../backend"')
      );
    });

    it('should error if config already exists without --force', async () => {
      mockFs.existsSync.mockReturnValue(true);

      try {
        await detect({ output: 'oats.config.json' });
      } catch (error) {
        // Expected
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configuration already exists'),
        expect.stringContaining('Use --force to overwrite')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should overwrite with --force flag', async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path.includes('oats.config.json')) return true; // Config exists
        if (path.includes('backend/package.json')) return true;
        if (path.includes('client/package.json')) return true;
        return false;
      });

      mockGlob.mockResolvedValue(['../backend', '../client']);

      mockFs.readFileSync.mockImplementation((path) => {
        if (path.includes('backend/package.json')) {
          return JSON.stringify({
            dependencies: { express: '^4.18.0' },
          });
        }
        if (path.includes('client/package.json')) {
          return JSON.stringify({
            name: '@myorg/api-client',
            scripts: { generate: 'openapi-ts' },
          });
        }
        return '{}';
      });

      await detect({ output: 'oats.config.json', force: true });

      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle detection failure', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockGlob.mockResolvedValue([]);
      mockFs.readFileSync.mockReturnValue('{}');

      try {
        await detect({ output: 'oats.config.json' });
      } catch (error) {
        // Expected
      }

      expect(mockSpinner.fail).toHaveBeenCalledWith('Detection failed');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('detectProjectStructure', () => {
    describe('monorepo detection', () => {
      it('should detect Lerna monorepo', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('lerna.json')
        );

        const result = await detectProjectStructure('/test/path');
        expect(result.monorepo).toBe(true);
      });

      it('should detect Nx monorepo', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('nx.json')
        );

        const result = await detectProjectStructure('/test/path');
        expect(result.monorepo).toBe(true);
      });

      it('should detect pnpm workspace', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('pnpm-workspace.yaml')
        );

        const result = await detectProjectStructure('/test/path');
        expect(result.monorepo).toBe(true);
      });

      it('should detect yarn workspaces', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('package.json')
        );
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({ workspaces: ['packages/*'] })
        );

        const result = await detectProjectStructure('/test/path');
        expect(result.monorepo).toBe(true);
      });
    });

    describe('backend detection', () => {
      const frameworks = [
        { dep: 'express', name: 'Express' },
        { dep: 'fastify', name: 'Fastify' },
        { dep: '@nestjs/core', name: 'NestJS' },
        { dep: 'koa', name: 'Koa' },
        { dep: '@hapi/hapi', name: 'Hapi' },
        { dep: 'restify', name: 'Restify' },
      ];

      frameworks.forEach(({ dep, name }) => {
        it(`should detect ${name} backend`, async () => {
          mockFs.existsSync.mockImplementation((path) => 
            path.includes('backend/package.json')
          );
          mockGlob.mockResolvedValue(['/test/backend']);
          mockFs.readFileSync.mockReturnValue(
            JSON.stringify({
              dependencies: { [dep]: '1.0.0' },
            })
          );

          const result = await detectProjectStructure('/test');
          
          expect(result.backend).toBeDefined();
          expect(result.backend?.framework).toBe(name);
          expect(result.backend?.type).toBe('backend');
        });
      });

      it('should detect API spec files', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('backend/package.json')
        );
        mockGlob.mockImplementation(async (pattern) => {
          if (pattern.includes('*')) return ['/test/backend'];
          if (pattern === 'src/swagger.json') return ['src/swagger.json'];
          return [];
        });
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            dependencies: { express: '4.0.0' },
          })
        );

        const result = await detectProjectStructure('/test');
        
        expect(result.backend?.apiSpec).toBe('src/swagger.json');
      });
    });

    describe('client detection', () => {
      it('should detect client by package name', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('api-client/package.json')
        );
        mockGlob.mockResolvedValue(['/test/api-client']);
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            name: '@myorg/api-client',
            scripts: { generate: 'openapi-ts' },
          })
        );

        const result = await detectProjectStructure('/test');
        
        expect(result.client).toBeDefined();
        expect(result.client?.packageName).toBe('@myorg/api-client');
        expect(result.client?.type).toBe('client');
      });

      it('should detect client by generator files', async () => {
        mockFs.existsSync.mockImplementation((path) => {
          if (path.includes('client/package.json')) return true;
          if (path.includes('openapi-ts.config.ts')) return true;
          return false;
        });
        mockGlob.mockResolvedValue(['/test/client']);
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({ name: 'my-app' })
        );

        const result = await detectProjectStructure('/test');
        
        expect(result.client).toBeDefined();
      });
    });

    describe('frontend detection', () => {
      const frameworks = [
        { dep: 'react', name: 'React' },
        { dep: 'vue', name: 'Vue' },
        { dep: '@angular/core', name: 'Angular' },
        { dep: 'svelte', name: 'Svelte' },
        { dep: 'next', name: 'Next.js' },
        { dep: 'nuxt', name: 'Nuxt' },
      ];

      frameworks.forEach(({ dep, name }) => {
        it(`should detect ${name} frontend`, async () => {
          mockFs.existsSync.mockImplementation((path) => 
            path.includes('frontend/package.json')
          );
          mockGlob.mockResolvedValue(['/test/frontend']);
          mockFs.readFileSync.mockReturnValue(
            JSON.stringify({
              dependencies: { [dep]: '1.0.0' },
            })
          );

          const result = await detectProjectStructure('/test');
          
          expect(result.frontend).toBeDefined();
          expect(result.frontend?.framework).toBe(name);
          expect(result.frontend?.type).toBe('frontend');
        });
      });
    });

    describe('package manager detection', () => {
      it('should detect yarn', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('yarn.lock')
        );

        const result = await detectProjectStructure('/test');
        expect(result.rootPackageManager).toBe('yarn');
      });

      it('should detect pnpm', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('pnpm-lock.yaml')
        );

        const result = await detectProjectStructure('/test');
        expect(result.rootPackageManager).toBe('pnpm');
      });

      it('should default to npm', async () => {
        mockFs.existsSync.mockReturnValue(false);

        const result = await detectProjectStructure('/test');
        expect(result.rootPackageManager).toBe('npm');
      });
    });

    describe('port detection', () => {
      it('should detect port from scripts', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('backend/package.json')
        );
        mockGlob.mockResolvedValue(['/test/backend']);
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            dependencies: { express: '4.0.0' },
            scripts: {
              dev: 'node server.js --port 3001',
            },
          })
        );

        const result = await detectProjectStructure('/test');
        
        expect(result.backend?.port).toBe(3001);
      });

      it('should detect PORT environment variable', async () => {
        mockFs.existsSync.mockImplementation((path) => 
          path.includes('backend/package.json')
        );
        mockGlob.mockResolvedValue(['/test/backend']);
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            dependencies: { express: '4.0.0' },
            scripts: {
              dev: 'PORT=8080 node server.js',
            },
          })
        );

        const result = await detectProjectStructure('/test');
        
        expect(result.backend?.port).toBe(8080);
      });
    });
  });
});