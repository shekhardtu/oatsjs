/**
 * OATS Development Orchestrator
 * 
 * Manages multiple development services and coordinates synchronization
 * 
 * @module @oatsjs/core/orchestrator
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import { execa } from 'execa';

import type { RuntimeConfig } from '../types/config.types.js';
import { ServiceStartError } from '../errors/index.js';

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

  constructor(config: RuntimeConfig) {
    super();
    this.config = config;
    this.setupSignalHandlers();
  }

  /**
   * Start all services
   */
  async start(): Promise<void> {
    console.log(chalk.blue('🚀 Starting OATS development environment...'));

    try {
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
      const child = execa(options.command, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
        },
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      status.process = child;

      let isReady = false;
      const readyPattern = options.readyPattern || 'Server|started|listening|ready';
      const readyRegex = new RegExp(readyPattern, 'i');

      // Handle stdout
      child.stdout?.on('data', (data: string) => {
        console.log(chalk.gray(`[${name}]`), data.trim());

        if (!isReady && readyRegex.test(data)) {
          isReady = true;
          status.status = 'running';
          console.log(chalk.green(`✅ ${name} service is ready`));
          resolve();
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data: string) => {
        console.error(chalk.red(`[${name}] ERROR:`), data.trim());
      });

      // Handle process exit
      child.on('exit', (code: number | null) => {
        if (code !== 0 && !this.isShuttingDown) {
          const error = new ServiceStartError(
            name,
            `Service exited with code ${code}`,
            code || -1
          );
          status.status = 'error';
          status.error = error;
          
          if (!isReady) {
            reject(error);
          } else {
            this.emit('service-error', { name, error });
          }
        } else {
          status.status = 'stopped';
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
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(chalk.yellow(`\n🔄 Received ${signal}, shutting down gracefully...`));
        await this.stop();
        process.exit(0);
      });
    });
  }
}