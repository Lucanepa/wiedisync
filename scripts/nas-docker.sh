#!/bin/bash
# Wrapper for running docker commands on the Synology NAS via SSH.
# Uses nas-ts host alias (Tailscale) with SSH multiplexing.
#
# Usage:
#   ./scripts/nas-docker.sh ps                          # docker ps
#   ./scripts/nas-docker.sh logs pocketbase-kscw -20    # tail 20 lines
#   ./scripts/nas-docker.sh restart pocketbase-kscw     # restart container
#   ./scripts/nas-docker.sh deploy hook.pb.js           # deploy a hook file
#   ./scripts/nas-docker.sh exec pocketbase-kscw CMD    # exec into container

set -euo pipefail

NAS_HOST="nas-ts"
SUDO_PASS="***REDACTED***"
DOCKER="/usr/local/bin/docker"
PB_HOOKS="/volume1/docker/pocketbase-dev/pb_hooks"
CONTAINER="pocketbase-kscw"

run_docker() {
  ssh "$NAS_HOST" "echo '$SUDO_PASS' | sudo -S $DOCKER $* 2>&1" | grep -v '^\[sudo\]'
}

case "${1:-help}" in
  ps)
    run_docker ps --format "'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
    ;;
  logs)
    TAIL="${3:--30}"
    run_docker logs "${2:-$CONTAINER}" --tail "${TAIL#-}" 2>&1
    ;;
  restart)
    run_docker restart "${2:-$CONTAINER}"
    echo "Restarted ${2:-$CONTAINER}"
    ;;
  deploy)
    shift
    for FILE in "$@"; do
      BASENAME=$(basename "$FILE")
      echo "Deploying $BASENAME..."
      ssh "$NAS_HOST" "cat > /tmp/$BASENAME" < "$FILE"
      ssh "$NAS_HOST" "echo '$SUDO_PASS' | sudo -S cp /tmp/$BASENAME $PB_HOOKS/$BASENAME"
    done
    run_docker restart "$CONTAINER"
    echo "Deployed and restarted $CONTAINER"
    ;;
  exec)
    shift
    run_docker exec "$@"
    ;;
  hook-ls)
    ssh "$NAS_HOST" "ls -la $PB_HOOKS/"
    ;;
  hook-cat)
    ssh "$NAS_HOST" "cat $PB_HOOKS/${2:?Usage: hook-cat <filename>}"
    ;;
  help|*)
    echo "Usage: nas-docker.sh <command>"
    echo ""
    echo "Commands:"
    echo "  ps                        List all containers"
    echo "  logs [container] [-N]     Show logs (default: pocketbase-kscw, 30 lines)"
    echo "  restart [container]       Restart container (default: pocketbase-kscw)"
    echo "  deploy <file> [file...]   Deploy hook files and restart PB"
    echo "  exec <container> <cmd>    Execute command in container"
    echo "  hook-ls                   List hook files on NAS"
    echo "  hook-cat <filename>       Read a hook file from NAS"
    ;;
esac
