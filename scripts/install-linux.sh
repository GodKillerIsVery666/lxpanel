#!/usr/bin/env sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root." >&2
  exit 1
fi

APP_DIR=${APP_DIR:-/opt/lxpanel}
DATA_DIR=${DATA_DIR:-/var/lib/lxpanel}
CONFIG_DIR=${CONFIG_DIR:-/etc/lxpanel}

mkdir -p "$APP_DIR" "$DATA_DIR" "$CONFIG_DIR"
if ! id lxpanel >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin lxpanel
fi

chown -R lxpanel:lxpanel "$DATA_DIR"
chmod 750 "$DATA_DIR"

if [ ! -f "$CONFIG_DIR/lxpanel.env" ]; then
  cp deploy/lxpanel.env.example "$CONFIG_DIR/lxpanel.env"
  chmod 640 "$CONFIG_DIR/lxpanel.env"
fi

cp deploy/lxpanel.service /etc/systemd/system/lxpanel.service
systemctl daemon-reload
systemctl enable lxpanel.service

echo "LXPanel service installed. Edit $CONFIG_DIR/lxpanel.env, copy build files to $APP_DIR, then run: systemctl restart lxpanel"
