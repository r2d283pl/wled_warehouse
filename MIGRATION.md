# Migracja WLED Warehouse na inny serwer

Są dwie drogi. **Wariant A** (paczka offline) jest zalecany do wdrożenia
produkcyjnego — nie wymaga internetu na serwerze docelowym. **Wariant B**
(ręczny) przydaje się, gdy chcesz kontrolować każdy krok.

Cała konfiguracja zależna od środowiska jest w pliku **`.env`** (czytanym zarówno
przez aplikację, jak i przez `docker-compose.yml` do podstawień zmiennych).

---

# Wariant A — paczka offline (zalecany)

## 1. Zbuduj paczkę (na maszynie deweloperskiej, z internetem)

```bash
cd /opt/wled_warehouse
./deploy/make-package.sh              # z bieżącymi danymi z działającego kontenera
./deploy/make-package.sh --no-data    # czysta instalacja, bez danych
```

Powstaje `dist/wled-warehouse-<wersja>.tar.gz` (~57 MB). Zawiera:

- obraz Dockera z **prebudowanymi** zależnościami (`better-sqlite3`, `bcrypt`
  skompilowane pod musl/Alpine) — serwer nie potrzebuje npm ani internetu,
- kod aplikacji wraz z gotowym `frontend/dist`,
- spójny zrzut bazy (robiony przez API backupu SQLite, więc bez problemu z WAL),
- **pełną historię git jako bundle** — serwer dostaje prawdziwe repozytorium
  z ustawionym `origin`, bez potrzeby posiadania poświadczeń w chwili instalacji,
- **pliki dla Claude Code**: `CLAUDE.md` (architektura + zasady izolacji sieci)
  i `.claude/settings.json` (uprawnienia, deny-lista chroniąca izolację),
- skrypty `install.sh`, `update.sh`, `backup.sh`, `restore.sh` i `INSTALL.md`.

Paczkę buduj z **zacommitowanego** stanu repozytorium — wtedy historia w bundlu
zgadza się z plikami. `--allow-dirty` wymusza budowę mimo zmian roboczych.

## 2. Skopiuj na serwer i uruchom instalator

```bash
tar -xzf wled-warehouse-<wersja>.tar.gz
cd wled-warehouse-<wersja>
sudo ./install.sh
```

Instalator pyta o katalog, konto admina, IP kontenera, sieć paneli i sposób
udostępnienia UI, a następnie sam wczytuje obraz, tworzy `.env` z losowym
`JWT_SECRET`, **tworzy sieć macvlan (także z VLAN-em na porcie trunk, opcjonalnie
trwale przez systemd-networkd)**, odtwarza repozytorium git z bundla, importuje
bazę i startuje aplikację, sprawdzając `/api/health`.

Jeśli wolisz utworzyć sieć samodzielnie — patrz punkt 4 w Wariancie B poniżej;
instalator wykryje istniejącą sieć i pominie kreator.

## 3. Aktualizacje i kopie zapasowe

```bash
sudo ./update.sh --app-dir /opt/wled_warehouse   # z nowszej paczki; zachowuje .env i dane
/opt/wled_warehouse/deploy/backup.sh             # kopia bazy + .env
/opt/wled_warehouse/deploy/restore.sh <archiwum> # odtworzenie danych
```

Kod jest montowany z katalogu hosta, więc pliki backendu można edytować
bezpośrednio na serwerze i wykonać `docker compose restart`.

Pełna instrukcja dla osoby wdrażającej: **`deploy/INSTALL.md`**.

## 4. Środowisko docelowe i model dostępu

Panele pracują w **VLAN 8 sieci ITX, 192.168.188.0/23**. Ten VLAN **nie ma
routingu** — powstał pod urządzenia IoT w magazynie, więc nie ma tam bramy ani
internetu. Sieć macvlan tworzy się wtedy **bez `--gateway`** (instalator przyjmuje
pustą bramę).

Dostęp dla ludzi (sieć Rhenus, Tailscale) idzie **przez hosta**, nie przez VLAN:
nakładka `docker-compose.access.yml` publikuje port aplikacji na hoście. Jest to
możliwe, bo frontend używa wyłącznie ścieżek względnych `/api/...` — **cały ruch
do paneli realizuje backend w kontenerze**, przeglądarka nigdy nie łączy się
z panelem bezpośrednio.

Dzięki temu panele pozostają odcięte: nie powstaje żadna trasa z Rhenus ani
z tailnetu do 192.168.188.0/23. Komplet reguł (czego nie wolno zrobić) jest
w `CLAUDE.md`, sekcja 1 — to samo czyta Claude Code na serwerze docelowym.

Uwaga o skanowaniu: skaner przyjmuje prefiks /24, a podsieć paneli to /23 —
pełne pokrycie wymaga dwóch przebiegów (`192.168.188` i `192.168.189`).

---

# Wariant B — migracja ręczna

## Wymagania na serwerze docelowym
- Docker + Docker Compose v2
- Sieć dockera, w której panele LED są osiągalne (zwykle **macvlan** na VLAN paneli)

## Kroki

1. **Skopiuj katalog aplikacji** na nowy serwer (np. do `/opt/wled_warehouse`):
   ```bash
   rsync -a --exclude node_modules --exclude 'frontend/node_modules' \
     /opt/wled_warehouse/ user@nowy-serwer:/opt/wled_warehouse/
   ```
   `node_modules` pomijamy — moduły natywne (`better-sqlite3`, `bcrypt`) zostaną
   przebudowane w kontenerze przy starcie (`npm install`).

2. **Zbuduj frontend** (na maszynie z Node, np. lokalnie lub na serwerze):
   ```bash
   cd frontend && npm install && npm run build
   ```
   Backend serwuje gotowe `frontend/dist`.

