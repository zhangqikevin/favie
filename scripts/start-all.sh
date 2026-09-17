#!/bin/sh
# Run the web app and the background worker together (Replit / single-container hosts).
# Deployments (Replit sets REPL_DEPLOYMENT=1) and any host with a production build run `next start`;
# the workspace Run button (FAVIE_DEV=1) runs `next dev`. The worker runs under a restart loop.
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-3000}"
sh scripts/worker-forever.sh &
WORKER=$!
trap 'kill $WORKER 2>/dev/null' EXIT INT TERM
# Is this a Replit DEPLOYMENT (not the workspace Run button)? Replit sets REPLIT_DEPLOYMENT=1 there; the
# workspace has REPLIT_DEV_DOMAIN, a deployment does not. `.replit`'s [env] FAVIE_DEV=1 leaks into
# deployments too, so it must never win over these — production ran `next dev` for days because of it
# (every first click on a route compiled it: 4–8 s).
DEPLOY=0
if [ "${REPLIT_DEPLOYMENT:-}" = "1" ] || [ "${REPL_DEPLOYMENT:-}" = "1" ]; then DEPLOY=1; fi
if [ -n "${REPL_ID:-}" ] && [ -z "${REPLIT_DEV_DOMAIN:-}" ]; then DEPLOY=1; fi
if [ "$DEPLOY" = "1" ]; then
  echo "[start-all] deployment: next start (production build)"
  [ -f .next/BUILD_ID ] || npx next build
  exec npx next start -p "$PORT"
elif [ -f .next/BUILD_ID ] && [ "${FAVIE_DEV:-0}" != "1" ]; then
  echo "[start-all] next start (existing production build)"
  exec npx next start -p "$PORT"
else
  echo "[start-all] next dev"
  exec npx next dev -p "$PORT"
fi
