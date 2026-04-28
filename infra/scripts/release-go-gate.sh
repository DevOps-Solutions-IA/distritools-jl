#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${LOG_DIR:-/tmp/distritoolsjl-go-gate}"
mkdir -p "$LOG_DIR"

bash infra/scripts/prepare-test-db.sh | tee "$LOG_DIR/prepare-test-db.log"
source infra/scripts/load-env.sh .env.test

npm run build | tee "$LOG_DIR/build.log"

APP_LOG="$LOG_DIR/app.log"
export PORT="${GATE_PORT:-33100}"
export APP_BASE_URL="http://127.0.0.1:${PORT}"

NODE_PATH=dist node dist/src/main.js >"$APP_LOG" 2>&1 &
APP_PID=$!

cleanup() {
  if ps -p "$APP_PID" >/dev/null 2>&1; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for ((i=1; i<=60; i++)); do
  if curl -sS "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null; then
    break
  fi

  if [[ "$i" == "60" ]]; then
    echo "Application health endpoint did not become ready" >&2
    exit 1
  fi

  sleep 2
done

curl -sS "http://127.0.0.1:${PORT}/api/v1/health" | tee "$LOG_DIR/health.json"
curl -sS "http://127.0.0.1:${PORT}/api/v1/ready" | tee "$LOG_DIR/ready.json"
curl -sS "http://127.0.0.1:${PORT}/api/v1/metrics" | tee "$LOG_DIR/metrics-before.json"

NODE_PATH=. node --import tsx --test --test-force-exit tests/unit/*.test.ts | tee "$LOG_DIR/unit-tests.log"
NODE_PATH=. node --import tsx --test --test-force-exit tests/critical/auth-rbac.e2e.test.ts | tee "$LOG_DIR/auth-rbac.log"
NODE_PATH=. node --import tsx --test --test-force-exit tests/critical/inventory-orders-payments.e2e.test.ts | tee "$LOG_DIR/inventory-orders-payments.log"
STRESS_ORDER_REQUESTS=60 \
STRESS_WEBHOOK_DUPLICATES=30 \
STRESS_READ_REQUESTS=250 \
STRESS_MIXED_REQUESTS=40 \
NODE_PATH=. node --import tsx --test --test-force-exit tests/critical/concurrency-stress.e2e.test.ts | tee "$LOG_DIR/concurrency-stress.log"
NODE_PATH=. node --import tsx --test --test-force-exit tests/critical/platform-closure.e2e.test.ts | tee "$LOG_DIR/platform-closure.log"
NODE_PATH=. node --import tsx --test --test-force-exit tests/critical/catalog.e2e.test.ts | tee "$LOG_DIR/catalog.log"

curl -sS "http://127.0.0.1:${PORT}/api/v1/metrics" | tee "$LOG_DIR/metrics-after.json"

echo "GO gate completed successfully"
