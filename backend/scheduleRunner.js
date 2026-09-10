// Backendowy harmonogram jasności/wł-wył paneli wg godzin (czas lokalny serwera — TZ).
// Uruchamia reguły niezależnie od otwartej przeglądarki.
const { getDb } = require('./db');

const lastFired = {}; // ruleId -> 'data HH:MM' (zapobiega podwójnemu odpaleniu w tej samej minucie)

async function applyToPanels(ips, payload) {
  await Promise.all(ips.map(ip => fetch(`http://${ip}/json/state`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(2500),
  }).catch(() => {})));
}

async function tick() {
  let db, rules;
  try { db = getDb(); rules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all(); }
  catch (e) { return; }
  if (!rules.length) return;

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const cur = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const day = now.getDay();
  const stamp = `${now.toDateString()} ${cur}`;

  for (const r of rules) {
    if (r.time !== cur) continue;
    if (r.days && r.days !== '*' && !r.days.split(',').map(s => parseInt(s, 10)).includes(day)) continue;
    if (lastFired[r.id] === stamp) continue;
    lastFired[r.id] = stamp;

    const devices = (r.scope === 'area' && r.area_id)
      ? db.prepare('SELECT ip FROM devices WHERE area_id = ?').all(r.area_id)
      : db.prepare('SELECT ip FROM devices').all();
    if (!devices.length) continue;

    let payload;
    if (r.action === 'off') payload = { on: false };
    else if (r.action === 'on') payload = { on: true };
    else payload = { on: (r.value || 0) > 0, bri: Math.max(0, Math.min(255, r.value || 0)) };

    applyToPanels(devices.map(d => d.ip), payload);
    console.log(`⏰ Harmonogram: reguła #${r.id} (${r.time} ${r.action}${r.action === 'bri' ? ' ' + r.value : ''}) -> ${devices.length} paneli`);
  }
}

function start() {
  setInterval(() => { tick().catch(e => console.error('Schedule tick error:', e.message)); }, 30000);
  console.log('⏰ Harmonogram jasności uruchomiony');
}

module.exports = { start };
