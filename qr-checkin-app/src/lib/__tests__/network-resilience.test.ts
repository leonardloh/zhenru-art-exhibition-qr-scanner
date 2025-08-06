/**
 * Unit tests for the network resilience system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetworkResilience, NetworkStatus, ConnectionQuality, networkResilience } from '../network-resilience';
import { errorHandler } from '../error-handler';

// Mock fetch for network tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout
global.AbortSignal = {
  timeout: vi.fn().mockReturnValue({ aborted: false })
} as any;

describe('NetworkResilience', () => {
  let resilience: NetworkResilience;

  beforeEach(() => {
    resilience = NetworkResilience.getInstance();
    resilience.stopMonitoring();
    resilience.clearFailedOperations();
    resilience.configureIntervals(100, 100); // Short intervals for testing
    vi.clearAllMocks();
  });

  afterEach(() => {
    resilience.stopMonitoring();
    vi.clearAllTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NetworkResilience.getInstance();
      const instance2 = NetworkResilience.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('network status detection', () => {
    it('should detect online status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      resilience.startMonitoring();
      
      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = resilience.getStatus();
      expect(status.status).toBe(NetworkStatus.ONLINE);
    });

    it('should detect offline status', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      resilience.startMonitoring();
      
      // Wait for initial check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = resilience.getStatus();
      expect(status.status).toBe(NetworkStatus.OFFLINE);
    });

    it('should detect slow connection', async () => {
      // Mock slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true }), 1200) // > 1000ms threshold
        )
      );
      
      resilience.startMonitoring();
      
      // Wait for check to complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const status = resilience.getStatus();
      expect(status.status).toBe(NetworkStatus.SLOW);
    });
  });

  describe('connection quality assessment', () => {
    it('should assess excellent quality for fast connections', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true }), 50) // < 100ms
        )
      );
      
      resilience.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const status = resilience.getStatus();
      expect(status.quality).toBe(ConnectionQuality.EXCELLENT);
    });

    it('should assess poor quality for slow connections', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true }), 1200) // > 1000ms
        )
      );
      
      resilience.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const status = resilience.getStatus();
      expect(status.quality).toBe(ConnectionQuality.POOR);
    });
  });

  describe('network event listeners', () => {
    it('should notify listeners of status changes', async () => {
      const listener = vi.fn();
      const unsubscribe = resilience.addListener(listener);
      
      // Simulate status change
      mockFetch.mockResolvedValueOnce({ ok: true });
      resilience.startMonitoring();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(listener).toHaveBeenCalled();
      
      unsubscribe();
    });

    it('should allow unsubscribing listeners', () => {
      const listener = vi.fn();
      const unsubscribe = resilience.addListener(listener);
      
      unsubscribe();
      
      // Verify listener was removed (this is internal state, so we test indirectly)
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('executeWithResilience', () => {
    it('should execute operation successfully when online', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await resilience.executeWithResilience(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should throw error when offline', async () => {
      // Set offline status
      mockFetch.mockRejectedValue(new Error('Network error'));
      resilience.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const operation = vi.fn().mockResolvedValue('success');
      
      await expect(
        resilience.executeWithResilience(operation)
      ).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Operation failed: No network connection'
      });
      
      expect(operation).not.toHaveBeenCalled();
    });

    it('should add failed operations to retry queue', async () => {
      const networkError = errorHandler.createError('Network failed', 'NETWORK_ERROR');
      const operation = vi.fn().mockRejectedValue(networkError);
      
      try {
        await resilience.executeWithResilience(operation, {
          retryOnReconnect: true,
          operationId: 'test-op'
        });
      } catch {
        // Expected to fail
      }
      
      expect(resilience.getFailedOperationsCount()).toBe(1);
    });

    it('should not add non-network errors to retry queue', async () => {
      // Set online status first
      mockFetch.mockResolvedValueOnce({ ok: true });
      resilience.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const validationError = errorHandler.createError('Invalid input', 'VALIDATION_ERROR');
      const operation = vi.fn().mockRejectedValue(validationError);
      
      try {
        await resilience.executeWithResilience(operation, {
          retryOnReconnect: true
        });
      } catch {
        // Expected to fail
      }
      
      expect(resilience.getFailedOperationsCount()).toBe(0);
    });
  });

  describe('retry queue processing', () => {
    it('should retry failed operations when back online', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(errorHandler.createError('Network error', 'NETWORK_ERROR'))
        .mockResolvedValueOnce('success');
      
      // Start online first, then go offline
      mockFetch.mockResolvedValueOnce({ ok: true });
      resilience.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now go offline
      mockFetch.mockRejectedValue(new Error('Network error'));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Add failed operation
      try {
        await resilience.executeWithResilience(operation, {
          retryOnReconnect: true,
          operationId: 'test-op'
        });
      } catch {
        // Expected to fail initially
      }
      
      expect(resilience.getFailedOperationsCount()).toBe(1);
      
      // Go back online
      mockFetch.mockResolvedValue({ ok: true });
      
      // Wait for retry processing with shorter interval
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for retry interval
      
      expect(operation).toHaveBeenCalledTimes(2); // Initial + retry
      expect(resilience.getFailedOperationsCount()).toBe(0); // Should be cleared after success
    });

    it('should remove operations after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(
        errorHandler.createError('Network error', 'NETWORK_ERROR')
      );
      
      // Add failed operation with low max retries
      try {
        await resilience.executeWithResilience(operation, {
          retryOnReconnect: true,
          maxRetries: 1,
          operationId: 'test-op'
        });
      } catch {
        // Expected to fail
      }
      
      expect(resilience.getFailedOperationsCount()).toBe(1);
      
      // Simulate multiple retry attempts
      mockFetch.mockResolvedValue({ ok: true });
      resilience.startMonitoring();
      
      // Wait for retries to exhaust
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(resilience.getFailedOperationsCount()).toBe(0); // Should be removed after max retries
    });
  });

  describe('utility methods', () => {
    it('should report online status correctly', () => {
      // Mock online status
      mockFetch.mockResolvedValue({ ok: true });
      resilience.startMonitoring();
      
      expect(resilience.isOnline()).toBe(true);
    });

    it('should report slow connection correctly', async () => {
      // Mock slow connection
      mockFetch.mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true }), 1200)
        )
      );
      
      resilience.startMonitoring();
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(resilience.isSlow()).toBe(true);
    });

    it('should provide network statistics', () => {
      const stats = resilience.getNetworkStats();
      
      expect(stats).toHaveProperty('status');
      expect(stats).toHaveProperty('quality');
      expect(stats).toHaveProperty('failedOperations');
      expect(stats).toHaveProperty('isMonitoring');
    });

    it('should clear failed operations', () => {
      // Add a failed operation
      const operation = vi.fn().mockRejectedValue(
        errorHandler.createError('Network error', 'NETWORK_ERROR')
      );
      
      resilience.executeWithResilience(operation, {
        retryOnReconnect: true
      }).catch(() => {});
      
      resilience.clearFailedOperations();
      expect(resilience.getFailedOperationsCount()).toBe(0);
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start and stop monitoring', () => {
      expect(resilience.getNetworkStats().isMonitoring).toBe(false);
      
      resilience.startMonitoring();
      expect(resilience.getNetworkStats().isMonitoring).toBe(true);
      
      resilience.stopMonitoring();
      expect(resilience.getNetworkStats().isMonitoring).toBe(false);
    });

    it('should not start monitoring multiple times', () => {
      resilience.startMonitoring();
      resilience.startMonitoring(); // Should not cause issues
      
      expect(resilience.getNetworkStats().isMonitoring).toBe(true);
    });
  });

  describe('browser event integration', () => {
    beforeEach(() => {
      // Mock window object
      global.window = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as any;
    });

    it('should listen to browser online/offline events', () => {
      resilience.startMonitoring();
      
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should remove event listeners when stopping', () => {
      resilience.startMonitoring();
      resilience.stopMonitoring();
      
      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
});

describe('withNetworkResilience utility', () => {
  it('should be available as a utility function', async () => {
    const { withNetworkResilience } = await import('../network-resilience');
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await withNetworkResilience(operation);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledOnce();
  });
});

describe('networkResilience singleton', () => {
  it('should be accessible as a singleton export', () => {
    expect(networkResilience).toBeInstanceOf(NetworkResilience);
  });
});