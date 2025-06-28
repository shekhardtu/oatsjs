/**
 * Custom Error Classes for OATS
 *
 * This module defines a hierarchy of error classes for better error handling
 * and user-friendly error messages throughout the application.
 *
 * @module @oatsjs/errors
 */

/**
 * Base error class for all OATS errors
 */
export abstract class OatsError extends Error {
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * Additional context about the error
   */
  public readonly context?: Record<string, unknown>;

  /**
   * Whether this error is recoverable
   */
  public readonly recoverable: boolean;

  /**
   * Timestamp when the error occurred
   */
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    recoverable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.recoverable = recoverable;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a user-friendly error message
   */
  public getUserMessage(): string {
    return this.message;
  }

  /**
   * Returns error details for logging
   */
  public getDetails(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends OatsError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', false, context);
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends ConfigError {
  public readonly validationErrors: Array<{
    path: string;
    message: string;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ path: string; message: string }>,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    (this as any).code = 'CONFIG_VALIDATION_ERROR';
    this.validationErrors = validationErrors;
  }

  getUserMessage(): string {
    const errors = this.validationErrors
      .map((err) => `  - ${err.path}: ${err.message}`)
      .join('\n');
    return `${this.message}\n${errors}`;
  }
}

/**
 * Service-related errors
 */
export class ServiceError extends OatsError {
  public readonly service: string;

  constructor(
    message: string,
    service: string,
    code: string = 'SERVICE_ERROR',
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, code, recoverable, context);
    this.service = service;
  }
}

/**
 * Service start error
 */
export class ServiceStartError extends ServiceError {
  public readonly exitCode?: number;
  public readonly stderr?: string;

  constructor(
    service: string,
    message: string,
    exitCode?: number,
    stderr?: string,
    context?: Record<string, unknown>
  ) {
    super(message, service, 'SERVICE_START_ERROR', true, context);
    this.exitCode = exitCode;
    this.stderr = stderr;
  }

  getUserMessage(): string {
    let message = `Failed to start ${this.service}: ${this.message}`;
    if (this.stderr) {
      message += `\nError output: ${this.stderr}`;
    }
    return message;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends OatsError {
  public readonly path: string;
  public readonly operation: string;

  constructor(
    message: string,
    path: string,
    operation: string,
    recoverable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message, 'FILESYSTEM_ERROR', recoverable, context);
    this.path = path;
    this.operation = operation;
  }

  getUserMessage(): string {
    return `File system error during ${this.operation} on ${this.path}: ${this.message}`;
  }
}

/**
 * API specification errors
 */
export class ApiSpecError extends OatsError {
  public readonly specPath: string;

  constructor(
    message: string,
    specPath: string,
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, 'API_SPEC_ERROR', recoverable, context);
    this.specPath = specPath;
  }
}

/**
 * Generator errors
 */
export class GeneratorError extends OatsError {
  public readonly generator: string;
  public readonly phase: 'generate' | 'build' | 'link';

  constructor(
    message: string,
    generator: string,
    phase: 'generate' | 'build' | 'link',
    recoverable: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message, 'GENERATOR_ERROR', recoverable, context);
    this.generator = generator;
    this.phase = phase;
  }

  getUserMessage(): string {
    return `Generator error during ${this.phase} phase (${this.generator}): ${this.message}`;
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends OatsError {
  public readonly url?: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'NETWORK_ERROR', true, context);
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Dependency errors
 */
export class DependencyError extends OatsError {
  public readonly dependency: string;
  public readonly requiredVersion?: string;
  public readonly installedVersion?: string;

  constructor(
    message: string,
    dependency: string,
    requiredVersion?: string,
    installedVersion?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'DEPENDENCY_ERROR', false, context);
    this.dependency = dependency;
    this.requiredVersion = requiredVersion;
    this.installedVersion = installedVersion;
  }

  getUserMessage(): string {
    let message = `Dependency error: ${this.dependency} - ${this.message}`;
    if (this.requiredVersion) {
      message += `\nRequired: ${this.requiredVersion}`;
    }
    if (this.installedVersion) {
      message += `\nInstalled: ${this.installedVersion}`;
    }
    return message;
  }
}

/**
 * Command execution errors
 */
export class CommandError extends OatsError {
  public readonly command: string;
  public readonly exitCode: number;
  public readonly stdout?: string;
  public readonly stderr?: string;

  constructor(
    message: string,
    command: string,
    exitCode: number,
    stdout?: string,
    stderr?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'COMMAND_ERROR', true, context);
    this.command = command;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }

  getUserMessage(): string {
    let message = `Command failed: ${this.command}\n`;
    message += `Exit code: ${this.exitCode}\n`;
    if (this.stderr) {
      message += `Error: ${this.stderr}`;
    }
    return message;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends OatsError {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(
    operation: string,
    timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      true,
      context
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * User cancellation error
 */
export class UserCancelledError extends OatsError {
  constructor(operation: string, context?: Record<string, unknown>) {
    super(`User cancelled: ${operation}`, 'USER_CANCELLED', false, context);
  }
}

/**
 * Creates an error with a suggestion for fixing it
 */
export class ErrorWithSuggestion extends OatsError {
  public readonly suggestion: string;

  constructor(
    message: string,
    code: string,
    suggestion: string,
    recoverable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message, code, recoverable, context);
    this.suggestion = suggestion;
  }

  getUserMessage(): string {
    return `${this.message}\n\n💡 Suggestion: ${this.suggestion}`;
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Handles an error and returns a user-friendly message
   */
  static handle(error: unknown): string {
    if (error instanceof OatsError) {
      return error.getUserMessage();
    }

    if (error instanceof Error) {
      return `Unexpected error: ${error.message}`;
    }

    return 'An unknown error occurred';
  }

  /**
   * Logs error details for debugging
   */
  static log(error: unknown, logger?: (message: string) => void): void {
    const log = logger || console.error;

    if (error instanceof OatsError) {
      log(JSON.stringify(error.getDetails(), null, 2));
    } else if (error instanceof Error) {
      log(error.stack || error.message);
    } else {
      log(String(error));
    }
  }

  /**
   * Determines if an error is recoverable
   */
  static isRecoverable(error: unknown): boolean {
    if (error instanceof OatsError) {
      return error.recoverable;
    }
    return false;
  }

  /**
   * Wraps an async function with error handling
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      const message = this.handle(error);
      console.error(`Error in ${context}: ${message}`);
      if (!this.isRecoverable(error)) {
        throw error;
      }
      return undefined;
    }
  }
}
