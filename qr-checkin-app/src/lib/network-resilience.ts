/**
 * Network resilience system for the QR Check-in Application
 * Handles offline detection, connection monitoring, and automatic retry when connection is restored
 */

import { errorHandler, ErrorCategory, ErrorSeverity } from './error-handler';
import type { AppError } from './error-handler';

// Network status types
export enum NetworkStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  SLOW = 'SLOW',
  UNKNOWN = 'UNKNOWN'
}

// Connection quality levels
export enum ConnectionQuality {
  EXCELLENT = 'EXCELLENT', // < 100ms latency
  GOOD = 'GOOD',          // 100-300ms latency
  FAIR = 'FAIR',          // 300-1000ms latency
  POOR = 'POOR',          // > 1000ms latency
  UNKNOWN = 'UNKNOWN'
}

// Network event types
export type NetworkEventType = 'online' | 'offline' | 'slow' | 'restored';

// Network event listener
export type NetworkEventListener = (status: NetworkStatus, quality?: ConnectionQuality) => void;

// Failed operation for retry queue
interface FailedOperation {
  id: string;
  operation: () => Promise<unknown>;
  retryCount: number;
  maxRetries: number;
  lastAttempt: Date;
  error: AppError;
  context?: Record<string, unknown>;
}

/**
 * Network resilience manager
 */
export class NetworkResilience {
  private static instance: NetworkResilience;
  private status: NetworkStatus = NetworkStatus.UNKNOWN;
  private quality: ConnectionQuality = ConnectionQuality.UNKNOWN;
  private listeners: NetworkEventListener[] = [];
  private failedOperations: Map<string, FailedOperation> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private retryIntervalTimer?: NodeJS.Timeout;

  // Configuration
  private readonly MONITOR_INTERVAL = 30000; // 30 seconds
  private readonly RETRY_INTERVAL = 10000;   // 10 seconds
  private readonly PING_TIMEOUT = 5000;      // 5 seconds
  private readonly SLOW_THRESHOLD = 1000;    // 1 second
  private readonly MAX_FAILED_OPERATIONS = 50;

  // Allow configuration for testing
  private monitorInterval = this.MONITOR_INTERVAL;
  private retryInterval = this.RETRY_INTERVAL;

  private constructor() {
    this.initializeNetworkMonitoring();
  }

  /**
   * Configure intervals for testing
   */
  public configureIntervals(monitorInterval: number, retryInterval: number): void {
    this.monitorInterval = monitorInterval;
    this.retryInterval = retryInterval;
  }

  public static getInstance(): NetworkResilience {
    if (!NetworkResilience.instance) {
      NetworkResilience.instance = new NetworkResilience();
    }
    return NetworkResilience.instance;
  }

  /**
   * Get current network status
   */
  public getStatus(): { status: NetworkStatus; quality: ConnectionQuality } {
    return {
      status: this.status,
      quality: this.quality
    };
  }

  /**
   * Check if currently online
   */
  public isOnline(): boolean {
    return this.status === NetworkStatus.ONLINE;
  }

  /**
   * Check if connection is slow
   */
  public isSlow(): boolean {
    return this.status === NetworkStatus.SLOW || this.quality === ConnectionQuality.POOR;
  }

  /**
   * Add network status listener
   */
  public addListener(listener: NetworkEventListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Execute operation with network resilience
   */
  public async executeWithResilience<T>(
    operation: () => Promise<T>,
    options: {
      retryOnReconnect?: boolean;
      maxRetries?: number;
      context?: Record<string, unknown>;
      operationId?: string;
    } = {}
  ): Promise<T> {
    const {
      retryOnReconnect = true,
      maxRetries = 3,
      context,
      operationId = this.generateOperationId()
    } = options;

    try {
      // Check network status before attempting operation
      if (this.status === NetworkStatus.OFFLINE) {
        const offlineError = errorHandler.createError(
          'Operation failed: No network connection',
          'NETWORK_ERROR',
          'Device is currently offline',
          context
        );
        
        // Add to retry queue if retryOnReconnect is enabled
        if (retryOnReconnect) {
          this.addToRetryQueue({
            id: operationId,
            operation,
            retryCount: 0,
            maxRetries,
            lastAttempt: new Date(),
            error: offlineError,
            context
          });
        }
        
        throw offlineError;
      }

      // Execute the operation
      const result = await operation();
      
      // Remove from failed operations if it was previously failed
      this.failedOperations.delete(operationId);
      
      return result;
    } catch (error) {
      const appError = error instanceof Error ? errorHandler.fromError(error, context) : error as AppError;
      
      // Only add to retry queue if it's a network error and not already handled above
      if (retryOnReconnect && this.isNetworkError(appError) && this.status !== NetworkStatus.OFFLINE) {
        this.addToRetryQueue({
          id: operationId,
          operation,
          retryCount: 0,
          maxRetries,
          lastAttempt: new Date(),
          error: appError,
          context
        });
      }
      
      throw appError;
    }
  }

  /**
   * Start network monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Initial status check
    this.checkNetworkStatus();
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, this.monitorInterval);

    // Set up retry processing
    this.retryIntervalTimer = setInterval(() => {
      this.processRetryQueue();
    }, this.retryInterval);

    // Listen to browser network events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Stop network monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.retryIntervalTimer) {
      clearInterval(this.retryIntervalTimer);
      this.retryIntervalTimer = undefined;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  /**
   * Get failed operations count
   */
  public getFailedOperationsCount(): number {
    return this.failedOperations.size;
  }

  /**
   * Clear failed operations queue
   */
  public clearFailedOperations(): void {
    this.failedOperations.clear();
  }

  /**
   * Get network statistics
   */
  public getNetworkStats(): {
    status: NetworkStatus;
    quality: ConnectionQuality;
    failedOperations: number;
    isMonitoring: boolean;
  } {
    return {
      status: this.status,
      quality: this.quality,
      failedOperations: this.failedOperations.size,
      isMonitoring: this.isMonitoring
    };
  }

  private initializeNetworkMonitoring(): void {
    // Check initial network status
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      this.status = navigator.onLine ? NetworkStatus.ONLINE : NetworkStatus.OFFLINE;
    }

    // Start monitoring automatically
    this.startMonitoring();
  }

