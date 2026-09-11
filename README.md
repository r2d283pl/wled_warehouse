# WLED Warehouse - System Zarządzania Strefami Magazynowymi

System do zarządzania matrycami LED WLED (ESP32) w strefach magazynowych.
Pozwala adminowi konfigurować urządzenia, dashboardy i użytkowników.
Operatorzy widzą tylko przypisane im panele i sterują strefami.

## Struktura projektu

```
/opt/wled_warehouse/
├── backend/
│   ├── server.js          # Główny serwer Express
│   ├── db.js              # Inicjalizacja SQLite
│   ├── routes/            # Endpointy API
│   │   ├── auth.js
│   │   ├── devices.js
│   │   ├── dashboards.js
│   │   └── users.js
│   └── middleware/
│       └── auth.js
├── frontend/
│   ├── src/               # React + Vite
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── .env
└── package.json
```

## Uruchomienie

```bash
cd /opt/wled_warehouse
docker compose up -d
```

## Wdrożenie na serwer docelowy

```bash
./deploy/make-package.sh     # buduje dist/wled-warehouse-<wersja>.tar.gz (offline)
```

Paczkę kopiuje się na serwer i rozpakowuje — `sudo ./install.sh` robi resztę
(obraz Dockera, `.env`, sieć macvlan, import bazy, start). Szczegóły:
[`deploy/INSTALL.md`](deploy/INSTALL.md) i [`MIGRATION.md`](MIGRATION.md).

## API Endpoints

- `POST /api/auth/login` - Logowanie
- `GET/POST /api/users` - Zarządzanie użytkownikami (admin)
- `GET/POST/PUT/DELETE /api/devices` - Zarządzanie urządzeniami WLED
- `GET/POST/PUT/DELETE /api/dashboards` - Dashboardy
- `POST /api/dashboards/:id/tiles` - Kafelki dashboardów
- `POST /api/devices/:id/command` - Wysłanie komendy do WLED
- `POST /api/devices/:id/scan` - Skanowanie presetów z WLED