/**
 * Check-in processing service for the QR Check-in Application
 * Handles the complete check-in workflow with error handling and retry logic
 */

import { checkInAttendee, getCheckInStatus } from './database';
import { errorHandler, ErrorSeverity } from './error-handler';
import { withNetworkResilience } from './network-resilience';
import { storeOfflineOperation } from './offline-storage';

// Allow disabling network resilience for testing
const USE_NETWORK_RESILIENCE = process.env.NODE_ENV !== 'test';
import type { BookingRecord, CheckInRequest, CheckInResult, DatabaseError } from '@/types/database';
import type { AppError } from './error-handler';

export interface CheckInProcessingOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: AppError) => void;
  onProgress?: (status: string) => void;
}

export interface CheckInProcessingResult {
  success: boolean;
  booking?: BookingRecord;
  error?: AppError;
  isDuplicateCheckIn?: boolean;
  previousCheckIn?: {
    attendedAt: string;
    actualGuests: number;
  };
  retryCount?: number;
  isOffline?: boolean;
  offlineOperationId?: string;
}

/**
 * Process check-in with comprehensive error handling and retry logic
 */
export async function processCheckIn(
  bookingId: number,
  actualGuests: number,
  options: CheckInProcessingOptions = {}
): Promise<CheckInProcessingResult> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry,
    onProgress
  } = options;

  // Validate inputs
  if (!bookingId || bookingId <= 0) {
    return {
      success: false,
      error: errorHandler.createError(
        'Invalid booking ID',
        'VALIDATION_ERROR',
        'Booking ID must be a positive number',
        { bookingId, actualGuests }
      ),
      retryCount: 0
    };
  }

  if (actualGuests < 0 || !Number.isInteger(actualGuests)) {
    return {
      success: false,
      error: errorHandler.createError(
        'Invalid guest count',
        'VALIDATION_ERROR',
        'Guest count must be a non-negative integer',
        { bookingId, actualGuests }
      ),
      retryCount: 0
    };
  }

  onProgress?.('Preparing check-in...');

  const checkInRequest: CheckInRequest = {
    bookingId,
    actualGuests,
    timestamp: new Date().toISOString()
  };

  try {
    const operation = async () => {
      onProgress?.('Processing check-in...');
      return await checkInAttendee(checkInRequest);
    };

    const result = USE_NETWORK_RESILIENCE
      ? await withNetworkResilience(operation, {
          retryOnReconnect: true,
          maxRetries,
          context: { operation: 'processCheckIn', bookingId, actualGuests }
        })
      : await operation();

    if (result.success) {
      onProgress?.('Check-in completed successfully');
      return {
        success: result.success,
        booking: result.booking,
        isDuplicateCheckIn: result.isDuplicateCheckIn,
        previousCheckIn: result.previousCheckIn,
        retryCount: 0
      };
    } else {
      const appError = result.error ? 
        errorHandler.fromDatabaseError(result.error, { operation: 'processCheckIn' }) :
        errorHandler.createError('Check-in failed', 'UNKNOWN_ERROR');

      return {
        success: false,
        error: appError,
        retryCount: 0
      };
    }
  } catch (error) {
    onProgress?.('Check-in failed');
    
    const appError = error instanceof Error ? 
      errorHandler.fromError(error, { operation: 'processCheckIn', bookingId, actualGuests }) :
      error as AppError;

    // Check if this is a network error and we should store for offline retry
    const isNetworkError = appError.code === 'NETWORK_ERROR' || 
                          appError.code === 'CONNECTION_ERROR' ||
                          (error instanceof Error && (
                            error.message.includes('fetch') ||
                            error.message.includes('network') ||
                            error.message.includes('offline')
                          ));

    if (isNetworkError && typeof window !== 'undefined') {
      // Store operation for offline retry
      const offlineOperationId = storeOfflineOperation('checkin', {
        bookingId,
        actualGuests,
        timestamp: checkInRequest.timestamp
      });

      onProgress?.('Saved for offline sync');

      return {
        success: false,
        error: appError,
        retryCount: 0,
        isOffline: true,
        offlineOperationId
      };
    }

    return {
      success: false,
      error: appError,
      retryCount: 0
    };
  }
}

/**
 * Validate check-in before processing
 */
export async function validateCheckIn(bookingId: number): Promise<{
  isValid: boolean;
  booking?: BookingRecord;
  error?: AppError;
  warnings?: string[];
}> {
  try {
    const operation = async () => await getCheckInStatus(bookingId);
    
    const statusResult = USE_NETWORK_RESILIENCE
      ? await withNetworkResilience(operation, {
          retryOnReconnect: true,
          maxRetries: 2,
          context: { operation: 'validateCheckIn', bookingId }
        })
      : await operation();
    
    if (statusResult.error) {
      return {
        isValid: false,
        error: errorHandler.fromDatabaseError(statusResult.error, { operation: 'validateCheckIn' })
      };
    }

    const booking = statusResult.booking!;
    const warnings: string[] = [];

    // Check if already checked in
    if (statusResult.isCheckedIn) {
      warnings.push('This attendee has already been checked in');
    }

    // Check if event time is reasonable (not too far in the future or past)
    const eventStart = new Date(booking.start_at);
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - eventStart.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      if (eventStart > now) {
        warnings.push('Event is more than 24 hours in the future');
      } else {
        warnings.push('Event was more than 24 hours ago');
      }
    }

    return {
      isValid: true,
      booking,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    const appError = error instanceof Error ? 
      errorHandler.fromError(error, { operation: 'validateCheckIn', bookingId }) :
      error as AppError;

    return {
      isValid: false,
      error: appError
    };
  }
}

/**
 * Format check-in result for display
 */
export function formatCheckInResult(result: CheckInProcessingResult): {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error';
  details?: string[];
} {
  if (!result.success) {
    const errorMessage = result.error ? errorHandler.getErrorMessage(result.error) : {
      title: 'Check-in Failed',
      message: 'An unknown error occurred',
      actions: [],
      severity: ErrorSeverity.MEDIUM
    };

    return {
      title: errorMessage.title,
      message: errorMessage.message,
      type: 'error' as const,
      details: errorMessage.actions.length > 0 ? errorMessage.actions : undefined
    };
  }

  const booking = result.booking!;
  const details: string[] = [];

  if (result.isDuplicateCheckIn && result.previousCheckIn) {
    const prevDate = new Date(result.previousCheckIn.attendedAt).toLocaleString();
    details.push(`Previous check-in: ${prevDate}`);
    details.push(`Previous guest count: ${result.previousCheckIn.actualGuests}`);
  }

  if (result.retryCount && result.retryCount > 0) {
    details.push(`Completed after ${result.retryCount} retr${result.retryCount > 1 ? 'ies' : 'y'}`);
  }

  if (result.isOffline) {
    return {
      title: 'Saved for Offline Sync',
      message: `${booking.name}'s check-in has been saved and will be processed when connection is restored`,
      type: 'warning' as const,
      details: ['Check-in will be automatically synced when online']
    };
  }

  return {
    title: result.isDuplicateCheckIn ? 'Check-in Updated' : 'Check-in Successful',
    message: `${booking.name} has been ${result.isDuplicateCheckIn ? 'updated' : 'checked in'} with ${booking.actual_num_guests} guest${booking.actual_num_guests !== 1 ? 's' : ''}`,
    type: result.isDuplicateCheckIn ? 'warning' : 'success',
    details: details.length > 0 ? details : undefined
  };
}