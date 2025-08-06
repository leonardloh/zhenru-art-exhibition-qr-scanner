/**
 * Unit tests for the error handling system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorHandler, ErrorCategory, ErrorSeverity, errorHandler } from '../error-handler';
import type { DatabaseError } from '@/types/database';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = ErrorHandler.getInstance();
    handler.clearErrorLog();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createError', () => {
    it('should create a standardized application error', () => {
      const error = handler.createError(
        'Test error message',
        'TEST_ERROR',
        'Test error details',
        { testContext: 'value' }
      );

      expect(error).toMatchObject({
        message: 'Test error message',
        code: 'TEST_ERROR',
        details: 'Test error details',
        context: { testContext: 'value' },
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        retryable: false
      });

      expect(error.id).toMatch(/^err_\d+_[a-z0-9]+$/);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should map known error codes correctly', () => {
      const networkError = handler.createError('Network failed', 'NETWORK_ERROR');
      expect(networkError.category).toBe(ErrorCategory.NETWORK);
      expect(networkError.severity).toBe(ErrorSeverity.HIGH);
      expect(networkError.retryable).toBe(true);

      const validationError = handler.createError('Invalid input', 'VALIDATION_ERROR');
      expect(validationError.category).toBe(ErrorCategory.VALIDATION);
      expect(validationError.severity).toBe(ErrorSeverity.LOW);
      expect(validationError.retryable).toBe(false);
    });
  });

  describe('fromDatabaseError', () => {
    it('should convert database error to application error', () => {
      const dbError: DatabaseError = {
        message: 'Database connection failed',
        code: 'DATABASE_ERROR',
        details: 'Connection timeout'
      };

      const appError = handler.fromDatabaseError(dbError, { operation: 'test' });

      expect(appError.message).toBe('Database connection failed');
      expect(appError.code).toBe('DATABASE_ERROR');
      expect(appError.details).toBe('Connection timeout');
      expect(appError.context).toEqual({ operation: 'test' });
    });
  });

  describe('fromError', () => {
    it('should convert JavaScript Error to application error', () => {
      const jsError = new Error('JavaScript error');
      jsError.name = 'TypeError';

      const appError = handler.fromError(jsError, { component: 'TestComponent' });

      expect(appError.message).toBe('JavaScript error');
      expect(appError.code).toBe('TypeError');
      expect(appError.context).toEqual({ component: 'TestComponent' });
    });

    it('should handle unknown error types', () => {
      const unknownError = 'string error';
      const appError = handler.fromError(unknownError);

      expect(appError.message).toBe('An unknown error occurred');
      expect(appError.code).toBe('UNKNOWN_ERROR');
      expect(appError.details).toBe('string error');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await handler.withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors', async () => {
      const retryableError = handler.createError('Network error', 'NETWORK_ERROR');
      const operation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');

      const onRetry = vi.fn();
      const result = await handler.withRetry(operation, undefined, onRetry);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = handler.createError('Validation error', 'VALIDATION_ERROR');
      const operation = vi.fn().mockRejectedValue(nonRetryableError);

      await expect(handler.withRetry(operation)).rejects.toEqual(nonRetryableError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry attempts', async () => {
      const retryableError = handler.createError('Network error', 'NETWORK_ERROR');
      const operation = vi.fn().mockRejectedValue(retryableError);

      await expect(
        handler.withRetry(operation, { maxAttempts: 2 })
      ).rejects.toEqual(retryableError);
      
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should implement exponential backoff', async () => {
      const retryableError = handler.createError('Network error', 'NETWORK_ERROR');
      const operation = vi.fn().mockRejectedValue(retryableError);
      
      const startTime = Date.now();
      
      try {
        await handler.withRetry(operation, { 
          maxAttempts: 2, 
          baseDelay: 100,
          backoffMultiplier: 2
        });
      } catch {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should have waited at least 100ms + 200ms = 300ms (plus jitter)
      expect(totalTime).toBeGreaterThan(250);
    });
  });

  describe('getErrorMessage', () => {
    it('should return user-friendly error message with actions', () => {
      const networkError = handler.createError('Connection failed', 'NETWORK_ERROR');
      const message = handler.getErrorMessage(networkError);

      expect(message.title).toBe('Connection Problem');
      expect(message.message).toBe('Network connection issue. Please check your internet connection and try again.');
      expect(message.actions).toContain('Try again');
      expect(message.actions).toContain('Check your internet connection');
      expect(message.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should provide appropriate actions for camera errors', () => {
      const cameraError = handler.createError('Camera not found', 'CAMERA_NOT_FOUND');
      const message = handler.getErrorMessage(cameraError);

      expect(message.actions).toContain('Use manual search instead');
    });

    it('should provide retry action for retryable errors', () => {
      const retryableError = handler.createError('Timeout', 'TIMEOUT_ERROR');
      const message = handler.getErrorMessage(retryableError);

      expect(message.actions).toContain('Try again');
    });
  });

  describe('getErrorStats', () => {
    it('should return error statistics', () => {
      // Create some test errors
      handler.createError('Network error', 'NETWORK_ERROR');
      handler.createError('Validation error', 'VALIDATION_ERROR');
      handler.createError('Another network error', 'NETWORK_ERROR');

      const stats = handler.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[ErrorCategory.NETWORK]).toBe(2);
      expect(stats.errorsByCategory[ErrorCategory.VALIDATION]).toBe(1);
      expect(stats.errorsBySeverity[ErrorSeverity.HIGH]).toBe(2); // Network errors
      expect(stats.errorsBySeverity[ErrorSeverity.LOW]).toBe(1);  // Validation error
      expect(stats.recentErrors).toHaveLength(3);
    });
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = ErrorHandler.getInstance();
      instance1.createError('Test error', 'TEST_ERROR');

      const instance2 = ErrorHandler.getInstance();
      const stats = instance2.getErrorStats();

      expect(stats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('error logging', () => {
    it('should log errors to console based on severity', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      handler.createError('Critical error', 'UNKNOWN_ERROR'); // Default medium -> warn
      handler.createError('High severity', 'DATABASE_ERROR'); // High -> error
      handler.createError('Low severity', 'VALIDATION_ERROR'); // Low -> info

      expect(warnSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('should limit error log size', () => {
      // Create more than 100 errors
      for (let i = 0; i < 105; i++) {
        handler.createError(`Error ${i}`, 'TEST_ERROR');
      }

      const stats = handler.getErrorStats();
      expect(stats.totalErrors).toBe(100); // Should be capped at 100
    });
  });
});

describe('errorHandler singleton', () => {
  it('should be accessible as a singleton export', () => {
    expect(errorHandler).toBeInstanceOf(ErrorHandler);
    
    const error = errorHandler.createError('Test', 'TEST');
    expect(error).toBeDefined();
  });
});