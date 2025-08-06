module.exports = {
  apps: [
    {
      name: 'qr-checkin-app',
      script: 'server.js',
      cwd: '/app',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0'
      },
      // Monitoring and logging
      log_file: '/var/log/pm2/qr-checkin-app.log',
      out_file: '/var/log/pm2/qr-checkin-app-out.log',
      error_file: '/var/log/pm2/qr-checkin-app-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      
      // Auto restart on file changes (disabled in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // Advanced PM2 features
      merge_logs: true,
      time: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Environment variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NEXT_TELEMETRY_DISABLED: 1
      }
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/qr-checkin-app.git',
      path: '/var/www/qr-checkin-app',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    }
  }
};