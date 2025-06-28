/**
 * Error Classes Tests
 */

import {
  OatsError,
  ConfigError,
  ConfigValidationError,
  ServiceError,
  ServiceStartError,
  FileSystemError,
  ApiSpecError,
  GeneratorError,
  NetworkError,
  DependencyError,
  CommandError,
  TimeoutError,
  UserCancelledError,
  ErrorWithSuggestion,
  ErrorHandler,
} from '../index';

describe('Error Classes', () => {
  describe('OatsError', () => {
    it('should create base error with required properties', () => {
      const error = new ConfigError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OatsError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.recoverable).toBe(false);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('ConfigError');
    });

    it('should capture stack trace', () => {
      const error = new ConfigError('Test error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConfigError');
    });

    it('should include context when provided', () => {
      const context = { file: 'test.json', line: 10 };
      const error = new ConfigError('Test error', context);
      
      expect(error.context).toEqual(context);
    });

    it('should provide error details', () => {
      const error = new ConfigError('Test error', { test: true });
      const details = error.getDetails();
      
      expect(details).toMatchObject({
        name: 'ConfigError',
        code: 'CONFIG_ERROR',
        message: 'Test error',
        recoverable: false,
        context: { test: true },
      });
      expect(details.timestamp).toBeInstanceOf(Date);
      expect(details.stack).toBeDefined();
    });
  });

  describe('ConfigValidationError', () => {
    it('should format validation errors in user message', () => {
      const validationErrors = [
        { path: 'services.backend.path', message: 'Path is required' },
        { path: 'services.client.packageName', message: 'Invalid package name' },
      ];
      
      const error = new ConfigValidationError(
        'Configuration validation failed',
        validationErrors
      );
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Configuration validation failed');
      expect(userMessage).toContain('services.backend.path: Path is required');
      expect(userMessage).toContain('services.client.packageName: Invalid package name');
    });
  });

  describe('ServiceStartError', () => {
    it('should include service details and exit code', () => {
      const error = new ServiceStartError(
        'backend',
        'Failed to start',
        1,
        'Port already in use'
      );
      
      expect(error.service).toBe('backend');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('Port already in use');
      expect(error.recoverable).toBe(true);
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Failed to start backend');
      expect(userMessage).toContain('Port already in use');
    });
  });

  describe('FileSystemError', () => {
    it('should include path and operation details', () => {
      const error = new FileSystemError(
        'Permission denied',
        '/path/to/file',
        'write',
        false
      );
      
      expect(error.path).toBe('/path/to/file');
      expect(error.operation).toBe('write');
      expect(error.recoverable).toBe(false);
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('File system error during write');
      expect(userMessage).toContain('/path/to/file');
      expect(userMessage).toContain('Permission denied');
    });
  });

  describe('GeneratorError', () => {
    it('should include generator and phase information', () => {
      const error = new GeneratorError(
        'Failed to generate client',
        '@hey-api/openapi-ts',
        'generate'
      );
      
      expect(error.generator).toBe('@hey-api/openapi-ts');
      expect(error.phase).toBe('generate');
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Generator error during generate phase');
      expect(userMessage).toContain('@hey-api/openapi-ts');
    });
  });

  describe('DependencyError', () => {
    it('should show version mismatch information', () => {
      const error = new DependencyError(
        'Version mismatch',
        'typescript',
        '>=5.0.0',
        '4.9.5'
      );
      
      expect(error.dependency).toBe('typescript');
      expect(error.requiredVersion).toBe('>=5.0.0');
      expect(error.installedVersion).toBe('4.9.5');
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('typescript');
      expect(userMessage).toContain('Required: >=5.0.0');
      expect(userMessage).toContain('Installed: 4.9.5');
    });
  });

  describe('CommandError', () => {
    it('should include command execution details', () => {
      const error = new CommandError(
        'Command failed',
        'npm install',
        1,
        'installed 100 packages',
        'npm ERR! code E404'
      );
      
      expect(error.command).toBe('npm install');
      expect(error.exitCode).toBe(1);
      expect(error.stdout).toBe('installed 100 packages');
      expect(error.stderr).toBe('npm ERR! code E404');
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Command failed: npm install');
      expect(userMessage).toContain('Exit code: 1');
      expect(userMessage).toContain('npm ERR! code E404');
    });
  });

  describe('TimeoutError', () => {
    it('should show timeout details', () => {
      const error = new TimeoutError('Backend startup', 30000);
      
      expect(error.operation).toBe('Backend startup');
      expect(error.timeoutMs).toBe(30000);
      expect(error.message).toBe("Operation 'Backend startup' timed out after 30000ms");
      expect(error.recoverable).toBe(true);
    });
  });

  describe('ErrorWithSuggestion', () => {
    it('should include suggestion in user message', () => {
      const error = new ErrorWithSuggestion(
        'Port 3000 is already in use',
        'PORT_IN_USE',
        'Try using a different port or kill the process using port 3000'
      );
      
      expect(error.suggestion).toBe('Try using a different port or kill the process using port 3000');
      
      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('Port 3000 is already in use');
      expect(userMessage).toContain('💡 Suggestion:');
      expect(userMessage).toContain('Try using a different port');
    });
  });

  describe('ErrorHandler', () => {
    describe('handle', () => {
      it('should handle OatsError instances', () => {
        const error = new ConfigError('Test error');
        const message = ErrorHandler.handle(error);
        expect(message).toBe('Test error');
      });

      it('should handle generic Error instances', () => {
        const error = new Error('Generic error');
        const message = ErrorHandler.handle(error);
        expect(message).toBe('Unexpected error: Generic error');
      });

      it('should handle non-Error values', () => {
        const message = ErrorHandler.handle('string error');
        expect(message).toBe('An unknown error occurred');
      });
    });

    describe('isRecoverable', () => {
      it('should identify recoverable errors', () => {
        const recoverable = new ServiceError('Test', 'backend', 'TEST_ERROR', true);
        const notRecoverable = new ConfigError('Test');
        
        expect(ErrorHandler.isRecoverable(recoverable)).toBe(true);
        expect(ErrorHandler.isRecoverable(notRecoverable)).toBe(false);
        expect(ErrorHandler.isRecoverable(new Error('test'))).toBe(false);
      });
    });

    describe('wrap', () => {
      it('should wrap successful async operations', async () => {
        const result = await ErrorHandler.wrap(
          async () => 'success',
          'test operation'
        );
        
        expect(result).toBe('success');
      });

      it('should handle recoverable errors', async () => {
        const recoverableError = new ServiceError('Test', 'backend', 'TEST', true);
        const result = await ErrorHandler.wrap(
          async () => {
            throw recoverableError;
          },
          'test operation'
        );
        
        expect(result).toBeUndefined();
      });

      it('should re-throw non-recoverable errors', async () => {
        const nonRecoverableError = new ConfigError('Test');
        
        await expect(
          ErrorHandler.wrap(
            async () => {
              throw nonRecoverableError;
            },
            'test operation'
          )
        ).rejects.toThrow(nonRecoverableError);
      });
    });

    describe('log', () => {
      it('should log OatsError details as JSON', () => {
        const mockLogger = jest.fn();
        const error = new ConfigError('Test', { extra: 'data' });
        
        ErrorHandler.log(error, mockLogger);
        
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining('"name": "ConfigError"')
        );
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining('"code": "CONFIG_ERROR"')
        );
      });

      it('should log Error stack traces', () => {
        const mockLogger = jest.fn();
        const error = new Error('Test error');
        
        ErrorHandler.log(error, mockLogger);
        
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining('Error: Test error')
        );
      });

      it('should use console.error by default', () => {
        const error = new Error('Test');
        ErrorHandler.log(error);
        
        expect(console.error).toHaveBeenCalled();
      });
    });
  });
});