/**
 * Supabase client configuration for the QR Check-in Application
 * Handles secure connection to the PostgreSQL database
 */

import { createClient } from '@supabase/supabase-js';

// Environment variable validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Warn if using placeholder values
if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.warn('Warning: Using placeholder Supabase configuration. Please set proper environment variables for production use.');
}

// Create the main Supabase client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We don't need session persistence for this app
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'qr-checkin-app',
    },
  },
});

// Create admin client for privileged operations (if service role key is available)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    })
  : null;

// Create client function for API routes
export function getSupabaseClient() {
  return supabase;
}

// Connection test function
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('registration').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}