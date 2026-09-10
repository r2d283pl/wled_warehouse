const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Zwraca listę id stref dostępnych dla użytkownika (bezpośrednio lub przez grupę).
// Dla admina zwraca null (= wszystkie strefy).
function accessibleAreaIds(db, user) {
  if (user.role === 'admin') return null;
  const rows = db.prepare(`
    SELECT DISTINCT a.id
    FROM areas a
    JOIN area_access aa ON aa.area_id = a.id
    LEFT JOIN user_group_members ugm ON ugm.group_id = aa.group_id
    WHERE aa.user_id = ? OR ugm.user_id = ?
  `).all(user.id, user.id);
  return rows.map(r => r.id);
}

// Dołącza do strefy kafelki, panele i (dla admina) dostęp + liczniki.
function decorateArea(db, area, isAdmin) {
  const tileRows = db.prepare(`
    SELECT t.*, GROUP_CONCAT(tt.device_id) AS target_device_ids
    FROM tiles t
    LEFT JOIN tile_targets tt ON tt.tile_id = t.id
    WHERE t.area_id = ?
    GROUP BY t.id
    ORDER BY t.sort_order, t.pos_y, t.pos_x
  `).all(area.id);

  area.tiles = tileRows.map(t => ({
    ...t,
    targetIds: t.target_device_ids ? t.target_device_ids.split(',').map(Number) : [],
    target_device_ids: undefined,
    config: JSON.parse(t.config || '{}'),
  }));

  // Panele potrzebne do renderu: przypisane do strefy + wskazywane przez jej kafelki
  const devIds = new Set();
  const assigned = db.prepare(
    'SELECT id, name, ip, size, type, location, area_id FROM devices WHERE area_id = ?'
  ).all(area.id);
  assigned.forEach(d => devIds.add(d.id));
  area.tiles.forEach(t => t.targetIds.forEach(id => devIds.add(id)));

  area.devices = devIds.size
    ? db.prepare(
        `SELECT id, name, ip, size, type, location, area_id FROM devices WHERE id IN (${[...devIds].map(() => '?').join(',')})`
      ).all(...devIds)
    : [];

  if (isAdmin) {
    area.device_count = assigned.length;
    area.tile_count = area.tiles.length;
    area.access = db.prepare(`
      SELECT aa.id, aa.user_id, aa.group_id, u.username, u.display_name, g.name AS group_name
      FROM area_access aa
      LEFT JOIN users u ON u.id = aa.user_id
      LEFT JOIN user_groups g ON g.id = aa.group_id
      WHERE aa.area_id = ?
    `).all(area.id);
  }
  return area;
}

