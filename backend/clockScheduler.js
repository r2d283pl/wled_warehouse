// Backendowy harmonogram zegara — wysyła aktualny czas na panele z kafelków typu 'clock'
// z włączonym autoPush, niezależnie od tego, czy przeglądarka operatora jest otwarta.
const { getDb } = require('./db');

// Cache indeksów efektu/palety per IP (jak po stronie frontu)
const _fx = {};
const _pal = {};

const _PL = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ż:'z', ź:'z', Ą:'A', Ć:'C', Ę:'E', Ł:'L', Ń:'N', Ó:'O', Ś:'S', Ż:'Z', Ź:'Z' };
const asciiText = (s) => String(s ?? '').replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g, c => _PL[c] || c);

async function getScrollFx(ip) {
  if (_fx[ip] != null) return _fx[ip];
  try {
    const eff = await (await fetch(`http://${ip}/json/eff`, { signal: AbortSignal.timeout(2500) })).json();
    const i = eff.findIndex(e => /scrolling\s*text/i.test(e));
    _fx[ip] = i >= 0 ? i : 122;
  } catch { _fx[ip] = 122; }
  return _fx[ip];
}
async function getSolidPal(ip) {
  if (_pal[ip] != null) return _pal[ip];
  try {
    const pal = await (await fetch(`http://${ip}/json/pal`, { signal: AbortSignal.timeout(2500) })).json();
    const i = pal.findIndex(p => /^\*?\s*color 1$/i.test(String(p).trim()));
    _pal[ip] = i >= 0 ? i : 2;
  } catch { _pal[ip] = 2; }
  return _pal[ip];
}

// Formatuje czas wg konfiguracji kafelka (czas lokalny serwera — ustaw TZ w env)
function formatClock(cfg = {}, d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const h = cfg.format12 ? ((d.getHours() % 12) || 12) : d.getHours();
  let t = `${pad(h)}:${pad(d.getMinutes())}`;
  if (cfg.showSeconds) t += `:${pad(d.getSeconds())}`;
  if (cfg.showDate) t += `  ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return t;
}

const lastSent = {}; // tileId -> timestamp ostatniej wysyłki

async function tick() {
  let rows;
  try {
    const db = getDb();
    rows = db.prepare(`
      SELECT t.id, t.config, GROUP_CONCAT(tt.device_id) AS device_ids
      FROM tiles t
      LEFT JOIN tile_targets tt ON tt.tile_id = t.id
      WHERE t.type = 'clock'
      GROUP BY t.id
    `).all();
  } catch (e) {
    console.error('Clock scheduler DB error:', e.message);
    return;
  }

  const now = Date.now();
  const db = getDb();

  for (const row of rows) {
    let cfg;
    try { cfg = JSON.parse(row.config || '{}'); } catch { cfg = {}; }
    if (!cfg.autoPush) continue;

    const intervalMs = Math.max(15, parseInt(cfg.autoPushInterval) || 60) * 1000;
    if (lastSent[row.id] && now - lastSent[row.id] < intervalMs) continue;
    lastSent[row.id] = now;

    const ids = row.device_ids ? row.device_ids.split(',').map(Number) : [];
    if (!ids.length) continue;

    const colHex = cfg.color || '#ffffff';
    const r = parseInt(colHex.slice(1, 3), 16), g = parseInt(colHex.slice(3, 5), 16), b = parseInt(colHex.slice(5, 7), 16);
    const text = asciiText(formatClock(cfg));

    for (const devId of ids) {
      const dev = db.prepare('SELECT ip FROM devices WHERE id = ?').get(devId);
      if (!dev) continue;
      try {
        const fx = await getScrollFx(dev.ip);
        const pal = await getSolidPal(dev.ip);
        await fetch(`http://${dev.ip}/json/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ on: true, seg: [{ fx, pal, c1: 0, n: text, col: [[r, g, b]] }] }),
          signal: AbortSignal.timeout(2500),
        });
      } catch { /* panel offline — pomiń */ }
    }
  }
}

function start() {
  // Sprawdzamy co 10 s; każdy kafelek respektuje własny interwał (autoPushInterval)
  setInterval(() => { tick().catch(e => console.error('Clock tick error:', e.message)); }, 10000);
  console.log(`🕐 Harmonogram zegara uruchomiony (TZ=${process.env.TZ || 'systemowa'})`);
}

module.exports = { start };
