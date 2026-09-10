const express = require('express');
const bcrypt = require('bcrypt');
const { getDb, logAction } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All user management routes require admin auth
router.use(authenticateToken, requireAdmin);

// GET /api/users — list all users (without password hashes)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT id, username, display_name, role, active, created_at, updated_at
      FROM users ORDER BY username
    `).all();
    res.json(users);
  } catch (err) {
    console.error('Users list error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/users — create new user
router.post('/', async (req, res) => {
  try {
    const { username, password, display_name, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Login i hasło są wymagane' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków' });
    }

    const db = getDb();

    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Użytkownik o tym loginie już istnieje' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, password_hash, display_name || username, role || 'operator');

    const newUser = db.prepare(
      'SELECT id, username, display_name, role, active, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    logAction(req.user, 'create_user', 'user', newUser.id, { username, role: role || 'operator' });

    res.status(201).json(newUser);
  } catch (err) {
    console.error('User create error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// PUT /api/users/:id — update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, display_name, role, active, password } = req.body;

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }

    // Zmiana loginu — wymagany niepusty i unikalny
    let newUsername;
    if (username !== undefined) {
      newUsername = String(username).trim();
      if (!newUsername) return res.status(400).json({ error: 'Login nie może być pusty' });
      const clash = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, id);
      if (clash) return res.status(400).json({ error: 'Ten login jest już zajęty' });
    }

    // Prevent editing the last admin
    if (role && role !== 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND id != ?").get(id);
      const currentUser = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
      if (currentUser.role === 'admin' && adminCount.count === 0) {
        return res.status(400).json({ error: 'Nie można usunąć ostatniego administratora' });
      }
    }

    const updates = [];
    const params = [];

    if (newUsername !== undefined) { updates.push('username = ?'); params.push(newUsername); }
    if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?'); params.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Brak danych do aktualizacji' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAction(req.user, 'update_user', 'user', parseInt(id), {
      username: db.prepare('SELECT username FROM users WHERE id = ?').get(id)?.username
    });

    const updated = db.prepare(
      'SELECT id, username, display_name, role, active, created_at, updated_at FROM users WHERE id = ?'
    ).get(id);

    res.json(updated);
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    // Don't allow deleting self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Nie możesz usunąć samego siebie' });
    }

    // Don't delete last admin
    const user = db.prepare('SELECT role, username FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie istnieje' });
    }
    if (user.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
      if (adminCount.count <= 1) {
        return res.status(400).json({ error: 'Nie można usunąć ostatniego administratora' });
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logAction(req.user, 'delete_user', 'user', parseInt(id), {
      username: user?.username || (db.prepare('SELECT username FROM users WHERE id = ?').get(id)?.username)
    });
    res.json({ success: true, message: 'Użytkownik usunięty' });
  } catch (err) {
    console.error('User delete error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;