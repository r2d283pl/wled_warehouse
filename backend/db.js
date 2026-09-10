const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || '/app/data/wled_warehouse.db';
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'operator' CHECK(role IN ('admin', 'operator')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ip TEXT NOT NULL,
      size TEXT DEFAULT '16x32',
      type TEXT DEFAULT 'matrix' CHECK(type IN ('matrix', 'strip', 'panel')),
      location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      last_seen TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      grid_cols INTEGER DEFAULT 4,
      tiles_per_page INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('power','smart-toggle','playlist','text-display','clock','status-indicator','pattern','color')),
      title TEXT DEFAULT '',
      config TEXT DEFAULT '{}',
      pos_x INTEGER DEFAULT 0,
      pos_y INTEGER DEFAULT 0,
      width INTEGER DEFAULT 1,
      height INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tile_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tile_id INTEGER NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      UNIQUE(tile_id, device_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT DEFAULT '',
      action TEXT NOT NULL,
      target_type TEXT DEFAULT '',
      target_id INTEGER,
      details TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      wled_preset_id INTEGER,
      name TEXT NOT NULL,
      label TEXT DEFAULT '',
      color TEXT DEFAULT 'blue',
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
      pixel_data TEXT NOT NULL,
      width INTEGER DEFAULT 16,
      height INTEGER DEFAULT 32,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS device_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      UNIQUE(group_id, device_id)
    );

    -- ===== Strefy (obszary) — model nadrzędny =====
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      grid_cols INTEGER DEFAULT 4,
      layout_locked INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Grupy użytkowników
    CREATE TABLE IF NOT EXISTS user_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    );

    -- Dostęp do strefy: dla pojedynczego użytkownika LUB grupy użytkowników
    CREATE TABLE IF NOT EXISTS area_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      CHECK ((user_id IS NOT NULL) <> (group_id IS NOT NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_area_access_user  ON area_access(area_id, user_id)  WHERE user_id  IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_area_access_group ON area_access(area_id, group_id) WHERE group_id IS NOT NULL;

    -- Ustawienia aplikacji (klucz-wartość) — np. domyślna podsieć skanowania
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Baza panelu: co panel ma "normalnie" pokazywać (kolor/grafika/preset/off) — wspólne dla
    -- wszystkich przeglądarek, by przywracanie po tekście/zegarze działało niezależnie od urządzenia.
    CREATE TABLE IF NOT EXISTS panel_base (
      device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      base TEXT
    );

    -- Harmonogram jasności/wł-wył wg godzin (backendowy, niezależny od przeglądarki)
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      time TEXT NOT NULL,                 -- 'HH:MM' (czas lokalny serwera / TZ)
      action TEXT NOT NULL DEFAULT 'bri', -- 'bri' | 'off' | 'on'
      value INTEGER DEFAULT 128,          -- jasność 0-255 dla action='bri'
      scope TEXT DEFAULT 'all',           -- 'all' | 'area'
      area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
      days TEXT DEFAULT '*',              -- CSV dni tygodnia (0=Nd..6=So) lub '*' = codziennie
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Szablony konfiguracji WLED (zapisany "wygląd" do zastosowania na panelach/strefach)
    CREATE TABLE IF NOT EXISTS config_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      state TEXT NOT NULL DEFAULT '{}',
      source_device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  migrate();
}

// Idempotentne migracje kolumn/danych dla istniejących baz
function migrate() {
  const hasColumn = (table, col) =>
    db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === col);

  // Panel należy do strefy
  if (!hasColumn('devices', 'area_id')) {
    db.exec('ALTER TABLE devices ADD COLUMN area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL');
  }
  // Kafelki należą do strefy (obok dotychczasowego dashboard_id, na czas przejścia)
  if (!hasColumn('tiles', 'area_id')) {
    db.exec('ALTER TABLE tiles ADD COLUMN area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE');
  }
  // Trwały znacznik migracji dashboardu -> strefa (idempotentny niezależnie od liczby kafelków)
  if (!hasColumn('dashboards', 'area_id')) {
    db.exec('ALTER TABLE dashboards ADD COLUMN area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL');
  }

  // Kafelek może należeć do strefy LUB dashboardu -> dashboard_id musi być nullable.
  // SQLite nie zdejmie NOT NULL przez ALTER, więc przebudowujemy tabelę (idempotentnie).
  const dashCol = db.prepare("PRAGMA table_info(tiles)").all().find(c => c.name === 'dashboard_id');
  if (dashCol && dashCol.notnull === 1) {
    db.pragma('foreign_keys = OFF');
    const rebuild = db.transaction(() => {
      db.exec(`
        CREATE TABLE tiles_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dashboard_id INTEGER REFERENCES dashboards(id) ON DELETE CASCADE,
          area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('power','smart-toggle','playlist','text-display','clock','status-indicator','pattern','color')),
          title TEXT DEFAULT '',
          config TEXT DEFAULT '{}',
          pos_x INTEGER DEFAULT 0,
          pos_y INTEGER DEFAULT 0,
          width INTEGER DEFAULT 1,
          height INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          CHECK (dashboard_id IS NOT NULL OR area_id IS NOT NULL)
        );
        INSERT INTO tiles_new (id, dashboard_id, area_id, type, title, config, pos_x, pos_y, width, height, sort_order, created_at, updated_at)
          SELECT id, dashboard_id, area_id, type, title, config, pos_x, pos_y, width, height, sort_order, created_at, updated_at FROM tiles;
        DROP TABLE tiles;
        ALTER TABLE tiles_new RENAME TO tiles;
      `);
    });
    rebuild();
    db.pragma('foreign_keys = ON');
  }

  // audit_log.user_id: zdejmij NOT NULL — kolidowało z ON DELETE SET NULL i blokowało
  // usuwanie użytkowników mających wpisy w audycie (kolumna username zachowuje czytelny ślad).
  const auditUid = db.prepare("PRAGMA table_info(audit_log)").all().find(c => c.name === 'user_id');
  if (auditUid && auditUid.notnull === 1) {
    db.pragma('foreign_keys = OFF');
    const rebuildAudit = db.transaction(() => {
      db.exec(`
        CREATE TABLE audit_log_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          username TEXT DEFAULT '',
          action TEXT NOT NULL,
          target_type TEXT DEFAULT '',
          target_id INTEGER,
          details TEXT DEFAULT '{}',
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO audit_log_new (id, user_id, username, action, target_type, target_id, details, created_at)
          SELECT id, user_id, username, action, target_type, target_id, details, created_at FROM audit_log;
        DROP TABLE audit_log;
        ALTER TABLE audit_log_new RENAME TO audit_log;
      `);
    });
    rebuildAudit();
    db.pragma('foreign_keys = ON');
    console.log('Migracja: audit_log.user_id ustawiono jako NULLABLE (umożliwia usuwanie userów)');
  }

  // Backfill 1:1, jednorazowo: tylko dashboardy bez przypisanej strefy
  const dashboards = db.prepare('SELECT * FROM dashboards WHERE area_id IS NULL').all();
  const migrateDash = db.transaction(() => {
    for (const dash of dashboards) {
      const area = db.prepare(
        'INSERT INTO areas (name, grid_cols, sort_order) VALUES (?, ?, ?)'
      ).run(dash.name, dash.grid_cols || 4, dash.sort_order || 0);
      const areaId = area.lastInsertRowid;

      db.prepare('UPDATE dashboards SET area_id = ? WHERE id = ?').run(areaId, dash.id);
      db.prepare('UPDATE tiles SET area_id = ? WHERE dashboard_id = ? AND area_id IS NULL')
        .run(areaId, dash.id);

      // właściciel dashboardu dostaje dostęp do nowej strefy
      if (dash.user_id) {
        db.prepare('INSERT OR IGNORE INTO area_access (area_id, user_id) VALUES (?, ?)')
          .run(areaId, dash.user_id);
      }
    }
  });
  if (dashboards.length) migrateDash();
}

module.exports = { getDb, logAction };

function logAction(user, action, targetType, targetId, details) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO audit_log (user_id, username, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      user?.id || 0,
      user?.username || 'system',
      action,
      targetType || '',
      targetId || null,
      JSON.stringify(details || {})
    );
  } catch (e) {
    console.error('Audit log insert failed:', e.message);
  }
}