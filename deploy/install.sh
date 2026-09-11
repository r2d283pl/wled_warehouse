#!/usr/bin/env bash
#
# Instalator WLED Warehouse (offline).
#
#   sudo ./install.sh                     # instalacja interaktywna (zalecane)
#   sudo ./install.sh --app-dir /srv/wled # inny katalog docelowy
#   sudo ./install.sh --yes               # bez pytań, same wartości domyślne
#
# Skrypt jest idempotentny — można go uruchomić ponownie na istniejącej instalacji.
# Istniejący plik .env oraz dane w wolumenie NIE są nadpisywane bez pytania.

set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=""
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --app-dir) APP_DIR="$2"; shift 2 ;;
    --yes|-y)  ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Nieznany argument: $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------- pomocnicze --
C_OK=$'\033[1;32m'; C_WARN=$'\033[1;33m'; C_ERR=$'\033[1;31m'; C_H=$'\033[1;36m'; C_0=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$C_H" "$1" "$C_0"; }
ok()   { printf '    %s✔%s %s\n' "$C_OK" "$C_0" "$1"; }
warn() { printf '    %s!%s %s\n' "$C_WARN" "$C_0" "$1"; }
die()  { printf '\n%sBŁĄD:%s %s\n' "$C_ERR" "$C_0" "$1" >&2; exit 1; }

# docker compose MUSI startować z katalogu projektu — inaczej COMPOSE_FILE z .env
# (nakładka dostępowa) nie zostanie uwzględniony.
dc() { ( cd "$APP_DIR" && docker compose "$@" ); }

ask() { # ask ZMIENNA "pytanie" "domyślna"
  local __v=$1 prompt=$2 def=$3 ans=""
  if [ "$ASSUME_YES" -eq 1 ] || [ ! -t 0 ]; then
    ans="$def"
  else
    read -r -p "    $prompt [$def]: " ans </dev/tty || true
    ans="${ans:-$def}"
  fi
  printf -v "$__v" '%s' "$ans"
}

ask_opt() { # jak ask, ale pusta odpowiedź jest dozwolona (nie wraca do domyślnej)
  local __v=$1 prompt=$2 hint=$3 ans=""
  if [ "$ASSUME_YES" -eq 1 ] || [ ! -t 0 ]; then
    ans=""
  else
    read -r -p "    $prompt [$hint]: " ans </dev/tty || true
  fi
  printf -v "$__v" '%s' "$ans"
}

confirm() { # confirm "pytanie" "t|n"  -> 0 = tak
  local prompt=$1 def=${2:-t} ans=""
  if [ "$ASSUME_YES" -eq 1 ] || [ ! -t 0 ]; then ans="$def"
  else read -r -p "    $prompt $([ "$def" = t ] && echo '[T/n]' || echo '[t/N]'): " ans </dev/tty || true; fi
  ans="${ans:-$def}"
  [[ "$ans" =~ ^[tTyY] ]]
}

envget() { sed -n "s/^[[:space:]]*$2=//p" "$1" 2>/dev/null | tail -1; }
envset() { # envset PLIK KLUCZ WARTOŚĆ
  local f=$1 k=$2 v=$3 tmp
  if grep -q "^[[:space:]]*$k=" "$f" 2>/dev/null; then
    tmp="$(mktemp)"
    awk -v k="$k" -v v="$v" '
      $0 ~ "^[[:space:]]*"k"=" && !done { print k"="v; done=1; next } { print }
    ' "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"
  else
    printf '%s=%s\n' "$k" "$v" >> "$f"
  fi
}

# --------------------------------------------------------------- 1. kontrola --
step "Sprawdzam środowisko"
command -v docker >/dev/null || die "Docker nie jest zainstalowany. Zainstaluj Docker Engine i uruchom ponownie."
docker info >/dev/null 2>&1 || die "Brak dostępu do demona Dockera. Uruchom przez sudo lub dodaj użytkownika do grupy 'docker'."
docker compose version >/dev/null 2>&1 || die "Brak Docker Compose v2 (polecenie 'docker compose'). Zainstaluj wtyczkę docker-compose-plugin."
ok "Docker $(docker version -f '{{.Server.Version}}' 2>/dev/null), Compose $(docker compose version --short 2>/dev/null)"

