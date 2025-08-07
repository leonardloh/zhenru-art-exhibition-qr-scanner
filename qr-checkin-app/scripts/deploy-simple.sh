#!/bin/bash

# Simple deployment script without SSL
# For internal/development use only

set -e

APP_NAME="qr-checkin-app"
LOG_FILE="/var/log/deploy-$APP_NAME-simple.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

log "Starting simple HTTP deployment of $APP_NAME"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    error ".env.production file not found. Please create it with required environment variables."
    exit 1
fi

# Build and deploy with simple Docker Compose
log "Building Docker images"
docker-compose -f docker-compose.simple.yml build --no-cache

log "Stopping existing containers"
docker-compose -f docker-compose.simple.yml down

log "Starting new containers"
docker-compose -f docker-compose.simple.yml up -d

# Wait for services to be healthy
log "Waiting for services to be healthy"
sleep 30

# Health check
log "Performing health check"
if curl -f http://localhost/api/health > /dev/null 2>&1; then
    log "Health check passed"
    log "Application is running at http://localhost"
    log "Note: QR scanner may not work without HTTPS"
else
    error "Health check failed"
    log "Check logs with: docker-compose -f docker-compose.simple.yml logs"
    exit 1
fi

# Clean up old Docker images
log "Cleaning up old Docker images"
docker image prune -f

log "Simple deployment completed successfully"
log "Access your app at: http://YOUR_SERVER_IP"
warning "Remember: QR camera access requires HTTPS in modern browsers"