const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

// Przechwytuje znormalizowany "wygląd" z żywego panelu (kolor/efekt/jasność),
// bez geometrii segmentów — dzięki temu da się zastosować na panelach o innym rozmiarze.
async function captureState(ip) {
  const res = await fetch(`http://${ip}/json/state`, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const s = await res.json();
  const main = (s.seg && (s.seg[s.mainseg || 0] || s.seg[0])) || {};
  return {
    on: s.on ?? true,
    bri: s.bri ?? 128,
    seg: [{
      col: main.col || [[255, 255, 255], [0, 0, 0], [0, 0, 0]],
      fx: main.fx ?? 0,
      sx: main.sx ?? 128,
      ix: main.ix ?? 128,
      pal: main.pal ?? 0,
    }],
  };
}

// Wysyła stan na panel; segment zawsze jako id:0 (główny), bez geometrii.
async function applyState(ip, state) {
  const payload = {
    on: state.on ?? true,
    bri: state.bri ?? 128,
    seg: (state.seg || [{}]).map((s, i) => ({ id: i, ...s })),
  };
  const res = await fetch(`http://${ip}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Rozwija cele {device_ids, area_ids} na unikalną listę paneli.
function resolveTargets(db, body) {
  const ids = new Set((body.device_ids || []).map(Number));
  if (Array.isArray(body.area_ids) && body.area_ids.length) {
    const placeholders = body.area_ids.map(() => '?').join(',');
    db.prepare(`SELECT id FROM devices WHERE area_id IN (${placeholders})`)
      .all(...body.area_ids)
      .forEach(r => ids.add(r.id));
  }
  if (!ids.size) return [];
  const placeholders = [...ids].map(() => '?').join(',');
  return db.prepare(`SELECT id, name, ip FROM devices WHERE id IN (${placeholders})`).all(...ids);
}

// Stosuje stan na wszystkich celach, zwraca wynik per panel.
async function applyToAll(targets, state) {
  return Promise.all(targets.map(async (dev) => {
    try {
      await applyState(dev.ip, state);
      return { device_id: dev.id, name: dev.name, ip: dev.ip, ok: true };
    } catch (e) {
      return { device_id: dev.id, name: dev.name, ip: dev.ip, ok: false, error: e.message };
    }
  }));
}

// GET /api/templates — lista szablonów
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT t.*, d.name AS source_name
      FROM config_templates t
      LEFT JOIN devices d ON d.id = t.source_device_id
      ORDER BY t.name
    `).all();
    res.json(rows.map(r => ({ ...r, state: JSON.parse(r.state || '{}') })));
  } catch (err) {
    console.error('Templates list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/templates/capture — podgląd stanu z panelu (bez zapisu)
router.post('/capture', async (req, res) => {
  try {
    const { device_id } = req.body || {};
    const db = getDb();
    const dev = db.prepare('SELECT id, ip FROM devices WHERE id = ?').get(device_id);
    if (!dev) return res.status(404).json({ error: 'Urządzenie nie istnieje' });
    const state = await captureState(dev.ip);
    res.json({ state });
  } catch (err) {
    res.status(502).json({ error: `Nie udało się odczytać panelu: ${err.message}` });
  }
});

// POST /api/templates — utwórz szablon (z urządzenia źródłowego lub z jawnego state)
router.post('/', async (req, res) => {
  try {
    const { name, description, from_device_id, state } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nazwa szablonu jest wymagana' });

    const db = getDb();
    let finalState = state;
    let sourceId = null;

    if (from_device_id) {
      const dev = db.prepare('SELECT id, ip FROM devices WHERE id = ?').get(from_device_id);
      if (!dev) return res.status(404).json({ error: 'Urządzenie źródłowe nie istnieje' });
      try {
        finalState = await captureState(dev.ip);
      } catch (e) {
        return res.status(502).json({ error: `Nie udało się odczytać panelu: ${e.message}` });
      }
      sourceId = dev.id;
    }

    if (!finalState || typeof finalState !== 'object') {
      return res.status(400).json({ error: 'Brak konfiguracji (state) lub urządzenia źródłowego' });
    }

    const result = db.prepare(
      'INSERT INTO config_templates (name, description, state, source_device_id) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', JSON.stringify(finalState), sourceId);

    const tpl = db.prepare('SELECT * FROM config_templates WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_template', 'template', tpl.id, { name, source_device_id: sourceId });
    res.status(201).json({ ...tpl, state: JSON.parse(tpl.state) });
  } catch (err) {
    console.error('Template create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/templates/:id — aktualizuj nazwę/opis/state
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, state } = req.body || {};

    const db = getDb();
    const tpl = db.prepare('SELECT id, name FROM config_templates WHERE id = ?').get(id);
    if (!tpl) return res.status(404).json({ error: 'Szablon nie istnieje' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (state !== undefined) { updates.push('state = ?'); params.push(JSON.stringify(state)); }
    if (!updates.length) return res.status(400).json({ error: 'Brak danych do aktualizacji' });

    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE config_templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAction(req.user, 'update_template', 'template', parseInt(id), { name: name || tpl.name });
    const updated = db.prepare('SELECT * FROM config_templates WHERE id = ?').get(id);
    res.json({ ...updated, state: JSON.parse(updated.state) });
  } catch (err) {
    console.error('Template update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const tpl = db.prepare('SELECT name FROM config_templates WHERE id = ?').get(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Szablon nie istnieje' });
    db.prepare('DELETE FROM config_templates WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_template', 'template', parseInt(req.params.id), { name: tpl.name });
    res.json({ success: true });
  } catch (err) {
    console.error('Template delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/templates/:id/apply — zastosuj szablon na panelach/strefach
router.post('/:id/apply', async (req, res) => {
  try {
    const db = getDb();
    const tpl = db.prepare('SELECT * FROM config_templates WHERE id = ?').get(req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Szablon nie istnieje' });

    const targets = resolveTargets(db, req.body || {});
    if (!targets.length) return res.status(400).json({ error: 'Nie wskazano paneli ani stref' });

    const state = JSON.parse(tpl.state || '{}');
    const results = await applyToAll(targets, state);
    const okCount = results.filter(r => r.ok).length;

    logAction(req.user, 'apply_template', 'template', tpl.id, { targets: targets.length, ok: okCount });
    res.json({ applied: okCount, total: results.length, results });
  } catch (err) {
    console.error('Template apply error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/templates/copy — bezpośrednie kopiowanie konfiguracji z panelu na panele/strefy
router.post('/copy', async (req, res) => {
  try {
    const { source_device_id } = req.body || {};
    const db = getDb();
    const src = db.prepare('SELECT id, ip, name FROM devices WHERE id = ?').get(source_device_id);
    if (!src) return res.status(404).json({ error: 'Urządzenie źródłowe nie istnieje' });

    let state;
    try {
      state = await captureState(src.ip);
    } catch (e) {
      return res.status(502).json({ error: `Nie udało się odczytać panelu źródłowego: ${e.message}` });
    }

    const targets = resolveTargets(db, req.body || {}).filter(t => t.id !== src.id);
    if (!targets.length) return res.status(400).json({ error: 'Nie wskazano paneli docelowych' });

    const results = await applyToAll(targets, state);
    const okCount = results.filter(r => r.ok).length;

    logAction(req.user, 'copy_config', 'device', src.id, { from: src.name, targets: targets.length, ok: okCount });
    res.json({ applied: okCount, total: results.length, results });
  } catch (err) {
    console.error('Copy config error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