[ -f "$PKG_DIR/VERSION" ] || die "To nie wygląda na katalog paczki (brak pliku VERSION)."
IMAGE="$(sed -n 's/^IMAGE=//p' "$PKG_DIR/VERSION")"
GIT_ORIGIN="$(sed -n 's/^GIT_ORIGIN=//p' "$PKG_DIR/VERSION")"
ok "Paczka $(sed -n 's/^PACKAGE=//p' "$PKG_DIR/VERSION")"

# ------------------------------------------------------------- 2. obraz --------
step "Wczytuję obraz aplikacji do Dockera"
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  ok "Obraz $IMAGE jest już wczytany"
else
  [ -f "$PKG_DIR/images/wled-warehouse.tar.gz" ] || die "Brak pliku images/wled-warehouse.tar.gz w paczce."
  gunzip -c "$PKG_DIR/images/wled-warehouse.tar.gz" | docker load
  docker image inspect "$IMAGE" >/dev/null 2>&1 || die "Obraz $IMAGE nie pojawił się po wczytaniu."
  ok "Wczytano $IMAGE"
fi

# -------------------------------------------------- 3. katalog aplikacji -------
step "Katalog aplikacji"
if [ -z "$APP_DIR" ]; then
  ask APP_DIR "Gdzie zainstalować aplikację?" "/opt/wled_warehouse"
fi
mkdir -p "$APP_DIR"
APP_DIR="$(cd "$APP_DIR" && pwd)"
ENV_FILE="$APP_DIR/.env"
FRESH_INSTALL=1
[ -f "$ENV_FILE" ] && FRESH_INSTALL=0
ok "$APP_DIR $([ "$FRESH_INSTALL" -eq 0 ] && echo '(istniejąca instalacja — .env zostanie zachowany)')"

if [ -f "$APP_DIR/docker-compose.yml" ] && dc ps -q 2>/dev/null | grep -q .; then
  step "Zatrzymuję działającą instancję"
  dc down
  ok "Zatrzymano"
fi

step "Kopiuję pliki aplikacji"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude '.env' "$PKG_DIR/app/" "$APP_DIR/"
else
  ( cd "$PKG_DIR/app" && tar -cf - --exclude='./.env' . ) | ( cd "$APP_DIR" && tar -xf - )
fi
chmod +x "$APP_DIR/deploy/"*.sh 2>/dev/null || true
ok "Skopiowano kod do $APP_DIR"

# ------------------------------------------------------------ 4. plik .env ----
step "Konfiguracja (.env)"
if [ "$FRESH_INSTALL" -eq 1 ]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"

  JWT="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  envset "$ENV_FILE" JWT_SECRET "$JWT"
  ok "Wygenerowano losowy JWT_SECRET"

  ask ADMIN_USER "Login administratora"                  "admin"
  ask ADMIN_PASS "Hasło administratora"                  "$(openssl rand -base64 12 2>/dev/null || echo ZmienToHaslo1)"
  ask APP_TZ     "Strefa czasowa (zegar na panelach)"     "Europe/Warsaw"
  ask APP_PORT   "Port aplikacji w kontenerze"            "3000"
  ask NET_NAME   "Nazwa sieci docker z panelami LED"      "itx_vlan8_net"
  ask CONT_IP    "Adres IP kontenera w VLAN paneli"       "192.168.188.11"
  ask SCAN_NET   "Prefiks /24 do skanowania paneli"       "${CONT_IP%.*}"
  ask CONT_NAME  "Nazwa kontenera"                        "wled_warehouse"

  envset "$ENV_FILE" ADMIN_USERNAME "$ADMIN_USER"
  envset "$ENV_FILE" ADMIN_PASSWORD "$ADMIN_PASS"
  envset "$ENV_FILE" TZ             "$APP_TZ"
  envset "$ENV_FILE" PORT           "$APP_PORT"
  envset "$ENV_FILE" DOCKER_NETWORK "$NET_NAME"
  envset "$ENV_FILE" CONTAINER_IP   "$CONT_IP"
  envset "$ENV_FILE" SCAN_SUBNET    "$SCAN_NET"
  envset "$ENV_FILE" CONTAINER_NAME "$CONT_NAME"
  envset "$ENV_FILE" NODE_ENV       "production"
  envset "$ENV_FILE" DB_PATH        "/app/data/wled_warehouse.db"
  chmod 600 "$ENV_FILE"
  ok "Utworzono $ENV_FILE (uprawnienia 600 — zawiera sekrety)"
