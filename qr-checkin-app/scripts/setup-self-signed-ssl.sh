#!/bin/bash

# Create self-signed SSL certificate for IP address
# This allows HTTPS access via IP address

SERVER_IP=${1:-"YOUR_SERVER_IP"}

if [ "$SERVER_IP" = "YOUR_SERVER_IP" ]; then
    echo "Usage: $0 <server_ip>"
    echo "Example: $0 143.198.123.45"
    exit 1
fi

echo "Creating self-signed SSL certificate for IP: $SERVER_IP"

# Create certificate directory
mkdir -p ./ssl

# Generate private key
openssl genrsa -out ./ssl/private.key 2048

# Create certificate signing request
cat > ./ssl/cert.conf <<EOF
[req]
default_bits = 2048
prompt = no
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]
C = US
ST = State
L = City
O = Organization
CN = $SERVER_IP

[v3_req]
subjectAltName = @alt_names

[alt_names]
IP.1 = $SERVER_IP
EOF

# Generate certificate
openssl req -new -x509 -key ./ssl/private.key -out ./ssl/certificate.crt -days 365 -config ./ssl/cert.conf -extensions v3_req

echo "Self-signed certificate created!"
echo "Certificate: ./ssl/certificate.crt"
echo "Private key: ./ssl/private.key"
echo ""
echo "Note: Browsers will show security warnings for self-signed certificates"
echo "Users need to click 'Advanced' -> 'Proceed to $SERVER_IP (unsafe)'"