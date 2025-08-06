#!/bin/bash

# Renew Let's Encrypt certificates
# This script should be run via cron job

echo "### Renewing Let's Encrypt certificates ..."

docker-compose run --rm --entrypoint "\
  certbot renew --webroot -w /var/www/certbot" certbot

echo "### Reloading nginx ..."
docker-compose exec nginx nginx -s reload

echo "### Certificate renewal completed at $(date)"