// GET /api/areas — admin: wszystkie; operator: tylko dostępne
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'admin';

    let areas;
    if (isAdmin) {
      areas = db.prepare('SELECT * FROM areas ORDER BY sort_order, name').all();
    } else {
      const ids = accessibleAreaIds(db, req.user);
      if (!ids.length) return res.json([]);
      areas = db.prepare(
        `SELECT * FROM areas WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, name`
      ).all(...ids);
    }

    res.json(areas.map(a => decorateArea(db, a, isAdmin)));
  } catch (err) {
    console.error('Areas list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ===== Operacje zapisu — tylko admin =====
router.use(requireAdmin);

// POST /api/areas — utwórz strefę
router.post('/', (req, res) => {
  try {
    const { name, description, grid_cols } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa strefy jest wymagana' });

    const db = getDb();
    const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM areas').get().n;
    const result = db.prepare(
      'INSERT INTO areas (name, description, grid_cols, sort_order) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', grid_cols || 4, next);

    const area = db.prepare('SELECT * FROM areas WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_area', 'area', area.id, { name });
    res.status(201).json(decorateArea(db, area, true));
  } catch (err) {
    console.error('Area create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/areas/:id — aktualizuj strefę
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, grid_cols, layout_locked, sort_order } = req.body;

    const db = getDb();
    const area = db.prepare('SELECT id, name FROM areas WHERE id = ?').get(id);
    if (!area) return res.status(404).json({ error: 'Strefa nie istnieje' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (grid_cols !== undefined) { updates.push('grid_cols = ?'); params.push(grid_cols); }
    if (layout_locked !== undefined) { updates.push('layout_locked = ?'); params.push(layout_locked ? 1 : 0); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

    if (!updates.length) return res.status(400).json({ error: 'Brak danych do aktualizacji' });

    updates.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE areas SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAction(req.user, 'update_area', 'area', parseInt(id), { name: name || area.name });
    const updated = db.prepare('SELECT * FROM areas WHERE id = ?').get(id);
    res.json(decorateArea(db, updated, true));
  } catch (err) {
    console.error('Area update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/areas/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const area = db.prepare('SELECT name FROM areas WHERE id = ?').get(req.params.id);
    if (!area) return res.status(404).json({ error: 'Strefa nie istnieje' });
    db.prepare('DELETE FROM areas WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_area', 'area', parseInt(req.params.id), { name: area.name });
    res.json({ success: true });
  } catch (err) {
    console.error('Area delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ===== Kafelki strefy =====

// POST /api/areas/:id/tiles — dodaj kafelek do strefy
router.post('/:id/tiles', (req, res) => {
  try {
    const areaId = req.params.id;
    const { type, title, config, pos_x, pos_y, width, height, target_device_ids } = req.body;
    if (!type) return res.status(400).json({ error: 'Typ kafelka jest wymagany' });

    const db = getDb();
    const area = db.prepare('SELECT id FROM areas WHERE id = ?').get(areaId);
    if (!area) return res.status(404).json({ error: 'Strefa nie istnieje' });

    const result = db.prepare(
      'INSERT INTO tiles (area_id, type, title, config, pos_x, pos_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(areaId, type, title || '', JSON.stringify(config || {}), pos_x || 0, pos_y || 0, width || 1, height || 1);

    const tileId = result.lastInsertRowid;
    if (Array.isArray(target_device_ids)) {
      const link = db.prepare('INSERT OR IGNORE INTO tile_targets (tile_id, device_id) VALUES (?, ?)');
      for (const devId of target_device_ids) link.run(tileId, devId);
    }

    logAction(req.user, 'create_tile', 'tile', tileId, { area_id: parseInt(areaId), type, title: title || '' });
    res.status(201).json(db.prepare('SELECT * FROM tiles WHERE id = ?').get(tileId));
  } catch (err) {
    console.error('Area tile create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ===== Dostęp do strefy =====

// POST /api/areas/:id/access — nadaj dostęp użytkownikowi LUB grupie
router.post('/:id/access', (req, res) => {
  try {
    const areaId = req.params.id;
    const { user_id, group_id } = req.body;
    if ((user_id && group_id) || (!user_id && !group_id)) {
      return res.status(400).json({ error: 'Podaj dokładnie jedno: user_id albo group_id' });
    }

    const db = getDb();
    const area = db.prepare('SELECT id FROM areas WHERE id = ?').get(areaId);
    if (!area) return res.status(404).json({ error: 'Strefa nie istnieje' });

    db.prepare('INSERT OR IGNORE INTO area_access (area_id, user_id, group_id) VALUES (?, ?, ?)')
      .run(areaId, user_id || null, group_id || null);

    logAction(req.user, 'grant_area_access', 'area', parseInt(areaId), { user_id, group_id });
    res.status(201).json(decorateArea(db, db.prepare('SELECT * FROM areas WHERE id = ?').get(areaId), true));
  } catch (err) {
    console.error('Area access grant error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/areas/:id/access/:accessId — odbierz dostęp
router.delete('/:id/access/:accessId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM area_access WHERE id = ? AND area_id = ?')
      .run(req.params.accessId, req.params.id);
    logAction(req.user, 'revoke_area_access', 'area', parseInt(req.params.id), { access_id: parseInt(req.params.accessId) });
    res.json({ success: true });
  } catch (err) {
    console.error('Area access revoke error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
