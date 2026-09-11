# WLED Warehouse — instrukcje dla Claude Code

System zarządzania matrycami LED (WLED/ESP32) w strefach magazynowych.
Node.js + Express + SQLite (backend), React + Vite (frontend), uruchamiany w Dockerze.

---

# 1. Izolacja sieci — zasady nienaruszalne

**Przeczytaj tę sekcję przed jakąkolwiek zmianą dotyczącą sieci, Dockera, compose lub hosta.**

## Topologia

| Element | Gdzie jest |
|---|---|
| Panele LED (WLED/ESP32) | **VLAN 8** w sieci **ITX**, adresacja **192.168.188.0/23** |
| Kontener aplikacji | jeden interfejs macvlan w VLAN 8 (`CONTAINER_IP` z `.env`) |
| Dostęp operatorów i administratora | przez **host**: sieć Rhenus oraz Tailscale |

**VLAN 8 nie ma routingu.** Powstał celowo pod urządzenia IoT wewnątrz magazynu:
nie ma bramy, nie ma internetu, nie ma trasy do innych sieci firmowych. To nie
jest usterka do naprawienia — to wymaganie bezpieczeństwa.

## Dlaczego dostęp przez host wystarczy

Frontend używa **wyłącznie ścieżek względnych** (`/api/...`). Cały ruch do paneli
realizuje backend w kontenerze (`backend/routes/wled.js`, `clockScheduler.js`,
`scheduleRunner.js`, `discovery.js`). Przeglądarka operatora **nie łączy się z
panelami bezpośrednio** — musi dosięgnąć tylko aplikację.

Wniosek: żeby dać komuś dostęp, publikujemy port aplikacji na hoście
(`docker-compose.access.yml`). **Nigdy** nie trasujemy VLAN-u 8 do innych sieci.

## Czego nie wolno zrobić

- ❌ **Nie** rozgłaszaj `192.168.188.0/23` w Tailscale (`--advertise-routes`) ani
  w żadnym innym VPN/routerze — to wystawiłoby wszystkie panele IoT na tailnet.
- ❌ **Nie** włączaj forwardowania między VLAN 8 a Rhenus/Tailscale
  (`sysctl net.ipv4.ip_forward`, reguły `iptables`/`nft` FORWARD, NAT).
- ❌ **Nie** twórz na hoście „shima” macvlan z trasą do 192.168.188.0/23,
  jeśli host ma jednocześnie Tailscale lub interfejs w Rhenus — to de facto router.
- ❌ **Nie** podłączaj sieci VLAN-u 8 do innych kontenerów ani nie dodawaj
  kontenerowi aplikacji sieci spoza `docker-compose.yml` / `docker-compose.access.yml`.
- ❌ **Nie** licz na internet w kontenerze — w VLAN 8 go nie ma. `npm install`,
  `git pull`, pobieranie obrazów wykonuje **host**, nigdy kontener przez VLAN 8.
- ❌ **Nie** zmieniaj konfiguracji sieciowej hosta (`ip link/addr/route add`,
  `netplan apply`, restart `systemd-networkd`, firewall) bez wyraźnej zgody
  użytkownika w bieżącej rozmowie. Te operacje są na deny-liście w `.claude/settings.json`.

## Co wolno i jak

- ✅ Publikowanie portu aplikacji na hoście — przez `docker-compose.access.yml`
  (`HOST_BIND`, `HOST_PORT` w `.env`). Domyślnie bindowanie na konkretny adres,
  nie na `0.0.0.0`, jeśli host ma interfejs w więcej niż jednej sieci.
- ✅ Diagnostyka read-only: `ip -4 addr show`, `ip route show`, `docker network inspect`,
  `docker exec ... ping <ip panelu>`.
- ✅ Sprawdzanie osiągalności paneli **z wnętrza kontenera** (to jedyne miejsce,
  które ma prawo widzieć VLAN 8):
  ```bash
  docker exec wled_warehouse wget -qO- --timeout=3 http://<ip-panelu>/json/state
  ```

## Skanowanie sieci — pułapka /23

Skaner (`backend/routes/discovery.js`) przyjmuje **prefiks /24** (trzy oktety)
plus zakres `start`–`end`. Podsieć paneli to `/23`, więc **jeden przebieg pokrywa
tylko połowę**. Pełne pokrycie = dwa skany:

- `192.168.188` (start 1, end 254)
- `192.168.189` (start 1, end 254)

`SCAN_SUBNET` w `.env` ustawia tylko wartość domyślną; prefiks zmienia się też
w UI (**Ustawienia**) bez restartu.

---

# 2. Architektura

```
backend/
  server.js           # Express, montuje /api/*, serwuje frontend/dist, SPA fallback
  db.js               # SQLite (better-sqlite3), schemat + getDb(), logAction()
  clockScheduler.js   # cykliczne wysyłanie czasu na panele (niezależne od przeglądarki)
  scheduleRunner.js   # harmonogramy jasności/scen
  patternAnimator.js  # animacje wzorów
  routes/             # auth, users, devices, wled, dashboards, tiles, areas,
                      # userGroups, discovery, templates, settings, patterns,
                      # schedules, audit
  middleware/auth.js  # JWT: authenticateToken, requireAdmin
frontend/
  src/App.jsx         # cały UI (React, jeden duży plik)
  dist/               # WERSJONOWANY build — to jest to, co serwuje backend
deploy/               # Dockerfile, skrypty paczki wdrożeniowej (patrz sekcja 5)
```

Role: **admin** konfiguruje urządzenia, strefy, dashboardy i użytkowników;
**operator** widzi tylko przypisane panele.

Dane (użytkownicy, urządzenia, strefy, kafelki, audyt) są w SQLite
w **wolumenie Dockera**, nie w katalogu projektu.

