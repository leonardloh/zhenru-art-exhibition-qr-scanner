'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { offlineSyncService, type SyncStats } from '@/lib/offline-sync';

interface NetworkStatusIndicatorProps {
  onSyncComplete?: () => void;
}

export default function NetworkStatusIndicator({ onSyncComplete }: NetworkStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStats, setSyncStats] = useState<SyncStats>({ 
    totalOperations: 0, 
    successfulSyncs: 0, 
    failedSyncs: 0, 
    pendingOperations: 0 
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const stats = await offlineSyncService.triggerSync();
      setSyncStats(stats);
      onSyncComplete?.();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, onSyncComplete]);

  useEffect(() => {
    // Check initial online status
    setIsOnline(offlineSyncService.isDeviceOnline());
    setSyncStats(offlineSyncService.getSyncStats());

    // Listen for sync events
    const unsubscribeSync = offlineSyncService.addSyncListener((stats) => {
      setSyncStats(stats);
    });

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically attempt sync when coming back online
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update sync stats periodically
    const interval = setInterval(() => {
      setSyncStats(offlineSyncService.getSyncStats());
      setIsSyncing(offlineSyncService.isSyncInProgress());
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      unsubscribeSync();
    };
  }, [handleSync]);

  if (isOnline && syncStats.pendingOperations === 0) {
    return null; // Don't show indicator when everything is normal
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50">
      <div className={`
        px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-center
        ${isOnline 
          ? 'bg-blue-100 text-blue-800 border border-blue-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
        }
      `}>
        <div className="flex items-center justify-center gap-2">
          {/* Status Icon */}
          <div className={`
            w-2 h-2 rounded-full
            ${isOnline ? 'bg-green-500' : 'bg-red-500'}
          `} />
          
          {/* Status Text */}
          <span>
            {!isOnline && 'Offline'}
            {isOnline && syncStats.pendingOperations > 0 && `${syncStats.pendingOperations} pending operations`}
            {isOnline && syncStats.pendingOperations === 0 && 'Online'}
          </span>

          {/* Sync Button */}
          {isOnline && syncStats.pendingOperations > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
            >
              {isSyncing ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Syncing...
                </div>
              ) : (
                'Sync Now'
              )}
            </button>
          )}
        </div>

        {/* Offline Instructions */}
        {!isOnline && (
          <div className="mt-1 text-xs opacity-75">
            Operations will be saved and synced when connection is restored
          </div>
        )}

        {/* Sync Statistics */}
        {isOnline && syncStats.pendingOperations > 0 && (
          <div className="mt-1 text-xs opacity-75">
            {syncStats.successfulSyncs > 0 && `${syncStats.successfulSyncs} synced`}
            {syncStats.failedSyncs > 0 && ` • ${syncStats.failedSyncs} failed`}
          </div>
        )}
      </div>
    </div>
  );
}