#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/whatsapp-ai-app"
BRIDGE_DIR="$ROOT_DIR/whatsapp-bridge"

APP_PORT="${APP_PORT:-8080}"
BRIDGE_PORT="${BRIDGE_PORT:-8081}"

APP_LOG="${APP_LOG:-/tmp/whatsapp-ai-app-test.log}"
BRIDGE_LOG="${BRIDGE_LOG:-/tmp/whatsapp-bridge-test.log}"

CONFIG_JSON="$APP_DIR/src/data/config.json"
CONVERSATIONS_JSON="$APP_DIR/src/data/conversations.json"

CONFIG_BAK="$(mktemp)"
CONV_BAK="$(mktemp)"

cp "$CONFIG_JSON" "$CONFIG_BAK"
cp "$CONVERSATIONS_JSON" "$CONV_BAK"

APP_PID=""
BRIDGE_PID=""

cleanup() {
  set +e
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" >/dev/null 2>&1; then kill "$APP_PID"; fi
  if [[ -n "$BRIDGE_PID" ]] && kill -0 "$BRIDGE_PID" >/dev/null 2>&1; then kill "$BRIDGE_PID"; fi
  cp "$CONFIG_BAK" "$CONFIG_JSON"
  cp "$CONV_BAK" "$CONVERSATIONS_JSON"
  rm -f "$CONFIG_BAK" "$CONV_BAK"
}
trap cleanup EXIT

require_ok() {
  local label="$1"
  local json="$2"
  JSON_PAYLOAD="$json" node -e '
const label = process.argv[1];
const payload = process.env.JSON_PAYLOAD;
try {
  JSON.parse(payload);
  console.log(`✔ ${label}`);
} catch {
  console.error(`✘ ${label} -> invalid JSON`);
  process.exit(1);
}
' "$label"
}

expect_field() {
  local label="$1"
  local json="$2"
  local expression="$3"
  JSON_PAYLOAD="$json" node -e '
const [label, expression] = process.argv.slice(1);
const obj = JSON.parse(process.env.JSON_PAYLOAD);
const result = Function("obj", `return (${expression});`)(obj);
if (!result) {
  console.error(`✘ ${label}`);
  process.exit(1);
}
console.log(`✔ ${label}`);
' "$label" "$expression"
}

start_services() {
  node "$BRIDGE_DIR/src/server.mjs" >"$BRIDGE_LOG" 2>&1 &
  BRIDGE_PID=$!

  node "$APP_DIR/src/server.mjs" >"$APP_LOG" 2>&1 &
  APP_PID=$!

  sleep 1
}

echo "[1/6] Iniciando serviços"
start_services

echo "[2/6] Healthchecks"
bridge_health=$(curl -fsS "http://127.0.0.1:$BRIDGE_PORT/health")
app_health=$(curl -fsS "http://127.0.0.1:$APP_PORT/api/health")
require_ok "bridge /health retorna JSON" "$bridge_health"
require_ok "app /api/health retorna JSON" "$app_health"
expect_field "bridge health ok=true" "$bridge_health" "obj.ok === true"
expect_field "app health ok=true" "$app_health" "obj.ok === true"

echo "[3/6] Fluxo mock com handoff"
inbound=$(curl -fsS -X POST "http://127.0.0.1:$APP_PORT/api/inbound/whatsapp" -H 'content-type: application/json' -d '{"conversationId":"e2e-mock-1","type":"text","text":"quero um humano"}')
conversation=$(curl -fsS "http://127.0.0.1:$APP_PORT/api/conversations/e2e-mock-1")
require_ok "inbound mock retorna JSON" "$inbound"
require_ok "conversa mock retorna JSON" "$conversation"
expect_field "inbound marcou handoff" "$inbound" "obj.reason === 'handoff'"
expect_field "conversa status human_required" "$conversation" "obj.status === 'human_required'"

echo "[4/6] Alternando para modo external"
config_update=$(curl -fsS -X POST "http://127.0.0.1:$APP_PORT/api/config" -H 'content-type: application/json' -d "{\"bridgeMode\":\"external\",\"bridgeBaseUrl\":\"http://127.0.0.1:$BRIDGE_PORT\",\"sessionId\":\"main\"}")
require_ok "config update retorna JSON" "$config_update"
expect_field "config bridgeMode external" "$config_update" "obj.bridgeMode === 'external'"

echo "[5/6] Conectar e confirmar scan via app"
connect=$(curl -fsS -X POST "http://127.0.0.1:$APP_PORT/api/whatsapp/connect")
confirm=$(curl -fsS -X POST "http://127.0.0.1:$APP_PORT/api/whatsapp/confirm-scan")
status=$(curl -fsS "http://127.0.0.1:$APP_PORT/api/status")
require_ok "connect retorna JSON" "$connect"
require_ok "confirm retorna JSON" "$confirm"
require_ok "status retorna JSON" "$status"
expect_field "connect awaiting_scan" "$connect" "obj.status === 'awaiting_scan'"
expect_field "confirm connected" "$confirm" "obj.status === 'connected'"
expect_field "status modo external" "$status" "obj.mode === 'external' && obj.whatsapp.status === 'connected'"

echo "[6/6] Envio manual"
manual_send=$(curl -fsS -X POST "http://127.0.0.1:$APP_PORT/api/messages/send" -H 'content-type: application/json' -d '{"to":"e2e-external-1","text":"teste manual"}')
require_ok "manual send retorna JSON" "$manual_send"
expect_field "manual send ok" "$manual_send" "obj.ok === true"

echo "\nTodos os testes E2E básicos passaram."
