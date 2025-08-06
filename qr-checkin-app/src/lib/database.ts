/**
 * Database service functions for the QR Check-in Application
 * Handles all database operations with comprehensive error handling
 */

import { supabase, testConnection } from './supabase';
import { errorHandler } from './error-handler';
import { withNetworkResilience } from './network-resilience';

// Allow disabling network resilience for testing
const USE_NETWORK_RESILIENCE = process.env.NODE_ENV !== 'test';
import type { 
  BookingRecord, 
  CheckInRequest, 
  DatabaseError, 
  SearchResult, 
  CheckInResult 
} from '@/types/database';

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Utility function to create standardized database errors
 */
function createDatabaseError(message: string, code?: string, details?: string): DatabaseError {
  const appError = errorHandler.createError(message, code, details, { source: 'database' });
  return {
    message: appError.userMessage,
    code: appError.code,
    details: appError.details,
  };
}

/**
 * Utility function to implement exponential backoff retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry for certain error types (like not found, validation errors)
      if (isNonRetryableError(error)) {
        throw lastError;
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: wait 1s, 2s, 4s, etc.
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Check if an error should not be retried
 */
function isNonRetryableError(error: unknown): boolean {
  // Don't retry for these specific error codes
  const nonRetryableCodes = ['PGRST116', 'VALIDATION_ERROR', '23505']; // Not found, validation, unique constraint
  const errorCode = (error as { code?: string })?.code;
  return errorCode ? nonRetryableCodes.includes(errorCode) : false;
}

/**
 * Test database connectivity
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    return await withRetry(() => testConnection(), 1); // Only retry once for connection tests
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Search for booking by exact koalendar_id (for QR code scanning)
 */
export async function findBookingByQRCode(koalendarId: string): Promise<SearchResult> {
  try {
    const operation = async () => {
      const { data, error } = await supabase
        .from('registration')
        .select('*')
        .eq('koalender_id', koalendarId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    };

    const result = USE_NETWORK_RESILIENCE 
      ? await withNetworkResilience(operation, {
          retryOnReconnect: true,
          maxRetries: MAX_RETRIES,
          context: { operation: 'findBookingByQRCode', koalendarId }
        })
      : await operation();

    return {
      bookings: result ? [result as BookingRecord] : [],
    };
  } catch (error: unknown) {
    console.error('Error finding booking by QR code:', error);
    
    const errorObj = error as { code?: string; message?: string };
    
    if (errorObj.code === 'PGRST116') {
      // No rows found
      return {
        bookings: [],
        error: createDatabaseError(
          'No booking found with this QR code',
          'NOT_FOUND',
          'The scanned QR code does not match any registration in the database'
        ),
      };
    }
    
    return {
      bookings: [],
      error: createDatabaseError(
        'Failed to search for booking',
        errorObj.code || 'DATABASE_ERROR',
        errorObj.message
      ),
    };
  }
}

/**
 * Search for bookings by partial koalendar_id (for manual search)
 */
export async function searchBookingsByPartialId(partialId: string): Promise<SearchResult> {
  if (partialId.length < 5) {
    return {
      bookings: [],
      error: createDatabaseError(
        'Search term must be at least 5 characters long',
        'VALIDATION_ERROR',
        'Please enter at least 5 characters to search'
      ),
    };
  }

  try {
    const operation = async () => {
      console.log('Attempting to search for bookings with partial ID:', partialId);
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Using table: registration');
      
      // First, test basic table access
      console.log('Testing basic table access...');
      const testQuery = await supabase.from('registration').select('id').limit(1);
      console.log('Basic table access test:', testQuery);
      
      const { data, error } = await supabase
        .from('registration')
        .select('*')
        .ilike('koalender_id', `${partialId}%`)
        .order('created_at', { ascending: false })
        .limit(20); // Limit results to prevent overwhelming the UI
      
      console.log('Supabase query result:', { data, error });
      
      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }
      
      console.log('Search successful, found', data?.length || 0, 'records');
      return data;
    };

    // Temporarily disable network resilience for search operations
    // The network monitoring is being overly aggressive
    const result = await operation();

    return {
      bookings: (result || []) as BookingRecord[],
    };
  } catch (error: unknown) {
    console.error('Error searching bookings by partial ID:', error);
    
    const errorObj = error as { code?: string; message?: string };
    
    return {
      bookings: [],
      error: createDatabaseError(
        'Failed to search for bookings',
        errorObj.code || 'DATABASE_ERROR',
        errorObj.message
      ),
    };
  }
}

/**
 * Check if attendee is already checked in and get current status
 */
