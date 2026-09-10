const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/dashboards — list dashboards for current user (or all for admin)
router.get('/', (req, res) => {
  try {
    const db = getDb();

    let dashboards;
    if (req.user.role === 'admin') {
      dashboards = db.prepare(`
        SELECT d.*, u.username as owner_name
        FROM dashboards d
        LEFT JOIN users u ON d.user_id = u.id
        ORDER BY d.sort_order, d.name
      `).all();
    } else {
      dashboards = db.prepare(`
        SELECT d.*, u.username as owner_name
        FROM dashboards d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.user_id = ?
        ORDER BY d.sort_order, d.name
      `).all(req.user.id);
    }

    // Get tiles for each dashboard
    const getTiles = db.prepare(`
      SELECT t.*, GROUP_CONCAT(td.device_id) as target_device_ids
      FROM tiles t
      LEFT JOIN tile_targets td ON td.tile_id = t.id
      WHERE t.dashboard_id = ?
      GROUP BY t.id
      ORDER BY t.sort_order, t.pos_y, t.pos_x
    `);

    for (const dash of dashboards) {
      const tiles = getTiles.all(dash.id);
      dash.tiles = tiles.map(t => ({
        ...t,
        targetIds: t.target_device_ids ? t.target_device_ids.split(',').map(Number) : [],
        target_device_ids: undefined,
        config: JSON.parse(t.config || '{}')
      }));
    }

    res.json(dashboards);
  } catch (err) {
    console.error('Dashboards list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/dashboards — create dashboard (admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name, user_id, grid_cols, tiles_per_page } = req.body;

    if (!name) return res.status(400).json({ error: 'Nazwa dashboardu jest wymagana' });
    if (!user_id) return res.status(400).json({ error: 'ID użytkownika jest wymagane' });

    const db = getDb();

    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM dashboards WHERE user_id = ?').get(user_id);

    const result = db.prepare(
      'INSERT INTO dashboards (name, user_id, grid_cols, tiles_per_page, sort_order) VALUES (?, ?, ?, ?, ?)'
    ).run(name, user_id, grid_cols || 4, tiles_per_page || 0, maxOrder.next);

    const dashboard = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(result.lastInsertRowid);
    logAction(req.user, 'create_dashboard', 'dashboard', dashboard.id, { name, user_id });
    res.status(201).json({ ...dashboard, tiles: [] });
  } catch (err) {
    console.error('Dashboard create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/dashboards/:id — update dashboard
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name, grid_cols, tiles_per_page, sort_order } = req.body;

    const db = getDb();
    const dash = db.prepare('SELECT id, name FROM dashboards WHERE id = ?').get(id);
    if (!dash) return res.status(404).json({ error: 'Dashboard nie istnieje' });

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (grid_cols !== undefined) { updates.push('grid_cols = ?'); params.push(grid_cols); }
    if (tiles_per_page !== undefined) { updates.push('tiles_per_page = ?'); params.push(tiles_per_page); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

    if (updates.length === 0) return res.status(400).json({ error: 'Brak danych' });

    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE dashboards SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAction(req.user, 'update_dashboard', 'dashboard', parseInt(id), {
      name: name || dash.name
    });

    const updated = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Dashboard update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/dashboards/:id
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const dash = db.prepare('SELECT name FROM dashboards WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM dashboards WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_dashboard', 'dashboard', parseInt(req.params.id), {
      name: dash?.name || 'unknown'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Dashboard delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ============ TILES ============

// POST /api/dashboards/:id/tiles — add tile to dashboard
router.post('/:id/tiles', requireAdmin, (req, res) => {
  try {
    const dashboardId = req.params.id;
    const { type, title, config, pos_x, pos_y, width, height, target_device_ids } = req.body;

    if (!type) return res.status(400).json({ error: 'Typ kafelka jest wymagany' });

    const db = getDb();
    const dash = db.prepare('SELECT id FROM dashboards WHERE id = ?').get(dashboardId);
    if (!dash) return res.status(404).json({ error: 'Dashboard nie istnieje' });

    const result = db.prepare(
      'INSERT INTO tiles (dashboard_id, type, title, config, pos_x, pos_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      dashboardId,
      type,
      title || '',
      JSON.stringify(config || {}),
      pos_x || 0,
      pos_y || 0,
      width || 1,
      height || 1
    );

    const tileId = result.lastInsertRowid;

    // Link devices
    if (target_device_ids && Array.isArray(target_device_ids)) {
      const insertLink = db.prepare('INSERT OR IGNORE INTO tile_targets (tile_id, device_id) VALUES (?, ?)');
      for (const deviceId of target_device_ids) {
        insertLink.run(tileId, deviceId);
      }
    }

    logAction(req.user, 'create_tile', 'tile', tileId, {
      dashboard_id: dashboardId,
      type,
      title: title || '',
    });

    const tile = db.prepare('SELECT * FROM tiles WHERE id = ?').get(tileId);
    res.status(201).json(tile);
  } catch (err) {
    console.error('Tile create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/dashboards/:id/tiles/:tileId — remove tile
router.delete('/:id/tiles/:tileId', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const tile = db.prepare('SELECT title, type FROM tiles WHERE id = ? AND dashboard_id = ?').get(req.params.tileId, req.params.id);
    db.prepare('DELETE FROM tiles WHERE id = ? AND dashboard_id = ?').run(req.params.tileId, req.params.id);
    logAction(req.user, 'delete_tile', 'tile', parseInt(req.params.tileId), {
      dashboard_id: parseInt(req.params.id),
      title: tile?.title || 'unknown',
      type: tile?.type || 'unknown'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Tile delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;