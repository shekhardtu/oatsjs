/**
 * Dev Sync Engine Tests
 */

import EventEmitter from 'events';
import { existsSync, readFileSync } from 'fs';

import chokidar from 'chokidar';

// Mock dependencies BEFORE imports
jest.mock('chokidar');
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));
jest.mock('../swagger-diff', () => {
  return {
    SwaggerChangeDetector: class MockSwaggerChangeDetector {
      hasSignificantChanges = jest.fn().mockReturnValue(true);
    },
  };
});

import { DevSyncEngine } from '../dev-sync-optimized';

const mockChokidar = chokidar as jest.Mocked<typeof chokidar>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<
  typeof readFileSync
>;

describe('DevSyncEngine', () => {
  let devSync: DevSyncEngine;
  let mockWatcher: any;
  let runCommandSpy: jest.SpyInstance;
  let unhandledRejectionHandler: any;

  // Capture unhandled rejections during tests
  beforeAll(() => {
    unhandledRejectionHandler = (err: any) => {
      // Ignore expected errors from the debounced sync function
      if (
        err?.message?.includes('Command failed') ||
        err?.message?.includes('API spec file not found')
      ) {
        return;
      }
      throw err;
    };
    process.on('unhandledRejection', unhandledRejectionHandler);
  });

  afterAll(() => {
    process.removeListener('unhandledRejection', unhandledRejectionHandler);
  });

  const defaultConfig = {
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
    sync: {
      debounceMs: 100,
      strategy: 'smart' as const,
    },
    resolvedPaths: {
      backend: '/test/backend',
      client: '/test/client',
    },
  };

  beforeEach((): void => {
    mockWatcher = new EventEmitter();
    mockWatcher.close = jest.fn().mockResolvedValue(undefined);

    mockChokidar.watch = jest.fn().mockReturnValue(mockWatcher);

    // Reset all fs mocks to default values
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ info: { version: '1.0.0' }, paths: {} })
    );

    devSync = new DevSyncEngine(defaultConfig as any);

    // Spy on runCommand and mock it to avoid dynamic import issues
    runCommandSpy = jest
      .spyOn(devSync as any, 'runCommand')
      .mockResolvedValue(undefined);
  });

  afterEach((): void => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('start', () => {
    it('should start watching for changes', async () => {
      await devSync.start();

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          ignoreInitial: false,
          persistent: true,
        })
      );
    });

    it('should handle file changes with debouncing', async () => {
      // First read returns v1.0.0, second read returns v1.0.1
      mockReadFileSync
        .mockReturnValueOnce(
          JSON.stringify({ info: { version: '1.0.0' }, paths: {} })
        )
        .mockReturnValueOnce(
          JSON.stringify({ info: { version: '1.0.1' }, paths: {} })
        );

      await devSync.start();

      // Simulate file change
      mockWatcher.emit('change', 'src/swagger.json');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(runCommandSpy).toHaveBeenCalledWith(
        'npm run generate',
        '/test/client'
      );
    });

    it('should handle multiple rapid changes (debouncing)', async () => {
      // Always return v1.0.1 to trigger sync
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ info: { version: '1.0.1' }, paths: {} })
      );

      await devSync.start();

      // Simulate multiple rapid changes
      mockWatcher.emit('change', 'src/swagger.json');
      mockWatcher.emit('change', 'src/swagger.json');
      mockWatcher.emit('change', 'src/swagger.json');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should only trigger generation once due to debouncing
      expect(runCommandSpy).toHaveBeenCalledTimes(1);
    });

    it('should run initial generation when configured', async () => {
      const configWithInitialGen = {
        ...defaultConfig,
        sync: {
          ...defaultConfig.sync,
          runInitialGeneration: true,
        },
      };

      devSync = new DevSyncEngine(configWithInitialGen as any);
      runCommandSpy = jest
        .spyOn(devSync as any, 'runCommand')
        .mockResolvedValue(undefined);

      // Return v1.0.1 to trigger sync on initial generation
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ info: { version: '1.0.1' }, paths: {} })
      );

      await devSync.start();

      // Should trigger generation immediately
      expect(runCommandSpy).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop watching and cleanup', async () => {
      await devSync.start();
      await devSync.stop();

      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = devSync.getStatus();

      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('watchedPaths');
      expect(status.isRunning).toBe(false);
    });

    it('should update status after start', async () => {
      await devSync.start();

      const status = devSync.getStatus();
      expect(status.isRunning).toBe(true);
    });
  });

  describe('sync process', () => {
    beforeEach(() => {
      // Always return different version to trigger sync
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ info: { version: '1.0.1' }, paths: {} })
      );
    });

    it('should perform full sync with build and link', async () => {
      const configWithFullSync = {
        ...defaultConfig,
        services: {
          ...defaultConfig.services,
          client: {
            ...defaultConfig.services.client,
            buildCommand: 'npm run build',
            linkCommand: 'npm link',
          },
        },
        sync: {
          ...defaultConfig.sync,
          autoLink: true,
        },
      };

      devSync = new DevSyncEngine(configWithFullSync as any);
      runCommandSpy = jest
        .spyOn(devSync as any, 'runCommand')
        .mockResolvedValue(undefined);

      await devSync.start();

      // Simulate file change
      mockWatcher.emit('change', 'src/swagger.json');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should run generate, build, and link commands
      expect(runCommandSpy).toHaveBeenCalledTimes(3);
      expect(runCommandSpy).toHaveBeenNthCalledWith(
        1,
        'npm run generate',
        '/test/client'
      );
      expect(runCommandSpy).toHaveBeenNthCalledWith(
        2,
        'npm run build',
        '/test/client'
      );
      expect(runCommandSpy).toHaveBeenNthCalledWith(
        3,
        'npm link',
        '/test/client'
      );
    });

    it('should emit sync events', async () => {
      const syncEventSpy = jest.fn();
      devSync.on('sync-event', syncEventSpy);

      await devSync.start();

      // Simulate file change
      mockWatcher.emit('change', 'src/swagger.json');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(syncEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation-started',
        })
      );

      expect(syncEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation-completed',
        })
      );
    });

    it('should handle sync errors', async () => {
      // Set up unhandled rejection handler for this test
      const unhandledRejections: Array<any> = [];
      const rejectionHandler = (reason: any) => {
        unhandledRejections.push(reason);
      };
      process.on('unhandledRejection', rejectionHandler);

      const syncEventSpy = jest.fn();
      devSync.on('sync-event', syncEventSpy);

      await devSync.start();

      // Mock the command to fail after start
      runCommandSpy.mockRejectedValue(
        new Error('Command failed: npm run generate - Error')
      );

      // Simulate file change
      mockWatcher.emit('change', 'src/swagger.json');

      // Wait for debounce and error handling
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(syncEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation-failed',
          error: expect.any(Error),
        })
      );

      // Clean up
      process.removeListener('unhandledRejection', rejectionHandler);
    });
  });

  describe('change detection', () => {
    it('should only sync on significant changes', async () => {
      // Mock the SwaggerChangeDetector to control when changes are significant
      const mockChangeDetector = {
        hasSignificantChanges: jest
          .fn()
          .mockReturnValueOnce(true) // First change is significant
          .mockReturnValueOnce(false), // Second change is not significant
      };
      (devSync as any).changeDetector = mockChangeDetector;

      await devSync.start();

      // First change will be processed (significant change)
      mockWatcher.emit('change', 'src/swagger.json');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(runCommandSpy).toHaveBeenCalledTimes(1);

      // Second change with same content - should not trigger sync
      mockWatcher.emit('change', 'src/swagger.json');
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(runCommandSpy).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('error handling', () => {
    it('should handle watcher errors', async () => {
      const errorSpy = jest.fn();
      devSync.on('error', errorSpy);

      await devSync.start();

      // Simulate watcher error
      mockWatcher.emit('error', new Error('Watch error'));

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle missing API spec file', async () => {
      // Set up unhandled rejection handler for this test
      const unhandledRejections: Array<any> = [];
      const rejectionHandler = (reason: any) => {
        unhandledRejections.push(reason);
      };
      process.on('unhandledRejection', rejectionHandler);

      const syncEventSpy = jest.fn();
      const errorSpy = jest.fn();
      devSync.on('sync-event', syncEventSpy);
      devSync.on('error', errorSpy);

      await devSync.start();

      // Mock existsSync to return false after start
      mockExistsSync.mockReturnValue(false);

      // Simulate file change
      mockWatcher.emit('change', 'src/swagger.json');

      // Wait for debounce and error propagation
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that generation-failed event was emitted with correct error
      expect(syncEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation-failed',
          error: expect.objectContaining({
            message: expect.stringContaining('API spec file not found'),
          }),
        })
      );

      // Clean up
      process.removeListener('unhandledRejection', rejectionHandler);
    });
  });
});
