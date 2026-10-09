#!/usr/bin/env bash
# ==============================================================================
# Relosta Discord Bot — Automated US Virginia Server Deployment Script
# Targets: AWS EC2 (us-east-1), Lightsail (VA), DigitalOcean (Ashburn), Ubuntu/Debian VPS
# ==============================================================================

set -euo pipefail

echo "===================================================================="
echo "⚡ Relosta Bot — US Virginia Datacenter Deployment Wizard"
echo "Datacenter Metro: Ashburn / Northern Virginia (us-east-1 / iad)"
echo "===================================================================="

# Check root or sudo
if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
else
  SUDO=""
fi

echo "[1/6] Updating system packages & installing native dependencies..."
$SUDO apt-get update -y
$SUDO apt-get install -y curl git build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev ffmpeg

echo "[2/6] Verifying Node.js 22 runtime..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  echo "Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi
echo "Node version: $(node -v)"

echo "[3/6] Setting up project directory..."
APP_DIR="/opt/relosta-bot"
$SUDO mkdir -p "$APP_DIR"
$SUDO chown -R "$USER:$USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning repository..."
  git clone https://github.com/tejasmeet-code/Bot-1.git "$APP_DIR"
else
  echo "Pulling latest code updates..."
  cd "$APP_DIR"
  git pull origin main || true
fi

cd "$APP_DIR"

echo "[4/6] Installing dependencies and building production bundle..."
npm install --legacy-peer-deps
npm run build

echo "[5/6] Ensuring storage volume directories..."
mkdir -p "$APP_DIR/.data"
chmod -R 775 "$APP_DIR/.data"

echo "[6/6] Configuring systemd service (auto-restart 24/7)..."
SERVICE_FILE="/etc/systemd/system/relosta-bot.service"

$SUDO bash -c "cat << 'EOF' > $SERVICE_FILE
[Unit]
Description=Relosta Discord Bot Service (US Virginia Server)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=TARGET_HOST_LOCATION=\"US Virginia (Ashburn, VA)\"
Environment=TARGET_HOST_REGION=\"us-east-1\"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=relosta-bot

[Install]
WantedBy=multi-user.target
EOF"

$SUDO systemctl daemon-reload
$SUDO systemctl enable relosta-bot
$SUDO systemctl restart relosta-bot

echo "===================================================================="
echo "✅ Relosta Bot service has been deployed in US Virginia!"
echo "Status check:  sudo systemctl status relosta-bot"
echo "Live logs:     sudo journalctl -u relosta-bot -f"
echo "Web Panel:     http://<YOUR_SERVER_IP>:3000"
echo "===================================================================="