  private async checkNetworkStatus(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Ping a reliable endpoint to check connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(this.PING_TIMEOUT)
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.ok) {
        const previousStatus = this.status;
        this.status = latency > this.SLOW_THRESHOLD ? NetworkStatus.SLOW : NetworkStatus.ONLINE;
        this.quality = this.calculateConnectionQuality(latency);

        // Notify listeners if status changed
        if (previousStatus !== this.status) {
          this.notifyListeners();
          
          // If we just came back online, process retry queue
          if (previousStatus === NetworkStatus.OFFLINE) {
            this.processRetryQueue();
          }
        }
      } else {
        this.setOfflineStatus();
      }
    } catch (error) {
      this.setOfflineStatus();
    }
  }

  private calculateConnectionQuality(latency: number): ConnectionQuality {
    if (latency < 100) return ConnectionQuality.EXCELLENT;
    if (latency < 300) return ConnectionQuality.GOOD;
    if (latency < 1000) return ConnectionQuality.FAIR;
    return ConnectionQuality.POOR;
  }

  private setOfflineStatus(): void {
    const previousStatus = this.status;
    this.status = NetworkStatus.OFFLINE;
    this.quality = ConnectionQuality.UNKNOWN;

    if (previousStatus !== NetworkStatus.OFFLINE) {
      this.notifyListeners();
    }
  }

  private handleOnline = (): void => {
    this.checkNetworkStatus();
  };

  private handleOffline = (): void => {
    this.setOfflineStatus();
  };

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.status, this.quality);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  private isNetworkError(error: AppError): boolean {
    return error.category === ErrorCategory.NETWORK || 
           (!!error.code && ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'CONNECTION_ERROR'].includes(error.code));
  }

  private addToRetryQueue(operation: FailedOperation): void {
    // Prevent queue from growing too large
    if (this.failedOperations.size >= this.MAX_FAILED_OPERATIONS) {
      // Remove oldest operation
      const oldestId = Array.from(this.failedOperations.keys())[0];
      this.failedOperations.delete(oldestId);
    }

    this.failedOperations.set(operation.id, operation);
  }

  private async processRetryQueue(): Promise<void> {
    if (this.status === NetworkStatus.OFFLINE || this.failedOperations.size === 0) {
      return;
    }

    const operationsToRetry = Array.from(this.failedOperations.values())
      .filter(op => op.retryCount < op.maxRetries)
      .sort((a, b) => a.lastAttempt.getTime() - b.lastAttempt.getTime());

    for (const operation of operationsToRetry) {
      try {
        await operation.operation();
        
        // Success - remove from queue
        this.failedOperations.delete(operation.id);
        
        console.log(`Successfully retried operation ${operation.id} after ${operation.retryCount + 1} attempts`);
      } catch (error) {
        // Update retry count and last attempt time
        operation.retryCount++;
        operation.lastAttempt = new Date();
        operation.error = error instanceof Error ? errorHandler.fromError(error) : error as AppError;

        // Remove if max retries exceeded
        if (operation.retryCount >= operation.maxRetries) {
          this.failedOperations.delete(operation.id);
          console.warn(`Operation ${operation.id} failed after ${operation.maxRetries} retry attempts`);
        }
      }
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const networkResilience = NetworkResilience.getInstance();

// Utility function to wrap operations with network resilience
export async function withNetworkResilience<T>(
  operation: () => Promise<T>,
  options?: {
    retryOnReconnect?: boolean;
    maxRetries?: number;
    context?: Record<string, unknown>;
  }
): Promise<T> {
  return networkResilience.executeWithResilience(operation, options);
}