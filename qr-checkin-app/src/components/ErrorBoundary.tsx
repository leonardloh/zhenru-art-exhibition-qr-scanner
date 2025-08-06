'use client';

import React, { Component, ReactNode } from 'react';
import { errorHandler, ErrorSeverity } from '@/lib/error-handler';
import type { AppError } from '@/lib/error-handler';

interface Props {
  children: ReactNode;
  fallback?: (error: AppError, retry: () => void) => ReactNode;
  onError?: (error: AppError) => void;
}

interface State {
  hasError: boolean;
  error: AppError | null;
}

/**
 * Error boundary component that catches JavaScript errors and displays user-friendly messages
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Convert the error to an AppError
    const appError = errorHandler.fromError(error, {
      component: 'ErrorBoundary',
      timestamp: new Date().toISOString()
    });

    return {
      hasError: true,
      error: appError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const appError = errorHandler.fromError(error, {
      component: 'ErrorBoundary',
      errorInfo,
      timestamp: new Date().toISOString()
    });

    // Call the onError callback if provided
    this.props.onError?.(appError);

    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-6xl mb-4">
                {this.state.error.severity === ErrorSeverity.CRITICAL ? '💥' : '⚠️'}
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h2>
              
              <p className="text-gray-600 mb-6">
                {this.state.error.userMessage}
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={this.handleRetry}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Reload Page
                </button>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto">
                    {JSON.stringify(this.state.error, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function useErrorHandler() {
  const handleError = (error: Error | AppError, context?: Record<string, unknown>) => {
    const appError = error instanceof Error ? errorHandler.fromError(error, context) : error;
    
    // In a real app, you might want to report this to an error tracking service
    console.error('Error handled:', appError);
    
    return appError;
  };

  return { handleError };
}