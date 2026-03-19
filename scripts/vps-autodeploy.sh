#!/bin/bash
# Auto-deploy PocketBase hooks on the VPS.
# Called by the webhook listener when GitHub pushes to main/dev.
# Usage: ./vps-autodeploy.sh <branch>

set -euo pipefail

BRANCH="${1:-main}"
REPO_DIR="/opt/wiedisync-repo"
PROD_HOOKS="/opt/pocketbase-kscw/pb_hooks"
DEV_HOOKS="/opt/pocketbase-kscw-dev/pb_hooks"
LOG="/var/log/wiedisync-deploy.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

log "Deploy triggered for branch: $BRANCH"

# Clone repo if first run, otherwise pull
if [ ! -d "$REPO_DIR" ]; then
  log "Cloning repo..."
  git clone --depth 1 --branch "$BRANCH" https://github.com/Lucanepa/wiedisync.git "$REPO_DIR"
else
  cd "$REPO_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$REPO_DIR"

# Deploy based on branch (skip secrets.json — it lives only on the VPS)
if [ "$BRANCH" = "main" ]; then
  log "Deploying hooks to PROD..."
  for f in pb_hooks/*.js; do
    cp "$f" "$PROD_HOOKS/"
  done
  chown pocketbase:pocketbase "$PROD_HOOKS"/*.js
  systemctl restart pocketbase-kscw
  log "PROD deploy complete."

elif [ "$BRANCH" = "dev" ]; then
  log "Deploying hooks to DEV..."
  for f in pb_hooks/*.js; do
    cp "$f" "$DEV_HOOKS/"
  done
  chown ubuntu:ubuntu "$DEV_HOOKS"/*.js
  systemctl restart pocketbase-kscw-dev
  log "DEV deploy complete."
fi

log "Done."
