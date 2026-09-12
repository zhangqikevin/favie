#!/bin/sh
# Supervisor for the pg-boss worker: restarts it whenever it exits (crash, or the self-exit in
# src/worker/index.ts when the database pool is unusable). Usage: npm run worker:forever
cd "$(dirname "$0")/.." || exit 1
while :; do
  echo "[worker-forever] starting worker $(date -u +%FT%TZ)"
  npx tsx src/worker/index.ts
  code=$?
  echo "[worker-forever] worker exited with $code; restarting in 3s"
  sleep 3
done
