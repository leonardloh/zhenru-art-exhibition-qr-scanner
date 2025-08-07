#!/bin/bash

# Docker-only server setup script for Digital Ocean droplet
# Streamlined version without Node.js/PM2 since we're using Docker

set -e

# Configuration
DEPLOY_USER="deploy"
APP_NAME="qr-checkin-app"
DEPLOY_PATH="/var/www/$APP_NAME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run this script as root"
    exit 1
fi

log "Starting Docker-only server setup for $APP_NAME"

# Update system
log "Updating system packages"
apt update && apt upgrade -y

# Install essential packages
log "Installing essential packages"
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release ufw htop

# Install Docker
log "Installing Docker"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose (standalone)
log "Installing Docker Compose"
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create deploy user
log "Creating deploy user"
if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -m -s /bin/bash $DEPLOY_USER
    usermod -aG docker $DEPLOY_USER
    usermod -aG sudo $DEPLOY_USER
fi

# Setup SSH for deploy user
log "Setting up SSH for deploy user"
mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh
chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh

# Create deployment directory
log "Creating deployment directory"
mkdir -p $DEPLOY_PATH
chown $DEPLOY_USER:$DEPLOY_USER $DEPLOY_PATH

# Create backup directory
mkdir -p /var/backups/$APP_NAME
chown $DEPLOY_USER:$DEPLOY_USER /var/backups/$APP_NAME

# Create log directory
mkdir -p /var/log
touch /var/log/deploy-$APP_NAME.log
chown $DEPLOY_USER:$DEPLOY_USER /var/log/deploy-$APP_NAME.log

# Setup firewall
log "Configuring firewall"
ufw --force enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# Setup log rotation
log "Setting up log rotation"
cat > /etc/logrotate.d/$APP_NAME << EOF
/var/log/deploy-$APP_NAME.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
}

# Docker container logs
/var/lib/docker/containers/*/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Setup cron job for certificate renewal (Docker-based)
log "Setting up certificate renewal cron job"
(crontab -u $DEPLOY_USER -l 2>/dev/null; echo "0 12 * * * cd $DEPLOY_PATH && ./scripts/renew-certs.sh >> /var/log/certbot-renewal.log 2>&1") | crontab -u $DEPLOY_USER -

# Setup Docker system cleanup cron job
log "Setting up Docker cleanup cron job"
(crontab -u $DEPLOY_USER -l 2>/dev/null; echo "0 2 * * 0 docker system prune -f >> /var/log/docker-cleanup.log 2>&1") | crontab -u $DEPLOY_USER -

# Create environment file template
log "Creating environment file template"
cat > $DEPLOY_PATH/.env.production.example << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Application Configuration
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0

# Security
SESSION_SECRET=your_session_secret

# SSL/TLS Configuration (for Let's Encrypt)
DOMAIN=yourdomain.com
EMAIL=admin@yourdomain.com
EOF

chown $DEPLOY_USER:$DEPLOY_USER $DEPLOY_PATH/.env.production.example

# Test Docker installation
log "Testing Docker installation"
docker --version
docker-compose --version

log "Docker-only server setup completed successfully!"
log ""
log "What was installed:"
log "✅ Docker & Docker Compose"
log "✅ Essential system packages"
log "✅ Deploy user with Docker permissions"
log "✅ Firewall configuration"
log "✅ Log rotation"
log "✅ Automated cleanup cron jobs"
log ""
log "What was NOT installed (since we're using Docker):"
log "❌ Node.js (runs inside Docker containers)"
log "❌ PM2 (Docker handles process management)"
log "❌ Nginx (runs inside Docker containers)"
log ""
log "Next steps:"
log "1. Copy your SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys"
log "2. Create .env.production file based on the example"
log "3. Clone your repository to $DEPLOY_PATH"
log "4. Run the deployment script"
log ""
warning "Don't forget to:"
warning "- Configure your domain DNS to point to this server"
warning "- Update the domain in nginx configuration"
warning "- Run the Let's Encrypt initialization script"