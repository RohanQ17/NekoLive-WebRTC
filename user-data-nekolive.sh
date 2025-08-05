#!/bin/bash
yum update -y
yum install -y git nginx

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install PM2
npm install -g pm2

# Clone your repository
cd /home/ec2-user
git clone https://github.com/RohanQ17/NekoLive-WebRTC.git
cd NekoLive-WebRTC

# Install dependencies
npm ci --only=production

# Setup environment for nekolive.app
cp .env.example .env
sed -i 's/NODE_ENV=production/NODE_ENV=production/' .env
sed -i 's/ALLOWED_ORIGINS=https:\/\/nekolive.app,https:\/\/www.nekolive.app/ALLOWED_ORIGINS=https:\/\/nekolive.app,https:\/\/www.nekolive.app/' .env

# Start application
pm2 start signaling-server.js --name nekolive
pm2 startup
pm2 save

# Configure nginx for domain
cat > /etc/nginx/conf.d/nekolive.conf << 'EOL'
server {
    listen 80;
    server_name nekolive.app www.nekolive.app;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
EOL

# Remove default nginx config
rm -f /etc/nginx/conf.d/default.conf

systemctl enable nginx
systemctl start nginx

# Log the completion
echo "NekoLive deployment completed at $(date)" >> /var/log/deployment.log
echo "Application should be accessible at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)" >> /var/log/deployment.log
