import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Basic health check
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: 'unknown',
        memory: 'unknown',
        responseTime: 0
      }
    };

    // Database connectivity check
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('registration')
        .select('id')
        .limit(1);
      
      health.checks.database = error ? 'unhealthy' : 'healthy';
    } catch (dbError) {
      health.checks.database = 'unhealthy';
      console.error('Database health check failed:', dbError);
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    health.checks.memory = memUsageMB.heapUsed < 400 ? 'healthy' : 'warning';
    
    // Response time
    health.checks.responseTime = Date.now() - startTime;

    // Determine overall status
    const isHealthy = health.checks.database === 'healthy' && 
                     health.checks.memory !== 'unhealthy' &&
                     health.checks.responseTime < 1000;

    if (!isHealthy) {
      health.status = 'unhealthy';
    }

    return NextResponse.json(health, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
      checks: {
        database: 'unknown',
        memory: 'unknown',
        responseTime: Date.now() - startTime
      }
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}