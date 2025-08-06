/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NetworkStatusIndicator from '../NetworkStatusIndicator';
import * as offlineStorage from '@/lib/offline-storage';

// Mock the offline storage module
vi.mock('@/lib/offline-storage', () => ({
  getOfflineOperationCount: vi.fn(),
  getRetryableOperations: vi.fn(),
  removeOfflineOperation: vi.fn(),
  incrementRetryCount: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('NetworkStatusIndicator', () => {
  const mockGetOfflineOperationCount = vi.mocked(offlineStorage.getOfflineOperationCount);
  const mockGetRetryableOperations = vi.mocked(offlineStorage.getRetryableOperations);
  const mockRemoveOfflineOperation = vi.mocked(offlineStorage.removeOfflineOperation);
  const mockIncrementRetryCount = vi.mocked(offlineStorage.incrementRetryCount);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Reset fetch mock
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 200 }));
    
    // Default mock returns
    mockGetOfflineOperationCount.mockReturnValue(0);
    mockGetRetryableOperations.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when online with no pending operations', () => {
    render(<NetworkStatusIndicator />);
    
    // Should not render anything
    expect(screen.queryByText(/online/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument();
  });

  it('should show offline status when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(<NetworkStatusIndicator />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Operations will be saved and synced when connection is restored')).toBeInTheDocument();
  });

  it('should show pending operations count when online with pending operations', () => {
    mockGetOfflineOperationCount.mockReturnValue(3);

    render(<NetworkStatusIndicator />);
    
    expect(screen.getByText('3 pending operations')).toBeInTheDocument();
    expect(screen.getByText('Sync Now')).toBeInTheDocument();
  });

  it('should handle sync button click', async () => {
    const mockOperations = [
      {
        id: 'test-1',
        type: 'checkin' as const,
        data: { bookingId: 123, actualGuests: 2 },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      }
    ];

    mockGetOfflineOperationCount.mockReturnValue(1);
    mockGetRetryableOperations.mockReturnValue(mockOperations);

    render(<NetworkStatusIndicator />);
    
    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    // Should show syncing state
    expect(screen.getByText('Syncing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockOperations[0].data),
      });
    });

    await waitFor(() => {
      expect(mockRemoveOfflineOperation).toHaveBeenCalledWith('test-1');
    });
  });

  it('should handle sync failure and increment retry count', async () => {
    const mockOperations = [
      {
        id: 'test-1',
        type: 'checkin' as const,
        data: { bookingId: 123, actualGuests: 2 },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      }
    ];

    mockGetOfflineOperationCount.mockReturnValue(1);
    mockGetRetryableOperations.mockReturnValue(mockOperations);
    
    // Mock fetch to fail
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    render(<NetworkStatusIndicator />);
    
    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mockIncrementRetryCount).toHaveBeenCalledWith('test-1');
    });

    // Should not remove the operation on failure
    expect(mockRemoveOfflineOperation).not.toHaveBeenCalled();
  });

  it('should not sync when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    mockGetOfflineOperationCount.mockReturnValue(1);

    render(<NetworkStatusIndicator />);
    
    // Should not show sync button when offline
    expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
  });

  it('should disable sync button when already syncing', async () => {
    const mockOperations = [
      {
        id: 'test-1',
        type: 'checkin' as const,
        data: { bookingId: 123, actualGuests: 2 },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      }
    ];

    mockGetOfflineOperationCount.mockReturnValue(1);
    mockGetRetryableOperations.mockReturnValue(mockOperations);

    // Make fetch hang to test syncing state
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

    render(<NetworkStatusIndicator />);
    
    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    // Button should be disabled and show syncing state
    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    const syncingButton = screen.getByRole('button');
    expect(syncingButton).toBeDisabled();
  });

  it('should call onSyncComplete callback after successful sync', async () => {
    const onSyncComplete = vi.fn();
    const mockOperations = [
      {
        id: 'test-1',
        type: 'checkin' as const,
        data: { bookingId: 123, actualGuests: 2 },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      }
    ];

    mockGetOfflineOperationCount.mockReturnValue(1);
    mockGetRetryableOperations.mockReturnValue(mockOperations);

    render(<NetworkStatusIndicator onSyncComplete={onSyncComplete} />);
    
    const syncButton = screen.getByText('Sync Now');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(onSyncComplete).toHaveBeenCalled();
    });
  });

  it('should handle online/offline events', () => {
    render(<NetworkStatusIndicator />);

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    fireEvent(window, new Event('offline'));

    expect(screen.getByText('Offline')).toBeInTheDocument();

    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    fireEvent(window, new Event('online'));

    // Should attempt to sync automatically when coming back online
    expect(mockGetRetryableOperations).toHaveBeenCalled();
  });
});