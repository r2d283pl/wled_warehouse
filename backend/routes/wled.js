const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Helper: fetch JSON from a WLED device
async function wledGet(ip, path) {
  const res = await fetch(`http://${ip}${path}`, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Helper: POST JSON to a WLED device
async function wledPost(ip, path, body) {
  const res = await fetch(`http://${ip}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Helper: resolve device
function getDevice(req, res) {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) { res.status(404).json({ error: 'Urządzenie nie istnieje' }); return null; }
  return device;
}

// GET /api/devices/:id/wled — fetch full WLED state, info, effects, palettes, presets
router.get('/:id/wled', async (req, res) => {
  try {
    const device = getDevice(req, res);
    if (!device) return;

    const [state, info, effects, palettes] = await Promise.all([
      wledGet(device.ip, '/json/state').catch(() => null),
      wledGet(device.ip, '/json/info').catch(() => null),
      wledGet(device.ip, '/json/eff').catch(() => null),
      wledGet(device.ip, '/json/pal').catch(() => null),
    ]);

    // Try to get presets too
    let presets = [];
    try {
      const presetsRaw = await wledGet(device.ip, '/presets.json');
      presets = Object.entries(presetsRaw)
        .filter(([k]) => k !== '0')
        .map(([k, v]) => ({ id: parseInt(k), name: v.n || `Preset ${k}` }));
    } catch { /* presets are optional */ }

    res.json({ state, info, effects, palettes, presets });
  } catch (err) {
    console.error('WLED fetch error:', err);
    res.status(502).json({ error: `Błąd połączenia: ${err.message}` });
  }
});

// POST /api/devices/:id/wled/state — update general state (on, bri, transition, etc.)
router.post('/:id/wled/state', async (req, res) => {
  try {
    const device = getDevice(req, res);
    if (!device) return;

    const result = await wledPost(device.ip, '/json/state', req.body);
    res.json({ success: true, result });
  } catch (err) {
    console.error('WLED state update error:', err);
    res.status(502).json({ error: `Błąd: ${err.message}` });
  }
});

// POST /api/devices/:id/wled/segment — update segment(s)
router.post('/:id/wled/segment', async (req, res) => {
  try {
    const device = getDevice(req, res);
    if (!device) return;

    const payload = { seg: req.body.seg };
    if (req.body.mainseg !== undefined) payload.mainseg = req.body.mainseg;

    const result = await wledPost(device.ip, '/json/state', payload);
    res.json({ success: true, result });
  } catch (err) {
    console.error('WLED segment update error:', err);
    res.status(502).json({ error: `Błąd: ${err.message}` });
  }
});

// POST /api/devices/:id/wled/color — set primary/secondary/tertiary colors
router.post('/:id/wled/color', async (req, res) => {
  try {
    const device = getDevice(req, res);
    if (!device) return;

    const { segment_id, col, fx, pal, sx, ix } = req.body;
    const seg = { id: segment_id || 0 };
    if (col) seg.col = col;
    if (fx !== undefined) seg.fx = fx;
    if (pal !== undefined) seg.pal = pal;
    if (sx !== undefined) seg.sx = sx;
    if (ix !== undefined) seg.ix = ix;
    if (req.body.on !== undefined) seg.on = req.body.on;
    if (req.body.bri !== undefined) seg.bri = req.body.bri;

    const payload = { seg: [seg] };
    if (req.body.on !== undefined && req.body.on === true) payload.on = true;

    const result = await wledPost(device.ip, '/json/state', payload);
    res.json({ success: true, result });
  } catch (err) {
    console.error('WLED color update error:', err);
    res.status(502).json({ error: `Błąd: ${err.message}` });
  }
});

// POST /api/devices/:id/wled/preset — activate a preset
router.post('/:id/wled/preset', async (req, res) => {
  try {
    const device = getDevice(req, res);
    if (!device) return;

    const { ps } = req.body;
    const result = await wledPost(device.ip, '/json/state', { on: true, ps });
    res.json({ success: true, result });
  } catch (err) {
    console.error('WLED preset error:', err);
    res.status(502).json({ error: `Błąd: ${err.message}` });
  }
});

module.exports = router;