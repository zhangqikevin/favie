#!/bin/sh
# Run the web app and the background worker together (Replit / single-container hosts).
# Deployments (Replit sets REPL_DEPLOYMENT=1) and any host with a production build run `next start`;
# the workspace Run button (FAVIE_DEV=1) runs `next dev`. The worker runs under a restart loop.
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-3000}"
sh scripts/worker-forever.sh &
WORKER=$!
trap 'kill $WORKER 2>/dev/null' EXIT INT TERM
if [ "${REPL_DEPLOYMENT:-}" = "1" ]; then
  [ -f .next/BUILD_ID ] || npx next build
  exec npx next start -p "$PORT"
elif [ -f .next/BUILD_ID ] && [ "${FAVIE_DEV:-0}" != "1" ]; then
  exec npx next start -p "$PORT"
else
  exec npx next dev -p "$PORT"
fi