export async function getCheckInStatus(bookingId: number): Promise<{
  isCheckedIn: boolean;
  booking?: BookingRecord;
  error?: DatabaseError;
}> {
  try {
    const operation = async () => {
      const { data, error } = await supabase
        .from('registration')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    };

    const result = USE_NETWORK_RESILIENCE
      ? await withNetworkResilience(operation, {
          retryOnReconnect: true,
          maxRetries: MAX_RETRIES,
          context: { operation: 'getCheckInStatus', bookingId }
        })
      : await operation();

    const booking = result as BookingRecord;
    return {
      isCheckedIn: booking.is_attended,
      booking,
    };
  } catch (error: unknown) {
    console.error('Error getting check-in status:', error);
    
    const errorObj = error as { code?: string; message?: string };
    
    if (errorObj.code === 'PGRST116') {
      return {
        isCheckedIn: false,
        error: createDatabaseError(
          'Booking not found',
          'NOT_FOUND',
          'The booking record could not be found in the database'
        ),
      };
    }
    
    return {
      isCheckedIn: false,
      error: createDatabaseError(
        'Failed to check booking status',
        errorObj.code || 'DATABASE_ERROR',
        errorObj.message
      ),
    };
  }
}

/**
 * Update booking record with check-in information
 * Includes duplicate check-in detection and comprehensive error handling
 */
export async function checkInAttendee(request: CheckInRequest): Promise<CheckInResult> {
  // Validate input
  if (request.actualGuests < 0) {
    return {
      success: false,
      error: createDatabaseError(
        'Guest count must be a positive number',
        'VALIDATION_ERROR',
        'Please enter a valid number of guests'
      ),
    };
  }

  if (!Number.isInteger(request.actualGuests)) {
    return {
      success: false,
      error: createDatabaseError(
        'Guest count must be a whole number',
        'VALIDATION_ERROR',
        'Please enter a valid whole number of guests'
      ),
    };
  }

  if (request.actualGuests > 999) {
    return {
      success: false,
      error: createDatabaseError(
        'Guest count is too high',
        'VALIDATION_ERROR',
        'Guest count cannot exceed 999'
      ),
    };
  }

  try {
    // First, get current booking status to detect duplicates
    const statusResult = await getCheckInStatus(request.bookingId);
    
    if (statusResult.error) {
      return {
        success: false,
        error: statusResult.error,
      };
    }

    const currentBooking = statusResult.booking!;
    const isDuplicateCheckIn = statusResult.isCheckedIn;

    // Perform the check-in update
    const operation = async () => {
      const { data, error } = await supabase
        .from('registration')
        .update({
          is_attended: true,
          attended_at: request.timestamp,
          actual_num_guests: request.actualGuests,
        })
        .eq('id', request.bookingId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    };

    const result = USE_NETWORK_RESILIENCE
      ? await withNetworkResilience(operation, {
          retryOnReconnect: true,
          maxRetries: MAX_RETRIES,
          context: { operation: 'checkInAttendee', bookingId: request.bookingId }
        })
      : await operation();

    const updatedBooking = result as BookingRecord;

    return {
      success: true,
      booking: updatedBooking,
      isDuplicateCheckIn,
      previousCheckIn: isDuplicateCheckIn ? {
        attendedAt: currentBooking.attended_at!,
        actualGuests: currentBooking.actual_num_guests || 0,
      } : undefined,
    };
  } catch (error: unknown) {
    console.error('Error checking in attendee:', error);
    
    const errorObj = error as { code?: string; message?: string };
    
    if (errorObj.code === 'PGRST116') {
      return {
        success: false,
        error: createDatabaseError(
          'Booking not found',
          'NOT_FOUND',
          'The booking record could not be found in the database'
        ),
      };
    }
    
    return {
      success: false,
      error: createDatabaseError(
        'Failed to check in attendee',
        errorObj.code || 'DATABASE_ERROR',
        errorObj.message || 'An unexpected error occurred while processing the check-in'
      ),
    };
  }
}

/**
 * Get booking details by ID (for verification)
 */
export async function getBookingById(bookingId: number): Promise<SearchResult> {
  try {
    const operation = async () => {
      const { data, error } = await supabase
        .from('registration')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      if (error) {
        throw error;
      }
      
      return data;
    };

    const result = USE_NETWORK_RESILIENCE
      ? await withNetworkResilience(operation, {
          retryOnReconnect: true,
          maxRetries: MAX_RETRIES,
          context: { operation: 'getBookingById', bookingId }
        })
      : await operation();

    return {
      bookings: result ? [result as BookingRecord] : [],
    };
  } catch (error: unknown) {
    console.error('Error getting booking by ID:', error);
    
    const errorObj = error as { code?: string; message?: string };
    
    if (errorObj.code === 'PGRST116') {
      return {
        bookings: [],
        error: createDatabaseError(
          'Booking not found',
          'NOT_FOUND',
          'The booking record could not be found'
        ),
      };
    }
    
    return {
      bookings: [],
      error: createDatabaseError(
        'Failed to retrieve booking',
        errorObj.code || 'DATABASE_ERROR',
        errorObj.message
      ),
    };
  }
}