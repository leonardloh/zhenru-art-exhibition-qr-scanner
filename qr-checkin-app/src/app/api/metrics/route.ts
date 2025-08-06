import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // Get basic metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      application: {
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      },
      database: {
        connected: false,
        totalRegistrations: 0,
        checkedInToday: 0,
        lastCheckIn: null
      }
    };

    // Database metrics
    try {
      // Test connection
      const { error: connectionError } = await supabase
        .from('registration')
        .select('id')
        .limit(1);
      
      metrics.database.connected = !connectionError;

      if (!connectionError) {
        // Total registrations
        const { count: totalCount } = await supabase
          .from('registration')
          .select('*', { count: 'exact', head: true });
        
        metrics.database.totalRegistrations = totalCount || 0;

        // Checked in today
        const today = new Date().toISOString().split('T')[0];
        const { count: checkedInCount } = await supabase
          .from('registration')
          .select('*', { count: 'exact', head: true })
          .eq('is_attended', true)
          .gte('attended_at', `${today}T00:00:00.000Z`)
          .lt('attended_at', `${today}T23:59:59.999Z`);
        
        metrics.database.checkedInToday = checkedInCount || 0;

        // Last check-in
        const { data: lastCheckIn } = await supabase
          .from('registration')
          .select('attended_at')
          .eq('is_attended', true)
          .order('attended_at', { ascending: false })
          .limit(1)
          .single();
        
        metrics.database.lastCheckIn = lastCheckIn?.attended_at || null;
      }
    } catch (dbError) {
      console.error('Database metrics error:', dbError);
      metrics.database.connected = false;
    }

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Metrics endpoint error:', error);
    
    return NextResponse.json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}