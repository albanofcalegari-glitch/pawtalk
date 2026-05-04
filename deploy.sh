#!/bin/bash
# Deploy PawTalk to VPS
# Usage: ./deploy.sh

set -e

VPS_HOST="31.97.167.30"
VPS_USER="root"
DOMAIN="pawtalk.turnit.com.ar"

echo "=== Building frontend ==="
cd web_build
npm run build
cd ..

echo "=== Uploading frontend ==="
rsync -avz --delete web_build/dist/ $VPS_USER@$VPS_HOST:/var/www/pawtalk/

echo "=== Uploading API ==="
rsync -avz --exclude='__pycache__' --exclude='*.db' --exclude='uploads/' api/ $VPS_USER@$VPS_HOST:/opt/pawtalk/api/

echo "=== Uploading nginx config ==="
scp nginx.conf $VPS_USER@$VPS_HOST:/etc/nginx/sites-available/pawtalk
ssh $VPS_USER@$VPS_HOST "ln -sf /etc/nginx/sites-available/pawtalk /etc/nginx/sites-enabled/pawtalk"

echo "=== Restarting services ==="
ssh $VPS_USER@$VPS_HOST << 'EOF'
  cd /opt/pawtalk/api
  pip install -r requirements.txt --quiet

  # Create systemd service if not exists
  cat > /etc/systemd/system/pawtalk-api.service << 'SVC'
[Unit]
Description=PawTalk API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/pawtalk/api
ExecStart=/usr/local/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
Environment=SECRET_KEY=CHANGE_ME_PROD_KEY
Environment=DATABASE_URL=sqlite:///pawtalk.db

[Install]
WantedBy=multi-user.target
SVC

  systemctl daemon-reload
  systemctl enable pawtalk-api
  systemctl restart pawtalk-api
  nginx -t && systemctl reload nginx
EOF

echo "=== Setting up SSL (if needed) ==="
ssh $VPS_USER@$VPS_HOST "certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m albano.f.calegari@gmail.com || true"

echo "=== Done! https://$DOMAIN ==="
