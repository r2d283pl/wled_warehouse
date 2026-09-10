const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// GET /api/audit — fetch audit log (admin only, last 200)
router.get('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień' });
  try {
    const db = getDb();
    const logs = db.prepare(`
      SELECT id, user_id, username, action, target_type, target_id, details, created_at
      FROM audit_log
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `).all();
    res.json(logs);
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
