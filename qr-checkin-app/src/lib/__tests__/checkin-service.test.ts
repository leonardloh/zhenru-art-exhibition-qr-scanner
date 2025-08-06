/**
 * Unit tests for check-in processing service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processCheckIn, validateCheckIn, formatCheckInResult } from '../checkin-service';
import * as database from '../database';
import type { BookingRecord, CheckInResult } from '@/types/database';

// Mock the database module
vi.mock('../database');

const mockBooking: BookingRecord = {
  id: 1,
  created_at: '2024-01-01T10:00:00Z',
  koalendar_id: 'TEST123456',
  event_type: 'Workshop',
  name: 'John Doe',
  email: 'john@example.com',
  contact_number: '+61400000000',
  is_lamrin_student: true,
  postcode: '2000',
  gender: 'Male',
  num_guests: 2,
  start_at: '2024-01-01T14:00:00Z',
  end_at: '2024-01-01T16:00:00Z',
  is_qr_sent: true,
  qr_sent_at: '2024-01-01T12:00:00Z',
  qr_batch_id: 'BATCH001',
  is_attended: false,
  attended_at: null,
  actual_num_guests: null
};

describe('processCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully process a first-time check-in', async () => {
    const mockResult: CheckInResult = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:30:00Z',
        actual_num_guests: 3
      },
      isDuplicateCheckIn: false
    };

    vi.mocked(database.checkInAttendee).mockResolvedValue(mockResult);

    const result = await processCheckIn(1, 3);

    expect(result.success).toBe(true);
    expect(result.booking?.actual_num_guests).toBe(3);
    expect(result.isDuplicateCheckIn).toBe(false);
    expect(result.retryCount).toBe(0);
    expect(database.checkInAttendee).toHaveBeenCalledWith({
      bookingId: 1,
      actualGuests: 3,
      timestamp: expect.any(String)
    });
  });

  it('should successfully process a duplicate check-in', async () => {
    const mockResult: CheckInResult = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:35:00Z',
        actual_num_guests: 2
      },
      isDuplicateCheckIn: true,
      previousCheckIn: {
        attendedAt: '2024-01-01T14:30:00Z',
        actualGuests: 3
      }
    };

    vi.mocked(database.checkInAttendee).mockResolvedValue(mockResult);

    const result = await processCheckIn(1, 2);

    expect(result.success).toBe(true);
    expect(result.isDuplicateCheckIn).toBe(true);
    expect(result.previousCheckIn).toEqual({
      attendedAt: '2024-01-01T14:30:00Z',
      actualGuests: 3
    });
  });

  it('should handle validation errors without retrying', async () => {
    const result = await processCheckIn(1, -1);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.retryCount).toBe(0);
    expect(database.checkInAttendee).not.toHaveBeenCalled();
  });

  it('should retry on network errors and eventually succeed', async () => {
    const networkError: CheckInResult = {
      success: false,
      error: {
        message: 'Network timeout',
        code: 'NETWORK_ERROR',
        details: 'Connection timed out'
      }
    };

    const successResult: CheckInResult = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:30:00Z',
        actual_num_guests: 2
      },
      isDuplicateCheckIn: false
    };

    vi.mocked(database.checkInAttendee)
      .mockResolvedValueOnce(networkError)
      .mockResolvedValueOnce(networkError)
      .mockResolvedValueOnce(successResult);

    const onRetry = vi.fn();
    const onProgress = vi.fn();

    const result = await processCheckIn(1, 2, {
      maxRetries: 3,
      retryDelay: 10, // Short delay for testing
      onRetry,
      onProgress
    });

    expect(result.success).toBe(true);
    expect(result.retryCount).toBe(2);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith('Processing check-in...');
    expect(onProgress).toHaveBeenCalledWith('Processing check-in (attempt 2)...');
    expect(onProgress).toHaveBeenCalledWith('Check-in completed successfully');
    expect(database.checkInAttendee).toHaveBeenCalledTimes(3);
  });

  it('should fail after maximum retries', async () => {
    const networkError: CheckInResult = {
      success: false,
      error: {
        message: 'Network timeout',
        code: 'NETWORK_ERROR',
        details: 'Connection timed out'
      }
    };

    vi.mocked(database.checkInAttendee).mockResolvedValue(networkError);

    const result = await processCheckIn(1, 2, {
      maxRetries: 2,
      retryDelay: 10
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
    expect(result.retryCount).toBe(2);
    expect(database.checkInAttendee).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should validate input parameters', async () => {
    // Invalid booking ID
    let result = await processCheckIn(0, 2);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toBe('Invalid booking ID');

    // Negative guest count
    result = await processCheckIn(1, -1);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toBe('Invalid guest count');

    // Non-integer guest count
    result = await processCheckIn(1, 2.5);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
    expect(result.error?.message).toBe('Invalid guest count');
  });

  it('should handle unexpected errors', async () => {
    vi.mocked(database.checkInAttendee).mockRejectedValue(new Error('Unexpected error'));

    const result = await processCheckIn(1, 2, { maxRetries: 0, retryDelay: 10 });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('UNEXPECTED_ERROR');
    expect(result.error?.message).toBe('Unexpected error during check-in');
  });
});

describe('validateCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate a normal check-in', async () => {
    const recentBooking = {
      ...mockBooking,
      start_at: new Date().toISOString() // Current time
    };

    vi.mocked(database.getCheckInStatus).mockResolvedValue({
      isCheckedIn: false,
      booking: recentBooking
    });

    const result = await validateCheckIn(1);

    expect(result.isValid).toBe(true);
    expect(result.booking).toEqual(recentBooking);
    expect(result.warnings).toBeUndefined();
  });

  it('should warn about duplicate check-ins', async () => {
    const checkedInBooking = {
      ...mockBooking,
      is_attended: true,
      attended_at: '2024-01-01T14:30:00Z'
    };

    vi.mocked(database.getCheckInStatus).mockResolvedValue({
      isCheckedIn: true,
      booking: checkedInBooking
    });

    const result = await validateCheckIn(1);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('This attendee has already been checked in');
  });

  it('should warn about events far in the future', async () => {
    const futureBooking = {
      ...mockBooking,
      start_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours from now
    };

    vi.mocked(database.getCheckInStatus).mockResolvedValue({
      isCheckedIn: false,
      booking: futureBooking
    });

    const result = await validateCheckIn(1);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Event is more than 24 hours in the future');
  });

  it('should warn about events far in the past', async () => {
    const pastBooking = {
      ...mockBooking,
      start_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 48 hours ago
    };

    vi.mocked(database.getCheckInStatus).mockResolvedValue({
      isCheckedIn: false,
      booking: pastBooking
    });

    const result = await validateCheckIn(1);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Event was more than 24 hours ago');
  });

  it('should handle database errors', async () => {
    vi.mocked(database.getCheckInStatus).mockResolvedValue({
      isCheckedIn: false,
      error: {
        message: 'Booking not found',
        code: 'NOT_FOUND',
        details: 'The booking record could not be found'
      }
    });

    const result = await validateCheckIn(1);

    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });
});

describe('formatCheckInResult', () => {
  it('should format successful first-time check-in', () => {
    const result = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:30:00Z',
        actual_num_guests: 2
      },
      isDuplicateCheckIn: false
    };

    const formatted = formatCheckInResult(result);

    expect(formatted.title).toBe('Check-in Successful');
    expect(formatted.message).toContain('John Doe has been checked in with 2 guests');
    expect(formatted.type).toBe('success');
  });

  it('should format successful duplicate check-in', () => {
    const result = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:35:00Z',
        actual_num_guests: 1
      },
      isDuplicateCheckIn: true,
      previousCheckIn: {
        attendedAt: '2024-01-01T14:30:00Z',
        actualGuests: 2
      }
    };

    const formatted = formatCheckInResult(result);

    expect(formatted.title).toBe('Check-in Updated');
    expect(formatted.message).toContain('John Doe has been updated with 1 guest');
    expect(formatted.type).toBe('warning');
    expect(formatted.details).toContain('Previous guest count: 2');
  });

  it('should format failed check-in', () => {
    const result = {
      success: false,
      error: {
        message: 'Network timeout',
        code: 'NETWORK_ERROR',
        details: 'Connection failed'
      }
    };

    const formatted = formatCheckInResult(result);

    expect(formatted.title).toBe('Check-in Failed');
    expect(formatted.message).toBe('Network timeout');
    expect(formatted.type).toBe('error');
    expect(formatted.details).toContain('Connection failed');
  });

  it('should include retry information', () => {
    const result = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:30:00Z',
        actual_num_guests: 2
      },
      isDuplicateCheckIn: false,
      retryCount: 2
    };

    const formatted = formatCheckInResult(result);

    expect(formatted.details).toContain('Completed after 2 retries');
  });

  it('should handle singular guest count', () => {
    const result = {
      success: true,
      booking: {
        ...mockBooking,
        is_attended: true,
        attended_at: '2024-01-01T14:30:00Z',
        actual_num_guests: 1
      },
      isDuplicateCheckIn: false
    };

    const formatted = formatCheckInResult(result);

    expect(formatted.message).toContain('1 guest');
    expect(formatted.message).not.toContain('1 guests');
  });
});