/**
 * Supabase database type definitions
 * Generated types for the registration table schema
 */

export interface Database {
  public: {
    Tables: {
      registrations: {
        Row: {
          id: number;
          created_at: string;
          koalendar_id: string;
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
          qr_sent_at: string | null;
          qr_batch_id: string | null;
          is_attended: boolean;
          attended_at: string | null;
          actual_num_guests: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          koalendar_id: string;
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
          is_qr_sent?: boolean;
          qr_sent_at?: string | null;
          qr_batch_id?: string | null;
          is_attended?: boolean;
          attended_at?: string | null;
          actual_num_guests?: number | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          koalendar_id?: string;
          event_type?: string;
          name?: string;
          email?: string;
          contact_number?: string;
          is_lamrin_student?: boolean;
          postcode?: string;
          gender?: string;
          num_guests?: number;
          start_at?: string;
          end_at?: string;
          is_qr_sent?: boolean;
          qr_sent_at?: string | null;
          qr_batch_id?: string | null;
          is_attended?: boolean;
          attended_at?: string | null;
          actual_num_guests?: number | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}