---

# 3. Uruchamianie i praca na serwerze

Kod jest montowany z katalogu hosta do `/app` w kontenerze, więc pliki backendu
edytuje się **bezpośrednio w tym repozytorium** i restartuje kontener.

```bash
cd /opt/wled_warehouse

docker compose restart          # po zmianie w backend/ — wystarczy restart
docker compose up -d            # po KAŻDEJ zmianie w .env (restart NIE wystarczy)
docker compose logs -f --tail 50
docker compose ps
```

**Zależności są zapieczone w obrazie** (`APP_IMAGE` w `.env`), w `NODE_PATH`
poza `/app`. Dlatego:

- ❌ nie uruchamiaj `npm install` w kontenerze (brak internetu w VLAN 8, a katalog
  `/app/node_modules` przesłoniłby zależności z obrazu),
- ✅ nową zależność dodaje się przez przebudowanie obrazu (`deploy/Dockerfile`)
  na maszynie z internetem i wydanie nowej paczki.

## Zmiany we frontendzie

`backend/server.js` serwuje `frontend/dist`. Edycja `frontend/src/App.jsx` **nie
zadziała**, dopóki nie powstanie nowy build:

```bash
cd frontend && npm install && npm run build   # wymaga Node i internetu NA HOŚCIE
cd .. && docker compose restart
```

Jeśli host nie ma Node, frontend buduje się na maszynie deweloperskiej i trafia
na serwer w kolejnej paczce.

## Dane i kopie zapasowe

```bash
./deploy/backup.sh                       # baza + .env do backups/ (spójny backup SQLite)
./deploy/restore.sh backups/<plik>.tar.gz
```

Bazy **nie kopiuj przez `cp`** przy działającej aplikacji — jest w trybie WAL.
Używaj `backup.sh` albo API `db.backup()` z better-sqlite3.

---

# 4. Konfiguracja (.env)

Plik `.env` (chmod 600) jest źródłem prawdy dla aplikacji **i** dla podstawień
w `docker-compose.yml`. Nie jest w gicie. Wzór: `.env.example`.

| Zmienna | Znaczenie |
|---|---|
| `JWT_SECRET` | sekret sesji; musi być długi i losowy |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | tworzą admina **tylko gdy baza jest pusta** |
| `PORT` | port aplikacji w kontenerze |
| `TZ` | strefa czasowa — istotna dla zegara na panelach |
| `SCAN_SUBNET` | domyślny prefiks /24 skanowania (patrz pułapka /23) |
| `CONTAINER_IP` | adres kontenera w VLAN 8 — musi być poza pulą DHCP |
| `DOCKER_NETWORK` | nazwa istniejącej sieci macvlan |
| `APP_IMAGE` | obraz z prebudowanymi zależnościami |
| `COMPOSE_FILE` | ustawione, gdy włączony jest dostęp z hosta (nakładka access) |
| `HOST_BIND` / `HOST_PORT` | adres i port publikacji UI na hoście |

Przy pokazywaniu `.env` użytkownikowi **maskuj** `JWT_SECRET` i `ADMIN_PASSWORD`.

`COMPOSE_FILE` z `.env` działa tylko, gdy `docker compose` uruchamiasz
**z katalogu projektu** (`cd /opt/wled_warehouse`), nie przez `--project-directory`.

---

# 5. Git i wdrożenia

Repozytorium na serwerze jest pełnoprawne (historia z bundla w paczce),
`origin` wskazuje na GitHub. Zmiany robione na serwerze commituj normalnie:

```bash
git status
git add -A && git commit -m "opis zmiany"
git push        # jeśli skonfigurowany jest klucz/token do origin
```

Nie commituj: `.env`, `data/`, `backups/`, `dist/`, `node_modules/`,
`.claude/settings.local.json` (te wpisy są w `.gitignore`).

`frontend/dist/` jest **celowo wersjonowany** — dzięki temu wdrożenie nie wymaga
budowania na serwerze.

Wydanie nowej paczki (na maszynie deweloperskiej, z internetem):

```bash
./deploy/make-package.sh              # dist/wled-warehouse-<wersja>.tar.gz
./deploy/make-package.sh --no-data    # bez zrzutu bazy
```

Aktualizacja serwera z nowej paczki: `sudo ./update.sh --app-dir /opt/wled_warehouse`
(robi kopię bazy, zachowuje `.env` i dane, podmienia kod i obraz).

---

# 6. Konwencje kodu

- Backend: **CommonJS** (`require`), nie ESM. Trasy: `express.Router()`,
  `authenticateToken` z `middleware/auth.js`, akcje zmieniające stan logowane
  przez `logAction()` z `db.js`.
- Zapytania do SQLite: `db.prepare(...).get/all/run(...)` z parametrami `?`.
  Nigdy nie sklejaj SQL ze stringów.
- Komunikaty dla użytkownika (UI, błędy API, logi startowe) są **po polsku**.
- Frontend to jeden plik `App.jsx` z Tailwindem — trzymaj się istniejącego stylu
  komponentów i nazewnictwa.
- Wywołania do paneli zawsze z timeoutem (`AbortSignal.timeout(3000)`) — panel
  bywa offline i nie może blokować requestu.

---

# 7. Zanim uznasz zadanie za zrobione

1. `docker compose ps` — kontener działa.
2. `docker exec <kontener> wget -qO- http://127.0.0.1:<PORT>/api/health` — odpowiada.
3. `docker compose logs --tail 30` — brak nowych błędów.
4. Przy zmianach w sieci/compose — potwierdź, że żadna reguła z sekcji 1 nie została
   naruszona, i powiedz to wprost użytkownikowi.
