/**
 * Database type definitions for the QR Check-in Application
 * Based on the Supabase PostgreSQL schema for registration records
 */

export interface BookingRecord {
  id: number;
  created_at: string;
  koalender_id: string;
  event_type: string;
  name: string;
  email: string;
  contact_number: string;
  is_lamrin_student: boolean;
  postcode: string;
  gender: string;
  num_guests: number;
  start_at: string;
  end_at: string;
  is_qr_sent: boolean;
  qr_sent_at?: string;
  qr_batch_id?: string;
  is_attended: boolean;
  attended_at?: string;
  actual_num_guests?: number;
}

export interface CheckInRequest {
  bookingId: number;
  actualGuests: number;
  timestamp: string;
}

export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
}

export interface SearchResult {
  bookings: BookingRecord[];
  error?: DatabaseError;
}

export interface CheckInResult {
  success: boolean;
  booking?: BookingRecord;
  error?: DatabaseError;
  isDuplicateCheckIn?: boolean;
  previousCheckIn?: {
    attendedAt: string;
    actualGuests: number;
  };
}