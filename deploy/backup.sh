#!/usr/bin/env bash
#
# Kopia zapasowa danych WLED Warehouse (baza + .env) do jednego archiwum.
#
#   ./backup.sh                          # do <katalog aplikacji>/backups/
#   ./backup.sh --out /mnt/nas/wled      # do wskazanego katalogu
#
# Baza kopiowana jest przez API backupu SQLite (spójna kopia mimo działającej
# aplikacji i pliku WAL). Archiwum ma uprawnienia 600 — zawiera sekrety z .env.

set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --app-dir) APP_DIR="$(cd "$2" && pwd)"; shift 2 ;;
    --out)     OUT_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Nieznany argument: $1" >&2; exit 1 ;;
  esac
done

OUT_DIR="${OUT_DIR:-$APP_DIR/backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT

ENV_FILE="$APP_DIR/.env"
[ -f "$ENV_FILE" ] || { echo "BŁĄD: brak $ENV_FILE" >&2; exit 1; }
CONTAINER_NAME="$(sed -n 's/^[[:space:]]*CONTAINER_NAME=//p' "$ENV_FILE" | tail -1)"; CONTAINER_NAME="${CONTAINER_NAME:-wled_warehouse}"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker exec "$CONTAINER_NAME" node -e '
    const Database = require("better-sqlite3");
    const src = process.env.DB_PATH || "/app/data/wled_warehouse.db";
    new Database(src, { readonly: true }).backup("/app/data/_backup.db")
      .then(() => process.exit(0))
      .catch(e => { console.error(e.message); process.exit(1); });
  '
  docker cp "$CONTAINER_NAME:/app/data/_backup.db" "$WORK/wled_warehouse.db"
  docker exec "$CONTAINER_NAME" rm -f /app/data/_backup.db
else
  # kontener nie działa — kopiujemy pliki bazy wprost z wolumenu
  ( cd "$APP_DIR" && docker compose create >/dev/null )
  VOL="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$CONTAINER_NAME")"
  [ -n "$VOL" ] || { echo "BŁĄD: nie ustalono wolumenu danych" >&2; exit 1; }
  IMAGE="$(sed -n 's/^[[:space:]]*APP_IMAGE=//p' "$ENV_FILE" | tail -1)"; IMAGE="${IMAGE:-alpine}"
  docker run --rm -v "$VOL:/d" -v "$WORK:/out" "$IMAGE" \
    sh -c 'cp /d/wled_warehouse.db /out/ 2>/dev/null || true'
  [ -f "$WORK/wled_warehouse.db" ] || { echo "BŁĄD: nie znaleziono bazy w wolumenie $VOL" >&2; exit 1; }
fi

cp "$ENV_FILE" "$WORK/env.backup"
[ -f "$APP_DIR/VERSION" ] && cp "$APP_DIR/VERSION" "$WORK/VERSION"

ARCHIVE="$OUT_DIR/wled-warehouse-backup-${STAMP}.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK" .
chmod 600 "$ARCHIVE"
echo "Kopia zapasowa: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
