# WLED Warehouse — instalacja na serwerze

Paczka jest **offline**: zawiera gotowy obraz Dockera z prebudowanymi zależnościami.
Serwer nie potrzebuje dostępu do internetu, Docker Huba ani npm.

## Wymagania

- Docker Engine + Docker Compose v2 (`docker compose version`)
- Uprawnienia root (`sudo`)
- Port fizyczny serwera z dostępem do sieci, w której pracują panele LED

## Instalacja (3 polecenia)

```bash
tar -xzf wled-warehouse-<wersja>.tar.gz
cd wled-warehouse-<wersja>
sudo ./install.sh
```

Instalator zada kilka pytań (katalog, login/hasło admina, adres IP kontenera,
sieć paneli, sposób udostępnienia UI) i sam:

1. wczyta obraz Dockera z paczki,
2. skopiuje kod do katalogu aplikacji (domyślnie `/opt/wled_warehouse`),
3. utworzy `.env` z losowym `JWT_SECRET`,
4. skonfiguruje dostęp do UI z sieci Rhenus i Tailscale (publikacja portu na hoście),
5. utworzy sieć macvlan (z obsługą VLAN-u 8 na porcie trunk), jeśli jej nie ma,
6. odtworzy repozytorium git z bundla i ustawi `origin`,
7. zaimportuje bazę danych dołączoną do paczki,
8. wystartuje aplikację i sprawdzi `/api/health`.

Po zakończeniu instalator wypisze adres, pod którym działa aplikacja
(np. `http://192.168.200.11:3000`).

> **Logowanie:** jeśli paczka zawiera bazę z serwera źródłowego, obowiązują
> dotychczasowe konta i hasła. `ADMIN_PASSWORD` z `.env` tworzy administratora
> tylko wtedy, gdy baza jest pusta.

## Sieć — co instalator robi, a czego nie

Panele pracują w **VLAN 8 (ITX), 192.168.188.0/23**, bez routingu i bez internetu.
Kontener dostaje w tym VLAN-ie jeden adres (macvlan) i tylko on rozmawia z panelami.

Dostęp dla ludzi idzie **przez hosta**: nakładka `docker-compose.access.yml`
publikuje port aplikacji, więc UI jest osiągalne z sieci Rhenus i przez Tailscale.
Działa to, bo przeglądarka rozmawia wyłącznie z aplikacją (`/api/...`), a do paneli
sięga backend w kontenerze.

**Instalator nigdy nie trasuje VLAN-u paneli na zewnątrz.** Nie rozgłaszaj
`192.168.188.0/23` w Tailscale ani nie włączaj forwardowania na hoście — komplet
reguł jest w `CLAUDE.md` (sekcja 1).

## Git i Claude Code na serwerze

Paczka zawiera pełną historię repozytorium (bundle), więc po instalacji
`/opt/wled_warehouse` jest normalnym repo z ustawionym `origin` na GitHub:

```bash
cd /opt/wled_warehouse
git status
git add -A && git commit -m "opis zmiany"
git push            # po wgraniu klucza deploy / tokena
```

W repozytorium są też `CLAUDE.md` (architektura, zasady izolacji sieci, procedury)
oraz `.claude/settings.json` (uprawnienia Claude Code wraz z deny-listą blokującą
zmiany sieci hosta). Claude Code uruchomiony w tym katalogu czyta je automatycznie.

## Co gdzie leży

| Element | Lokalizacja |
|---|---|
| Kod aplikacji | `/opt/wled_warehouse` (edytowalny, montowany do kontenera) |
| Konfiguracja | `/opt/wled_warehouse/.env` (uprawnienia 600) |
| Dane (baza SQLite) | wolumen Dockera `*_wled_warehouse_data` |
| Kopie zapasowe | `/opt/wled_warehouse/backups/` |
| Zasady dla Claude Code | `/opt/wled_warehouse/CLAUDE.md`, `.claude/settings.json` |

## Codzienna obsługa

> Polecenia `docker compose` uruchamiaj **z katalogu aplikacji** (`cd /opt/wled_warehouse`).
> Flaga `--project-directory` pomija `COMPOSE_FILE` z `.env`, więc wyłączyłaby
> publikację portu na hoście.

```bash
cd /opt/wled_warehouse

docker compose logs -f          # podgląd logów
docker compose restart          # restart (np. po edycji kodu w backend/)
docker compose up -d            # po KAŻDEJ zmianie w .env (restart nie wystarczy)
docker compose down             # zatrzymanie

./deploy/backup.sh              # kopia bazy + .env do backups/
./deploy/restore.sh <archiwum>  # odtworzenie danych z kopii
```

## Aktualizacja do nowszej wersji

```bash
tar -xzf wled-warehouse-<nowa-wersja>.tar.gz
cd wled-warehouse-<nowa-wersja>
sudo ./update.sh --app-dir /opt/wled_warehouse
```

`update.sh` robi kopię bazy, podmienia kod i obraz, zachowuje `.env` i dane.

## Edycja kodu na serwerze

Kod jest montowany z katalogu hosta, więc pliki w `/opt/wled_warehouse/backend/`
można edytować bezpośrednio na serwerze:

```bash
vi /opt/wled_warehouse/backend/routes/devices.js
cd /opt/wled_warehouse && docker compose restart
```

Zmiany we frontendzie wymagają przebudowania (`cd frontend && npm run build`) —
to wymaga Node i internetu, więc frontend buduje się zwykle na maszynie
deweloperskiej i trafia na serwer w kolejnej paczce.

## Gdy coś nie działa

| Objaw | Sprawdź |
|---|---|
| `install.sh` kończy się na braku sieci | `docker network ls` — czy istnieje sieć z `.env` (`DOCKER_NETWORK`) |
| Aplikacja nie odpowiada | `docker compose logs --tail 50` |
| Panele niewidoczne w skanowaniu | Czy `CONTAINER_IP` jest w podsieci paneli i poza pulą DHCP; czy VLAN na porcie trunk jest tagowany |
| Aplikacja nieosiągalna z hosta | macvlan izoluje host od kontenera — patrz „shim” w `MIGRATION.md` |
| Zły czas na panelach | `TZ` w `.env`, potem `docker compose up -d` (nie `restart`) |

Szczegóły sieciowe (macvlan, VLAN na trunku, trwałość po restarcie, dostęp z hosta)
opisuje `MIGRATION.md` w katalogu aplikacji.
