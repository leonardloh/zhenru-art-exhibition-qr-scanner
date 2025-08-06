/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  storeOfflineOperation,
  getOfflineOperations,
  removeOfflineOperation,
  incrementRetryCount,
  getRetryableOperations,
  clearOfflineOperations,
  getOfflineOperationCount,
  hasPendingOperations,
  type OfflineOperation
} from '../offline-storage';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Offline Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('storeOfflineOperation', () => {
    it('should store a new offline operation', () => {
      const operationId = storeOfflineOperation('checkin', {
        bookingId: 123,
        actualGuests: 2
      });

      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'qr-checkin-offline-operations',
        expect.stringContaining('"type":"checkin"')
      );
    });

    it('should generate unique operation IDs', () => {
      const id1 = storeOfflineOperation('checkin', { bookingId: 1 });
      const id2 = storeOfflineOperation('checkin', { bookingId: 2 });

      expect(id1).not.toBe(id2);
    });

    it('should set correct initial values', () => {
      const data = { bookingId: 123, actualGuests: 2 };
      storeOfflineOperation('checkin', data);

      const setItemCall = localStorageMock.setItem.mock.calls[0];
      const storedData = JSON.parse(setItemCall[1]);
      const operation = storedData[0];

      expect(operation.type).toBe('checkin');
      expect(operation.data).toEqual(data);
      expect(operation.retryCount).toBe(0);
      expect(operation.maxRetries).toBe(3);
      expect(operation.timestamp).toBeDefined();
    });
  });

  describe('getOfflineOperations', () => {
    it('should return empty array when no operations stored', () => {
      const operations = getOfflineOperations();
      expect(operations).toEqual([]);
    });

    it('should return stored operations', () => {
      const mockOperations: OfflineOperation[] = [
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      const operations = getOfflineOperations();
      expect(operations).toEqual(mockOperations);
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const operations = getOfflineOperations();
      expect(operations).toEqual([]);
    });
  });

  describe('removeOfflineOperation', () => {
    it('should remove specific operation', () => {
      const mockOperations: OfflineOperation[] = [
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3
        },
        {
          id: 'test-2',
          type: 'checkin',
          data: { bookingId: 456 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      removeOfflineOperation('test-1');

      const setItemCall = localStorageMock.setItem.mock.calls[0];
      const remainingOperations = JSON.parse(setItemCall[1]);
      
      expect(remainingOperations).toHaveLength(1);
      expect(remainingOperations[0].id).toBe('test-2');
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count for existing operation', () => {
      const mockOperations: OfflineOperation[] = [
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123 },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      const result = incrementRetryCount('test-1');

      expect(result).toBe(true);
      
      const setItemCall = localStorageMock.setItem.mock.calls[0];
      const updatedOperations = JSON.parse(setItemCall[1]);
      
      expect(updatedOperations[0].retryCount).toBe(1);
    });

    it('should remove operation when max retries exceeded', () => {
      const mockOperations: OfflineOperation[] = [
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123 },
          timestamp: Date.now(),
          retryCount: 2,
          maxRetries: 3
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      const result = incrementRetryCount('test-1');

      expect(result).toBe(false);
      // When max retries exceeded, the operation is removed, which calls saveOfflineOperations with empty array
      expect(localStorageMock.setItem).toHaveBeenCalledWith('qr-checkin-offline-operations', '[]');
    });

    it('should return false for non-existent operation', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const result = incrementRetryCount('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getRetryableOperations', () => {
    it('should return only operations below max retry count', () => {
      const mockOperations: OfflineOperation[] = [
        {
          id: 'test-1',
          type: 'checkin',
          data: { bookingId: 123 },
          timestamp: Date.now(),
          retryCount: 1,
          maxRetries: 3
        },
        {
          id: 'test-2',
          type: 'checkin',
          data: { bookingId: 456 },
          timestamp: Date.now(),
          retryCount: 3,
          maxRetries: 3
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      const retryable = getRetryableOperations();

      expect(retryable).toHaveLength(1);
      expect(retryable[0].id).toBe('test-1');
    });
  });

  describe('clearOfflineOperations', () => {
    it('should remove all operations from localStorage', () => {
      clearOfflineOperations();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('qr-checkin-offline-operations');
    });
  });

  describe('getOfflineOperationCount', () => {
    it('should return correct count of operations', () => {
      const mockOperations = [
        { id: 'test-1', type: 'checkin', data: {}, timestamp: Date.now(), retryCount: 0, maxRetries: 3 },
        { id: 'test-2', type: 'checkin', data: {}, timestamp: Date.now(), retryCount: 0, maxRetries: 3 }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      const count = getOfflineOperationCount();
      expect(count).toBe(2);
    });

    it('should return 0 when no operations', () => {
      const count = getOfflineOperationCount();
      expect(count).toBe(0);
    });
  });

  describe('hasPendingOperations', () => {
    it('should return true when operations exist', () => {
      const mockOperations = [
        { id: 'test-1', type: 'checkin', data: {}, timestamp: Date.now(), retryCount: 0, maxRetries: 3 }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockOperations));

      expect(hasPendingOperations()).toBe(true);
    });

    it('should return false when no operations exist', () => {
      expect(hasPendingOperations()).toBe(false);
    });
  });
});