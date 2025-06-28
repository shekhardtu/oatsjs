/**
 * OATS Development Orchestrator
 *
 * Manages multiple development services and coordinates synchronization
 *
 * @module @oatsjs/core/orchestrator
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

import chalk from 'chalk';
import { execa } from 'execa';
// @ts-ignore - detect-port doesn't have type definitions
import detectPort from 'detect-port';

import { ServiceStartError } from '../errors/index.js';
import { DevSyncEngine } from './dev-sync-optimized.js';

import type { RuntimeConfig } from '../types/config.types.js';

const execAsync = promisify(exec);

export interface ServiceStatus {
  name: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  process?: any;
  port?: number;
  startTime?: Date;
  error?: Error;
}

/**
 * Development services orchestrator
 */
export class DevSyncOrchestrator extends EventEmitter {
  private config: RuntimeConfig;
  private services: Map<string, ServiceStatus> = new Map();
  private isShuttingDown = false;
  private syncEngine?: DevSyncEngine;

  constructor(config: RuntimeConfig) {
    super();
    this.config = config;
    this.setupSignalHandlers();
    
    // Initialize sync engine if client service is configured
    if (this.config.services.client) {
      this.syncEngine = new DevSyncEngine(config);
      this.syncEngine.on('sync-event', (event) => {
        console.log(chalk.blue(`🔄 Sync event: ${event.type}`));
      });
    }
  }

