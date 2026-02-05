#!/bin/bash
set -e

PROJECT_DIR="/root/auto-submitter"
NODE_PATH="/root/.nvm/versions/node/v20.19.6/bin/node"
NPM_PATH="/root/.nvm/versions/node/v20.19.6/bin/npm"
NPX_PATH="/root/.nvm/versions/node/v20.19.6/bin/npx"
PM2_PATH="/root/.nvm/versions/node/v20.19.6/bin/pm2"

echo "--- STARTING DEPLOYMENT ---"

# 1. Cleanup PM2
$PM2_PATH delete all || true

# 2. Cleanup & Clone (Safely)
# Instead of rm -rf the whole dir, we'll clean and git init if necessary, 
# but a clean start is better.
echo "--- CLONING REPOSITORY ---"
rm -rf $PROJECT_DIR
git clone --depth 1 https://github.com/digitalwazi/only-auto-submit.git $PROJECT_DIR || { echo "Clone failed"; exit 1; }

echo "--- RESTORING MODULAR ENGINE ---"
# We expect modular files to be in /root/deploy_temp
if [ -d "/root/deploy_temp/engine" ]; then
    mkdir -p $PROJECT_DIR/src/lib/engine
    cp -rv /root/deploy_temp/engine/* $PROJECT_DIR/src/lib/engine/
else
    echo "WARNING: /root/deploy_temp/engine not found"
fi

if [ -f "/root/deploy_temp/worker.ts" ]; then
    mkdir -p $PROJECT_DIR/src/lib
    cp -v /root/deploy_temp/worker.ts $PROJECT_DIR/src/lib/worker.ts
else
    echo "WARNING: /root/deploy_temp/worker.ts not found"
fi

# 3. Setup
cd $PROJECT_DIR
echo "DATABASE_URL=\"file:./dev.db\"" > .env

# 4. Install
$NPM_PATH install --legacy-peer-deps

# 5. Prisma
$NPX_PATH prisma generate
$NPX_PATH prisma db push --accept-data-loss

# 6. Build
export NODE_OPTIONS="--max-old-space-size=2048"
$NPM_PATH run build

# 7. Nginx
cat <<EOF > /etc/nginx/sites-available/crazydealz.in
server {
    listen 80;
    server_name crazydealz.in www.crazydealz.in;
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
ln -sf /etc/nginx/sites-available/crazydealz.in /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 8. Start
$PM2_PATH start $NPM_PATH --name "next-app" -- start
$PM2_PATH start $NPM_PATH --name "worker-daemon" -- run worker
$PM2_PATH save

echo "--- DEPLOYMENT FINISHED ---"
