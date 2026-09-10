const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

// Sonduje pojedynczy adres IP pod kątem urządzenia WLED (/json/info).
async function probe(ip) {
  try {
    const res = await fetch(`http://${ip}/json/info`, { signal: AbortSignal.timeout(1200) });
    if (!res.ok) return null;
    const info = await res.json();
    // WLED zwraca brand:"WLED" oraz obiekt leds. Akceptujemy też starsze fw bez brand.
    if (!info || (info.brand !== 'WLED' && !info.leds)) return null;

    const m = info.leds && info.leds.matrix;
    return {
      ip,
      name: info.name || `WLED-${ip}`,
      mac: info.mac || '',
      version: info.ver || '',
      ledCount: (info.leds && info.leds.count) || 0,
      matrix: m ? `${m.w}x${m.h}` : null,
    };
  } catch {
    return null; // brak odpowiedzi / timeout / nie-WLED
  }
}

// Skanuje zakres base.start ... base.end z ograniczoną równoległością.
async function scanRange(base, start, end, concurrency = 32) {
  const ips = [];
  for (let i = start; i <= end; i++) ips.push(`${base}.${i}`);

  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < ips.length) {
      const ip = ips[idx++];
      const found = await probe(ip);
      if (found) results.push(found);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ips.length) }, worker));
  results.sort((a, b) => {
    const na = parseInt(a.ip.split('.').pop(), 10);
    const nb = parseInt(b.ip.split('.').pop(), 10);
    return na - nb;
  });
  return results;
}

// POST /api/discovery/scan — skan podsieci HTTP w poszukiwaniu paneli WLED
router.post('/scan', async (req, res) => {
  try {
    const { getSetting } = require('./settings');
    let { subnet, start, end } = req.body || {};
    subnet = String(subnet || getSetting('scan_subnet') || '192.168.200').trim();

    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(subnet)) {
      return res.status(400).json({ error: 'Nieprawidłowy prefiks podsieci (np. 192.168.200)' });
    }
    start = Math.max(0, Math.min(255, parseInt(start ?? getSetting('scan_start'), 10) || 1));
    end = Math.max(start, Math.min(255, parseInt(end ?? getSetting('scan_end'), 10) || 254));

    const devices = await scanRange(subnet, start, end);

    const db = getDb();
    const existing = new Set(db.prepare('SELECT ip FROM devices').all().map(r => r.ip));
    devices.forEach(d => { d.alreadyAdded = existing.has(d.ip); });

    logAction(req.user, 'scan_network', 'discovery', null, { subnet, start, end, found: devices.length });
    res.json({ subnet, start, end, count: devices.length, devices });
  } catch (err) {
    console.error('Network scan error:', err);
    res.status(500).json({ error: 'Błąd skanowania sieci' });
  }
});

// POST /api/discovery/probe — sprawdź pojedynczy IP (np. do auto-uzupełnienia przy ręcznym dodawaniu)
router.post('/probe', async (req, res) => {
  try {
    const { ip } = req.body || {};
    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return res.status(400).json({ error: 'Podaj prawidłowy adres IP' });
    }
    const info = await probe(ip);
    if (!info) return res.status(404).json({ error: 'Nie znaleziono urządzenia WLED pod tym adresem' });
    res.json(info);
  } catch (err) {
    console.error('Probe error:', err);
    res.status(500).json({ error: 'Błąd sprawdzania urządzenia' });
  }
});

module.exports = router;
