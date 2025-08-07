# Deployment Guide

This guide covers the complete deployment process for the QR Check-in App on Digital Ocean.

## Prerequisites

- Digital Ocean droplet with Ubuntu 22.04 LTS
- Domain name configured to point to your server
- Supabase project with database configured
- GitHub repository with the application code

## Initial Server Setup

### 1. Create Digital Ocean Droplet

1. Create a new droplet with Ubuntu 22.04 LTS
2. Choose appropriate size (minimum: 1GB RAM, 1 vCPU)
3. Add your SSH key during creation
4. Note the server IP address

### 2. Configure DNS

Point your domain to the server IP:
```
A record: yourdomain.com -> YOUR_SERVER_IP
A record: www.yourdomain.com -> YOUR_SERVER_IP
```

### 3. Run Server Setup Script

SSH into your server and run the Docker-only setup script:

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Download and run the Docker-only setup script
curl -sSL https://raw.githubusercontent.com/your-username/qr-checkin-app/main/scripts/setup-server-docker.sh | bash

# Or manually download and run:
wget https://raw.githubusercontent.com/your-username/qr-checkin-app/main/scripts/setup-server-docker.sh
chmod +x setup-server-docker.sh
./setup-server-docker.sh
```

This script will:
- Install Docker and Docker Compose
- Create a deploy user with Docker permissions
- Set up firewall rules
- Configure log rotation
- Set up certificate renewal cron job
- Set up automated Docker cleanup

**What's NOT installed** (since we use Docker):
- Node.js (runs inside containers)
- PM2 (Docker handles process management)
- Nginx (runs inside containers)

## Application Deployment

### 1. Switch to Deploy User

```bash
su - deploy
```

### 2. Clone Repository

```bash
cd /var/www
git clone https://github.com/your-username/qr-checkin-app.git
cd qr-checkin-app
```

### 3. Configure Environment Variables

```bash
# Copy the example file
cp .env.production.example .env.production

# Edit with your actual values
nano .env.production
```

Required environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0
```

**Important**: Make sure your Supabase URL and keys are correct. The application will fall back to placeholder values if these are not set properly, causing connection failures.

### 4. Update Nginx Configuration

Edit the nginx configuration to use your domain:

```bash
# Edit the nginx configuration
nano nginx/default.conf

# Replace 'example.com' with your actual domain
sed -i 's/example.com/yourdomain.com/g' nginx/default.conf
```

### 5. Initialize SSL Certificates

```bash
# Update the Let's Encrypt script with your domain and email
nano scripts/init-letsencrypt.sh

# Update these variables:
# domains=(yourdomain.com www.yourdomain.com)
# email="your-email@example.com"

# Run the initialization script
./scripts/init-letsencrypt.sh
```

### 6. Deploy the Application

```bash
# Run the deployment script
./scripts/deploy.sh
```

## Deployment Options

### Option 1: Simple HTTP Deployment (No SSL)

**Best for**: Internal networks, development, testing

**Limitations**: QR scanner won't work (requires HTTPS for camera access)

```bash
# Simple deployment without SSL
docker-compose -f docker-compose.simple.yml up -d

# Or use the deployment script
./scripts/deploy-simple.sh

# Access at: http://YOUR_SERVER_IP
```

**Pros**:
- Quick setup
- No domain/DNS required
- No SSL certificate management
- Works with IP addresses

**Cons**:
- QR scanner feature disabled (camera requires HTTPS)
- Less secure
- Not suitable for public internet

### Option 2: Full Production Deployment (With SSL)

**Best for**: Production, public access, full QR scanner functionality

```bash
# Full deployment with SSL, Nginx, monitoring
./scripts/deploy.sh

# Access at: https://yourdomain.com
```

**Pros**:
- Full QR scanner functionality
- Secure HTTPS
- Production-ready
- Monitoring and health checks

**Cons**:
- Requires domain name
- SSL certificate setup
- More complex configuration

### Option 3: Local Development

For local testing and development:

```bash
# Use the local development compose file
docker-compose -f docker-compose.local.yml up --build

# This will:
# - Run Next.js in development mode
# - Read environment variables from .env.local at runtime
# - Enable hot reloading
# - Access at http://localhost:3000
```