3. **Dostosuj `.env`** (skopiuj z `.env.example` i uzupełnij):
   ```
   JWT_SECRET=...              # USTAW własny, długi sekret
   ADMIN_PASSWORD=...          # hasło administratora
   TZ=Europe/Warsaw           # strefa czasowa (zegar na panelach)
   SCAN_SUBNET=192.168.200    # domyślna podsieć skanowania (też w UI: Ustawienia)

   CONTAINER_NAME=wled_warehouse
   APP_DIR=/opt/wled_warehouse        # ścieżka katalogu na nowym serwerze
   # APP_IMAGE=...                    # zostaw zakomentowane — tryb ręczny używa
                                      # node:20-alpine i npm install przy starcie
   CONTAINER_IP=192.168.200.11        # IP kontenera w sieci paneli
   DOCKER_NETWORK=fleet-manager_vlan200_net   # nazwa istniejącej sieci docker
   ```

4. **Upewnij się, że sieć docker (macvlan) istnieje.** Jeśli nie — utwórz ją.

   **A) Port dostępowy / pojedynczy nietagowany VLAN** — parent to fizyczny NIC:
   ```bash
   docker network create -d macvlan \
     --subnet=192.168.200.0/24 --gateway=192.168.200.1 \
     -o parent=eth0 fleet-manager_vlan200_net
   ```

   **B) Port TRUNK (802.1Q, tagowane VLAN-y) — scenariusz produkcyjny.**
   Macvlan musi mieć jako parent **sub-interfejs VLAN**, nie sam NIC. Najpierw
   utwórz interfejs VLAN na trunku (przykład: VLAN 200 na `eth0`), potem macvlan:
   ```bash
   # 1) sub-interfejs VLAN na porcie trunk (tu: eth0, VLAN 200)
   sudo ip link add link eth0 name eth0.200 type vlan id 200
   sudo ip link set eth0.200 up

   # 2) sieć macvlan dockera z parent = sub-interfejs VLAN
   docker network create -d macvlan \
     --subnet=192.168.200.0/24 --gateway=192.168.200.1 \
     -o parent=eth0.200 fleet-manager_vlan200_net
   ```
   - `eth0` zostaw bez adresu IP (to czysty trunk); adresację ma sub-interfejs/kontener.
   - `CONTAINER_IP` w `.env` musi należeć do podsieci VLAN i być **poza pulą DHCP**.
   - Dla kolejnych VLAN-ów powtórz z innym `id` i osobną siecią docker.

   **Trwałość po restarcie** (przykłady — wybierz wg dystrybucji):
   - *systemd-networkd* — utwórz `/etc/systemd/network/eth0.200.netdev`:
     ```ini
     [NetDev]
     Name=eth0.200
     Kind=vlan
     [VLAN]
     Id=200
     ```
     oraz `/etc/systemd/network/eth0.200.network` (`[Match] Name=eth0.200`),
     następnie `sudo systemctl restart systemd-networkd`.
   - *netplan* (Ubuntu) — w `/etc/netplan/*.yaml`:
     ```yaml
     network:
       version: 2
       vlans:
         eth0.200:
           id: 200
           link: eth0
     ```
     `sudo netplan apply`.
   Sieć macvlan dockera odtworzy się sama (jest `external`) — wystarczy, że
   istnieje sub-interfejs; samą sieć docker utwórz raz poleceniem powyżej.

   **(Opcjonalnie) Dostęp z samego hosta do kontenera/paneli.** Macvlan domyślnie
   izoluje host od własnych kontenerów macvlan. Jeśli host musi sięgać panele/aplikację,
   dodaj „shim”:
   ```bash
   sudo ip link add macvlan-shim link eth0.200 type macvlan mode bridge
   sudo ip addr add 192.168.200.2/24 dev macvlan-shim   # wolny adres w VLAN
   sudo ip link set macvlan-shim up
   sudo ip route add 192.168.200.0/24 dev macvlan-shim
   ```

5. **Uruchom:**
   ```bash
   cd /opt/wled_warehouse
   docker compose up -d
   ```
   Aplikacja będzie dostępna pod `http://<CONTAINER_IP>:<PORT>` (np.
   `http://192.168.200.11:3000`) z sieci paneli.

## Ważne uwagi
- **Zmiany w `.env` wymagają `docker compose up -d`** (nie `docker restart`) —
  inaczej nie zostaną zastosowane na poziomie kontenera (dotyczy m.in. `TZ`).
- Dane (użytkownicy, strefy, kafelki) są w **wolumenie** `wled_warehouse_data`.
  Aby przenieść też dane, skopiuj wolumen:
  ```bash
  # na starym serwerze
  docker run --rm -v wled_warehouse_data:/d -v $PWD:/b alpine \
    tar czf /b/wled_data.tgz -C /d .
  # na nowym (po utworzeniu wolumenu przez 'compose up' i zatrzymaniu kontenera)
  docker run --rm -v wled_warehouse_data:/d -v $PWD:/b alpine \
    sh -c "cd /d && tar xzf /b/wled_data.tgz"
  ```
- Przeglądarka operatora (Android/PC) musi dosięgnąć **aplikację**, ale **nie
  musi widzieć paneli** — frontend używa wyłącznie ścieżek względnych `/api/...`,
  a ruch do paneli realizuje backend w kontenerze (`backend/routes/wled.js`,
  `clockScheduler.js`, `scheduleRunner.js`, `discovery.js`).
- Parametry aplikacyjne (podsieć skanowania) można też zmienić w locie w UI:
  **Ustawienia** (zmiana efektywna natychmiast, bez restartu).
