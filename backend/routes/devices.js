const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All device management requires authentication
router.use(authenticateToken);

// GET /api/devices — list all devices
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const devices = db.prepare('SELECT * FROM devices ORDER BY location, name').all();
    res.json(devices);
  } catch (err) {
    console.error('Devices list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ===== Proxy stanu/metadanych paneli (backend jest w sieci paneli — działa z każdego urządzenia) =====
const _metaCache = {}; // ip -> { fx, pal }
let _statusCache = { t: 0, data: null };

async function panelState(ip) {
  const r = await fetch(`http://${ip}/json/state`, { signal: AbortSignal.timeout(2000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function panelMeta(ip) {
  if (_metaCache[ip]) return _metaCache[ip];
  let fx = 122, pal = 2;
  try { const eff = await (await fetch(`http://${ip}/json/eff`, { signal: AbortSignal.timeout(2500) })).json(); const i = eff.findIndex(e => /scrolling\s*text/i.test(e)); if (i >= 0) fx = i; } catch {}
  try { const p = await (await fetch(`http://${ip}/json/pal`, { signal: AbortSignal.timeout(2500) })).json(); const i = p.findIndex(x => /^\*?\s*color 1$/i.test(String(x).trim())); if (i >= 0) pal = i; } catch {}
  _metaCache[ip] = { fx, pal };
  return _metaCache[ip];
}

// GET /api/devices/status — zbiorczy status wszystkich paneli (online/on/kolor), z krótkim cache
router.get('/status', async (req, res) => {
  try {
    if (_statusCache.data && Date.now() - _statusCache.t < 2500) return res.json(_statusCache.data);
    const db = getDb();
    const devices = db.prepare('SELECT id, ip FROM devices').all();
    const entries = await Promise.all(devices.map(async d => {
      try {
        const s = await panelState(d.ip);
        return [d.id, { online: true, on: s.on, bri: s.bri, ps: s.ps, col0: s.seg?.[0]?.col?.[0] || null }];
      } catch { return [d.id, { online: false, on: false }]; }
    }));
    const data = Object.fromEntries(entries);
    _statusCache = { t: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error('Devices status error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/devices/:id/state — surowy stan panelu (proxy) — do zapamiętania przed tekstem/zegarem
router.get('/:id/state', async (req, res) => {
  try {
    const db = getDb();
    const dev = db.prepare('SELECT ip FROM devices WHERE id = ?').get(req.params.id);
    if (!dev) return res.status(404).json({ error: 'Urządzenie nie istnieje' });
    const s = await panelState(dev.ip);
    res.json({ on: s.on, bri: s.bri, seg: s.seg });
  } catch (err) {
    res.status(502).json({ error: `Brak odpowiedzi: ${err.message}` });
  }
});

// GET /api/devices/:id/wledmeta — indeks efektu "Scrolling Text" i palety "Color 1" (cache)
router.get('/:id/wledmeta', async (req, res) => {
  try {
    const db = getDb();
    const dev = db.prepare('SELECT ip FROM devices WHERE id = ?').get(req.params.id);
    if (!dev) return res.status(404).json({ error: 'Urządzenie nie istnieje' });
    res.json(await panelMeta(dev.ip));
  } catch (err) {
    res.json({ fx: 122, pal: 2 });
  }
});

// GET /api/devices/base — mapa baz wszystkich paneli { deviceId: base }
router.get('/base', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT device_id, base FROM panel_base').all();
    const out = {};
    for (const r of rows) { try { out[r.device_id] = JSON.parse(r.base); } catch { /* skip */ } }
    res.json(out);
  } catch (err) {
    console.error('Panel base list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/devices/:id/base — zapisz bazę panelu (operatorskie)
router.post('/:id/base', (req, res) => {
  try {
    const { base } = req.body || {};
    getDb().prepare('INSERT INTO panel_base (device_id, base) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET base = excluded.base')
      .run(req.params.id, JSON.stringify(base || null));
    res.json({ success: true });
  } catch (err) {
    console.error('Panel base set error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/devices/:id — single device details
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Urządzenie nie istnieje' });

    const presets = db.prepare('SELECT * FROM presets WHERE device_id = ? ORDER BY name').all(device.id);

    res.json({ ...device, presets });
  } catch (err) {
    console.error('Device detail error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/devices/:id/command — wyślij komendę do panelu (dostępne też dla operatorów,
// bo to podstawowa akcja sterowania panelami na dashboardzie operatora)
router.post('/:id/command', async (req, res) => {
  try {
    const db = getDb();
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Urządzenie nie istnieje' });

    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Brak danych komendy' });
    }

    try {
      const response = await fetch(`http://${device.ip}/json/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        return res.status(502).json({ error: `WLED odpowiedział błędem HTTP ${response.status}` });
      }

      const wledResult = await response.json();
      logAction(req.user, 'command_device', 'device', device.id, {
        payload: Object.keys(payload).join(',')
      });
      res.json({ success: true, result: wledResult });
    } catch (fetchErr) {
      res.status(502).json({ error: `Błąd połączenia: ${fetchErr.message}` });
    }
  } catch (err) {
    console.error('Device command error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ===== Operacje zapisu — wymagają admina (per-trasa, by /wled/* przeszło do routera wled.js) =====

// POST /api/devices — add a new device
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name, ip, size, type, location, notes, area_id } = req.body;

    if (!name || !ip) {
      return res.status(400).json({ error: 'Nazwa i adres IP są wymagane' });
    }

    const db = getDb();

    const existing = db.prepare('SELECT id FROM devices WHERE ip = ?').get(ip);
    if (existing) {
      return res.status(409).json({ error: 'Urządzenie z tym adresem IP już istnieje' });
    }

    const result = db.prepare(
      'INSERT INTO devices (name, ip, size, type, location, notes, area_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, ip, size || '16x32', type || 'matrix', location || '', notes || '', area_id || null);

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_device', 'device', device.id, { name, ip, location, type });
    res.status(201).json(device);
  } catch (err) {
    console.error('Device create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/devices/:id — update device
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip, size, type, location, notes, active, area_id } = req.body;

    const db = getDb();
    const device = db.prepare('SELECT id, name, ip FROM devices WHERE id = ?').get(id);
    if (!device) return res.status(404).json({ error: 'Urządzenie nie istnieje' });

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (ip !== undefined) { updates.push('ip = ?'); params.push(ip); }
    if (size !== undefined) { updates.push('size = ?'); params.push(size); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (area_id !== undefined) { updates.push('area_id = ?'); params.push(area_id || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Brak danych do aktualizacji' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAction(req.user, 'update_device', 'device', parseInt(id), {
      name: name || device.name,
      ip: ip || device.ip
    });

    const updated = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Device update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/devices/:id
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const device = db.prepare('SELECT id, name FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Urządzenie nie istnieje' });

    db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_device', 'device', parseInt(req.params.id), {
      name: device.name
    });
    res.json({ success: true, message: 'Urządzenie usunięte' });
  } catch (err) {
    console.error('Device delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/devices/:id/scan — scan WLED device for presets/status
router.post('/:id/scan', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
    if (!device) return res.status(404).json({ error: 'Urządzenie nie istnieje' });

    const results = { online: false, presets: [], info: null, error: null };

    try {
      const stateRes = await fetch(`http://${device.ip}/json/state?t=${Date.now()}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!stateRes.ok) throw new Error(`HTTP ${stateRes.status}`);
      const stateData = await stateRes.json();
      results.online = true;
      results.state = { on: stateData.on, ps: stateData.ps || 0, bri: stateData.bri };
    } catch (fetchErr) {
      results.error = `Brak odpowiedzi: ${fetchErr.message}`;
      db.prepare("UPDATE devices SET last_seen = NULL WHERE id = ?").run(device.id);
      return res.json(results);
    }

    try {
      const presetsRes = await fetch(`http://${device.ip}/presets.json?t=${Date.now()}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (presetsRes.ok) {
        const presetsData = await presetsRes.json();
        results.presets = Object.entries(presetsData)
          .filter(([k]) => k !== '0')
          .map(([k, v]) => ({ id: parseInt(k), name: v.n || `Preset ${k}`, data: v }));
      }
    } catch (presetErr) {}

    try {
      const infoRes = await fetch(`http://${device.ip}/json/info?t=${Date.now()}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (infoRes.ok) {
        results.info = await infoRes.json();
      }
    } catch (infoErr) {}

    try {
      const [effRes, palRes] = await Promise.all([
        fetch(`http://${device.ip}/json/eff?t=${Date.now()}`, { signal: AbortSignal.timeout(2000) }),
        fetch(`http://${device.ip}/json/pal?t=${Date.now()}`, { signal: AbortSignal.timeout(2000) })
      ]);
      if (effRes.ok) results.effects = await effRes.json();
      if (palRes.ok) results.palettes = await palRes.json();
    } catch { /* optional */ }

    db.prepare("UPDATE devices SET last_seen = datetime('now') WHERE id = ?").run(device.id);

    logAction(req.user, 'scan_device', 'device', device.id, { online: results.online });
    res.json(results);
  } catch (err) {
    console.error('Device scan error:', err);
    res.status(500).json({ error: 'Błąd skanowania urządzenia' });
  }
});


// GET /api/devices/groups — list all device groups
router.get('/groups/list', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const groups = db.prepare('SELECT * FROM device_groups ORDER BY name').all();
    res.json(groups);
  } catch (err) {
    console.error('Groups list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/devices/groups — create a device group
router.post('/groups', requireAdmin, (req, res) => {
  try {
    const { name, description, device_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa grupy jest wymagana' });

    const db = getDb();
    const result = db.prepare('INSERT INTO device_groups (name, description) VALUES (?, ?)').run(name, description || '');

    if (device_ids && Array.isArray(device_ids)) {
      const insertMember = db.prepare('INSERT OR IGNORE INTO group_members (group_id, device_id) VALUES (?, ?)');
      for (const deviceId of device_ids) {
        insertMember.run(result.lastInsertRowid, deviceId);
      }
    }

    const group = db.prepare('SELECT * FROM device_groups WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_group', 'group', group.id, { name, device_count: device_ids?.length || 0 });
    res.status(201).json(group);
  } catch (err) {
    console.error('Group create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/devices/groups/:id
router.delete('/groups/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT name FROM device_groups WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM device_groups WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_group', 'group', parseInt(req.params.id), {
      name: group?.name || 'unknown'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Group delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;