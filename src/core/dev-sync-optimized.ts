/**
 * OATS Development Sync Engine
 *
 * Optimized file watching and synchronization system
 *
 * @module @oatsjs/core/dev-sync-optimized
 */

import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import chalk from 'chalk';
import { watch } from 'chokidar';
import debounce from 'lodash.debounce';

import { ApiSpecError, GeneratorError } from '../errors/index.js';

import { SwaggerChangeDetector } from './swagger-diff.js';

import type { RuntimeConfig } from '../types/config.types.js';

export interface SyncEvent {
  type:
    | 'spec-changed'
    | 'generation-started'
    | 'generation-completed'
    | 'generation-failed';
  timestamp: Date;
  file?: string;
  changes?: string[];
  error?: Error;
}

/**
 * Development synchronization engine
 */
export class DevSyncEngine extends EventEmitter {
  private config: RuntimeConfig;
  private watcher?: any;
  private changeDetector: SwaggerChangeDetector;
  private debouncedSync: () => void;
  private isRunning = false;
  private lastSyncTime?: Date;
  private syncLock = false;
  private syncRetries = 0;
  private readonly MAX_SYNC_RETRIES = 3;

  constructor(config: RuntimeConfig) {
    super();
    this.config = config;
    this.changeDetector = new SwaggerChangeDetector();

    // Setup debounced sync function
    this.debouncedSync = debounce(
      this.performSync.bind(this),
      this.config.sync.debounceMs || 1000
    );
  }

