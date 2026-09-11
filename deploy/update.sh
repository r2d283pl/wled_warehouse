#!/usr/bin/env bash
#
# Aktualizacja istniejącej instalacji WLED Warehouse z nowej paczki.
#
#   sudo ./update.sh                      # aktualizuje instalację wskazaną w pytaniu
#   sudo ./update.sh --app-dir /opt/wled_warehouse
#
# Zachowuje .env oraz dane (baza NIE jest podmieniana danymi z paczki).
# Przed podmianą plików robi automatyczną kopię bazy.

set -euo pipefail
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --app-dir) APP_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Nieznany argument: $1" >&2; exit 1 ;;
  esac
done

C_OK=$'\033[1;32m'; C_H=$'\033[1;36m'; C_ERR=$'\033[1;31m'; C_0=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$C_H" "$1" "$C_0"; }
ok()   { printf '    %s✔%s %s\n' "$C_OK" "$C_0" "$1"; }
die()  { printf '\n%sBŁĄD:%s %s\n' "$C_ERR" "$C_0" "$1" >&2; exit 1; }

# docker compose musi startować z katalogu projektu — inaczej COMPOSE_FILE z .env
# (nakładka dostępowa docker-compose.access.yml) zostanie zignorowany.
dc() { ( cd "$APP_DIR" && docker compose "$@" ); }

[ -f "$PKG_DIR/VERSION" ] || die "Uruchom ten skrypt z katalogu nowej paczki."
IMAGE="$(sed -n 's/^IMAGE=//p' "$PKG_DIR/VERSION")"

if [ -z "$APP_DIR" ]; then
  read -r -p "Katalog istniejącej instalacji [/opt/wled_warehouse]: " APP_DIR </dev/tty || true
  APP_DIR="${APP_DIR:-/opt/wled_warehouse}"
fi
[ -f "$APP_DIR/.env" ] || die "$APP_DIR nie wygląda na instalację WLED Warehouse (brak .env). Użyj install.sh."

step "Kopia zapasowa danych przed aktualizacją"
"$APP_DIR/deploy/backup.sh" --app-dir "$APP_DIR" || die "Kopia zapasowa nie powiodła się — przerywam."

step "Wczytuję nowy obraz"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  ok "Obraz $IMAGE już wczytany"
else
  gunzip -c "$PKG_DIR/images/wled-warehouse.tar.gz" | docker load
  ok "Wczytano $IMAGE"
fi

step "Zatrzymuję aplikację"
dc down
ok "Zatrzymano"

step "Podmieniam pliki aplikacji (bez .env i bez danych)"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude '.env' "$PKG_DIR/app/" "$APP_DIR/"
else
  ( cd "$PKG_DIR/app" && tar -cf - --exclude='./.env' . ) | ( cd "$APP_DIR" && tar -xf - )
fi
chmod +x "$APP_DIR/deploy/"*.sh 2>/dev/null || true
ok "Kod zaktualizowany"

# przestaw .env na nowy obraz
if grep -q '^[[:space:]]*APP_IMAGE=' "$APP_DIR/.env"; then
  tmp="$(mktemp)"; awk -v v="$IMAGE" '/^[[:space:]]*APP_IMAGE=/ && !d {print "APP_IMAGE="v; d=1; next} {print}' "$APP_DIR/.env" > "$tmp"
  cat "$tmp" > "$APP_DIR/.env"; rm -f "$tmp"
else
  printf 'APP_IMAGE=%s\n' "$IMAGE" >> "$APP_DIR/.env"
fi
ok "APP_IMAGE=$IMAGE"

# repozytorium git: zapisz stan sprzed podmiany, żeby zmiany były prześledzalne
if command -v git >/dev/null 2>&1 && [ -d "$APP_DIR/.git" ]; then
  if [ -n "$(git -C "$APP_DIR" status --porcelain)" ]; then
    step "Git: zapisuję stan wdrożenia"
    git -C "$APP_DIR" add -A
    git -C "$APP_DIR" commit -q -m "Wdrożenie paczki $(sed -n 's/^PACKAGE=//p' "$PKG_DIR/VERSION")" || true
    ok "Commit: $(git -C "$APP_DIR" rev-parse --short HEAD)"
  else
    ok "Git: brak zmian względem HEAD"
  fi
fi

step "Uruchamiam"
dc up -d

CONTAINER_NAME="$(sed -n 's/^[[:space:]]*CONTAINER_NAME=//p' "$APP_DIR/.env" | tail -1)"; CONTAINER_NAME="${CONTAINER_NAME:-wled_warehouse}"
APP_PORT="$(sed -n 's/^[[:space:]]*PORT=//p' "$APP_DIR/.env" | tail -1)"; APP_PORT="${APP_PORT:-3000}"
printf '    czekam na /api/health'
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" wget -qO- "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    echo; ok "Aktualizacja zakończona — aplikacja odpowiada"; exit 0
  fi
  printf '.'; sleep 2
done
echo
die "Aplikacja nie wstała. Logi: cd $APP_DIR && docker compose logs --tail 50"