else
  ok "Zachowano istniejący $ENV_FILE"
fi

envset "$ENV_FILE" APP_DIR   "$APP_DIR"
envset "$ENV_FILE" APP_IMAGE "$IMAGE"

CONTAINER_NAME="$(envget "$ENV_FILE" CONTAINER_NAME)"; CONTAINER_NAME="${CONTAINER_NAME:-wled_warehouse}"
DOCKER_NETWORK="$(envget "$ENV_FILE" DOCKER_NETWORK)"; DOCKER_NETWORK="${DOCKER_NETWORK:-itx_vlan8_net}"
CONTAINER_IP="$(envget "$ENV_FILE" CONTAINER_IP)";     CONTAINER_IP="${CONTAINER_IP:-192.168.188.11}"
APP_PORT="$(envget "$ENV_FILE" PORT)";                 APP_PORT="${APP_PORT:-3000}"

# ----------------------------------------------- 5. dostęp z hosta (Rhenus/TS) --
step "Dostęp do UI spoza VLAN-u paneli"
if [ "$FRESH_INSTALL" -eq 1 ] || [ -z "$(envget "$ENV_FILE" COMPOSE_FILE)" ]; then
  echo "    VLAN paneli nie ma routingu, więc UI udostępnia się publikując port"
  echo "    aplikacji na hoście (osiągalny z sieci Rhenus i przez Tailscale)."
  echo "    Panele LED pozostają przy tym odcięte — nie powstaje żadna trasa do VLAN-u."
  if confirm "Włączyć publikację portu na hoście?" t; then
    ask HOST_BIND_V "Adres bindowania na hoście (0.0.0.0 = wszystkie interfejsy hosta)" "0.0.0.0"
    ask HOST_PORT_V "Port na hoście"                                                    "$APP_PORT"
    envset "$ENV_FILE" HOST_BIND    "$HOST_BIND_V"
    envset "$ENV_FILE" HOST_PORT    "$HOST_PORT_V"
    envset "$ENV_FILE" COMPOSE_FILE "docker-compose.yml:docker-compose.access.yml"
    ACCESS_ENABLED=1
    ok "UI będzie publikowane na ${HOST_BIND_V}:${HOST_PORT_V}"
    warn "Host nie może rozgłaszać podsieci paneli (Tailscale --advertise-routes) — patrz CLAUDE.md."
  else
    ACCESS_ENABLED=0
    ok "Bez publikacji — UI dostępne tylko z sieci paneli"
  fi
else
  ACCESS_ENABLED=1
  ok "Zachowano istniejącą konfigurację dostępu ($(envget "$ENV_FILE" HOST_BIND):$(envget "$ENV_FILE" HOST_PORT))"
fi

# ------------------------------------------------------------ 6. sieć ---------
step "Sieć dockera: $DOCKER_NETWORK"
if docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
  ok "Sieć już istnieje"
else
  warn "Sieć nie istnieje — panele LED są w osobnym VLAN-ie (macvlan)."
  echo
  echo "    Dostępne interfejsy sieciowe:"
  ip -o link show 2>/dev/null | awk -F': ' '$2 !~ /^(lo|docker|br-|veth)/ {printf "      %s\n", $2}'
  echo
  if confirm "Utworzyć sieć macvlan teraz?" t; then
    ask NET_PARENT "Interfejs fizyczny (port trunk do switcha)" "$(ip -o route get 1.1.1.1 2>/dev/null | awk '{print $5; exit}')"
    ask NET_VLAN   "ID VLAN (puste = port dostępowy, bez tagowania)" "8"
    ask NET_SUBNET "Podsieć paneli" "192.168.188.0/23"
    ask_opt NET_GW "Brama podsieci" "puste = VLAN bez routingu"

    PARENT_IF="$NET_PARENT"
    if [ -n "$NET_VLAN" ]; then
      PARENT_IF="${NET_PARENT}.${NET_VLAN}"
      if ip link show "$PARENT_IF" >/dev/null 2>&1; then
        ok "Sub-interfejs $PARENT_IF już istnieje"
      else
        ip link add link "$NET_PARENT" name "$PARENT_IF" type vlan id "$NET_VLAN"
        ip link set "$PARENT_IF" up
        ok "Utworzono sub-interfejs VLAN $PARENT_IF"
        if confirm "Zapisać $PARENT_IF na stałe (systemd-networkd, przetrwa restart)?" t; then
          if [ -d /etc/systemd/network ]; then
            cat > "/etc/systemd/network/10-${PARENT_IF}.netdev" <<EOF
