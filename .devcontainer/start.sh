#!/usr/bin/env bash
# Bei jedem Start des Codespace: Datenbank starten, dann API und Web-App im Hintergrund.
# Auch manuell aufrufbar: bash .devcontainer/start.sh
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
mkdir -p .data
log=.data/dev.log

# Antwortet die API über die Web-App, laufen beide bereits.
if curl -sf http://127.0.0.1:5173/v1/health >/dev/null 2>&1; then
  echo "App läuft bereits."
  exit 0
fi

{
  echo "== $(date -Is) Start"
  pnpm db:start || echo "!! Datenbank konnte nicht gestartet werden (siehe oben)."
} > "$log" 2>&1

setsid nohup pnpm dev >> "$log" 2>&1 < /dev/null &

# Warten, bis API und Web-App antworten, damit Fehler direkt im Startprotokoll stehen.
for _ in $(seq 90); do
  if curl -sf http://127.0.0.1:5173/v1/health >/dev/null 2>&1; then
    echo "App läuft: Web-App auf Port 5173, API auf Port 3000. Protokoll: $log"
    exit 0
  fi
  sleep 1
done
echo "!! App antwortet nach 90 Sekunden noch nicht. Letzte Zeilen aus $log:"
tail -n 40 "$log"
exit 1
