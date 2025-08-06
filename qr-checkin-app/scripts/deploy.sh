#!/bin/bash

# Deployment script for QR Check-in App
# This script handles the complete deployment process

set -e

# Configuration
APP_NAME="qr-checkin-app"
DEPLOY_USER="deploy"
DEPLOY_PATH="/var/www/$APP_NAME"
BACKUP_PATH="/var/backups/$APP_NAME"
LOG_FILE="/var/log/deploy-$APP_NAME.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

# Check if running as deploy user
if [ "$USER" != "$DEPLOY_USER" ]; then
    error "This script must be run as the $DEPLOY_USER user"
    exit 1
fi

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    error "Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed"
    exit 1
fi

log "Starting deployment of $APP_NAME"

# Create backup of current deployment
if [ -d "$DEPLOY_PATH" ]; then
    log "Creating backup of current deployment"
    mkdir -p $BACKUP_PATH
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    cp -r $DEPLOY_PATH $BACKUP_PATH/$BACKUP_NAME
    log "Backup created at $BACKUP_PATH/$BACKUP_NAME"
fi

# Navigate to deployment directory
cd $DEPLOY_PATH

# Pull latest changes
log "Pulling latest changes from repository"
git pull origin main

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    error ".env.production file not found. Please create it with required environment variables."
    exit 1
fi

# Build and deploy with Docker Compose
log "Building Docker images"
docker-compose build --no-cache

log "Stopping existing containers"
docker-compose down

log "Starting new containers"
docker-compose up -d

# Wait for services to be healthy
log "Waiting for services to be healthy"
sleep 30

# Health check
log "Performing health check"
if curl -f http://localhost/health > /dev/null 2>&1; then
    log "Health check passed"
else
    error "Health check failed"
    
    # Rollback if backup exists
    if [ -d "$BACKUP_PATH/$BACKUP_NAME" ]; then
        warning "Rolling back to previous version"
        docker-compose down
        rm -rf $DEPLOY_PATH
        cp -r $BACKUP_PATH/$BACKUP_NAME $DEPLOY_PATH
        cd $DEPLOY_PATH
        docker-compose up -d
        
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log "Rollback successful"
        else
            error "Rollback failed. Manual intervention required."
        fi
    fi
    exit 1
fi

# Clean up old Docker images
log "Cleaning up old Docker images"
docker image prune -f

# Clean up old backups (keep last 5)
log "Cleaning up old backups"
cd $BACKUP_PATH
ls -t | tail -n +6 | xargs -r rm -rf

log "Deployment completed successfully"

# Send notification (optional - requires mail command)
if command -v mail &> /dev/null; then
    echo "Deployment of $APP_NAME completed successfully at $(date)" | mail -s "Deployment Success" admin@example.com
fi