[NetDev]
Name=$PARENT_IF
Kind=vlan

[VLAN]
Id=$NET_VLAN
EOF
            cat > "/etc/systemd/network/10-${NET_PARENT}.network" <<EOF
[Match]
Name=$NET_PARENT

[Network]
VLAN=$PARENT_IF
EOF
            systemctl enable --now systemd-networkd >/dev/null 2>&1 || true
            systemctl restart systemd-networkd >/dev/null 2>&1 || true
            ok "Zapisano konfigurację w /etc/systemd/network/"
          else
            warn "Brak /etc/systemd/network — dodaj VLAN trwale ręcznie (patrz MIGRATION.md)."
          fi
        else
          warn "VLAN $PARENT_IF zniknie po restarcie serwera — dodaj go trwale (patrz MIGRATION.md)."
        fi
      fi
    fi

    if [ -n "$NET_GW" ]; then
      docker network create -d macvlan --subnet="$NET_SUBNET" --gateway="$NET_GW" \
        -o parent="$PARENT_IF" "$DOCKER_NETWORK"
    else
      # VLAN bez routingu — brak bramy jest zamierzony
      docker network create -d macvlan --subnet="$NET_SUBNET" \
        -o parent="$PARENT_IF" "$DOCKER_NETWORK"
    fi
    ok "Utworzono sieć macvlan $DOCKER_NETWORK (parent: $PARENT_IF)"
  else
    die "Sieć $DOCKER_NETWORK jest wymagana. Utwórz ją ręcznie (instrukcja w MIGRATION.md) i uruchom install.sh ponownie."
  fi
fi

# ------------------------------------------------------------ 7. git ---------
step "Repozytorium git"
if ! command -v git >/dev/null 2>&1; then
  warn "git nie jest zainstalowany — pomijam (kod działa, brak wersjonowania zmian na serwerze)"
elif [ -d "$APP_DIR/.git" ]; then
  ok "Repozytorium już istnieje (HEAD $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '?'))"
elif [ -f "$PKG_DIR/git/repo.bundle" ]; then
  TMP_CLONE="$(mktemp -d)"
  if git clone --quiet "$PKG_DIR/git/repo.bundle" "$TMP_CLONE/repo" 2>/dev/null; then
    mv "$TMP_CLONE/repo/.git" "$APP_DIR/.git"
    git -C "$APP_DIR" remote remove origin 2>/dev/null || true
    if [ -n "$GIT_ORIGIN" ]; then
      git -C "$APP_DIR" remote add origin "$GIT_ORIGIN"
      ok "origin -> $GIT_ORIGIN"
    fi
    git -C "$APP_DIR" config user.name  >/dev/null 2>&1 || git -C "$APP_DIR" config user.name  "WLED Warehouse ($(hostname))"
    git -C "$APP_DIR" config user.email >/dev/null 2>&1 || git -C "$APP_DIR" config user.email "wled-warehouse@$(hostname)"
    ok "Odtworzono historię z bundla ($(git -C "$APP_DIR" rev-list --count HEAD 2>/dev/null || echo '?') commitów)"
    if [ -n "$(git -C "$APP_DIR" status --porcelain 2>/dev/null)" ]; then
      warn "Pliki z paczki różnią się od HEAD — zobacz 'git -C $APP_DIR status'"
    fi
  else
    warn "Nie udało się odtworzyć repozytorium z bundla — pomijam"
  fi
  rm -rf "$TMP_CLONE"
else
  warn "Paczka nie zawiera bundla git — pomijam"
fi

# katalog ma należeć do człowieka, nie do roota spod sudo (inaczej git odmówi pracy)
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  chown -R "$SUDO_USER" "$APP_DIR" 2>/dev/null || true
  chmod 600 "$ENV_FILE"
  ok "Właściciel katalogu: $SUDO_USER"
fi

# ------------------------------------------------- 8. wolumen i import danych --
step "Przygotowuję wolumen z danymi"
dc create >/dev/null
DATA_VOL="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$CONTAINER_NAME")"
[ -n "$DATA_VOL" ] || die "Nie udało się ustalić nazwy wolumenu danych."
ok "Wolumen: $DATA_VOL"

