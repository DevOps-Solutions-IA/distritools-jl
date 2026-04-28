#!/usr/bin/env bash
set -euo pipefail

ATTEMPTS="${ATTEMPTS:-60}"
SLEEP_SECONDS="${SLEEP_SECONDS:-2}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for wait-for-postgres.sh" >&2
  exit 1
fi

for ((i=1; i<=ATTEMPTS; i++)); do
  if node - <<'NODE'
const net = require('node:net');
const url = new URL(process.env.DATABASE_URL);
const socket = net.createConnection({
  host: url.hostname,
  port: Number(url.port || 5432),
});
socket.once('connect', () => {
  console.log('postgres-ready');
  socket.end();
});
socket.once('error', () => {
  process.exit(1);
});
NODE
  then
    exit 0
  fi

  echo "Waiting for PostgreSQL (${i}/${ATTEMPTS})..."
  sleep "$SLEEP_SECONDS"
done

echo "PostgreSQL is not reachable" >&2
exit 1
