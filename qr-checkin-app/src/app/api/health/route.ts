/**
 * Health check API endpoint for network monitoring
 * Provides a simple endpoint to test connectivity and server health
 */

import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/supabase';

export async function GET() {
  try {
    // Test database connectivity
    const dbHealthy = await testConnection();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealthy ? 'connected' : 'disconnected',
      uptime: process.uptime()
    };

    return NextResponse.json(health, { 
      status: dbHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }, 
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
}

export async function HEAD() {
  // Simple HEAD request for network latency testing
  // Don't check database for basic network connectivity
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}