#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-.env.test}"
LOCAL_RUN_DIR="/tmp/distritoolsjl-local"
BACKEND_LOG="$LOCAL_RUN_DIR/backend.log"
FRONTEND_LOG="$LOCAL_RUN_DIR/frontend.log"
BACKEND_PID_FILE="$LOCAL_RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$LOCAL_RUN_DIR/frontend.pid"

echo "==> Cargando variables de entorno"
. infra/scripts/load-env.sh "$ENV_FILE"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL no está definida después de cargar $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${REDIS_URL:-}" ]]; then
  echo "REDIS_URL no está definida después de cargar $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$LOCAL_RUN_DIR"

stop_pidfile() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pid_file"
  fi
}

kill_port() {
  local port="$1"

  if command -v docker >/dev/null 2>&1; then
    mapfile -t container_ids < <(
      docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' \
        | awk -v port="$port" '$0 ~ "distritoolsjl" && $0 ~ ":" port "->" { print $1 }'
    )
    if [[ "${#container_ids[@]}" -gt 0 ]]; then
      echo "==> Cerrando contenedores DistriTools JL que ocupan puerto $port: ${container_ids[*]}"
      docker stop "${container_ids[@]}" >/dev/null
      sleep 1
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    mapfile -t pids < <(lsof -ti tcp:"$port" || true)
    if [[ "${#pids[@]}" -gt 0 ]]; then
      kill "${pids[@]}" 2>/dev/null || true
      sleep 1
      return 0
    fi
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    sleep 1
    return 0
  fi

  mapfile -t pids < <(ss -lntp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)
  if [[ "${#pids[@]}" -gt 0 ]]; then
    kill "${pids[@]}" 2>/dev/null || true
    sleep 1
  fi
}

wait_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-60}"
  local sleep_seconds="${4:-2}"

  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "==> $label listo"
      return 0
    fi
    echo "Esperando $label (${i}/${attempts})..."
    sleep "$sleep_seconds"
  done

  echo "$label no respondió en $url" >&2
  return 1
}

echo "==> Levantando Postgres y Redis"
docker compose -f docker-compose.test.yml up -d postgres redis

echo "==> Esperando Postgres"
bash infra/scripts/wait-for-postgres.sh

echo "==> Generando Prisma y aplicando migraciones"
npm run prisma:generate
npm run prisma:migrate:deploy
NODE_PATH=. node --import tsx scripts/seed-test-data.ts

echo "==> Compilando backend"
npm run build

echo "==> Compilando frontend"
(
  cd frontend
  APP_ENV="${APP_ENV:-local}" ADMIN_AUTH_DISABLED="${ADMIN_AUTH_DISABLED:-true}" npm run build
)

echo "==> Reiniciando procesos locales previos"
stop_pidfile "$BACKEND_PID_FILE"
stop_pidfile "$FRONTEND_PID_FILE"
kill_port 3000
kill_port 3001

echo "==> Arrancando backend en 3000"
setsid env \
  PORT=3000 \
  APP_BASE_URL=http://127.0.0.1:3000 \
  DATABASE_URL="$DATABASE_URL" \
  REDIS_URL="$REDIS_URL" \
  PAYMENT_GATEWAY_SECRET="${PAYMENT_GATEWAY_SECRET:-test-payment-secret}" \
  JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-test-access-secret}" \
  JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-test-refresh-secret}" \
  JWT_2FA_CHALLENGE_SECRET="${JWT_2FA_CHALLENGE_SECRET:-test-2fa-challenge-secret}" \
  APP_ENV="${APP_ENV:-local}" \
  ADMIN_AUTH_DISABLED="${ADMIN_AUTH_DISABLED:-true}" \
  SHIPPING_PROVIDER="${SHIPPING_PROVIDER:-internal}" \
  NINETY_NINE_ENVIOS_API_BASE_URL="${NINETY_NINE_ENVIOS_API_BASE_URL:-}" \
  NINETY_NINE_ENVIOS_API_KEY="${NINETY_NINE_ENVIOS_API_KEY:-}" \
  NINETY_NINE_ENVIOS_CLIENT_ID="${NINETY_NINE_ENVIOS_CLIENT_ID:-}" \
  NINETY_NINE_ENVIOS_CLIENT_SECRET="${NINETY_NINE_ENVIOS_CLIENT_SECRET:-}" \
  NINETY_NINE_ENVIOS_ENV="${NINETY_NINE_ENVIOS_ENV:-sandbox}" \
  NINETY_NINE_ENVIOS_WEBHOOK_SECRET="${NINETY_NINE_ENVIOS_WEBHOOK_SECRET:-}" \
  NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_CITY="${NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_CITY:-}" \
  NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DEPARTMENT="${NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DEPARTMENT:-}" \
  NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_ADDRESS="${NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_ADDRESS:-}" \
  NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_PHONE="${NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_PHONE:-}" \
  NINETY_NINE_ENVIOS_DEFAULT_DECLARED_VALUE_MODE="${NINETY_NINE_ENVIOS_DEFAULT_DECLARED_VALUE_MODE:-order_total}" \
  NINETY_NINE_ENVIOS_ENABLE_COD="${NINETY_NINE_ENVIOS_ENABLE_COD:-false}" \
  NODE_PATH=dist \
  node dist/src/main.js >"$BACKEND_LOG" 2>&1 < /dev/null &
echo $! > "$BACKEND_PID_FILE"
wait_http "http://127.0.0.1:3000/api/v1/health" "backend"

echo "==> Arrancando frontend en 3001"
(
  cd "$ROOT_DIR/frontend"
  setsid env \
    NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000 \
    NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 \
    APP_ENV="${APP_ENV:-local}" \
    ADMIN_AUTH_DISABLED="${ADMIN_AUTH_DISABLED:-true}" \
    ./node_modules/.bin/next start --port 3001 >"$FRONTEND_LOG" 2>&1 < /dev/null &
  echo $! > "$FRONTEND_PID_FILE"
)
wait_http "http://127.0.0.1:3001/" "frontend"

echo
echo "==> Stack local listo"
echo "Backend:  http://127.0.0.1:3000/api/v1/health"
echo "Frontend: http://127.0.0.1:3001/"
echo
echo "==> Logs"
echo "Backend log:  $BACKEND_LOG"
echo "Frontend log: $FRONTEND_LOG"
echo
echo "==> PIDs"
echo "Backend PID:  $(cat "$BACKEND_PID_FILE")"
echo "Frontend PID: $(cat "$FRONTEND_PID_FILE")"
