/**
 * Offline storage utilities for PWA functionality
 * Handles storing failed operations and syncing when online
 */

export interface OfflineOperation {
  id: string;
  type: 'checkin' | 'search';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface CheckInOperation {
  bookingId: number;
  actualGuests: number;
  timestamp: string;
}

const OFFLINE_STORAGE_KEY = 'qr-checkin-offline-operations';
const MAX_RETRY_COUNT = 3;

/**
 * Store a failed operation for later retry
 */
export function storeOfflineOperation(
  type: OfflineOperation['type'],
  data: Record<string, unknown>
): string {
  const operation: OfflineOperation = {
    id: generateOperationId(),
    type,
    data,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: MAX_RETRY_COUNT,
  };

  const operations = getOfflineOperations();
  operations.push(operation);
  saveOfflineOperations(operations);

  return operation.id;
}

/**
 * Get all pending offline operations
 */
export function getOfflineOperations(): OfflineOperation[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading offline operations:', error);
    return [];
  }
}

/**
 * Save offline operations to localStorage
 */
function saveOfflineOperations(operations: OfflineOperation[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(operations));
  } catch (error) {
    console.error('Error saving offline operations:', error);
  }
}

/**
 * Remove a completed operation
 */
export function removeOfflineOperation(operationId: string): void {
  const operations = getOfflineOperations();
  const filtered = operations.filter(op => op.id !== operationId);
  saveOfflineOperations(filtered);
}

/**
 * Increment retry count for an operation
 */
export function incrementRetryCount(operationId: string): boolean {
  const operations = getOfflineOperations();
  const operation = operations.find(op => op.id === operationId);
  
  if (!operation) return false;
  
  operation.retryCount++;
  
  if (operation.retryCount >= operation.maxRetries) {
    // Remove operation if max retries exceeded
    removeOfflineOperation(operationId);
    return false;
  }
  
  saveOfflineOperations(operations);
  return true;
}

/**
 * Get operations ready for retry (not at max retry count)
 */
export function getRetryableOperations(): OfflineOperation[] {
  return getOfflineOperations().filter(op => op.retryCount < op.maxRetries);
}

/**
 * Clear all offline operations
 */
export function clearOfflineOperations(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OFFLINE_STORAGE_KEY);
}

/**
 * Generate a unique operation ID
 */
function generateOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the count of pending operations
 */
export function getOfflineOperationCount(): number {
  return getOfflineOperations().length;
}

/**
 * Check if there are any pending operations
 */
export function hasPendingOperations(): boolean {
  return getOfflineOperationCount() > 0;
}