  /**
   * Start watching for changes
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log(chalk.blue('👁️  Starting file watcher...'));

    try {
      const watchPaths = this.getWatchPaths();
      const ignored = this.config.sync.ignore || [
        '**/node_modules/**',
        '**/.git/**',
      ];

      this.watcher = watch(watchPaths, {
        ignored,
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      });

      this.watcher.on('change', this.handleFileChange.bind(this));
      this.watcher.on('add', this.handleFileChange.bind(this));
      this.watcher.on('error', this.handleWatchError.bind(this));

      this.isRunning = true;
      console.log(chalk.green('✅ File watcher started'));

      // Run initial sync if configured
      if (this.config.sync.runInitialGeneration) {
        console.log(chalk.blue('🔄 Running initial sync...'));
        await this.performSync();
      }

      this.emit('started');
    } catch (error) {
      console.error(chalk.red('❌ Failed to start file watcher:'), error);
      throw error;
    }
  }

  /**
   * Stop watching for changes
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log(chalk.yellow('🔄 Stopping file watcher...'));

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }

    this.isRunning = false;
    console.log(chalk.green('✅ File watcher stopped'));
    this.emit('stopped');
  }

  /**
   * Get current sync status
   */
  getStatus(): {
    isRunning: boolean;
    lastSyncTime?: Date;
    watchedPaths: string[];
  } {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      watchedPaths: this.getWatchPaths(),
    };
  }

  /**
   * Handle file change events
   */
  private handleFileChange(filePath: string): void {
    console.log(chalk.gray(`📝 File changed: ${filePath}`));

    // Check if this is an API spec file or related file
    if (this.isRelevantFile(filePath)) {
      console.log(
        chalk.blue('🔄 API-related file changed, scheduling sync...')
      );
      this.debouncedSync();
    }
  }

  /**
   * Handle watch errors
   */
  private handleWatchError(error: Error): void {
    console.error(chalk.red('👁️  File watcher error:'), error);
    this.emit('error', error);
  }

  /**
   * Perform synchronization
   */
  private async performSync(): Promise<void> {
    // Prevent concurrent sync operations
    if (this.syncLock) {
      console.log(chalk.yellow('⏳ Sync already in progress, skipping...'));
      return;
    }
    
    this.syncLock = true;
    
    try {
      const event: SyncEvent = {
        type: 'generation-started',
        timestamp: new Date(),
      };
      this.emit('sync-event', event);

      console.log(chalk.blue('🔄 Synchronizing API changes...'));

      // Check if API spec has meaningful changes
      const hasChanges = await this.checkForMeaningfulChanges();
      if (!hasChanges && this.config.sync.strategy === 'smart') {
        console.log(chalk.gray('📊 No meaningful API changes detected'));
        return;
      }

      // Generate TypeScript client
      await this.generateClient();

      // Build client if needed
      if (this.config.services.client.buildCommand) {
        await this.buildClient();
      }

      // Link packages if auto-link is enabled
      if (this.config.sync.autoLink) {
        await this.linkPackages();
      }

      this.lastSyncTime = new Date();
      this.syncRetries = 0; // Reset retry count on success
      console.log(chalk.green('✅ Synchronization completed successfully'));

      const completedEvent: SyncEvent = {
        type: 'generation-completed',
        timestamp: new Date(),
      };
      this.emit('sync-event', completedEvent);
    } catch (error) {
      console.error(chalk.red('❌ Synchronization failed:'), error);

      const failedEvent: SyncEvent = {
        type: 'generation-failed',
        timestamp: new Date(),
        error: error as Error,
      };
      this.emit('sync-event', failedEvent);

      // Retry logic with exponential backoff
      if (this.syncRetries < this.MAX_SYNC_RETRIES) {
        this.syncRetries++;
        const retryDelay = Math.pow(2, this.syncRetries) * 1000;
        console.log(chalk.yellow(`🔄 Retrying sync in ${retryDelay}ms (attempt ${this.syncRetries}/${this.MAX_SYNC_RETRIES})...`));
        setTimeout(() => {
          this.syncLock = false;
          this.performSync();
        }, retryDelay);
      } else {
        console.error(chalk.red('❌ Max sync retries exceeded. Manual intervention required.'));
        this.syncRetries = 0;
      }
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Check for meaningful changes in API spec
   */
  private async checkForMeaningfulChanges(): Promise<boolean> {
    const specPath = join(
      this.config.resolvedPaths.backend,
      this.config.services.backend.apiSpec.path
    );

    if (!existsSync(specPath)) {
      throw new ApiSpecError(`API spec file not found: ${specPath}`, specPath);
    }

    try {
      const currentSpec = JSON.parse(readFileSync(specPath, 'utf-8'));
      return this.changeDetector.hasSignificantChanges(currentSpec);
    } catch (error) {
      throw new ApiSpecError(`Failed to parse API spec: ${error}`, specPath);
    }
  }

  /**
   * Generate TypeScript client
   */
  private async generateClient(): Promise<void> {
    console.log(chalk.blue('🏗️  Generating TypeScript client...'));

    // Copy swagger.json to client directory for local generation
    const specPath = join(
      this.config.resolvedPaths.backend,
      this.config.services.backend.apiSpec.path
    );
    const clientSwaggerPath = join(
      this.config.resolvedPaths.client,
      'swagger.json'
    );
    
    try {
      const { copyFileSync } = await import('fs');
      copyFileSync(specPath, clientSwaggerPath);
      console.log(chalk.dim('Copied swagger.json to client directory'));
    } catch (error) {
      console.error(chalk.red('Failed to copy swagger.json:'), error);
    }

    // Implementation depends on generator type
    const { generator, generateCommand } = this.config.services.client;

    if (generator === 'custom' && generateCommand) {
      await this.runCommand(generateCommand, this.config.resolvedPaths.client);
    } else {
      // Handle other generators (@hey-api/openapi-ts, etc.)
      throw new GeneratorError(
        `Generator ${generator} not yet implemented`,
        generator,
        'generate'
      );
    }

    console.log(chalk.green('✅ TypeScript client generated'));
  }

  /**
   * Build client package
   */
  private async buildClient(): Promise<void> {
    const { buildCommand } = this.config.services.client;
    if (!buildCommand) return;

    console.log(chalk.blue('🔨 Building client package...'));
    await this.runCommand(buildCommand, this.config.resolvedPaths.client);
    console.log(chalk.green('✅ Client package built'));
  }

  /**
   * Link packages for local development
   */
  private async linkPackages(): Promise<void> {
    console.log(chalk.blue('🔗 Linking packages...'));

    const { linkCommand } = this.config.services.client;
    if (linkCommand) {
      // Link the client package
      await this.runCommand(linkCommand, this.config.resolvedPaths.client);

      // Link in frontend if configured
      if (this.config.services.frontend) {
        const frontendLinkCommand =
          this.config.services.frontend.packageLinkCommand ||
          `${this.config.packageManager} link ${this.config.services.client.packageName}`;

        await this.runCommand(
          frontendLinkCommand,
          this.config.resolvedPaths.frontend!
        );
      }
      
      // Touch a file in frontend to trigger HMR
      if (this.config.services.frontend) {
        try {
          const touchFile = join(this.config.resolvedPaths.frontend!, 'src', '.oats-sync');
          await this.runCommand(`touch ${touchFile}`, this.config.resolvedPaths.frontend!);
          console.log(chalk.dim('Triggered frontend HMR'));
        } catch (err) {
          // Ignore errors, this is optional
        }
      }
    }

    console.log(chalk.green('✅ Packages linked'));
  }

  /**
   * Run a shell command
   */
  private async runCommand(command: string, cwd: string): Promise<void> {
    const { execa } = await import('execa');

    try {
      await execa(command, {
        cwd,
        shell: true,
        stdio: 'inherit',
      });
    } catch (error) {
      throw new Error(`Command failed: ${command} - ${error}`);
    }
  }

  /**
   * Get paths to watch for changes
   */
  private getWatchPaths(): string[] {
    const paths: string[] = [];

    // Watch API spec file
    const specPath = join(
      this.config.resolvedPaths.backend,
      this.config.services.backend.apiSpec.path
    );
    paths.push(specPath);

    // Watch additional paths if specified
    if (this.config.services.backend.apiSpec.watch) {
      for (const pattern of this.config.services.backend.apiSpec.watch) {
        paths.push(join(this.config.resolvedPaths.backend, pattern));
      }
    }

    return paths;
  }

  /**
   * Check if file is relevant for synchronization
   */
  private isRelevantFile(filePath: string): boolean {
    const watchPaths = this.getWatchPaths();
    return watchPaths.some(
      (path) =>
        filePath.includes(path) ||
        filePath.endsWith('.json') ||
        filePath.endsWith('.yaml') ||
        filePath.endsWith('.yml')
    );
  }
}
