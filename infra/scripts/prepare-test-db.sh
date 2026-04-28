#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source infra/scripts/load-env.sh .env.test

docker compose -f docker-compose.test.yml down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -f docker-compose.test.yml up -d
bash infra/scripts/wait-for-postgres.sh

for ((i=1; i<=60; i++)); do
  if node - <<'NODE'
const net = require('node:net');
const url = new URL(process.env.REDIS_URL);
const socket = net.createConnection({
  host: url.hostname,
  port: Number(url.port || 6379),
});
socket.once('connect', () => {
  console.log('redis-ready');
  socket.end();
});
socket.once('error', () => process.exit(1));
NODE
  then
    break
  fi

  if [[ "$i" == "60" ]]; then
    echo "Redis is not reachable" >&2
    exit 1
  fi

  echo "Waiting for Redis (${i}/60)..."
  sleep 2
done

npm run prisma:generate
npm run prisma:migrate:deploy
NODE_PATH=. node --import tsx scripts/seed-test-data.ts

echo "Test database prepared"
