const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

// PUT /api/tiles/:id — update tile
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { type, title, config, pos_x, pos_y, width, height, sort_order, target_device_ids } = req.body;

    const db = getDb();
    const tile = db.prepare('SELECT id, title, type FROM tiles WHERE id = ?').get(id);
    if (!tile) return res.status(404).json({ error: 'Kafelek nie istnieje' });

    const updates = [];
    const params = [];

    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(config)); }
    if (pos_x !== undefined) { updates.push('pos_x = ?'); params.push(pos_x); }
    if (pos_y !== undefined) { updates.push('pos_y = ?'); params.push(pos_y); }
    if (width !== undefined) { updates.push('width = ?'); params.push(width); }
    if (height !== undefined) { updates.push('height = ?'); params.push(height); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(id);
      db.prepare(`UPDATE tiles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // Update device targets
    if (target_device_ids !== undefined && Array.isArray(target_device_ids)) {
      db.prepare('DELETE FROM tile_targets WHERE tile_id = ?').run(id);
      const insertLink = db.prepare('INSERT OR IGNORE INTO tile_targets (tile_id, device_id) VALUES (?, ?)');
      for (const deviceId of target_device_ids) {
        insertLink.run(id, deviceId);
      }
    }

    logAction(req.user, 'update_tile', 'tile', id, {
      title: title || tile.title,
      type: type || tile.type,
      target_device_ids
    });

    const updated = db.prepare('SELECT * FROM tiles WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Tile update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/tiles/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const tile = db.prepare('SELECT title FROM tiles WHERE id = ?').get(req.params.id);
    db.prepare('DELETE FROM tiles WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_tile', 'tile', parseInt(req.params.id), {
      title: tile?.title || 'unknown'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Tile delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
