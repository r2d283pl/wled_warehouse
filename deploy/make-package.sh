#!/usr/bin/env bash
#
# Buduje offline'ową paczkę wdrożeniową WLED Warehouse.
# Uruchamiaj NA MASZYNIE DEWELOPERSKIEJ (ta z internetem i Dockerem):
#
#   ./deploy/make-package.sh                 # z bieżącymi danymi (baza z działającego kontenera)
#   ./deploy/make-package.sh --no-data       # bez danych (czysta instalacja na serwerze)
#   ./deploy/make-package.sh --skip-frontend # bez przebudowy frontendu (użyje frontend/dist)
#   ./deploy/make-package.sh --allow-dirty   # mimo niescommitowanych zmian w repo
#
# Wynik: dist/wled-warehouse-<wersja>.tar.gz (+ .sha256)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

WITH_DATA=1
SKIP_FRONTEND=0
ALLOW_DIRTY=0
for arg in "$@"; do
  case "$arg" in
    --no-data)       WITH_DATA=0 ;;
    --skip-frontend) SKIP_FRONTEND=1 ;;
    --allow-dirty)   ALLOW_DIRTY=1 ;;
    -h|--help)       sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Nieznany argument: $arg" >&2; exit 1 ;;
  esac
done

APP_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo 1.0.0)"
STAMP="$(date +%Y%m%d)"
VERSION="${APP_VERSION}-${STAMP}"
IMAGE="wled-warehouse:${VERSION}"
PKG_NAME="wled-warehouse-${VERSION}"
STAGE="$(mktemp -d)"/"$PKG_NAME"
SRC_CONTAINER="${CONTAINER_NAME:-wled_warehouse}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
trap 'rm -rf "$(dirname "$STAGE")"' EXIT

mkdir -p "$STAGE"/{app,images,data,git}

# --- 1. Frontend -------------------------------------------------------------
if [ "$SKIP_FRONTEND" -eq 1 ]; then
  step "Pomijam build frontendu (--skip-frontend)"
  [ -f frontend/dist/index.html ] || { echo "BŁĄD: brak frontend/dist — zbuduj frontend." >&2; exit 1; }
else
  step "Buduję frontend (vite)"
  ( cd frontend && [ -d node_modules ] || npm install )
  ( cd frontend && npm run build )
fi

# --- 2. Obraz Dockera z prebudowanymi zależnościami --------------------------
step "Buduję obraz $IMAGE (zależności pod musl/Alpine)"
docker build -f deploy/Dockerfile -t "$IMAGE" -t wled-warehouse:latest .

step "Eksportuję obraz do pliku (docker save + gzip)"
docker save "$IMAGE" | gzip -1 > "$STAGE/images/wled-warehouse.tar.gz"

# --- 3. Kod aplikacji --------------------------------------------------------
step "Kopiuję kod aplikacji"
rsync -a \
  --exclude '.git/' \
  --exclude '.claude/settings.local.json' --exclude '.claude/*.local.json' \
  --exclude 'node_modules/' --exclude 'frontend/node_modules/' \
  --exclude '.env' --exclude '*.local' \
  --exclude 'data/' --exclude '*.db' --exclude '*.db-shm' --exclude '*.db-wal' \
  --exclude '/dist/' --exclude '/backups/' --exclude '*.log' \
  ./ "$STAGE/app/"
mkdir -p "$STAGE/app/data"

# --- 3b. Repozytorium git ----------------------------------------------------
if git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  step "Pakuję repozytorium git (pełna historia jako bundle)"
  if [ -n "$(git -C "$REPO_DIR" status --porcelain)" ]; then
    echo "UWAGA: w repozytorium są niescommitowane zmiany." >&2
    echo "       Pliki w paczce będą je zawierać, ale historia w bundlu — nie." >&2
    if [ "$ALLOW_DIRTY" -eq 0 ]; then
      if [ -t 0 ]; then
        read -r -p "Kontynuować mimo to? [t/N]: " _a </dev/tty || true
        [[ "${_a:-n}" =~ ^[tTyY] ]] || { echo "Przerwano. Zacommituj zmiany albo użyj --allow-dirty."; exit 1; }
      else
        echo "Przerwano (brak terminala). Zacommituj zmiany albo użyj --allow-dirty." >&2; exit 1
      fi
    fi
  fi
  git -C "$REPO_DIR" bundle create "$STAGE/git/repo.bundle" --all HEAD 2>/dev/null
  GIT_ORIGIN="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || echo '')"
  echo "    historia: $(git -C "$REPO_DIR" rev-list --count HEAD) commitów, origin: ${GIT_ORIGIN:-brak}"
