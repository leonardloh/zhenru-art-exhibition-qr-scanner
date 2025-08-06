/**
 * Centralized error handling system for the QR Check-in Application
 * Provides comprehensive error management, retry logic, and user-friendly messaging
 */

import type { DatabaseError } from '@/types/database';

// Error categories for different types of failures
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  CAMERA = 'CAMERA',
  QR_SCANNING = 'QR_SCANNING',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',       // Minor issues, app continues to function
  MEDIUM = 'MEDIUM', // Significant issues, some functionality affected
  HIGH = 'HIGH',     // Critical issues, major functionality broken
  CRITICAL = 'CRITICAL' // App-breaking issues
}

// Standardized application error interface
export interface AppError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  details?: string;
  code?: string;
  timestamp: Date;
  retryable: boolean;
  context?: Record<string, unknown>;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_ERROR',
    'TEMPORARY_ERROR',
    'RATE_LIMIT_ERROR'
  ]
};

// Error mapping for common error codes
const ERROR_CODE_MAPPING: Record<string, { category: ErrorCategory; severity: ErrorSeverity; userMessage: string }> = {
  // Network errors
  'NETWORK_ERROR': {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    userMessage: 'Network connection issue. Please check your internet connection and try again.'
  },
  'TIMEOUT_ERROR': {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Request timed out. Please try again.'
  },
  'CONNECTION_ERROR': {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.HIGH,
    userMessage: 'Unable to connect to the server. Please check your connection.'
  },
  
  // Database errors
  'DATABASE_ERROR': {
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.HIGH,
    userMessage: 'Database error occurred. Please try again in a moment.'
  },
  'NOT_FOUND': {
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.LOW,
    userMessage: 'The requested record was not found.'
  },
  'DUPLICATE_ENTRY': {
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.LOW,
    userMessage: 'This record already exists.'
  },
  
  // Validation errors
  'VALIDATION_ERROR': {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Please check your input and try again.'
  },
  'INVALID_INPUT': {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Invalid input provided. Please correct and try again.'
  },
  
  // Camera errors
  'CAMERA_PERMISSION_DENIED': {
    category: ErrorCategory.PERMISSION,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Camera permission is required to scan QR codes. Please allow camera access.'
  },
  'CAMERA_NOT_FOUND': {
    category: ErrorCategory.CAMERA,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'No camera found on this device. Please use manual search instead.'
  },
  'CAMERA_ERROR': {
    category: ErrorCategory.CAMERA,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Camera error occurred. Please try again or use manual search.'
  },
  
  // QR scanning errors
  'QR_DECODE_ERROR': {
    category: ErrorCategory.QR_SCANNING,
    severity: ErrorSeverity.LOW,
    userMessage: 'Unable to read QR code. Please ensure the code is clear and try again.'
  },
  'INVALID_QR_FORMAT': {
    category: ErrorCategory.QR_SCANNING,
    severity: ErrorSeverity.LOW,
    userMessage: 'Invalid QR code format. Please scan a valid booking QR code.'
  }
};

