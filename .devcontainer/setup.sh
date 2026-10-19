#!/usr/bin/env bash
# Einmalig beim Anlegen des Codespace: Abhängigkeiten, Datenbank, Demo-Mandant.
set -euo pipefail
cd "$(dirname "$0")/.."

# pnpm kommt über corepack (im Image aktiviert); Rückfall für andere Umgebungen.
if ! command -v pnpm >/dev/null 2>&1; then
  mkdir -p "$HOME/.local/bin"
  corepack enable pnpm --install-directory "$HOME/.local/bin"
  export PATH="$HOME/.local/bin:$PATH"
fi

pnpm install --frozen-lockfile
[ -f .env ] || cp .env.example .env
pnpm db:start
pnpm db:seed
echo "Einrichtung fertig. Die App startet automatisch auf Port 5173."
