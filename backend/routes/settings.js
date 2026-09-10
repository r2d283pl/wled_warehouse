const express = require('express');
const os = require('os');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Klucze ustawień edytowalnych w aplikacji (efektywne natychmiast)
const ALLOWED = ['scan_subnet', 'scan_start', 'scan_end'];

// Domyślne wartości (gdy brak w DB) — z env lub stałe
function defaults() {
  return {
    scan_subnet: process.env.SCAN_SUBNET || '192.168.200',
    scan_start: '1',
    scan_end: '254',
  };
}

// Odczyt pojedynczego ustawienia z DB z fallbackiem na default (używane też przez discovery)
function getSetting(key) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (row && row.value != null) return row.value;
  } catch { /* brak tabeli/itp. */ }
  return defaults()[key];
}

router.use(authenticateToken, requireAdmin);

// Pierwszy adres IPv4 spoza pętli zwrotnej (informacyjnie — IP kontenera w sieci)
function primaryIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === 'IPv4' && !i.internal) return i.address;
    }
  }
  return null;
}

// GET /api/settings — ustawienia aplikacji + (tylko do odczytu) parametry wdrożenia
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const app = {};
    for (const k of ALLOWED) app[k] = stored[k] ?? defaults()[k];

    res.json({
      app,
      deployment: {
        port: process.env.PORT || '3000',
        tz: process.env.TZ || '(systemowa)',
        container_ip: process.env.CONTAINER_IP || primaryIp(),
        network: process.env.DOCKER_NETWORK || '(z docker-compose)',
        node_env: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err) {
    console.error('Settings get error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/settings — zapis ustawień aplikacji (tylko klucze z ALLOWED)
router.put('/', (req, res) => {
  try {
    const db = getDb();
    const body = req.body || {};
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

    const updated = [];
    for (const k of ALLOWED) {
      if (body[k] !== undefined && body[k] !== null) {
        upsert.run(k, String(body[k]));
        updated.push(k);
      }
    }
    if (!updated.length) return res.status(400).json({ error: 'Brak prawidłowych ustawień do zapisu' });

    logAction(req.user, 'update_settings', 'settings', null, { keys: updated.join(',') });
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const app = {};
    for (const k of ALLOWED) app[k] = stored[k] ?? defaults()[k];
    res.json({ app, updated });
  } catch (err) {
    console.error('Settings put error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
module.exports.getSetting = getSetting;
