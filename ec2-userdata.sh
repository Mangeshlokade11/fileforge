#!/bin/bash
# ================================================================
#  FileForge — EC2 User Data Script
#  Paste this into "User data" when launching an EC2 instance
#  to fully automate the setup.
#
#  Requirements: Ubuntu 22.04 LTS (AMI: ami-0c7217cdde317cfec)
#  Instance type: t3.medium or larger (4 GB RAM recommended)
#  Storage: 30 GB gp3 EBS minimum
#  Security group: allow ports 22, 80, 443, 3000
# ================================================================
set -e
exec > >(tee /var/log/fileforge-userdata.log) 2>&1

echo "[$(date)] Starting FileForge EC2 setup..."

# ── System updates ─────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ── Conversion tools ───────────────────────────────────────────
apt-get install -y --no-install-recommends \
  ffmpeg \
  libreoffice-headless libreoffice-writer libreoffice-calc libreoffice-impress \
  ghostscript \
  imagemagick \
  libvips-dev \
  fonts-liberation fonts-dejavu-core fontconfig \
  nginx curl git build-essential

fc-cache -f -v

# Fix ImageMagick PDF policy
sed -i 's/<policy domain="coder" rights="none" pattern="PDF"/<policy domain="coder" rights="read|write" pattern="PDF"/' \
  /etc/ImageMagick-6/policy.xml || true

# ── Node.js 20 ─────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── MongoDB 7 ──────────────────────────────────────────────────
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -qq && apt-get install -y mongodb-org
systemctl enable mongod && systemctl start mongod

# ── PM2 ────────────────────────────────────────────────────────
npm install -g pm2 --quiet

# ── App directory ──────────────────────────────────────────────
APP_DIR=/home/ubuntu/fileforge
mkdir -p $APP_DIR
cd $APP_DIR

# ── REPLACE WITH YOUR ACTUAL DEPLOYMENT METHOD ─────────────────
# Option A: git clone (recommended)
# git clone https://github.com/YOUR_ORG/fileforge.git .

# Option B: S3 download
# aws s3 cp s3://your-bucket/fileforge.zip /tmp/fileforge.zip
# unzip /tmp/fileforge.zip -d $APP_DIR

# For now, create a placeholder that you'll replace:
cat > /home/ubuntu/DEPLOY_INSTRUCTIONS.txt << 'INSTRUCTIONS'
FileForge EC2 setup is complete!

To deploy your app:
1. Copy your FileForge project files to /home/ubuntu/fileforge/
   e.g.: scp -r ./fileforge/* ubuntu@YOUR-IP:/home/ubuntu/fileforge/

2. Then run:
   cd /home/ubuntu/fileforge
   cp .env.example .env
   # Edit .env with your values
   nano .env
   npm install
   pm2 start backend/server.js --name fileforge
   pm2 save

Your server is ready. The following are installed:
  ✓ Node.js 20
  ✓ MongoDB 7
  ✓ FFmpeg
  ✓ LibreOffice
  ✓ Ghostscript
  ✓ ImageMagick
  ✓ nginx
  ✓ PM2
INSTRUCTIONS
# ── End placeholder ─────────────────────────────────────────────

# Create required dirs
mkdir -p $APP_DIR/uploads $APP_DIR/temp $APP_DIR/logs
chown -R ubuntu:ubuntu $APP_DIR

# ── nginx config ───────────────────────────────────────────────
cat > /etc/nginx/conf.d/fileforge.conf << 'NGINX'
client_max_body_size 600M;
client_body_timeout 300s;
proxy_read_timeout 300s;

server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        upgrade;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
NGINX

nginx -t && systemctl enable nginx && systemctl restart nginx

echo "[$(date)] FileForge EC2 setup complete!"
echo "[$(date)] See /home/ubuntu/DEPLOY_INSTRUCTIONS.txt for next steps"
