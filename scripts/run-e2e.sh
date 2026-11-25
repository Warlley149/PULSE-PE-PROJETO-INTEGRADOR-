#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:0}"

echo ">>> Liberando porta 3000 caso esteja em uso..."
fuser -k 3000/tcp 2>/dev/null || true

echo ">>> Compilando aplicacao Next.js (npm run build)..."
npm run build

echo ">>> Iniciando servidor Next.js em modo producao na porta 3000..."
npx next start -p 3000 >/tmp/pulse_next_prod.log 2>&1 &
SERVER_PID=$!

cleanup() {
  echo ">>> Encerrando servidor Next.js (PID $SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo ">>> Aguardando servidor ficar disponivel em http://localhost:3000..."
for i in $(seq 1 40); do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo ">>> Servidor online!"
    break
  fi
  sleep 1
done

echo ">>> Executando suite automatizada Cypress E2E..."
npx cypress run
