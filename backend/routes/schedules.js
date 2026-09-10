const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// GET /api/schedules — lista reguł (z nazwą strefy)
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT s.*, a.name AS area_name
      FROM schedules s LEFT JOIN areas a ON a.id = s.area_id
      ORDER BY s.time
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Schedules list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

function validTime(t) { return /^\d{2}:\d{2}$/.test(t) && parseInt(t.slice(0, 2)) < 24 && parseInt(t.slice(3)) < 60; }

// POST /api/schedules — utwórz regułę
router.post('/', (req, res) => {
  try {
    const { name, time, action, value, scope, area_id, days, enabled } = req.body || {};
    if (!validTime(time)) return res.status(400).json({ error: 'Godzina w formacie HH:MM' });
    if (!['bri', 'off', 'on'].includes(action)) return res.status(400).json({ error: 'Nieprawidłowa akcja' });

    const db = getDb();
    const result = db.prepare(
      'INSERT INTO schedules (name, time, action, value, scope, area_id, days, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name || '', time, action,
      action === 'bri' ? Math.max(0, Math.min(255, parseInt(value) || 0)) : 0,
      scope === 'area' ? 'area' : 'all',
      scope === 'area' ? (area_id || null) : null,
      days || '*',
      enabled === false ? 0 : 1
    );
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_schedule', 'schedule', row.id, { time, action });
    res.status(201).json(row);
  } catch (err) {
    console.error('Schedule create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/schedules/:id — aktualizuj (m.in. włącz/wyłącz)
router.put('/:id', (req, res) => {
  try {
    const { name, time, action, value, scope, area_id, days, enabled } = req.body || {};
    const db = getDb();
    const s = db.prepare('SELECT id FROM schedules WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Reguła nie istnieje' });

    const u = [], p = [];
    if (name !== undefined) { u.push('name = ?'); p.push(name); }
    if (time !== undefined) { if (!validTime(time)) return res.status(400).json({ error: 'Godzina HH:MM' }); u.push('time = ?'); p.push(time); }
    if (action !== undefined) { u.push('action = ?'); p.push(action); }
    if (value !== undefined) { u.push('value = ?'); p.push(Math.max(0, Math.min(255, parseInt(value) || 0))); }
    if (scope !== undefined) { u.push('scope = ?'); p.push(scope === 'area' ? 'area' : 'all'); }
    if (area_id !== undefined) { u.push('area_id = ?'); p.push(area_id || null); }
    if (days !== undefined) { u.push('days = ?'); p.push(days || '*'); }
    if (enabled !== undefined) { u.push('enabled = ?'); p.push(enabled ? 1 : 0); }
    if (!u.length) return res.status(400).json({ error: 'Brak danych' });
    p.push(req.params.id);
    db.prepare(`UPDATE schedules SET ${u.join(', ')} WHERE id = ?`).run(...p);
    res.json(db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id));
  } catch (err) {
    console.error('Schedule update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_schedule', 'schedule', parseInt(req.params.id), {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
