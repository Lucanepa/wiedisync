#!/bin/bash
# Deploy PocketBase hooks to Synology NAS and restart the container.
# Usage: ./scripts/deploy-hooks.sh

set -euo pipefail

NAS="nas-ts"
HOOKS_PATH="/volume1/docker/pocketbase-dev/pb_hooks/"
CONTAINER="pocketbase-kscw"
SUDO_PASS="***REDACTED***"

echo "Deploying pb_hooks to Synology (via $NAS)..."
for f in pb_hooks/*; do
  BASENAME=$(basename "$f")
  echo "  $BASENAME"
  ssh "$NAS" "cat > /tmp/$BASENAME" < "$f"
  ssh "$NAS" "echo '$SUDO_PASS' | sudo -S cp /tmp/$BASENAME $HOOKS_PATH$BASENAME"
done

echo "Restarting $CONTAINER..."
ssh "$NAS" "echo '$SUDO_PASS' | sudo -S /usr/local/bin/docker restart $CONTAINER"

echo "Done. Hooks deployed and $CONTAINER restarted."
