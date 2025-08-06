'use client';

import React from 'react';
import { errorHandler, ErrorSeverity } from '@/lib/error-handler';
import type { AppError } from '@/lib/error-handler';

interface ErrorDisplayProps {
  error: string | AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Generic error display component for showing user-friendly error messages
 */
export default function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className = '',
  compact = false
}: ErrorDisplayProps) {
  // Handle string errors
  const appError = typeof error === 'string' 
    ? { message: error, severity: ErrorSeverity.MEDIUM, retryable: true } as AppError
    : error;
  
  const errorMessage = errorHandler.getErrorMessage(appError);

  const getSeverityStyles = () => {
    switch (errorMessage.severity) {
      case ErrorSeverity.LOW:
        return {
          container: 'bg-blue-50 border-blue-200',
          icon: '💡',
          title: 'text-blue-800',
          message: 'text-blue-700',
          button: 'bg-blue-600 hover:bg-blue-700'
        };
      case ErrorSeverity.MEDIUM:
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: '⚠️',
          title: 'text-yellow-800',
          message: 'text-yellow-700',
          button: 'bg-yellow-600 hover:bg-yellow-700'
        };
      case ErrorSeverity.HIGH:
        return {
          container: 'bg-red-50 border-red-200',
          icon: '❌',
          title: 'text-red-800',
          message: 'text-red-700',
          button: 'bg-red-600 hover:bg-red-700'
        };
      case ErrorSeverity.CRITICAL:
        return {
          container: 'bg-red-100 border-red-300',
          icon: '💥',
          title: 'text-red-900',
          message: 'text-red-800',
          button: 'bg-red-700 hover:bg-red-800'
        };
      default:
        return {
          container: 'bg-gray-50 border-gray-200',
          icon: '⚪',
          title: 'text-gray-800',
          message: 'text-gray-700',
          button: 'bg-gray-600 hover:bg-gray-700'
        };
    }
  };

  const styles = getSeverityStyles();

  if (compact) {
    return (
      <div className={`flex items-center space-x-3 p-4 border rounded-xl ${styles.container} ${className}`}>
        <span className="text-xl flex-shrink-0">{styles.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${styles.title} leading-relaxed`}>
            {errorMessage.title}
          </p>
          <p className={`text-sm ${styles.message} leading-relaxed`}>
            {errorMessage.message}
          </p>
        </div>
        <div className="flex space-x-2">
          {onRetry && appError.retryable && (
            <button
              onClick={onRetry}
              className={`px-3 py-2 text-sm font-medium text-white rounded-lg ${styles.button} transition-colors touch-target-comfortable`}
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors touch-target-comfortable p-2"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl p-6 ${styles.container} ${className}`}>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <span className="text-4xl">{styles.icon}</span>
        </div>
        
        <div className="flex-1">
          <h3 className={`text-xl font-bold mb-3 ${styles.title}`}>
            {errorMessage.title}
          </h3>
          
          <p className={`mb-6 text-base leading-relaxed ${styles.message}`}>
            {errorMessage.message}
          </p>

          {errorMessage.actions.length > 0 && (
            <div className="mb-6">
              <h4 className={`text-base font-semibold mb-3 ${styles.title}`}>
                What you can do:
              </h4>
              <ul className={`text-base space-y-2 ${styles.message} leading-relaxed`}>
                {errorMessage.actions.map((action, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-3 mt-1">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
            {onRetry && appError.retryable && (
              <button
                onClick={onRetry}
                className={`px-6 py-3 text-base font-semibold text-white rounded-xl ${styles.button} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 touch-target-comfortable`}
              >
                Try Again
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-6 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 touch-target-comfortable"
              >
                Dismiss
              </button>
            )}
          </div>

          {appError.details && (
            <details className="mt-6">
              <summary className={`cursor-pointer text-base ${styles.title} hover:underline font-medium`}>
                Technical Details
              </summary>
              <div className="mt-3 text-sm bg-white bg-opacity-50 p-4 rounded-lg border">
                <pre className="whitespace-pre-wrap text-xs font-mono">
                  {appError.details}
                </pre>
              </div>
            </details>
          )}

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-6">
              <summary className={`cursor-pointer text-sm ${styles.title} hover:underline font-medium`}>
                Debug Information (Development)
              </summary>
              <pre className="mt-3 text-xs bg-white bg-opacity-50 p-4 rounded-lg border overflow-auto">
                {JSON.stringify(appError, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Toast-style error notification component
 */
interface ErrorToastProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => void;
  autoHide?: boolean;
  hideDelay?: number;
}

export function ErrorToast({
  error,
  onDismiss,
  onRetry,
  autoHide = true,
  hideDelay = 5000
}: ErrorToastProps) {
  React.useEffect(() => {
    if (autoHide && error.severity === ErrorSeverity.LOW) {
      const timer = setTimeout(onDismiss, hideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, hideDelay, onDismiss, error.severity]);

  const errorMessage = errorHandler.getErrorMessage(error);

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <ErrorDisplay
        error={error}
        onRetry={onRetry}
        onDismiss={onDismiss}
        compact={true}
        className="shadow-lg"
      />
    </div>
  );
}

/**
 * Hook for managing error state
 */
export function useErrorState() {
  const [error, setError] = React.useState<AppError | null>(null);

  const showError = React.useCallback((error: Error | AppError, context?: Record<string, unknown>) => {
    const appError = error instanceof Error ? errorHandler.fromError(error, context) : error;
    setError(appError);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const retryWithClear = React.useCallback((retryFn: () => void | Promise<void>) => {
    return async () => {
      clearError();
      try {
        await retryFn();
      } catch (error) {
        showError(error as Error);
      }
    };
  }, [clearError, showError]);

  return {
    error,
    showError,
    clearError,
    retryWithClear,
    hasError: error !== null
  };
}