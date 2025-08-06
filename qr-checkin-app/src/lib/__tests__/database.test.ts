/**
 * Unit tests for database service functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BookingRecord } from '@/types/database';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
      ilike: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
};

// Mock the supabase module
vi.mock('../supabase', () => ({
  supabase: mockSupabase,
  testConnection: vi.fn(),
}));

const mockBookingRecord: BookingRecord = {
  id: 1,
  created_at: '2024-01-01T00:00:00Z',
  koalendar_id: 'TEST123456',
  event_type: 'Workshop',
  name: 'John Doe',
  email: 'john@example.com',
  contact_number: '+1234567890',
  is_lamrin_student: true,
  postcode: '12345',
  gender: 'Male',
  num_guests: 2,
  start_at: '2024-01-01T10:00:00Z',
  end_at: '2024-01-01T12:00:00Z',
  is_qr_sent: true,
  qr_sent_at: '2024-01-01T09:00:00Z',
  qr_batch_id: 'BATCH001',
  is_attended: false,
  attended_at: null,
  actual_num_guests: null,
};

describe('Database Service Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkDatabaseConnection', () => {
    it('should return true when connection is successful', async () => {
      const { testConnection } = await import('../supabase');
      const { checkDatabaseConnection } = await import('../database');
      
      vi.mocked(testConnection).mockResolvedValue(true);

      const result = await checkDatabaseConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      const { testConnection } = await import('../supabase');
      const { checkDatabaseConnection } = await import('../database');
      
      vi.mocked(testConnection).mockRejectedValue(new Error('Connection failed'));

      const result = await checkDatabaseConnection();
      expect(result).toBe(false);
    });
  });

  describe('findBookingByQRCode', () => {
    it('should return booking when QR code is found', async () => {
      const { findBookingByQRCode } = await import('../database');
      
      const mockChain = {
        single: vi.fn().mockResolvedValue({ data: mockBookingRecord, error: null }),
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain),
        }),
      });

      const result = await findBookingByQRCode('TEST123456');
      
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toEqual(mockBookingRecord);
      expect(result.error).toBeUndefined();
    });

    it('should return error when booking is not found', async () => {
      const { findBookingByQRCode } = await import('../database');
      
      const mockChain = {
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116', message: 'No rows found' } 
        }),
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain),
        }),
      });

      const result = await findBookingByQRCode('NOTFOUND');
      
      expect(result.bookings).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('searchBookingsByPartialId', () => {
    it('should return validation error for short search terms', async () => {
      const { searchBookingsByPartialId } = await import('../database');
      
      const result = await searchBookingsByPartialId('ABC');
      
      expect(result.bookings).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return matching bookings for valid search', async () => {
      const { searchBookingsByPartialId } = await import('../database');
      
      const mockChain = {
        limit: vi.fn().mockResolvedValue({ data: [mockBookingRecord], error: null }),
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockChain),
          }),
        }),
      });

      const result = await searchBookingsByPartialId('TEST1');
      
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toEqual(mockBookingRecord);
      expect(result.error).toBeUndefined();
    });
  });

  describe('checkInAttendee', () => {
    it('should successfully check in attendee', async () => {
      const { checkInAttendee } = await import('../database');
      
      const updatedBooking = { ...mockBookingRecord, is_attended: true, actual_num_guests: 3 };
      const mockChain = {
        single: vi.fn().mockResolvedValue({ data: updatedBooking, error: null }),
      };
      
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue(mockChain),
          }),
        }),
      });

      const result = await checkInAttendee({
        bookingId: 1,
        actualGuests: 3,
        timestamp: '2024-01-01T11:00:00Z',
      });
      
      expect(result.success).toBe(true);
      expect(result.booking).toEqual(updatedBooking);
      expect(result.error).toBeUndefined();
    });

    it('should return validation error for negative guest count', async () => {
      const { checkInAttendee } = await import('../database');
      
      const result = await checkInAttendee({
        bookingId: 1,
        actualGuests: -1,
        timestamp: '2024-01-01T11:00:00Z',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('getBookingById', () => {
    it('should return booking when ID is found', async () => {
      const { getBookingById } = await import('../database');
      
      const mockChain = {
        single: vi.fn().mockResolvedValue({ data: mockBookingRecord, error: null }),
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain),
        }),
      });

      const result = await getBookingById(1);
      
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]).toEqual(mockBookingRecord);
      expect(result.error).toBeUndefined();
    });

    it('should return error when booking ID is not found', async () => {
      const { getBookingById } = await import('../database');
      
      const mockChain = {
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116', message: 'No rows found' } 
        }),
      };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(mockChain),
        }),
      });

      const result = await getBookingById(999);
      
      expect(result.bookings).toHaveLength(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });
});