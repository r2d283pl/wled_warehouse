require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
// CORS: domyślnie odbija origin żądania (bezpieczne dla tej samej domeny — SPA jest serwowane
// przez backend). Aby ograniczyć, ustaw CORS_ORIGINS w .env (lista oddzielona przecinkami).
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: corsOrigins.length ? corsOrigins : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '5mb' }));

// Initialize database and admin user
function initAdmin() {
  try {
    const db = getDb();
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();

    if (adminCount.count === 0) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin';

      bcrypt.hash(password, 10).then(hash => {
        db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
          .run(username, hash, 'Administrator', 'admin');
        console.log(`✅ Admin user created: ${username}`);
      });
    }
  } catch (err) {
    console.error('Admin init error:', err);
  }
}

initAdmin();

// Harmonogram zegara (wysyła czas na panele niezależnie od przeglądarki)
try { require('./clockScheduler').start(); } catch (e) { console.error('Clock scheduler init error:', e.message); }
try { require('./scheduleRunner').start(); } catch (e) { console.error('Schedule runner init error:', e.message); }

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/dashboards', require('./routes/dashboards'));
app.use('/api/areas', require('./routes/areas'));
app.use('/api/user-groups', require('./routes/userGroups'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/patterns', require('./routes/patterns'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/tiles', require('./routes/tiles'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/devices', require('./routes/wled'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// SPA fallback — serve index.html for any non-API route
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint nie istnieje' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Wewnętrzny błąd serwera' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WLED Warehouse API running on port ${PORT}`);
  console.log(`📁 DB Path: ${process.env.DB_PATH || '/app/data/wled_warehouse.db'}`);
  console.log(`🔗 http://0.0.0.0:${PORT}`);
});