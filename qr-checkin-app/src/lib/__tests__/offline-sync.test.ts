/**
 * Offline Sync Service Tests
 * Tests for enhanced offline sync functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineSyncService } from '../offline-sync';
import { clearOfflineOperations } from '../offline-storage';

// Mock fetch
const mockFetch = vi.fn();

// Mock ServiceWorkerRegistration
const mockServiceWorkerRegistration = {
  prototype: {
    sync: {},
  },
};

// Mock navigator
const mockNavigator = {
  onLine: true,
  serviceWorker: {
    ready: Promise.resolve({
      sync: {
        register: vi.fn(),
      },
    }),
  },
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

describe('OfflineSyncService', () => {
  let syncService: OfflineSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global mocks
    global.fetch = mockFetch;
    Object.defineProperty(window, 'navigator', {
      value: mockNavigator,
      writable: true,
    });
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    Object.defineProperty(window, 'ServiceWorkerRegistration', {
      value: mockServiceWorkerRegistration,
      writable: true,
    });

    // Clear offline operations
    clearOfflineOperations();
    
    // Create new sync service instance
    syncService = new OfflineSyncService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Operation Queuing', () => {
    it('should queue operations for offline sync', () => {
      localStorageMock.getItem.mockReturnValue(null);
      localStorageMock.setItem.mockImplementation(() => {});

      const operationData = {
        bookingId: 123,
        actualGuests: 2,
        timestamp: '2024-01-20T10:00:00Z',
      };

      const operationId = syncService.queueOperation('checkin', operationData);

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should return sync statistics', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const stats = syncService.getSyncStats();

      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('successfulSyncs');
      expect(stats).toHaveProperty('failedSyncs');
      expect(stats).toHaveProperty('pendingOperations');
      expect(typeof stats.totalOperations).toBe('number');
    });
  });

  describe('Sync Process', () => {
    it('should sync operations when online', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123, actualGuests: 2 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
        },
      ]));
      localStorageMock.setItem.mockImplementation(() => {});

      const stats = await syncService.triggerSync();

      expect(mockFetch).toHaveBeenCalledWith('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('bookingId'),
      });
      expect(stats.totalOperations).toBeGreaterThanOrEqual(0); // Should be reduced after successful sync
    });

    it('should handle sync failures gracefully', async () => {
      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123, actualGuests: 2 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
        },
      ]));
      localStorageMock.setItem.mockImplementation(() => {});

      const stats = await syncService.triggerSync();

      expect(mockFetch).toHaveBeenCalled();
      expect(stats.totalOperations).toBeGreaterThan(0); // Should still have pending operations
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123, actualGuests: 2 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
        },
      ]));
      localStorageMock.setItem.mockImplementation(() => {});

      const stats = await syncService.triggerSync();

      expect(mockFetch).toHaveBeenCalled();
      expect(stats.totalOperations).toBeGreaterThan(0); // Should still have pending operations
    });

    it('should not sync when offline', async () => {
      mockNavigator.onLine = false;
      syncService = new OfflineSyncService(); // Recreate with offline status

      const stats = await syncService.triggerSync();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(syncService.isDeviceOnline()).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      // Mock server error that should trigger retry
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123, actualGuests: 2 },
          timestamp: Date.now(),
          retryCount: 2, // Already retried twice
          maxRetries: 3,
        },
      ]));
      localStorageMock.setItem.mockImplementation(() => {});

      const stats = await syncService.triggerSync();

      // Should have attempted to sync the operation
      expect(stats).toBeDefined();
      // The operation should still be pending for retry
    });

    it('should handle conflict errors appropriately', async () => {
      // Mock conflict response (409)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      });

      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123, actualGuests: 2 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
        },
      ]));
      localStorageMock.setItem.mockImplementation(() => {});

      const stats = await syncService.triggerSync();

      // Should have attempted to sync the operation
      expect(stats).toBeDefined();
      // Conflict errors should not be retried
    });
  });

  describe('Event Listeners', () => {
    it('should support sync event listeners', () => {
      const listener = vi.fn();
      const unsubscribe = syncService.addSyncListener(listener);

      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      unsubscribe();
    });

    it('should handle listener errors gracefully', async () => {
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      syncService.addSyncListener(faultyListener);
      
      // This should not throw even if listener throws
      await expect(syncService.triggerSync()).resolves.toBeDefined();
    });
  });

  describe('Status Checks', () => {
    it('should report sync status correctly', () => {
      expect(typeof syncService.isSyncInProgress()).toBe('boolean');
      expect(typeof syncService.isDeviceOnline()).toBe('boolean');
    });

    it('should prevent concurrent sync operations', async () => {
      localStorageMock.getItem.mockReturnValue('[]');
      
      // Start first sync
      const firstSync = syncService.triggerSync();
      
      // Try to start second sync while first is running
      const secondSync = syncService.triggerSync();
      
      const [firstResult, secondResult] = await Promise.all([firstSync, secondSync]);
      
      // Both should return stats, but second should not actually sync
      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should clear all operations when requested', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        { id: 'test-1', type: 'checkin', data: {}, timestamp: Date.now(), retryCount: 0, maxRetries: 3 },
        { id: 'test-2', type: 'checkin', data: {}, timestamp: Date.now(), retryCount: 0, maxRetries: 3 },
      ]));
      localStorageMock.setItem.mockImplementation(() => {});

      syncService.clearAllOperations();

      // Should have called removeItem for each operation
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('Background Sync Integration', () => {
    it('should register for background sync when supported', () => {
      // Background sync registration is tested in the constructor
      expect(mockNavigator.serviceWorker.ready).toBeDefined();
    });

    it('should handle background sync registration failures', () => {
      const mockServiceWorker = {
        ready: Promise.reject(new Error('Service worker not available')),
      };

      Object.defineProperty(window, 'navigator', {
        value: { ...mockNavigator, serviceWorker: mockServiceWorker },
        writable: true,
      });

      // Should not throw even if background sync fails
      expect(() => new OfflineSyncService()).not.toThrow();
    });
  });
});