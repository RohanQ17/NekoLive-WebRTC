#!/bin/bash

# NekoLive Production Deployment Script
# Run this script to deploy to AWS EC2

set -e

echo "🚀 Starting NekoLive Production Deployment..."

# Configuration
DOMAIN="${DOMAIN:-your-domain.com}"
SSL_EMAIL="${SSL_EMAIL:-admin@your-domain.com}"
APP_PORT="${APP_PORT:-8080}"

# Update system
echo "📦 Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install Node.js 18 LTS
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx and certbot
echo "📦 Installing nginx and certbot..."
sudo apt install -y nginx certbot python3-certbot-nginx

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create app directory
echo "📁 Setting up application directory..."
sudo mkdir -p /var/www/nekolive
sudo chown -R $USER:$USER /var/www/nekolive

# Install application dependencies
echo "📦 Installing application dependencies..."
cd /var/www/nekolive
npm ci --only=production

# Setup environment file
echo "⚙️ Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i "s/NODE_ENV=development/NODE_ENV=production/" .env
    sed -i "s/ALLOWED_ORIGINS=\*/ALLOWED_ORIGINS=https:\/\/$DOMAIN/" .env
    sed -i "s/PORT=8080/PORT=$APP_PORT/" .env
    echo "✅ Environment file created. Please review and update .env file with your settings."
fi

# Configure nginx
echo "🌐 Configuring nginx..."
sudo tee /etc/nginx/sites-available/nekolive > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL configuration will be added by certbot

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files
    location ~* \.(html|css|js|png|jpg|jpeg|gif|ico|svg)$ {
        root /var/www/nekolive;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # WebSocket and API endpoints
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/nekolive /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
echo "🔒 Setting up SSL certificate..."
sudo certbot --nginx -d $DOMAIN --email $SSL_EMAIL --agree-tos --non-interactive

# Start application with PM2
echo "🚀 Starting application..."
pm2 start signaling-server.js --name "nekolive"
pm2 startup
pm2 save

# Setup firewall
echo "🔥 Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Setup log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/nekolive > /dev/null <<EOF
/var/log/pm2/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 0644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Create health check script
echo "🏥 Creating health check script..."
tee /var/www/nekolive/health-check.sh > /dev/null <<EOF
#!/bin/bash
response=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/health)
if [ \$response -eq 200 ]; then
    echo "✅ Application is healthy"
    exit 0
else
    echo "❌ Application is unhealthy (HTTP \$response)"
    pm2 restart nekolive
    exit 1
fi
EOF
chmod +x /var/www/nekolive/health-check.sh

# Setup cron job for health checks
echo "⏰ Setting up health check cron job..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/nekolive/health-check.sh >> /var/log/nekolive-health.log 2>&1") | crontab -

# Setup backup script
echo "💾 Creating backup script..."
tee /var/www/nekolive/backup.sh > /dev/null <<EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/nekolive"
mkdir -p \$BACKUP_DIR

# Backup application files
tar -czf \$BACKUP_DIR/nekolive_\$DATE.tar.gz \\
    /var/www/nekolive \\
    /etc/nginx/sites-available/nekolive \\
    --exclude=/var/www/nekolive/node_modules

# Keep only last 7 backups
find \$BACKUP_DIR -name "nekolive_*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR/nekolive_\$DATE.tar.gz"
EOF
chmod +x /var/www/nekolive/backup.sh

# Setup daily backup cron job
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/nekolive/backup.sh >> /var/log/nekolive-backup.log 2>&1") | crontab -

echo ""
echo "🎉 Production deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "   🌐 Domain: https://$DOMAIN"
echo "   🔒 SSL: Enabled (Let's Encrypt)"
echo "   🔥 Firewall: Configured"
echo "   📦 PM2: Running as service"
echo "   🏥 Health checks: Every 5 minutes"
echo "   💾 Daily backups: 2 AM"
echo ""
echo "📝 Next steps:"
echo "   1. Review and update /var/www/nekolive/.env"
echo "   2. Test your application at https://$DOMAIN"
echo "   3. Monitor logs with: pm2 logs nekolive"
echo "   4. Check status with: pm2 status"
echo ""
echo "🔧 Useful commands:"
echo "   pm2 restart nekolive  # Restart application"
echo "   pm2 logs nekolive      # View logs"
echo "   pm2 monit             # Process monitor"
echo "   sudo nginx -t         # Test nginx config"
echo ""
