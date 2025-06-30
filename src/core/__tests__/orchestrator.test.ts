/**
 * Orchestrator Tests
 */

import EventEmitter from 'events';

import { execa } from 'execa';

import detectPort from 'detect-port';

import { DevSyncOrchestrator } from '../orchestrator';

// Mock dependencies
jest.mock('execa');
jest.mock('detect-port', () => {
  return jest.fn().mockImplementation((port: number) => Promise.resolve(port));
});
jest.mock('../dev-sync-optimized', () => ({
  DevSyncEngine: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
  })),
}));

const mockExeca = execa as jest.MockedFunction<typeof execa>;
const mockDetectPort = jest.mocked(detectPort);

describe('DevSyncOrchestrator', () => {
  let orchestrator: DevSyncOrchestrator;
  let mockProcess: any;
  const defaultConfig = {
    services: {
      backend: {
        path: '../backend',
        startCommand: 'npm run dev',
        port: 4000,
        apiSpec: {
          path: 'src/swagger.json',
        },
      },
      client: {
        path: '../client',
        packageName: '@test/client',
        generator: 'custom',
        generateCommand: 'npm run generate',
      },
    },
    resolvedPaths: {
      backend: '/test/backend',
      client: '/test/client',
      apiSpec: '/test/backend/src/swagger.json',
    },
    sync: {
      debounceMs: 100,
      strategy: 'conservative',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock child process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.killed = false;

    // Setup execa mock to return mock process
    mockExeca.mockImplementation(() => mockProcess as any);

    // Mock detect-port to return available ports by default
    mockDetectPort.mockImplementation(async (port: number) => port);

    // Mock execAsync for OS-level port checks
    jest.mock('child_process', () => ({
      exec: jest.fn((_cmd: string, cb: (err: any, stdout: string) => void) => {
        cb(null, ''); // Return empty stdout (port is free)
      }),
    }));

    orchestrator = new DevSyncOrchestrator(defaultConfig as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should start backend service successfully', async () => {
      const startPromise = orchestrator.start();

      // Wait for services to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockExeca).toHaveBeenCalledWith(
        'npm run dev',
        expect.objectContaining({
          cwd: '/test/backend',
          shell: true,
          stdio: ['inherit', 'pipe', 'pipe'],
          preferLocal: true,
          localDir: '/test/backend',
        })
      );

      // Emit ready pattern from backend
      mockProcess.stdout.emit(
        'data',
        Buffer.from('Server listening on port 4000')
      );

      await startPromise;

      // Verify sync engine was started
      const { DevSyncEngine } = jest.requireMock('../dev-sync-optimized');
      expect(DevSyncEngine).toHaveBeenCalled();

      const mockSyncInstance = DevSyncEngine.mock.results[0].value;
      expect(mockSyncInstance.start).toHaveBeenCalled();
    }, 10000);

    it('should handle service startup failure', async () => {
      const startPromise = orchestrator.start();

      // Wait a bit then simulate service failure
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Emit error and exit
      mockProcess.emit('error', new Error('Failed to start'));
      mockProcess.emit('exit', 1);

      await expect(startPromise).rejects.toThrow('Failed to start');
    }, 10000);

    it('should pass environment variables to services', async () => {
      // Create new orchestrator with env config
      const configWithEnv = {
        ...defaultConfig,
        services: {
          ...defaultConfig.services,
          backend: {
            ...defaultConfig.services.backend,
            env: {
              NODE_ENV: 'development',
              API_PORT: '4000',
            },
          },
        },
        resolvedPaths: defaultConfig.resolvedPaths,
        sync: defaultConfig.sync,
      };

      orchestrator = new DevSyncOrchestrator(configWithEnv as any);

      // Mock port detection
      mockDetectPort.mockImplementation(async (port: number) => {
        if (mockDetectPort.mock.calls.length <= 1) {
          return port;
        }
        return port + 1;
      });

      const startPromise = orchestrator.start();

      // Wait for service start
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockExeca).toHaveBeenCalledWith(
        'npm run dev',
        expect.objectContaining({
          cwd: '/test/backend',
          env: expect.objectContaining({
            NODE_ENV: 'development',
            API_PORT: '4000',
          }),
        })
      );

      // Emit ready pattern to complete startup
      mockProcess.stdout.emit('data', Buffer.from('Server listening on'));

      await startPromise;
    }, 10000);
  });

  describe('stop', () => {
    it('should stop all running services', async () => {
      // Start services first
      const startPromise = orchestrator.start();

      // Wait for service start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit ready pattern
      mockProcess.stdout.emit('data', Buffer.from('Server listening on'));

      await startPromise;

      // Mock the process exit when kill is called
      mockProcess.kill.mockImplementation(() => {
        setTimeout(() => mockProcess.emit('exit', 0), 10);
      });

      // Stop services
      await orchestrator.stop();

      expect(mockProcess.kill).toHaveBeenCalled();
    }, 10000);
  });

  describe('getStatus', () => {
    it('should return status of all services', () => {
      const statuses = orchestrator.getStatus();
      expect(Array.isArray(statuses)).toBe(true);
    });

    it('should include service details in status', async () => {
      const startPromise = orchestrator.start();

      // Wait for service start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit ready pattern
      mockProcess.stdout.emit('data', Buffer.from('Server listening on'));

      await startPromise;

      const statuses = orchestrator.getStatus();
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses[0]).toHaveProperty('name');
      expect(statuses[0]).toHaveProperty('status');
      expect(statuses[0]).toHaveProperty('port');
    }, 10000);
  });

  describe('event handling', () => {
    it('should emit ready event when services start', async () => {
      const eventSpy = jest.fn();
      orchestrator.on('ready', eventSpy);

      const startPromise = orchestrator.start();

      // Wait for service start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit ready pattern
      mockProcess.stdout.emit('data', Buffer.from('Server listening on'));

      await startPromise;

      expect(eventSpy).toHaveBeenCalled();
    }, 10000);

    it('should emit service-error events on crash', async () => {
      const errorSpy = jest.fn();
      orchestrator.on('service-error', errorSpy);

      // First start successfully
      const startPromise = orchestrator.start();

      // Wait for service start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit ready pattern
      mockProcess.stdout.emit('data', Buffer.from('Server listening on'));

      await startPromise;

      // Then simulate crash after service was running
      mockProcess.emit('exit', 1);

      // Wait for event to be emitted
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'backend',
          error: expect.any(Error),
        })
      );
    }, 10000);
  });
});
