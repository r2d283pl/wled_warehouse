const express = require('express');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

function withMembers(db, group) {
  group.members = db.prepare(`
    SELECT u.id, u.username, u.display_name
    FROM user_group_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.group_id = ?
    ORDER BY u.username
  `).all(group.id);
  group.member_count = group.members.length;
  return group;
}

// GET /api/user-groups — lista grup z członkami
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const groups = db.prepare('SELECT * FROM user_groups ORDER BY name').all();
    res.json(groups.map(g => withMembers(db, g)));
  } catch (err) {
    console.error('User groups list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/user-groups — utwórz grupę (opcjonalnie z członkami)
router.post('/', (req, res) => {
  try {
    const { name, description, user_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa grupy jest wymagana' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM user_groups WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: 'Grupa o tej nazwie już istnieje' });

    const result = db.prepare('INSERT INTO user_groups (name, description) VALUES (?, ?)')
      .run(name, description || '');
    const groupId = result.lastInsertRowid;

    if (Array.isArray(user_ids)) {
      const add = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
      for (const uid of user_ids) add.run(groupId, uid);
    }

    logAction(req.user, 'create_user_group', 'user_group', groupId, { name });
    res.status(201).json(withMembers(db, db.prepare('SELECT * FROM user_groups WHERE id = ?').get(groupId)));
  } catch (err) {
    console.error('User group create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/user-groups/:id — aktualizuj nazwę/opis i (opcjonalnie) całe członkostwo
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, user_ids } = req.body;

    const db = getDb();
    const group = db.prepare('SELECT id, name FROM user_groups WHERE id = ?').get(id);
    if (!group) return res.status(404).json({ error: 'Grupa nie istnieje' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      params.push(id);
      db.prepare(`UPDATE user_groups SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    // Wymiana całego składu grupy
    if (Array.isArray(user_ids)) {
      const replace = db.transaction(() => {
        db.prepare('DELETE FROM user_group_members WHERE group_id = ?').run(id);
        const add = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
        for (const uid of user_ids) add.run(id, uid);
      });
      replace();
    }

    logAction(req.user, 'update_user_group', 'user_group', parseInt(id), { name: name || group.name });
    res.json(withMembers(db, db.prepare('SELECT * FROM user_groups WHERE id = ?').get(id)));
  } catch (err) {
    console.error('User group update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/user-groups/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const group = db.prepare('SELECT name FROM user_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Grupa nie istnieje' });
    db.prepare('DELETE FROM user_groups WHERE id = ?').run(req.params.id);
    logAction(req.user, 'delete_user_group', 'user_group', parseInt(req.params.id), { name: group.name });
    res.json({ success: true });
  } catch (err) {
    console.error('User group delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
