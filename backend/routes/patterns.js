const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const animator = require('../patternAnimator');

const router = express.Router();
router.use(authenticateToken);

// Rozwija cele {device_ids, area_ids} na unikalną listę paneli [{id, ip}]
function resolveTargets(db, body) {
  const ids = new Set((body.device_ids || []).map(Number));
  if (Array.isArray(body.area_ids) && body.area_ids.length) {
    const ph = body.area_ids.map(() => '?').join(',');
    db.prepare(`SELECT id FROM devices WHERE area_id IN (${ph})`).all(...body.area_ids).forEach(r => ids.add(r.id));
  }
  if (!ids.size) return [];
  const ph = [...ids].map(() => '?').join(',');
  return db.prepare(`SELECT id, ip FROM devices WHERE id IN (${ph})`).all(...ids);
}

// GET /api/patterns — lista wzorów (z pełnymi danymi pikseli — wzory są niewielkie)
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare('SELECT * FROM patterns ORDER BY name').all();
    res.json(rows.map(r => ({ ...r, pixel_data: JSON.parse(r.pixel_data || '{}') })));
  } catch (err) {
    console.error('Patterns list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/patterns/:id/send — wyślij wzór na panele/strefy (statyczny = 1 klatka; animacja = pętla)
router.post('/:id/send', async (req, res) => {
  try {
    const db = getDb();
    const p = db.prepare('SELECT * FROM patterns WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Wzór nie istnieje' });

    const data = JSON.parse(p.pixel_data || '{}');
    const frames = data.frames || [];
    if (!frames.length) return res.status(400).json({ error: 'Wzór nie ma klatek' });

    const targets = resolveTargets(db, req.body || {});
    if (!targets.length) return res.status(400).json({ error: 'Nie wskazano paneli ani stref' });

    animator.stop(targets.map(t => t.id)); // zatrzymaj ewentualną wcześniejszą animację

    const animated = frames.length > 1;
    if (animated) {
      animator.start(targets, frames, p.width, p.height, data);
    } else {
      const segI = animator.buildSegI(frames[0], p.width, p.height, data.mapping || {});
      await Promise.all(targets.map(t => animator.sendFrame(t.ip, segI, data.bri).catch(() => {})));
    }

    logAction(req.user, 'send_pattern', 'pattern', p.id, { name: p.name, targets: targets.length, animated });
    res.json({ success: true, devices: targets.length, animated });
  } catch (err) {
    console.error('Pattern send error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/patterns/send-adhoc — wyślij BIEŻĄCE klatki z edytora (bez zapisywania wzoru)
router.post('/send-adhoc', async (req, res) => {
  try {
    const db = getDb();
    const body = req.body || {};
    const frames = Array.isArray(body.frames) ? body.frames : [];
    const width = parseInt(body.width), height = parseInt(body.height);
    if (!frames.length) return res.status(400).json({ error: 'Brak klatek do wysłania' });
    if (!width || !height) return res.status(400).json({ error: 'Brak wymiarów rysunku' });

    const data = { speed: body.speed, loop: body.loop, bri: body.bri, mapping: body.mapping || {} };
    const targets = resolveTargets(db, body);
    if (!targets.length) return res.status(400).json({ error: 'Nie wskazano paneli ani stref' });

    animator.stop(targets.map(t => t.id)); // zatrzymaj ewentualną wcześniejszą animację

    const animated = frames.length > 1;
    if (animated) {
      animator.start(targets, frames, width, height, data);
    } else {
      const segI = animator.buildSegI(frames[0], width, height, data.mapping || {});
      await Promise.all(targets.map(t => animator.sendFrame(t.ip, segI, data.bri).catch(() => {})));
    }

    logAction(req.user, 'send_pattern_adhoc', 'pattern', null, { targets: targets.length, animated, width, height, frames: frames.length });
    res.json({ success: true, devices: targets.length, animated });
  } catch (err) {
    console.error('Pattern adhoc send error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/patterns/stop — zatrzymaj animację i zgaś wskazane panele/strefy
router.post('/stop', async (req, res) => {
  try {
    const db = getDb();
    const targets = resolveTargets(db, req.body || {});
    animator.stop(targets.map(t => t.id));
    await Promise.all(targets.map(t => fetch(`http://${t.ip}/json/state`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seg: [{ frz: false }], on: false }), signal: AbortSignal.timeout(2500),
    }).catch(() => {})));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ===== CRUD wzorów — tylko admin =====
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name, width, height, pixel_data } = req.body || {};
    if (!name || !width || !height) return res.status(400).json({ error: 'Nazwa i rozmiar są wymagane' });
    const db = getDb();
    const result = db.prepare('INSERT INTO patterns (name, width, height, pixel_data) VALUES (?, ?, ?, ?)')
      .run(name, width, height, JSON.stringify(pixel_data || { frames: [] }));
    const row = db.prepare('SELECT * FROM patterns WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_pattern', 'pattern', row.id, { name, size: `${width}x${height}` });
    res.status(201).json({ ...row, pixel_data: JSON.parse(row.pixel_data) });
  } catch (err) {
    console.error('Pattern create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { name, width, height, pixel_data } = req.body || {};
    const db = getDb();
    const p = db.prepare('SELECT id FROM patterns WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Wzór nie istnieje' });
    const updates = [], params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (width !== undefined) { updates.push('width = ?'); params.push(width); }
    if (height !== undefined) { updates.push('height = ?'); params.push(height); }
    if (pixel_data !== undefined) { updates.push('pixel_data = ?'); params.push(JSON.stringify(pixel_data)); }
    if (!updates.length) return res.status(400).json({ error: 'Brak danych' });
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE patterns SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const row = db.prepare('SELECT * FROM patterns WHERE id = ?').get(req.params.id);
    logAction(req.user, 'update_pattern', 'pattern', row.id, { name: row.name });
    res.json({ ...row, pixel_data: JSON.parse(row.pixel_data) });
  } catch (err) {
    console.error('Pattern update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const p = db.prepare('SELECT name FROM patterns WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM patterns WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_pattern', 'pattern', parseInt(req.params.id), { name: p?.name });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
