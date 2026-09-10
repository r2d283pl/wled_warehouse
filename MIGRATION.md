# Migracja WLED Warehouse na inny serwer

Aplikacja jest spakowana tak, by przenieść ją w kilku krokach. Cała konfiguracja
zależna od środowiska jest w pliku **`.env`** (czytanym zarówno przez aplikację,
jak i przez `docker-compose.yml` do podstawień zmiennych).

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
- Przeglądarka operatora (Android/PC) musi być w sieci osiągającej panele —
  status i sterowanie idą częściowo bezpośrednio do paneli po IP.
- Parametry aplikacyjne (podsieć skanowania) można też zmienić w locie w UI:
  **Ustawienia** (zmiana efektywna natychmiast, bez restartu).
