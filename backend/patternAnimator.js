// Wysyłka grafiki/animacji na panele WLED przez indywidualne piksele (seg[].i) z "freeze",
// żeby efekt nie nadpisywał ustawionych pikseli. Animacja = backendowa pętla z limitem prędkości
// (chroni ESP32 przed zawieszeniem przy zbyt szybkim strumieniu komend HTTP).

const active = {}; // deviceId -> intervalId (uruchomione animacje)

// Buduje tablicę kolorów w kolejności LED (logiczny układ matrycy 2D = wierszami, lewy-górny róg).
// Opcje mapping: { serpentine, flipX, flipY } — gdyby fizyczne okablowanie wymagało korekty.
function buildSegI(frame, w, h, mapping = {}) {
  const colors = new Array(w * h).fill('000000');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const X = mapping.flipX ? (w - 1 - x) : x;
      const Y = mapping.flipY ? (h - 1 - y) : y;
      const ledIdx = (mapping.serpentine && (Y % 2 === 1)) ? (Y * w + (w - 1 - X)) : (Y * w + X);
      let hex = (frame[y * w + x] || '#000000');
      hex = String(hex).replace('#', '').toUpperCase();
      if (ledIdx >= 0 && ledIdx < w * h) colors[ledIdx] = hex;
    }
  }
  return [0, ...colors]; // forma zakresowa WLED: od indeksu 0, kolejne kolory LED
}

async function sendFrame(ip, segI, bri) {
  await fetch(`http://${ip}/json/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on: true, bri: bri || 128, seg: [{ frz: true, i: segI }] }),
    signal: AbortSignal.timeout(3000),
  });
}

function stop(deviceIds = []) {
  for (const id of deviceIds) {
    if (active[id]) { clearInterval(active[id]); delete active[id]; }
  }
}

function stopAll() { stop(Object.keys(active).map(Number)); }

// targets: [{id, ip}]; frames: [[hex...]]; data: { speed, loop, bri, mapping }
function start(targets, frames, w, h, data = {}) {
  const speed = Math.max(120, parseInt(data.speed) || 300); // dolny limit ~8 fps — bezpiecznie dla WLED
  const segIs = frames.map(f => buildSegI(f, w, h, data.mapping || {}));
  for (const t of targets) {
    stop([t.id]);
    let idx = 0;
    const tick = async () => {
      try { await sendFrame(t.ip, segIs[idx], data.bri); } catch { /* panel offline/zajęty */ }
      idx++;
      if (idx >= segIs.length) {
        if (data.loop) idx = 0;
        else { stop([t.id]); }
      }
    };
    tick();
    active[t.id] = setInterval(tick, speed);
  }
}

module.exports = { start, stop, stopAll, buildSegI, sendFrame };
