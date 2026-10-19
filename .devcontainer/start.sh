#!/usr/bin/env bash
# Bei jedem Start des Codespace: Datenbank starten, dann API und Web-App im Hintergrund.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"

pnpm db:start
mkdir -p .data
if curl -sf http://127.0.0.1:3000/v1/health >/dev/null 2>&1; then
  echo "App läuft bereits."
  exit 0
fi
setsid nohup pnpm dev > .data/dev.log 2>&1 < /dev/null &
echo "App startet im Hintergrund: Web-App auf Port 5173, API auf Port 3000. Protokoll: .data/dev.log"
