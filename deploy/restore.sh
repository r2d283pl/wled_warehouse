#!/usr/bin/env bash
#
# Odtworzenie danych WLED Warehouse z archiwum utworzonego przez backup.sh.
#
#   sudo ./restore.sh /opt/wled_warehouse/backups/wled-warehouse-backup-20260911-101500.tar.gz
#
# Podmienia bazę w wolumenie. Plik .env NIE jest odtwarzany automatycznie
# (leży w archiwum jako env.backup — skopiuj ręcznie, jeśli trzeba).

set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="${1:-}"

[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || { sed -n '2,9p' "$0"; exit 1; }
ARCHIVE="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"
[ -f "$APP_DIR/.env" ] || { echo "BŁĄD: brak $APP_DIR/.env" >&2; exit 1; }

CONTAINER_NAME="$(sed -n 's/^[[:space:]]*CONTAINER_NAME=//p' "$APP_DIR/.env" | tail -1)"; CONTAINER_NAME="${CONTAINER_NAME:-wled_warehouse}"
IMAGE="$(sed -n 's/^[[:space:]]*APP_IMAGE=//p' "$APP_DIR/.env" | tail -1)"; IMAGE="${IMAGE:-alpine}"

WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
tar -xzf "$ARCHIVE" -C "$WORK"
[ -f "$WORK/wled_warehouse.db" ] || { echo "BŁĄD: archiwum nie zawiera wled_warehouse.db" >&2; exit 1; }

read -r -p "Podmienić bazę danych z $ARCHIVE? Obecne dane zostaną zarchiwizowane. [t/N]: " a </dev/tty || true
[[ "${a:-n}" =~ ^[tTyY] ]] || { echo "Anulowano."; exit 0; }

echo "==> Zatrzymuję aplikację"
( cd "$APP_DIR" && docker compose down )

( cd "$APP_DIR" && docker compose create >/dev/null )
VOL="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$CONTAINER_NAME")"
[ -n "$VOL" ] || { echo "BŁĄD: nie ustalono wolumenu danych" >&2; exit 1; }

docker run --rm -v "$VOL:/d" -v "$WORK:/in:ro" "$IMAGE" sh -c '
  [ -f /d/wled_warehouse.db ] && cp /d/wled_warehouse.db "/d/wled_warehouse.db.bak-$(date +%Y%m%d-%H%M%S)"
  cp /in/wled_warehouse.db /d/wled_warehouse.db
  rm -f /d/wled_warehouse.db-wal /d/wled_warehouse.db-shm
'
echo "==> Odtworzono bazę w wolumenie $VOL"

( cd "$APP_DIR" && docker compose up -d )
echo "==> Aplikacja uruchomiona"