## CI/CD Setup (Optional)

### 1. GitHub Secrets

Add the following secrets to your GitHub repository:

- `DEPLOY_HOST`: Your server IP address
- `DEPLOY_USER`: deploy
- `DEPLOY_SSH_KEY`: Private SSH key for the deploy user
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SLACK_WEBHOOK`: (Optional) Slack webhook for notifications

### 2. SSH Key Setup

Generate SSH key pair for GitHub Actions:

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github-actions

# Copy public key to server
ssh-copy-id -i ~/.ssh/github-actions.pub deploy@YOUR_SERVER_IP

# Add private key to GitHub secrets as DEPLOY_SSH_KEY
cat ~/.ssh/github-actions
```

## Monitoring and Maintenance

### Health Checks

The application provides several monitoring endpoints:

- `https://yourdomain.com/health` - Basic health check
- `https://yourdomain.com/api/health` - Detailed health status
- `https://yourdomain.com/api/metrics` - Application metrics

### Log Files

Monitor application logs:

```bash
# Application logs
docker-compose logs -f app

# Nginx logs
docker-compose logs -f nginx

# Deployment logs
tail -f /var/log/deploy-qr-checkin-app.log

# Certificate renewal logs
tail -f /var/log/certbot-renewal.log
```

### Certificate Renewal

Certificates are automatically renewed via cron job. To manually renew:

```bash
./scripts/renew-certs.sh
```

### Backup and Recovery

Backups are automatically created during deployments in `/var/backups/qr-checkin-app/`.

To manually create a backup:

```bash
# Create backup
sudo cp -r /var/www/qr-checkin-app /var/backups/qr-checkin-app/manual-backup-$(date +%Y%m%d-%H%M%S)

# Restore from backup
sudo cp -r /var/backups/qr-checkin-app/backup-YYYYMMDD-HHMMSS /var/www/qr-checkin-app
```

### Scaling

To scale the application:

1. **Vertical Scaling**: Resize your Digital Ocean droplet
2. **Horizontal Scaling**: Use a load balancer with multiple droplets
3. **Database Scaling**: Supabase handles database scaling automatically

### Security Updates

Keep the system updated:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull
docker-compose up -d

# Update Node.js dependencies
npm audit fix
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Check certificate status
   docker-compose exec certbot certbot certificates
   
   # Force renewal
   docker-compose exec certbot certbot renew --force-renewal
   ```

2. **Database Connection Issues**
   ```bash
   # Check environment variables
   cat .env.production
   
   # Test database connection
   curl https://yourdomain.com/api/health
   ```

   **Common cause**: Application using placeholder Supabase URL instead of real one
   - Verify environment variables are set correctly in `.env.production`
   - Check Docker logs: `docker-compose logs app`
   - Look for "placeholder.supabase.co" in error messages

3. **Docker Build Issues**
   ```bash
   # Clean build cache and rebuild
   docker-compose down
   docker system prune -f
   docker-compose build --no-cache
   docker-compose up -d
   ```

   **TypeScript errors during build**:
   - Check for naming conflicts (e.g., `createClient` function names)
   - Verify all imports are correct
   - Ensure database table names match your schema

4. **Docker Issues**
   ```bash
   # Restart all services
   docker-compose restart
   
   # Rebuild containers
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **Nginx Configuration Issues**
   ```bash
   # Test nginx configuration
   docker-compose exec nginx nginx -t
   
   # Reload nginx
   docker-compose exec nginx nginx -s reload
   ```

### Performance Optimization

1. **Enable Gzip Compression**: Already configured in nginx.conf
2. **Optimize Images**: Use WebP format and appropriate sizes
3. **Database Optimization**: Use Supabase's built-in optimization features
4. **CDN**: Consider using a CDN for static assets

### Monitoring Setup

For production monitoring, consider integrating:

- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry
- **Performance Monitoring**: New Relic, DataDog
- **Log Aggregation**: ELK Stack, Splunk

## Support

For issues related to:
- **Application**: Check GitHub issues
- **Deployment**: Review deployment logs
- **Infrastructure**: Check Digital Ocean documentation
- **Database**: Refer to Supabase documentation