/**
 * Central error handler class
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private retryConfig: RetryConfig;

  private constructor(config?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<RetryConfig>): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * Create a standardized application error
   */
  public createError(
    message: string,
    code?: string,
    details?: string,
    context?: Record<string, unknown>
  ): AppError {
    const errorMapping = code ? ERROR_CODE_MAPPING[code] : null;
    const errorId = this.generateErrorId();

    const appError: AppError = {
      id: errorId,
      category: errorMapping?.category || ErrorCategory.UNKNOWN,
      severity: errorMapping?.severity || ErrorSeverity.MEDIUM,
      message,
      userMessage: errorMapping?.userMessage || message,
      details,
      code,
      timestamp: new Date(),
      retryable: code ? this.retryConfig.retryableErrors.includes(code) : false,
      context
    };

    this.logError(appError);
    return appError;
  }

  /**
   * Convert database error to application error
   */
  public fromDatabaseError(dbError: DatabaseError, context?: Record<string, unknown>): AppError {
    return this.createError(
      dbError.message,
      dbError.code,
      dbError.details,
      context
    );
  }

  /**
   * Convert generic error to application error
   */
  public fromError(error: Error | unknown, context?: Record<string, unknown>): AppError {
    if (error instanceof Error) {
      return this.createError(
        error.message,
        error.name,
        error.stack,
        context
      );
    }

    return this.createError(
      'An unknown error occurred',
      'UNKNOWN_ERROR',
      String(error),
      context
    );
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>,
    onRetry?: (attempt: number, error: AppError) => void
  ): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...config };
    let lastError: AppError;

    for (let attempt = 0; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? this.fromError(error) : error as AppError;

        // Don't retry if error is not retryable or this is the last attempt
        if (!lastError.retryable || attempt === retryConfig.maxAttempts) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        onRetry?.(attempt + 1, lastError);

        await this.delay(jitteredDelay);
      }
    }

    throw lastError!;
  }

  /**
   * Get user-friendly error message with action suggestions
   */
  public getErrorMessage(error: AppError): {
    title: string;
    message: string;
    actions: string[];
    severity: ErrorSeverity;
  } {
    const actions: string[] = [];

    // Add retry action for retryable errors
    if (error.retryable) {
      actions.push('Try again');
    }

    // Add specific actions based on error category
    switch (error.category) {
      case ErrorCategory.NETWORK:
        actions.push('Check your internet connection');
        if (!actions.includes('Try again')) {
          actions.push('Try again in a moment');
        }
        break;

      case ErrorCategory.CAMERA:
      case ErrorCategory.PERMISSION:
        actions.push('Use manual search instead');
        if (error.code === 'CAMERA_PERMISSION_DENIED') {
          actions.push('Allow camera access in browser settings');
        }
        break;

      case ErrorCategory.QR_SCANNING:
        actions.push('Try scanning again');
        actions.push('Use manual search instead');
        break;

      case ErrorCategory.VALIDATION:
        actions.push('Check your input');
        break;

      case ErrorCategory.DATABASE:
        if (error.code === 'NOT_FOUND') {
          actions.push('Verify the booking ID');
          actions.push('Try manual search');
        } else {
          actions.push('Try again in a moment');
        }
        break;
    }

    return {
      title: this.getErrorTitle(error),
      message: error.userMessage,
      actions,
      severity: error.severity
    };
  }

  /**
   * Get error statistics for monitoring
   */
  public getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: AppError[];
  } {
    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });

    // Count errors
    this.errorLog.forEach(error => {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    });

    // Get recent errors (last 10)
    const recentErrors = this.errorLog
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalErrors: this.errorLog.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors
    };
  }

  /**
   * Clear error log (useful for testing or memory management)
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(error: AppError): void {
    this.errorLog.push(error);

    // Log to console based on severity
    const logMethod = this.getLogMethod(error.severity);
    logMethod(`[${error.category}] ${error.message}`, {
      id: error.id,
      code: error.code,
      details: error.details,
      context: error.context
    });

    // Keep only last 100 errors to prevent memory issues
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }
  }

  private getLogMethod(severity: ErrorSeverity): typeof console.log {
    switch (severity) {
      case ErrorSeverity.LOW:
        return console.info;
      case ErrorSeverity.MEDIUM:
        return console.warn;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private getErrorTitle(error: AppError): string {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Connection Problem';
      case ErrorCategory.DATABASE:
        return 'Data Error';
      case ErrorCategory.VALIDATION:
        return 'Input Error';
      case ErrorCategory.CAMERA:
        return 'Camera Issue';
      case ErrorCategory.QR_SCANNING:
        return 'QR Code Error';
      case ErrorCategory.PERMISSION:
        return 'Permission Required';
      default:
        return 'Error';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();