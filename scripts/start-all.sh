#!/bin/sh
# Run the web app and the background worker together (Replit / single-container hosts).
# Web: `next start` when a production build exists, else `next dev`. Worker: supervised restart loop.
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-3000}"
sh scripts/worker-forever.sh &
WORKER=$!
trap 'kill $WORKER 2>/dev/null' EXIT INT TERM
if [ -d .next ] && [ -f .next/BUILD_ID ] && [ "${FAVIE_DEV:-0}" != "1" ]; then
  npx next start -p "$PORT"
else
  npx next dev -p "$PORT"
fi
