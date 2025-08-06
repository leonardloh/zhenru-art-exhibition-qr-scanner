/**
 * Enhanced offline sync service for PWA functionality
 * Handles background sync, queue management, and conflict resolution
 */

import { 
  storeOfflineOperation, 
  getRetryableOperations, 
  removeOfflineOperation,
  incrementRetryCount,
  type OfflineOperation 
} from './offline-storage';

export interface SyncResult {
  success: boolean;
  operationId: string;
  error?: string;
  retryAfter?: number;
}

export interface SyncStats {
  totalOperations: number;
  successfulSyncs: number;
  failedSyncs: number;
  pendingOperations: number;
}

export class OfflineSyncService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncListeners: Array<(stats: SyncStats) => void> = [];
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      this.setupNetworkListeners();
      this.setupBackgroundSync();
    }
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private setupBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // Register background sync
        return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('offline-sync');
      }).catch(error => {
        console.warn('Background sync registration failed:', error);
      });
    }
  }

  /**
   * Queue an operation for offline sync
   */
  public queueOperation(type: OfflineOperation['type'], data: Record<string, unknown>): string {
    const operationId = storeOfflineOperation(type, data);
    
    // Try to sync immediately if online
    if (this.isOnline) {
      this.scheduleRetry(operationId, 1000); // 1 second delay
    }

    return operationId;
  }

  /**
   * Manually trigger sync process
   */
  public async triggerSync(): Promise<SyncStats> {
    if (this.isSyncing || !this.isOnline) {
      return this.getSyncStats();
    }

    this.isSyncing = true;
    const operations = getRetryableOperations();
    const results: SyncResult[] = [];

    for (const operation of operations) {
      try {
        const result = await this.syncOperation(operation);
        results.push(result);

        if (result.success) {
          removeOfflineOperation(operation.id);
          this.clearRetryTimeout(operation.id);
        } else {
          const shouldRetry = incrementRetryCount(operation.id);
          if (shouldRetry && result.retryAfter) {
            this.scheduleRetry(operation.id, result.retryAfter);
          }
        }
      } catch (error) {
        console.error('Sync operation failed:', error);
        results.push({
          success: false,
          operationId: operation.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        const shouldRetry = incrementRetryCount(operation.id);
        if (shouldRetry) {
          this.scheduleRetry(operation.id, this.getExponentialBackoffDelay(operation.retryCount));
        }
      }
    }

    this.isSyncing = false;
    const stats = this.getSyncStats();
    this.notifySyncListeners(stats);
    
    return stats;
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: OfflineOperation): Promise<SyncResult> {
    switch (operation.type) {
      case 'checkin':
        return await this.syncCheckInOperation(operation);
      case 'search':
        // Search operations don't need sync as they're read-only
        return { success: true, operationId: operation.id };
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Sync check-in operation
   */
  private async syncCheckInOperation(operation: OfflineOperation): Promise<SyncResult> {
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(operation.data),
      });

      if (response.ok) {
        return { success: true, operationId: operation.id };
      }

      // Handle different error scenarios
      if (response.status === 409) {
        // Conflict - record already checked in
        return { 
          success: false, 
          operationId: operation.id, 
          error: 'Record already checked in',
          retryAfter: 0 // Don't retry conflicts
        };
      }

      if (response.status >= 500) {
        // Server error - retry with backoff
        return { 
          success: false, 
          operationId: operation.id, 
          error: `Server error: ${response.statusText}`,
          retryAfter: this.getExponentialBackoffDelay(operation.retryCount)
        };
      }

      // Client error - don't retry
      return { 
        success: false, 
        operationId: operation.id, 
        error: `Client error: ${response.statusText}`,
        retryAfter: 0
      };

    } catch (error) {
      // Network error - retry with backoff
      return { 
        success: false, 
        operationId: operation.id, 
        error: error instanceof Error ? error.message : 'Network error',
        retryAfter: this.getExponentialBackoffDelay(operation.retryCount)
      };
    }
  }

  /**
   * Schedule a retry for a specific operation
   */
  private scheduleRetry(operationId: string, delayMs: number): void {
    this.clearRetryTimeout(operationId);
    
    const timeout = setTimeout(async () => {
      if (this.isOnline) {
        const operations = getRetryableOperations();
        const operation = operations.find(op => op.id === operationId);
        
        if (operation) {
          try {
            const result = await this.syncOperation(operation);
            if (result.success) {
              removeOfflineOperation(operation.id);
              this.clearRetryTimeout(operation.id);
            } else if (result.retryAfter && result.retryAfter > 0) {
              this.scheduleRetry(operation.id, result.retryAfter);
            }
          } catch (error) {
            console.error('Retry failed:', error);
            const shouldRetry = incrementRetryCount(operation.id);
            if (shouldRetry) {
              this.scheduleRetry(operation.id, this.getExponentialBackoffDelay(operation.retryCount + 1));
            }
          }
        }
      }
      
      this.retryTimeouts.delete(operationId);
    }, delayMs);

    this.retryTimeouts.set(operationId, timeout);
  }

  /**
   * Clear retry timeout for an operation
   */
  private clearRetryTimeout(operationId: string): void {
    const timeout = this.retryTimeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(operationId);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private getExponentialBackoffDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Get current sync statistics
   */
  public getSyncStats(): SyncStats {
    const operations = getRetryableOperations();
    return {
      totalOperations: operations.length,
      successfulSyncs: 0, // This would be tracked in a real implementation
      failedSyncs: 0, // This would be tracked in a real implementation
      pendingOperations: operations.length,
    };
  }

  /**
   * Add listener for sync events
   */
  public addSyncListener(listener: (stats: SyncStats) => void): () => void {
    this.syncListeners.push(listener);
    
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all sync listeners
   */
  private notifySyncListeners(stats: SyncStats): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(stats);
      } catch (error) {
        console.error('Sync listener error:', error);
      }
    });
  }

  /**
   * Check if currently syncing
   */
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Check if device is online
   */
  public isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Clear all pending operations (use with caution)
   */
  public clearAllOperations(): void {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    // Clear operations from storage
    const operations = getRetryableOperations();
    operations.forEach(op => removeOfflineOperation(op.id));
  }
}

// Export singleton instance
export const offlineSyncService = new OfflineSyncService();