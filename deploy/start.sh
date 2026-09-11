#!/bin/sh
# Start aplikacji wewnątrz kontenera. Obsługuje dwa tryby:
#
#  1) obraz produkcyjny (APP_IMAGE=wled-warehouse:...) — zależności są już w NODE_PATH,
#     start jest natychmiastowy i nie wymaga internetu,
#  2) goły node:20-alpine (tryb deweloperski, domyślny) — zależności dociągane
#     do /app/node_modules przez npm install.
set -e

if [ ! -d /app/node_modules ] && [ ! -d "${NODE_PATH:-/nonexistent}" ]; then
  echo "==> Brak zależności, uruchamiam npm install (wymaga internetu)..."
  npm install
fi

exec node backend/server.js