else
  echo "UWAGA: to nie jest repozytorium git — paczka bez historii." >&2
  rmdir "$STAGE/git" 2>/dev/null || true
  GIT_ORIGIN=""
fi

# --- 4. Zrzut bazy -----------------------------------------------------------
if [ "$WITH_DATA" -eq 1 ]; then
  if docker ps --format '{{.Names}}' | grep -qx "$SRC_CONTAINER"; then
    step "Zrzucam bazę z kontenera $SRC_CONTAINER (spójny backup, bez WAL)"
    docker exec "$SRC_CONTAINER" node -e '
      const Database = require("better-sqlite3");
      const src = process.env.DB_PATH || "/app/data/wled_warehouse.db";
      new Database(src, { readonly: true }).backup("/app/data/_pkg_export.db")
        .then(() => process.exit(0))
        .catch(e => { console.error(e.message); process.exit(1); });
    '
    docker cp "$SRC_CONTAINER:/app/data/_pkg_export.db" "$STAGE/data/wled_warehouse.db"
    docker exec "$SRC_CONTAINER" rm -f /app/data/_pkg_export.db
    echo "    rozmiar: $(du -h "$STAGE/data/wled_warehouse.db" | cut -f1)"
  else
    echo "UWAGA: kontener '$SRC_CONTAINER' nie działa — paczka bez danych." >&2
    WITH_DATA=0
  fi
fi
[ "$WITH_DATA" -eq 1 ] || rmdir "$STAGE/data" 2>/dev/null || true

# --- 5. Skrypty i metadane ---------------------------------------------------
step "Składam paczkę"
for f in install.sh update.sh backup.sh restore.sh; do
  cp "deploy/$f" "$STAGE/$f"
  chmod +x "$STAGE/$f"
done
cp deploy/INSTALL.md "$STAGE/INSTALL.md"

cat > "$STAGE/VERSION" <<EOF
PACKAGE=$PKG_NAME
APP_VERSION=$APP_VERSION
IMAGE=$IMAGE
BUILT_AT=$(date -Is)
BUILT_ON=$(hostname)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo brak)
GIT_ORIGIN=$GIT_ORIGIN
WITH_DATA=$WITH_DATA
EOF

mkdir -p "$REPO_DIR/dist"
OUT="$REPO_DIR/dist/${PKG_NAME}.tar.gz"
tar -czf "$OUT" -C "$(dirname "$STAGE")" "$PKG_NAME"
( cd "$REPO_DIR/dist" && sha256sum "${PKG_NAME}.tar.gz" > "${PKG_NAME}.tar.gz.sha256" )

step "Gotowe"
echo "  Paczka:   $OUT"
echo "  Rozmiar:  $(du -h "$OUT" | cut -f1)"
echo "  Suma:     ${OUT}.sha256"
echo "  Dane:     $([ "$WITH_DATA" -eq 1 ] && echo 'dołączone' || echo 'brak (czysta instalacja)')"
echo "  Git:      $([ -f "$STAGE/git/repo.bundle" ] && echo "bundle z historią, origin ${GIT_ORIGIN:-brak}" || echo 'brak')"
echo "  Claude:   CLAUDE.md + .claude/settings.json"
echo
echo "Skopiuj paczkę na serwer i uruchom:"
echo "  tar -xzf ${PKG_NAME}.tar.gz && cd ${PKG_NAME} && sudo ./install.sh"