  /**
   * Start all services
   */
  async start(): Promise<void> {
    console.log(chalk.blue('🚀 Starting OATS development environment...'));

    try {
      // Check and handle port conflicts before starting
      if (this.config.services.backend.port) {
        await this.handlePortConflict('backend', this.config.services.backend.port);
      }
      if (this.config.services.frontend?.port) {
        await this.handlePortConflict('frontend', this.config.services.frontend.port);
      }

      // Start backend service
      await this.startService('backend', {
        command: this.config.services.backend.startCommand,
        cwd: this.config.resolvedPaths.backend,
        port: this.config.services.backend.port,
        env: this.config.services.backend.env,
        readyPattern: this.config.services.backend.readyPattern,
      });

      // Start frontend service if configured
      if (this.config.services.frontend) {
        await this.startService('frontend', {
          command: this.config.services.frontend.startCommand,
          cwd: this.config.resolvedPaths.frontend!,
          port: this.config.services.frontend.port,
          env: this.config.services.frontend.env,
          readyPattern: this.config.services.frontend.readyPattern,
        });
      }

      console.log(chalk.green('✅ All services started successfully'));
      
      // Start sync engine after services are running
      if (this.syncEngine) {
        console.log(chalk.blue('🔄 Starting file watcher for API sync...'));
        await this.syncEngine.start();
      }
      
      this.emit('ready');
    } catch (error) {
      console.error(chalk.red('❌ Failed to start services:'), error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all services
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log(chalk.yellow('🔄 Shutting down services...'));

    // Stop sync engine first if it's running
    if (this.syncEngine) {
      await this.syncEngine.stop();
    }

    const stopPromises: Promise<void>[] = [];

    for (const [name, status] of this.services) {
      if (status.process && !status.process.killed) {
        stopPromises.push(this.stopService(name));
      }
    }

    await Promise.all(stopPromises);
    console.log(chalk.green('✅ All services stopped'));
    this.emit('stopped');
  }

  /**
   * Get status of all services
   */
  getStatus(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  /**
   * Start a specific service
   */
  private async startService(
    name: string,
    options: {
      command: string;
      cwd: string;
      port?: number;
      env?: Record<string, string>;
      readyPattern?: string;
    }
  ): Promise<void> {
    console.log(chalk.blue(`📦 Starting ${name} service...`));

    const status: ServiceStatus = {
      name,
      status: 'starting',
      port: options.port,
      startTime: new Date(),
    };

    this.services.set(name, status);

    return new Promise((resolve, reject) => {
      console.log(chalk.dim(`Executing command: ${options.command}`));
      console.log(chalk.dim(`Working directory: ${options.cwd}`));
      
      const child = execa(options.command, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
        },
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
        preferLocal: true,
        localDir: options.cwd,
      });

      status.process = child;

      let isReady = false;
      const readyPattern = options.readyPattern;
      const readyRegex = readyPattern ? new RegExp(readyPattern, 'i') : null;
      
      // If port is specified, prioritize port-based detection
      const usePortDetection = !!options.port;
      const useTextDetection = !!readyPattern && !usePortDetection;

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        console.log(chalk.gray(`[${name}]`), output);

        // Only use text pattern if port detection is not available
        if (!isReady && useTextDetection && readyRegex && readyRegex.test(output)) {
          isReady = true;
          status.status = 'running';
          console.log(chalk.green(`✅ ${name} service is ready (text pattern matched)`));
          resolve();
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        console.error(chalk.red(`[${name}] ERROR:`), output);
        
        // Only use text pattern if port detection is not available
        if (!isReady && useTextDetection && readyRegex && readyRegex.test(output)) {
          isReady = true;
          status.status = 'running';
          console.log(chalk.green(`✅ ${name} service is ready (text pattern matched from stderr)`));
          resolve();
        }
        
        // Store stderr for error reporting
        if (!status.error) {
          (status as any).stderr = output;
        }
      });

      // Handle process exit
      child.on('exit', (code: number | null) => {
        if (!this.isShuttingDown) {
          // Only treat as error if service wasn't ready and exited with non-zero code
          if (!isReady && code !== 0) {
            const stderr = (status as any).stderr || '';
            const error = new ServiceStartError(
              name,
              `Service exited with code ${code}`,
              code || -1,
              stderr
            );
            status.status = 'error';
            status.error = error;
            reject(error);
          } else if (isReady && code !== 0) {
            // Service was running but crashed
            const stderr = (status as any).stderr || '';
            const error = new ServiceStartError(
              name,
              `Service crashed with code ${code}`,
              code || -1,
              stderr
            );
            status.status = 'error';
            status.error = error;
            this.emit('service-error', { name, error });
          } else {
            status.status = 'stopped';
          }
        }
      });

      child.on('error', (error: Error) => {
        const serviceError = new ServiceStartError(
          name,
          `Failed to start service: ${error.message}`,
          -1
        );
        status.status = 'error';
        status.error = serviceError;
        reject(serviceError);
      });

      // If port is specified, prioritize port-based detection
      let portCheckInterval: NodeJS.Timeout | undefined;
      if (usePortDetection && options.port) {
        console.log(chalk.dim(`Using port-based detection for ${name} on port ${options.port}`));
        
        portCheckInterval = setInterval(async () => {
          try {
            const isPortInUse = await this.isPortInUse(options.port!);
            if (isPortInUse && !isReady) {
              // Port is now in use, service is ready
              if (portCheckInterval) {
                clearInterval(portCheckInterval);
                portCheckInterval = undefined;
              }
              isReady = true;
              status.status = 'running';
              console.log(chalk.green(`✅ ${name} service is ready (port ${options.port} is now in use)`));
              resolve();
            }
          } catch (err) {
            // Ignore errors during port checking
          }
        }, 500); // Check every 500ms for faster detection
        
        // Clean up interval on timeout
        setTimeout(() => {
          if (portCheckInterval) {
            clearInterval(portCheckInterval);
            portCheckInterval = undefined;
          }
        }, 29000);
      }

      // Timeout for service startup
      setTimeout(() => {
        if (!isReady) {
          const error = new ServiceStartError(
            name,
            'Service failed to start within timeout',
            -1
          );
          status.status = 'error';
          status.error = error;
          reject(error);
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Stop a specific service
   */
  private async stopService(name: string): Promise<void> {
    const status = this.services.get(name);
    if (!status?.process) return;

    return new Promise<void>((resolve) => {
      const child = status.process!;

      child.on('exit', () => {
        console.log(chalk.green(`✅ ${name} service stopped`));
        resolve();
      });

      // Try graceful shutdown first
      child.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Check if a port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const availablePort = await detectPort(port);
      return availablePort !== port;
    } catch (error) {
      // If detectPort fails, fallback to checking with lsof/netstat
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          const { stdout } = await execAsync(`lsof -i :${port} -t`);
          return stdout.trim() !== '';
        } else if (process.platform === 'win32') {
          const { stdout } = await execAsync(`netstat -an | findstr :${port}`);
          return stdout.includes('LISTENING');
        }
      } catch {
        // Command failed, assume port is free
        return false;
      }
      return false;
    }
  }

  /**
   * Handle port conflicts by killing existing process if needed
   */
  private async handlePortConflict(serviceName: string, port: number): Promise<void> {
    const isInUse = await this.isPortInUse(port);
    
    if (isInUse) {
      console.log(chalk.yellow(`⚠️  Port ${port} is already in use for ${serviceName}`));
      
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          // Get PIDs of processes using the port
          const { stdout } = await execAsync(`lsof -i :${port} -t`);
          const pids = stdout.trim().split('\n').filter(pid => pid);
          
          if (pids.length > 0) {
            for (const pid of pids) {
              if (pid) {
                console.log(chalk.yellow(`🔪 Killing process ${pid} using port ${port}...`));
                try {
                  await execAsync(`kill -9 ${pid}`);
                } catch (err) {
                  console.warn(chalk.yellow(`⚠️  Could not kill process ${pid}: ${err}`));
                }
              }
            }
            
            // Wait a bit for the port to be released
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify port is now free
            const stillInUse = await this.isPortInUse(port);
            if (!stillInUse) {
              console.log(chalk.green(`✅ Port ${port} is now free`));
            } else {
              throw new Error(`Failed to free port ${port}`);
            }
          }
        } else if (process.platform === 'win32') {
          // Windows: Find and kill process using the port
          const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
          const lines = stdout.trim().split('\n');
          const pids = new Set<string>();
          
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid)) {
              pids.add(pid);
            }
          });
          
          for (const pid of pids) {
            console.log(chalk.yellow(`🔪 Killing process ${pid} using port ${port}...`));
            await execAsync(`taskkill /F /PID ${pid}`);
          }
          
          // Wait a bit for the port to be released
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify port is now free
          const stillInUse = await this.isPortInUse(port);
          if (!stillInUse) {
            console.log(chalk.green(`✅ Port ${port} is now free`));
          } else {
            throw new Error(`Failed to free port ${port}`);
          }
        }
      } catch (error) {
        console.error(chalk.red(`❌ Failed to handle port conflict: ${error}`));
        throw new ServiceStartError(
          serviceName,
          `Port ${port} is already in use and could not be freed`,
          -1
        );
      }
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(
          chalk.yellow(`\n🔄 Received ${signal}, shutting down gracefully...`)
        );
        await this.stop();
        process.exit(0);
      });
    });
  }
}