DB_IN_PKG="$PKG_DIR/data/wled_warehouse.db"
if [ -f "$DB_IN_PKG" ]; then
  EXISTING="$(docker run --rm -v "$DATA_VOL:/d" "$IMAGE" sh -c 'ls -1 /d/wled_warehouse.db 2>/dev/null | wc -l')"
  DO_IMPORT=1
  if [ "${EXISTING//[$'\t\r\n ']/}" != "0" ]; then
    warn "W wolumenie jest już baza danych."
    if confirm "Nadpisać ją bazą z paczki? (poprzednia zostanie zarchiwizowana)" n; then
      docker run --rm -v "$DATA_VOL:/d" "$IMAGE" \
        sh -c 'cp /d/wled_warehouse.db "/d/wled_warehouse.db.bak-$(date +%Y%m%d-%H%M%S)"'
      ok "Zarchiwizowano dotychczasową bazę w wolumenie"
    else
      DO_IMPORT=0
      ok "Pomijam import — zostaje baza już obecna na serwerze"
    fi
  fi
  if [ "$DO_IMPORT" -eq 1 ]; then
    docker run --rm -v "$DATA_VOL:/d" -v "$PKG_DIR/data:/restore:ro" "$IMAGE" \
      sh -c 'cp /restore/wled_warehouse.db /d/wled_warehouse.db && rm -f /d/wled_warehouse.db-wal /d/wled_warehouse.db-shm'
    ok "Zaimportowano bazę z paczki (użytkownicy, strefy, dashboardy, kafelki)"
    warn "Hasła użytkowników są takie jak na serwerze źródłowym (ADMIN_PASSWORD z .env dotyczy tylko pustej bazy)."
  fi
else
  ok "Paczka bez danych — powstanie pusta baza, admin z ADMIN_USERNAME/ADMIN_PASSWORD"
fi

# ------------------------------------------------------------ 9. start --------
step "Uruchamiam aplikację"
dc up -d
ok "Kontener $CONTAINER_NAME wystartował"

printf '    czekam na /api/health'
HEALTHY=0
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" wget -qO- "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    HEALTHY=1; break
  fi
  printf '.'; sleep 2
done
echo

if [ "$HEALTHY" -eq 1 ]; then
  printf '\n%s╔══════════════════════════════════════════════════════════╗%s\n' "$C_OK" "$C_0"
  printf '%s║  WLED Warehouse działa                                   ║%s\n' "$C_OK" "$C_0"
  printf '%s╚══════════════════════════════════════════════════════════╝%s\n' "$C_OK" "$C_0"
  echo
  echo "  Z sieci paneli:  http://${CONTAINER_IP}:${APP_PORT}"
  if [ "${ACCESS_ENABLED:-0}" -eq 1 ]; then
    HB="$(envget "$ENV_FILE" HOST_BIND)"; HP="$(envget "$ENV_FILE" HOST_PORT)"
    echo "  Z Rhenus/Tailscale: http://<adres-hosta>:${HP}  (bind ${HB})"
    command -v tailscale >/dev/null 2>&1 && \
      echo "                      http://$(tailscale ip -4 2>/dev/null | head -1):${HP}"
  fi
  echo "  Katalog:         $APP_DIR"
  echo "  Dane:            wolumen $DATA_VOL"
  [ "$FRESH_INSTALL" -eq 1 ] && [ ! -f "$DB_IN_PKG" ] && {
    echo "  Logowanie:       $(envget "$ENV_FILE" ADMIN_USERNAME) / $(envget "$ENV_FILE" ADMIN_PASSWORD)"; }
  echo
  echo "  Przydatne (uruchamiaj z katalogu aplikacji):"
  echo "    cd $APP_DIR"
  echo "    docker compose logs -f        # logi"
  echo "    docker compose restart        # restart po edycji kodu"
  echo "    docker compose up -d          # po zmianie w .env"
  echo "    ./deploy/backup.sh            # kopia danych"
  echo
  echo "  Zasady izolacji sieci i instrukcje dla Claude Code: $APP_DIR/CLAUDE.md"
else
  warn "Aplikacja nie odpowiedziała w ciągu 60 s. Sprawdź logi:"
  echo "    cd $APP_DIR && docker compose logs --tail 50"
  exit 1
fi
