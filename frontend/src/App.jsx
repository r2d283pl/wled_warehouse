import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  MonitorSmartphone, Power, Settings, Users, LayoutDashboard, LogOut,
  Plus, Trash2, Save, AlertCircle, CheckCircle2, X, Edit2, Copy,
  Type, PaintBucket, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search,
  RefreshCw, Wifi, WifiOff, Play, Square, Palette, Zap,
  Lock, Unlock, FolderPlus, Sun, Moon, History, Sliders, Layers, Sparkles, Clock
} from 'lucide-react'

// ==========================================
// API Client
// ==========================================
const API = {
  async request(path, options = {}) {
    const token = localStorage.getItem('wled_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('wled_token');
      localStorage.removeItem('wled_user');
      window.location.reload();
      return null;
    }
    return res.json();
  },

  login: (u, p) => API.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  getMe: () => API.request('/api/auth/me'),

  getUsers: () => API.request('/api/users'),
  createUser: (data) => API.request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => API.request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => API.request(`/api/users/${id}`, { method: 'DELETE' }),

  getDevices: () => API.request('/api/devices'),
  getDevice: (id) => API.request(`/api/devices/${id}`),
  createDevice: (data) => API.request('/api/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id, data) => API.request(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDevice: (id) => API.request(`/api/devices/${id}`, { method: 'DELETE' }),
  scanDevice: (id) => API.request(`/api/devices/${id}/scan`, { method: 'POST' }),
  sendCommand: (id, payload) => API.request(`/api/devices/${id}/command`, { method: 'POST', body: JSON.stringify(payload) }),
  // Status/metadane paneli przez backend (działa z każdego urządzenia, nie tylko z sieci paneli)
  getDeviceStatuses: () => API.request('/api/devices/status'),
  getDeviceState: (id) => API.request(`/api/devices/${id}/state`),
  getWledMeta: (id) => API.request(`/api/devices/${id}/wledmeta`),
  // Baza panelu (wspólna, backend) — do przywracania po tekście/zegarze/grafice
  getPanelBases: () => API.request('/api/devices/base'),
  savePanelBase: (id, base) => API.request(`/api/devices/${id}/base`, { method: 'POST', body: JSON.stringify({ base }) }),

  // Discovery paneli w sieci
  scanNetwork: (data) => API.request('/api/discovery/scan', { method: 'POST', body: JSON.stringify(data) }),
  probeDevice: (ip) => API.request('/api/discovery/probe', { method: 'POST', body: JSON.stringify({ ip }) }),

  // WLED control
  wledFetchAll: (id) => API.request(`/api/devices/${id}/wled`),
  wledState: (id, payload) => API.request(`/api/devices/${id}/wled/state`, { method: 'POST', body: JSON.stringify(payload) }),
  wledSegment: (id, payload) => API.request(`/api/devices/${id}/wled/segment`, { method: 'POST', body: JSON.stringify(payload) }),
  wledColor: (id, payload) => API.request(`/api/devices/${id}/wled/color`, { method: 'POST', body: JSON.stringify(payload) }),
  wledPreset: (id, ps) => API.request(`/api/devices/${id}/wled/preset`, { method: 'POST', body: JSON.stringify({ ps }) }),

  // Strefy (obszary)
  getAreas: () => API.request('/api/areas'),
  createArea: (data) => API.request('/api/areas', { method: 'POST', body: JSON.stringify(data) }),
  updateArea: (id, data) => API.request(`/api/areas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArea: (id) => API.request(`/api/areas/${id}`, { method: 'DELETE' }),
  addAreaTile: (areaId, data) => API.request(`/api/areas/${areaId}/tiles`, { method: 'POST', body: JSON.stringify(data) }),
  grantAreaAccess: (areaId, data) => API.request(`/api/areas/${areaId}/access`, { method: 'POST', body: JSON.stringify(data) }),
  revokeAreaAccess: (areaId, accessId) => API.request(`/api/areas/${areaId}/access/${accessId}`, { method: 'DELETE' }),

  // Szablony konfiguracji
  getTemplates: () => API.request('/api/templates'),
  captureTemplate: (deviceId) => API.request('/api/templates/capture', { method: 'POST', body: JSON.stringify({ device_id: deviceId }) }),
  createTemplate: (data) => API.request('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => API.request(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => API.request(`/api/templates/${id}`, { method: 'DELETE' }),
  applyTemplate: (id, targets) => API.request(`/api/templates/${id}/apply`, { method: 'POST', body: JSON.stringify(targets) }),
  copyConfig: (data) => API.request('/api/templates/copy', { method: 'POST', body: JSON.stringify(data) }),

  // Grupy użytkowników
  getUserGroups: () => API.request('/api/user-groups'),
  createUserGroup: (data) => API.request('/api/user-groups', { method: 'POST', body: JSON.stringify(data) }),
  updateUserGroup: (id, data) => API.request(`/api/user-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUserGroup: (id) => API.request(`/api/user-groups/${id}`, { method: 'DELETE' }),

  // Grafika / wzory
  getPatterns: () => API.request('/api/patterns'),
  createPattern: (data) => API.request('/api/patterns', { method: 'POST', body: JSON.stringify(data) }),
  updatePattern: (id, data) => API.request(`/api/patterns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePattern: (id) => API.request(`/api/patterns/${id}`, { method: 'DELETE' }),
  sendPattern: (id, targets) => API.request(`/api/patterns/${id}/send`, { method: 'POST', body: JSON.stringify(targets) }),
  sendPatternAdhoc: (body) => API.request('/api/patterns/send-adhoc', { method: 'POST', body: JSON.stringify(body) }),
  stopPattern: (targets) => API.request('/api/patterns/stop', { method: 'POST', body: JSON.stringify(targets) }),

  // Harmonogram jasności
  getSchedules: () => API.request('/api/schedules'),
  createSchedule: (data) => API.request('/api/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id, data) => API.request(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSchedule: (id) => API.request(`/api/schedules/${id}`, { method: 'DELETE' }),

  // Ustawienia aplikacji
  getSettings: () => API.request('/api/settings'),
  updateSettings: (data) => API.request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Kafelki (wspólne)
  updateTile: (id, data) => API.request(`/api/tiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTile: (id) => API.request(`/api/tiles/${id}`, { method: 'DELETE' }),
  getAuditLog: () => API.request('/api/audit'),
};

// ==========================================
// COLORS
// ==========================================
const TILE_COLORS = [
  { val: 'green', label: 'Zielony', bg: 'bg-emerald-500', render: 'bg-emerald-600 hover:bg-emerald-500 text-white', wled: [0, 255, 0] },
  { val: 'red', label: 'Czerwony', bg: 'bg-red-500', render: 'bg-red-600 hover:bg-red-500 text-white', wled: [255, 0, 0] },
  { val: 'blue', label: 'Niebieski', bg: 'bg-blue-500', render: 'bg-blue-600 hover:bg-blue-500 text-white', wled: [0, 0, 255] },
  { val: 'orange', label: 'Pomarańczowy', bg: 'bg-orange-500', render: 'bg-orange-600 hover:bg-orange-500 text-white', wled: [255, 165, 0] },
  { val: 'yellow', label: 'Żółty', bg: 'bg-yellow-400', render: 'bg-yellow-500 hover:bg-yellow-400 text-black', wled: [255, 255, 0] },
  { val: 'purple', label: 'Fioletowy', bg: 'bg-purple-500', render: 'bg-purple-600 hover:bg-purple-500 text-white', wled: [128, 0, 128] },
  { val: 'pink', label: 'Różowy', bg: 'bg-pink-500', render: 'bg-pink-600 hover:bg-pink-500 text-white', wled: [255, 105, 180] },
  { val: 'cyan', label: 'Błękitny', bg: 'bg-cyan-400', render: 'bg-cyan-500 hover:bg-cyan-400 text-black', wled: [0, 255, 255] },
  { val: 'white', label: 'Biały', bg: 'bg-slate-200', render: 'bg-slate-100 hover:bg-white text-black', wled: [255, 255, 255] },
];

// Zamienia konfigurację koloru kafelka na [r,g,b]
function tileRgb(colorVal, customHex, fallback = [255, 255, 255]) {
  if (colorVal === 'custom' && customHex) {
    return [parseInt(customHex.slice(1, 3), 16), parseInt(customHex.slice(3, 5), 16), parseInt(customHex.slice(5, 7), 16)];
  }
  const found = TILE_COLORS.find(c => c.val === colorVal);
  return found ? found.wled : fallback;
}

// Polska odmiana rzeczownika "panel" wg liczby: 1 → panel, 2-4 → panele, reszta → paneli
// (z wyjątkiem 12-14, które przyjmują "paneli").
function panelWord(n) {
  const abs = Math.abs(Number(n) || 0);
  if (abs === 1) return 'panel';
  const d = abs % 10, dd = abs % 100;
  if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return 'panele';
  return 'paneli';
}

// Metadane WLED (indeks efektu "Scrolling Text" + palety "Color 1") pobierane przez BACKEND,
// więc działa z każdego urządzenia (telefon poza siecią paneli też). Cache per device id; fallback {122,2}.
const _wledMetaCache = {};
async function wledMeta(deviceId) {
  if (_wledMetaCache[deviceId]) return _wledMetaCache[deviceId];
  let m;
  try { m = await API.getWledMeta(deviceId); } catch { m = null; }
  _wledMetaCache[deviceId] = (m && m.fx != null) ? m : { fx: 122, pal: 2 };
  return _wledMetaCache[deviceId];
}

// Transliteracja polskich znaków na ASCII — wbudowany font Scrolling Text w WLED
// nie zawiera diakrytyków, więc np. "ZAJĘTE" bez tego wyświetli się z dziurami.
const _PL_MAP = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ż:'z', ź:'z', Ą:'A', Ć:'C', Ę:'E', Ł:'L', Ń:'N', Ó:'O', Ś:'S', Ż:'Z', Ź:'Z' };
function asciiText(s) {
  return String(s ?? '').replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/g, c => _PL_MAP[c] || c);
}


// ==========================================
// COMPONENTS: Toast, Sidebar
// ==========================================
function Toast({ type, msg }) {
  if (!msg) return null;
  const isSuccess = type === 'success';
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full flex items-center gap-2 shadow-2xl backdrop-blur-sm border transition-all animate-fade-in ${isSuccess ? 'bg-emerald-900/80 border-emerald-500 text-emerald-100' : 'bg-red-900/80 border-red-500 text-red-100'}`}>
      {isSuccess ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span className="font-medium text-sm">{msg}</span>
    </div>
  );
}

function Sidebar({ role, activeTab, setActiveTab, onLogout, username, theme, toggleTheme }) {
  const navItems = [
    { tab: 'dashboard', label: 'Panel Sterowania', icon: <MonitorSmartphone size={20} />, roles: ['admin', 'operator'] },
  ];
  const adminItems = [
    { tab: 'devices', label: 'Urządzenia', icon: <Settings size={20} /> },
    { tab: 'fleet', label: 'Flota', icon: <MonitorSmartphone size={20} /> },
    { tab: 'areas', label: 'Strefy', icon: <Layers size={20} /> },
    { tab: 'templates', label: 'Szablony', icon: <Sparkles size={20} /> },
    { tab: 'graphics', label: 'Grafika', icon: <Palette size={20} /> },
    { tab: 'groups', label: 'Grupy', icon: <FolderPlus size={20} /> },
    { tab: 'users', label: 'Użytkownicy', icon: <Users size={20} /> },
    { tab: 'audit', label: 'Logi', icon: <History size={20} /> },
    { tab: 'schedule', label: 'Harmonogram', icon: <Sun size={20} /> },
    { tab: 'settings', label: 'Ustawienia', icon: <Sliders size={20} /> },
  ];
  return (
    <nav className="w-full md:w-64 bg-slate-800 border-r border-slate-700 flex flex-col shadow-2xl min-h-screen">
      <div className="p-6 border-b border-slate-700 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-600"><MonitorSmartphone size={20} className="text-white" /></div>
        <div>
          <h2 className="font-bold text-white leading-tight">WLED Warehouse</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">{role}</p>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-1">
        {navItems.filter(n => n.roles.includes(role)).map(n => (
          <button key={n.tab} onClick={() => setActiveTab(n.tab)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === n.tab ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
            {n.icon}<span className="font-medium">{n.label}</span>
          </button>
        ))}
        {role === 'admin' && (
          <>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-8 mb-2 ml-2">Administracja</p>
            {adminItems.map(n => (
              <button key={n.tab} onClick={() => setActiveTab(n.tab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === n.tab ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}>
                {n.icon}<span className="font-medium">{n.label}</span>
              </button>
            ))}
          </>
        )}
      </div>
      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500 mb-2 ml-2">{username}</div>
        <button onClick={toggleTheme} className="flex items-center gap-3 text-slate-500 hover:text-yellow-400 w-full px-4 py-2 transition-colors rounded-xl hover:bg-yellow-900/10 mb-1">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}</span>
        </button>
        <button onClick={onLogout} className="flex items-center gap-3 text-slate-500 hover:text-red-400 w-full px-4 py-2 transition-colors rounded-xl hover:bg-red-900/10">
          <LogOut size={18} /><span>Wyloguj</span>
        </button>
      </div>
    </nav>
  );
}

// ==========================================
// LOGIN
// ==========================================
function LoginScreen({ onLogin, error }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-md border border-slate-700 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
        <div className="flex justify-center mb-6"><div className="p-4 bg-purple-600 rounded-2xl"><MonitorSmartphone size={40} className="text-white" /></div></div>
        <h1 className="text-2xl font-black text-white text-center mb-2">WLED Warehouse</h1>
        <p className="text-sm text-slate-400 text-center mb-8">System zarządzania strefami magazynowymi</p>
        <form onSubmit={e => { e.preventDefault(); onLogin(u, p); }} className="space-y-4">
          <input type="text" value={u} onChange={e => setU(e.target.value)} placeholder="Login" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all" autoFocus />
          <input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="Hasło" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all" />
          {error && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
          <button type="submit" disabled={!u || !p} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-blue-500/20">Zaloguj</button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// WLED CONTROL PANEL (slide-over)
// ==========================================
function WledPanel({ device, onClose, onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(null);
  const [fxSearch, setFxSearch] = useState('');
  const [palSearch, setPalSearch] = useState('');
  const [customColors, setCustomColors] = useState(['#ff0000', '#00ff00', '#0000ff']);
  const [slider, setSlider] = useState({}); // lokalne nadpisania suwaków (bri/sx/ix) podczas przeciągania
  const userTouched = useRef(false);
  const cooldownUntil = useRef(0);
  const slideTimers = useRef({});

  // Suwak: natychmiast aktualizuje UI lokalnie, wysyłkę do panelu debouncuje (płynność + brak floodu)
  const slide = (key, value, endpoint, makePayload) => {
    setSlider(prev => ({ ...prev, [key]: value }));
    userTouched.current = true;
    cooldownUntil.current = Date.now() + 2500;
    clearTimeout(slideTimers.current[key]);
    slideTimers.current[key] = setTimeout(async () => {
      await API[endpoint](device.id, makePayload(value));
      setTimeout(() => { userTouched.current = false; }, 1200);
    }, 120);
  };

  const load = useCallback(async () => {
    // Skip refresh during user interaction (avoids trampling in-progress changes)
    if (userTouched.current && Date.now() < cooldownUntil.current) return;
    setLoading(true);
    setError(null);
    const r = await API.wledFetchAll(device.id);
    if (!r) { setLoading(false); return; }
    if (r.error) { setError(r.error); setLoading(false); return; }
    setData(r);
    // Sync custom colors from WLED state
    if (r.state?.seg?.[0]?.col) {
      const cols = r.state.seg[0].col;
      setCustomColors(cols.map(c => {
        if (Array.isArray(c) && c.length >= 3) {
          return '#' + [c[0], c[1], c[2]].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('');
        }
        return '#ffffff';
      }));
    }
    // Po realnym odświeżeniu (poza interakcją) zsynchronizuj suwaki ze stanem panelu
    if (!userTouched.current) setSlider({});
    setLoading(false);
  }, [device.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const send = async (endpoint, payload, label) => {
    setSending(label);
    userTouched.current = true;
    cooldownUntil.current = Date.now() + 3000;
    const r = await API[endpoint](device.id, payload);
    if (r?.success && r.result) {
      // Only update state from result, not effects/palettes lists (those don't change)
      setData(prev => prev ? { ...prev, state: r.result } : prev);
    }
    setTimeout(() => { userTouched.current = false; }, 3000);
    setSending(null);
  };

  const togglePower = () => {
    if (!data?.state) return;
    send('wledState', { on: !data.state.on }, 'power');
  };

  const setColor = (index, hex) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const col = [...customColors];
    col[index] = hex;
    setCustomColors(col);
    send('wledColor', { col: [col.map(h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)])[0]] }, 'color');
    // Actually build proper col array from all three
  };

  const applyColors = () => {
    const cols = customColors.map(h => [
      parseInt(h.slice(1,3), 16),
      parseInt(h.slice(3,5), 16),
      parseInt(h.slice(5,7), 16)
    ]);
    send('wledColor', { col: cols }, 'color');
  };

  const setEffect = (fx) => {
    send('wledColor', { fx, col: [] }, 'fx');
  };

  const setPalette = (pal) => {
    send('wledColor', { pal, col: [] }, 'pal');
  };

  const runPreset = (ps) => {
    send('wledPreset', ps, 'preset');
  };

  const state = data?.state;
  const info = data?.info;
  const effects = data?.effects || [];
  const palettes = data?.palettes || [];
  const presets = data?.presets || [];
  const seg0 = state?.seg?.[0];
  const isOn = state?.on && seg0?.on;

  const filteredEffects = effects.filter((_, i) =>
    !fxSearch || effects[i]?.toLowerCase().includes(fxSearch.toLowerCase())
  );
  const filteredPalettes = palettes.filter((_, i) =>
    !palSearch || palettes[i]?.toLowerCase().includes(palSearch.toLowerCase())
  );

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 animate-overlay" onClick={onClose} />
      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 w-full max-w-xl h-full bg-slate-800 border-l border-slate-700 shadow-2xl animate-slide-in overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 z-10 p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <MonitorSmartphone size={20} className="text-blue-400" /> {device.name}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">{device.ip}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">Offline</p>
                <p className="text-red-400/70 text-xs mt-1">{error}</p>
                <button onClick={load} className="mt-3 text-xs bg-red-900/30 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-red-900/50 transition-colors">
                  <RefreshCw size={12} /> Spróbuj ponownie
                </button>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* ===== POWER + BRIGHTNESS ===== */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Power size={16} /> Zasilanie</h3>
                  <button onClick={togglePower}
                    className={`p-4 rounded-full transition-all ${isOn ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                    <Power size={24} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <Sun size={16} className="text-slate-500 flex-shrink-0" />
                  <div className="flex-1 relative">
                    {(() => { const bri = slider.bri ?? state?.bri ?? 0; return (
                    <input type="range" min="0" max="255" value={bri}
                      onChange={e => slide('bri', parseInt(e.target.value), 'wledState', v => ({ bri: v, transition: 3 }))}
                      className="w-full" style={{ background: isOn ? `linear-gradient(to right, #3b82f6 ${(bri/255)*100}%, #334155 ${(bri/255)*100}%)` : '#334155' }}
                      disabled={!isOn} />
                    ); })()}
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-10 text-right">{Math.round(((slider.bri ?? state?.bri ?? 0)/255)*100)}%</span>
                </div>
              </div>

              {/* ===== COLORS ===== */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><PaintBucket size={16} /> Kolory</h3>
                <div className="space-y-4">
                  <div className="flex gap-3 items-center">
                    {['Podstawowy', 'Drugorzędny', 'Trzeciorzędny'].map((label, i) => (
                      <div key={i} className="flex-1">
                        <p className="text-[10px] text-slate-500 mb-2">{label}</p>
                        <input type="color" value={customColors[i] || '#ffffff'}
                          onChange={e => {
                            const cols = [...customColors];
                            cols[i] = e.target.value;
                            setCustomColors(cols);
                          }}
                          className="w-full h-12 rounded-xl cursor-pointer bg-transparent border border-slate-600 p-1" />
                      </div>
                    ))}
                  </div>
                  <button onClick={applyColors} disabled={sending === 'color'}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                    <PaintBucket size={16} /> {sending === 'color' ? '...' : 'Zastosuj kolory'}
                  </button>
                </div>
              </div>

              {/* ===== EFFECTS ===== */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Sparkles size={16} /> Efekty ({effects.length})</h3>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Szukaj efektu..." value={fxSearch}
                    onChange={e => setFxSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {filteredEffects.map((name, idx) => (
                    <button key={idx} onClick={() => setEffect(idx)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${seg0?.fx === idx ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                      <span>#{idx} {name}</span>
                      {seg0?.fx === idx && <CheckCircle2 size={12} className="text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== PALETTES ===== */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Palette size={16} /> Palety ({palettes.length})</h3>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Szukaj palety..." value={palSearch}
                    onChange={e => setPalSearch(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:border-blue-500 outline-none" />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredPalettes.map((name, idx) => (
                    <button key={idx} onClick={() => setPalette(idx)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${seg0?.pal === idx ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                      <span>#{idx} {name}</span>
                      {seg0?.pal === idx && <CheckCircle2 size={12} className="text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== SPEED + INTENSITY ===== */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Sliders size={16} /> Strojenie</h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400">Prędkość</span>
                      <span className="text-xs font-mono text-slate-500">{slider.sx ?? seg0?.sx ?? 128}</span>
                    </div>
                    <input type="range" min="0" max="255" value={slider.sx ?? seg0?.sx ?? 128}
                      onChange={e => slide('sx', parseInt(e.target.value), 'wledColor', v => ({ sx: v }))}
                      className="w-full" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400">Intensywność</span>
                      <span className="text-xs font-mono text-slate-500">{slider.ix ?? seg0?.ix ?? 128}</span>
                    </div>
                    <input type="range" min="0" max="255" value={slider.ix ?? seg0?.ix ?? 128}
                      onChange={e => slide('ix', parseInt(e.target.value), 'wledColor', v => ({ ix: v }))}
                      className="w-full" />
                  </div>
                </div>
              </div>

              {/* ===== PRESETS ===== */}
              {presets.length > 0 && (
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Play size={16} /> Presety</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map(p => (
                      <button key={p.id} onClick={() => runPreset(p.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${state?.ps === p.id ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== SEGMENTS ===== */}
              {state?.seg && state.seg.length > 1 && (
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Layers size={16} /> Segmenty</h3>
                  <div className="space-y-2">
                    {state.seg.map((seg, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">
                        <div>
                          <span className="text-sm font-bold text-white">Segment {seg.id || i}</span>
                          <span className="text-xs text-slate-500 ml-3">LED {seg.start}-{seg.stop} ({seg.len})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${seg.on ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className="text-[10px] text-slate-500 font-mono">{effects[seg.fx] || '?'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== DEVICE INFO ===== */}
              {info && (
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Informacje</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-500">Wersja:</span> <span className="text-slate-300">{info.ver}</span></div>
                    <div><span className="text-slate-500">LED:</span> <span className="text-slate-300">{info.leds?.count}</span></div>
                    <div><span className="text-slate-500">WiFi:</span> <span className="text-slate-300">{info.wifi?.signal}% ({info.wifi?.rssi}dBm)</span></div>
                    <div><span className="text-slate-500">Uptime:</span> <span className="text-slate-300">{Math.floor((info.uptime || 0)/60)}min</span></div>
                    <div><span className="text-slate-500">Nazwa:</span> <span className="text-slate-300">{info.name || info.cn}</span></div>
                    <div><span className="text-slate-500">MAC:</span> <span className="text-slate-300 font-mono">{info.mac}</span></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ==========================================
// OPERATOR DASHBOARD VIEW
// ==========================================
function DashboardView({ user, areas, fetchData, onOpenWled }) {
  // Strefy są nadrzędnym kontenerem; renderowanie kafelków pozostaje bez zmian.
  const dashboards = areas;
  // Urządzenia do statusu/IP wyliczamy z paneli osadzonych w dostępnych strefach.
  const devices = React.useMemo(() => {
    const map = new Map();
    (Array.isArray(areas) ? areas : []).forEach(a => (Array.isArray(a?.devices) ? a.devices : []).forEach(d => map.set(d.id, d)));
    return [...map.values()];
  }, [areas]);
  const [activeDashId, setActiveDashId] = useState(null);
  // Szerokość ekranu — na telefonie siatka strefy nie może mieć tylu kolumn co na monitorze
  const [viewportW, setViewportW] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [deviceStatus, setDeviceStatus] = useState({});
  const [textInputs, setTextInputs] = useState({});
  const [textColors, setTextColors] = useState({});
  // Prędkość przewijania tekstu (WLED sx 0-255; wyższa = szybciej), per kafelek, trwała
  const [textSpeeds, setTextSpeeds] = useState(() => { try { return JSON.parse(localStorage.getItem('wled_text_speeds') || '{}'); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem('wled_text_speeds', JSON.stringify(textSpeeds)); } catch { /* ignore */ } }, [textSpeeds]);
  // Pasek „cała strefa": wspólny tekst + prędkość dla broadcastu na wszystkie panele
  const [bcText, setBcText] = useState('');
  const [bcSpeed, setBcSpeed] = useState(128);
  const [sendTargets, setSendTargets] = useState({}); // tileId -> [devId] (cele wysyłki tekstu/zegara)
  const [expandedCtrl, setExpandedCtrl] = useState({}); // tileId -> bool (rozwinięcie mini-kontrolki tekst/zegar)
  // Stan przełączników/kafelków grafiki — trwały (localStorage), by przeżył odświeżenie strony
  const [smartLocal, setSmartLocal] = useState(() => { try { return JSON.parse(localStorage.getItem('wled_smart_local') || '{}'); } catch { return {}; } });
  // Wskaźnik strefy — 2 stany (tileId -> 'state1'|'state2'), trwałe
  const [statusLocal, setStatusLocal] = useState(() => { try { return JSON.parse(localStorage.getItem('wled_status_local') || '{}'); } catch { return {}; } });
  // JEDNO źródło prawdy: która funkcja (tileId) jest AKTUALNIE wyświetlana na danym panelu (deviceId -> tileId|null).
  // Napędza podświetlenie aktywnej funkcji i wygaszanie pozostałych; przy zmianie na inną funkcję poprzednia przestaje być aktywna.
  const [activeFn, setActiveFn] = useState(() => { try { return JSON.parse(localStorage.getItem('wled_active_fn') || '{}'); } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem('wled_smart_local', JSON.stringify(smartLocal)); } catch { /* ignore */ } }, [smartLocal]);
  useEffect(() => { try { localStorage.setItem('wled_status_local', JSON.stringify(statusLocal)); } catch { /* ignore */ } }, [statusLocal]);
  useEffect(() => { try { localStorage.setItem('wled_active_fn', JSON.stringify(activeFn)); } catch { /* ignore */ } }, [activeFn]);

  // Ustawia aktywną funkcję dla paneli (tileId lub null = nic nie wyświetlane).
  const setActive = (deviceIds, tileId) => setActiveFn(prev => { const n = { ...prev }; (deviceIds || []).forEach(d => { n[d] = tileId; }); return n; });
  // Po wyłączeniu nakładki (tekst/zegar): aktywną funkcją staje się z powrotem baza panelu (np. grafika).
  const restoreActive = (deviceIds) => setActiveFn(prev => { const n = { ...prev }; (deviceIds || []).forEach(d => { const b = panelBase.current[d]; n[d] = (b && b.tileId != null) ? b.tileId : null; }); return n; });
  const [toast, setToast] = useState(null);
  const [editingTileId, setEditingTileId] = useState(null);
  const [copying, setCopying] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [dragId, setDragId] = useState(null);
  const [dragPanelId, setDragPanelId] = useState(null); // przeciągana karta panelu (Etap 4)
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [editLayout, setEditLayout] = useState(false); // tryb edycji układu (dotyk + mysz)
  // Co panel ma pokazywać "normalnie" (baza) — zapamiętane przez aplikację, bo stanu grafiki
  // NIE DA SIĘ odczytać z panelu (/json/state nie zwraca pikseli). Po wyłączeniu nakładki
  // odtwarzamy bazę ponownie (np. ponownie wysyłamy logo), zamiast czytać panel.
  const panelBase = useRef({});       // deviceId -> { kind:'graphic'|'color'|'preset'|'off'|'on', tileId, ... }
  const preDisplayState = useRef({}); // zapas z odczytu dla paneli bez znanej bazy (proste kolory)
  const graphicPrevBase = useRef({}); // deviceId -> baza sprzed grafiki (do przywrócenia przy wyłączeniu grafiki)

  // Baza paneli trzymana na BACKENDZIE (wspólna dla wszystkich przeglądarek/urządzeń).
  const loadBases = async () => { try { const r = await API.getPanelBases(); if (r && !r.error) panelBase.current = r; } catch { /* keep */ } };
  useEffect(() => { loadBases(); }, []);

  // Wołane przez akcje ustawiające stan panelu (przełącznik/zasilanie/kolor/preset/grafika)
  const setPanelBase = (deviceIds, base) => {
    (deviceIds || []).forEach(devId => { panelBase.current[devId] = base; delete preDisplayState.current[devId]; API.savePanelBase(devId, base); });
  };

  // Zegar — odświeżanie co sekundę (na potrzeby kafelków typu 'clock')
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeDash = dashboards.find(d => d.id === activeDashId) || dashboards[0];

  // ===== Układ kafelków: blokada admina + personalna kolejność (localStorage), tryb edycji =====
  const adminLocked = !!activeDash?.layout_locked;
  const lsKeyOrder = activeDash ? `wled_layout_${user.id}_${activeDash.id}` : null;
  const lsPanelKey = activeDash ? `wled_panels_${user.id}_${activeDash.id}` : null; // kolejność KART paneli (Etap 4)
  // Przeciąganie (mysz) aktywne tylko w trybie edycji; na dotyku służą strzałki na kafelkach
  const canDrag = !adminLocked && editLayout;

  const renderTiles = React.useMemo(() => {
    const tiles = activeDash?.tiles || [];
    if (adminLocked || !lsKeyOrder) return tiles;
    const saved = JSON.parse(localStorage.getItem(lsKeyOrder) || 'null');
    if (!Array.isArray(saved)) return tiles;
    const byId = new Map(tiles.map(t => [t.id, t]));
    const ordered = saved.map(id => byId.get(id)).filter(Boolean);
    tiles.forEach(t => { if (!saved.includes(t.id)) ordered.push(t); });
    return ordered;
  }, [activeDash, adminLocked, lsKeyOrder, layoutVersion]);

  // Zapis nowej kolejności do localStorage
  const persistOrder = (ids) => { if (lsKeyOrder) localStorage.setItem(lsKeyOrder, JSON.stringify(ids)); setLayoutVersion(v => v + 1); };

  // ===== Etap 4: kolejność KART paneli (jeden panel = jedna karta) =====
  // Baza = panele wg pierwszego wystąpienia w kafelkach + panele strefy bez kafelków; zapis nadpisuje kolejność.
  const orderedDevIds = React.useMemo(() => {
    const base = [];
    (activeDash?.tiles || []).forEach(t => {
      const ids = t.targetIds || [];
      if (ids.length === 1 && !base.includes(ids[0])) base.push(ids[0]);
    });
    (activeDash?.devices || []).forEach(d => { if (!base.includes(d.id)) base.push(d.id); });
    if (adminLocked || !lsPanelKey) return base;
    const saved = JSON.parse(localStorage.getItem(lsPanelKey) || 'null');
    if (!Array.isArray(saved)) return base;
    const ordered = saved.filter(id => base.includes(id));
    base.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
    return ordered;
  }, [activeDash, adminLocked, lsPanelKey, layoutVersion]);

  const persistPanelOrder = (ids) => { if (lsPanelKey) localStorage.setItem(lsPanelKey, JSON.stringify(ids)); setLayoutVersion(v => v + 1); };
  const handlePanelDrop = (targetDevId) => {
    if (!canDrag || dragPanelId == null || dragPanelId === targetDevId) { setDragPanelId(null); return; }
    const ids = [...orderedDevIds];
    const from = ids.indexOf(dragPanelId), to = ids.indexOf(targetDevId);
    if (from === -1 || to === -1) { setDragPanelId(null); return; }
    const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
    setDragPanelId(null);
    persistPanelOrder(ids);
  };
  const movePanelOrder = (devId, delta) => {
    const ids = [...orderedDevIds];
    const from = ids.indexOf(devId);
    if (from === -1) return;
    const to = Math.max(0, Math.min(ids.length - 1, from + delta));
    if (to === from) return;
    const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
    persistPanelOrder(ids);
  };

  const handleDragOver = (e) => { if (canDrag) e.preventDefault(); };
  const handleDrop = (targetId) => {
    if (!canDrag || dragId == null || dragId === targetId) { setDragId(null); return; }
    const ids = renderTiles.map(t => t.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
    setDragId(null);
    persistOrder(ids);
  };
  const resetLayout = () => { if (lsKeyOrder) localStorage.removeItem(lsKeyOrder); if (lsPanelKey) localStorage.removeItem(lsPanelKey); setLayoutVersion(v => v + 1); };

  useEffect(() => {
    if (dashboards.length > 0 && !activeDashId) {
      setActiveDashId(dashboards[0].id);
    }
  }, [dashboards]);

  // Okresowy status paneli — przez backend (działa z każdego urządzenia, nie tylko z sieci paneli)
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const data = await API.getDeviceStatuses();
        if (active && data && !data.error) setDeviceStatus(data);
      } catch { /* pomiń ten cykl */ }
      if (active) loadBases(); // odśwież bazy (mogły zmienić się z innej przeglądarki)
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [devices.length]);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const handleTogglePower = async (deviceIds) => {
    for (const devId of deviceIds) {
      const dev = devices.find(d => d.id === devId);
      if (!dev) continue;
      const isOn = deviceStatus[devId]?.on;
      await API.sendCommand(devId, { on: !isOn });
      setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: !isOn } }));
      setPanelBase([devId], { kind: !isOn ? 'on' : 'off' });
    }
    setActive(deviceIds, null);
    showToast('success', 'Zasilanie przełączone');
  };

  // Bieżący stan logiczny przełącznika dwustanowego: 'state1' | 'state2' | 'off'
  const smartLogicalState = (devId, s1, s2) => {
    const st = deviceStatus[devId];
    if (!st || st.on === false) return 'off';
    const eq = (a, b) => Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    if (eq(st.col0, s2)) return 'state2';
    if (eq(st.col0, s1)) return 'state1';
    return st.on ? 'state1' : 'off';
  };

  // Bieżący stan przełącznika: lokalny (wiarygodny przy grafikach) z fallbackiem na kolor panelu
  const smartCurrent = (tile, s1, s2) => smartLocal[tile.id] || smartLogicalState((tile.targetIds || [])[0], s1, s2);

  const handleSmartToggle = async (tile) => {
    const cfg = tile.config || {};
    const s1 = tileRgb(cfg.state1Color, cfg.state1CustomHex, [0, 255, 0]);
    const s2 = tileRgb(cfg.state2Color, cfg.state2CustomHex, [255, 0, 0]);
    const targets = tile.targetIds || [];
    if (!targets.length) { showToast('error', 'Kafelek nie ma przypisanych paneli'); return; }

    // Cykl: wyłączony → stan1 → stan2 → wyłączony
    const cur = smartCurrent(tile, s1, s2);
    const next = cur === 'off' ? 'state1' : cur === 'state1' ? 'state2' : 'off';
    const patId = next === 'state1' ? cfg.state1Pattern : cfg.state2Pattern;
    const rgb = next === 'state1' ? s1 : s2;

    if (next === 'off') {
      await API.stopPattern({ device_ids: targets });  // zatrzymuje ewentualną animację + gasi
      targets.forEach(devId => setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: false } })));
    } else if (patId) {
      await API.sendPattern(patId, { device_ids: targets });  // grafika/animacja na panel
      targets.forEach(devId => setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true } })));
    } else {
      await API.stopPattern({ device_ids: targets });  // wyczyść ewentualną wcześniejszą grafikę/freeze
      for (const devId of targets) await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx: 0, col: [rgb] }] });
      targets.forEach(devId => setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true, col0: rgb } })));
    }
    // Zapamiętaj nową bazę panelu (do odtworzenia po nakładkach)
    setPanelBase(targets, next === 'off' ? { kind: 'off', tileId: null } : patId ? { kind: 'graphic', patternId: patId, tileId: tile.id } : { kind: 'color', rgb, tileId: tile.id });
    setSmartLocal(prev => ({ ...prev, [tile.id]: next }));
    setActive(targets, next === 'off' ? null : tile.id);
    const label = next === 'off' ? 'WYŁĄCZONE' : next === 'state1' ? (cfg.state1Label || 'Stan 1') : (cfg.state2Label || 'Stan 2');
    showToast('success', `Przełączono: ${label}${patId && next !== 'off' ? ' (grafika)' : ''}`);
  };

  // Wskaźnik strefy — 2 stany (dostępne/niedostępne), każdy WYSYŁA swój kolor na panel (bez wyłączania).
  const statusColors = (cfg = {}) => ({
    s1: tileRgb(cfg.state1Color ?? cfg.activeColor, cfg.state1CustomHex ?? cfg.activeCustomHex, [0, 255, 0]),
    s2: tileRgb(cfg.state2Color ?? cfg.inactiveColor, cfg.state2CustomHex ?? cfg.inactiveCustomHex, [255, 0, 0]),
  });
  // Bieżący stan wskaźnika: lokalny, z fallbackiem na kolor panelu; domyślnie 'state1' (dostępne).
  const statusCurrent = (tile) => {
    if (statusLocal[tile.id] === 'state1' || statusLocal[tile.id] === 'state2') return statusLocal[tile.id];
    const { s1, s2 } = statusColors(tile.config);
    const log = (tile.targetIds || [])[0] != null ? smartLogicalState((tile.targetIds || [])[0], s1, s2) : 'state1';
    return log === 'state2' ? 'state2' : 'state1';
  };

  const handleStatusToggle = async (tile) => {
    const targets = tile.targetIds || [];
    if (!targets.length) { showToast('error', 'Kafelek nie ma przypisanych paneli'); return; }
    const cfg = tile.config || {};
    const { s1, s2 } = statusColors(cfg);
    const next = statusCurrent(tile) === 'state1' ? 'state2' : 'state1';
    const rgb = next === 'state1' ? s1 : s2;
    await API.stopPattern({ device_ids: targets }); // usuń ewentualną grafikę/freeze
    for (const devId of targets) await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx: 0, col: [rgb] }] });
    targets.forEach(devId => setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true, col0: rgb } })));
    setPanelBase(targets, { kind: 'color', rgb, tileId: tile.id });
    setStatusLocal(prev => ({ ...prev, [tile.id]: next }));
    setActive(targets, tile.id);
    const label = next === 'state1' ? (cfg.state1Label || cfg.activeLabel || 'Dostępne') : (cfg.state2Label || cfg.inactiveLabel || 'Niedostępne');
    showToast('success', label);
  };

  const handleSetPreset = async (deviceIds, presetId, presetName, tileId = null) => {
    const devs = deviceIds.map(id => devices.find(d => d.id === id)).filter(Boolean);
    const onPromises = devs.map(dev => API.sendCommand(dev.id, { on: true, ps: parseInt(presetId) }));
    await Promise.all(onPromises);
    for (const devId of deviceIds) setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true } }));
    setPanelBase(deviceIds, { kind: 'preset', presetId: parseInt(presetId), tileId });
    setActive(deviceIds, tileId);
    showToast('success', `Ustawiono: ${presetName}`);
  };

  // Kafelek "Grafika": dotknięcie wyświetla grafikę, ponowne dotknięcie wyłącza
  const handlePatternToggle = async (tile) => {
    const cfg = tile.config || {};
    const targets = tile.targetIds || [];
    if (!targets.length) { showToast('error', 'Kafelek nie ma przypisanych paneli'); return; }
    if (!cfg.patternId) { showToast('error', 'Kafelek nie ma wybranej grafiki'); return; }
    const on = (targets[0] != null) && activeFn[targets[0]] === tile.id;
    if (on) {
      // Wyłączenie grafiki: przywróć bazę sprzed grafiki (np. wskaźnik/kolor), inaczej zgaś panel.
      await API.stopPattern({ device_ids: targets });
      let any = false;
      for (const devId of targets) {
        const prev = graphicPrevBase.current[devId] || null;
        delete graphicPrevBase.current[devId];
        if (prev) { setPanelBase([devId], prev); any = true; } else { setPanelBase([devId], { kind: 'off', tileId: null }); }
      }
      await restoreDisplay(targets); // odtwarza ustawioną wyżej bazę (prev) lub gasi
      restoreActive(targets);
      showToast('success', any ? 'Przywrócono poprzedni stan' : 'Grafika wyłączona');
    } else {
      for (const devId of targets) { graphicPrevBase.current[devId] = panelBase.current[devId] || null; } // zapamiętaj bazę sprzed grafiki
      await API.sendPattern(cfg.patternId, { device_ids: targets });
      targets.forEach(devId => setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true } })));
      setPanelBase(targets, { kind: 'graphic', patternId: cfg.patternId, tileId: tile.id });
      setActive(targets, tile.id);
      showToast('success', 'Grafika wyświetlona');
    }
  };

  const handlePlaylistPress = async (tile, deviceIds) => {
    const cfg = tile.config || {};
    if (cfg.graphicId) { await API.sendPattern(cfg.graphicId, { device_ids: deviceIds }); deviceIds.forEach(devId => setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true } }))); setPanelBase(deviceIds, { kind: 'graphic', patternId: cfg.graphicId, tileId: tile.id }); setActive(deviceIds, tile.id); showToast('success', 'Grafika wysłana'); }
    else { await handleSetPreset(deviceIds, cfg.presetId, cfg.presetLabel, tile.id); }
  };

  // Przed nałożeniem nakładki: jeśli znamy bazę (aplikacja ją ustawiła) — nic nie robimy.
  // Jeśli nie — zapamiętujemy prosty stan z ostatniego odczytu (kolor + zasilanie). Pełnej grafiki
  // i tak nie da się odczytać z panelu; ważne, by po wyłączeniu NIE gasić włączonego panelu.
  const captureBeforeDisplay = (devId) => {
    if (panelBase.current[devId] || preDisplayState.current[devId]) return;
    const st = deviceStatus[devId];
    preDisplayState.current[devId] = st ? { on: st.on !== false, bri: st.bri, col0: st.col0 } : { on: true };
  };

  const handleSendText = async (tileId, deviceIds) => {
    if (!deviceIds?.length) { showToast('error', 'Wybierz panele do wyświetlenia'); return; }
    const text = textInputs[tileId] || 'WLED WAREHOUSE';
    const colHex = textColors[tileId] || '#ffffff';
    const r = parseInt(colHex.slice(1,3), 16);
    const g = parseInt(colHex.slice(3,5), 16);
    const b = parseInt(colHex.slice(5,7), 16);
    const sx = Math.max(0, Math.min(255, textSpeeds[tileId] ?? 128));
    for (const devId of deviceIds) {
      await captureBeforeDisplay(devId);
      const { fx, pal } = await wledMeta(devId);
      // c1:0 = Trail wyłączony (bez „smugi" za tekstem)
      await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx, pal, sx, c1: 0, n: asciiText(text), col: [[r, g, b]] }] });
    }
    setActive(deviceIds, tileId);
    showToast('success', `Tekst wysłany na ${deviceIds.length} ${panelWord(deviceIds.length)}`);
  };

  // Wyłącza wyświetlanie tekstu/zegara — PRZYWRACA stan sprzed wyświetlenia (a nie gasi panelu)
  // Przywraca bazę panelu (odtwarza grafikę/kolor/preset/off). Fallback: zapas z /state, potem wyłączenie.
  const restoreDisplay = async (deviceIds) => {
    let restored = 0;
    for (const devId of deviceIds) {
      const base = panelBase.current[devId];
      if (base) {
        if (base.kind === 'graphic') await API.sendPattern(base.patternId, { device_ids: [devId] });
        else if (base.kind === 'color') await API.sendCommand(devId, { on: true, bri: base.bri || 140, seg: [{ id: 0, frz: false, fx: 0, col: [base.rgb] }] });
        else if (base.kind === 'preset') await API.sendCommand(devId, { on: true, ps: base.presetId });
        else if (base.kind === 'off') await API.sendCommand(devId, { on: false });
        else await API.sendCommand(devId, { on: true, seg: [{ frz: false }] });
        restored++;
        setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: base.kind !== 'off', col0: base.kind === 'color' ? base.rgb : null } }));
      } else {
        // Brak znanej bazy: nie gasimy włączonego panelu — wracamy do jego koloru sprzed nakładki.
        const saved = preDisplayState.current[devId];
        if (saved && saved.on === false) {
          await API.sendCommand(devId, { on: false });
          setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: false } }));
        } else if (saved && saved.col0) {
          await API.sendCommand(devId, { on: true, bri: saved.bri || 140, seg: [{ id: 0, frz: false, fx: 0, col: [saved.col0] }] });
          restored++;
          setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true, col0: saved.col0 } }));
        } else {
          // panel był włączony, ale bez znanego koloru — usuń tekst (solid), zostaw włączony
          await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx: 0 }] });
          restored++;
          setDeviceStatus(prev => ({ ...prev, [devId]: { ...prev[devId], on: true } }));
        }
      }
      delete preDisplayState.current[devId];
    }
    return restored;
  };

  const handleTurnOff = async (deviceIds) => {
    if (!deviceIds?.length) { showToast('error', 'Wybierz panele'); return; }
    const restored = await restoreDisplay(deviceIds);
    restoreActive(deviceIds);
    showToast('success', restored ? 'Przywrócono poprzedni stan' : `Wyłączono ${deviceIds.length} ${panelWord(deviceIds.length)}`);
  };

  // Formatuje czas/datę wg konfiguracji kafelka zegara (domyślnie bieżący stan `now`)
  const formatClock = (cfg = {}, d = now) => {
    const pad = n => String(n).padStart(2, '0');
    const h = cfg.format12 ? ((d.getHours() % 12) || 12) : d.getHours();
    let t = `${pad(h)}:${pad(d.getMinutes())}`;
    if (cfg.showSeconds) t += `:${pad(d.getSeconds())}`;
    if (cfg.showDate) t += `  ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    return t;
  };

  // Wysyła aktualny czas na panele (świeży `new Date()` — używane też przez auto-wysyłkę)
  const sendClockNow = async (tile, deviceIds) => {
    const cfg = tile.config || {};
    const colHex = cfg.color || '#ffffff';
    const r = parseInt(colHex.slice(1, 3), 16), g = parseInt(colHex.slice(3, 5), 16), b = parseInt(colHex.slice(5, 7), 16);
    const text = formatClock(cfg, new Date());
    for (const devId of deviceIds) {
      await captureBeforeDisplay(devId);
      const { fx, pal } = await wledMeta(devId);
      // c1:0 = Trail wyłączony (bez „smugi" za cyframi)
      await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx, pal, c1: 0, n: asciiText(text), col: [[r, g, b]] }] });
    }
  };

  const handleSendClock = async (tile, deviceIds) => {
    if (!deviceIds?.length) { showToast('error', 'Wybierz panele do wyświetlenia'); return; }
    lastClockSent.current[tile.id] = formatClock(tile.config || {}, new Date()); // uniknij natychmiastowego dubla z tickera
    await sendClockNow(tile, deviceIds);
    setActive(deviceIds, tile.id);
    showToast('success', `Godzina wysłana na ${deviceIds.length} ${panelWord(deviceIds.length)}`);
  };

  // ===== Broadcast na całą strefę (tekst/zegar w kolorze każdego panelu) =====
  const BC_TEXT = 'bc-text';
  const BC_CLOCK = 'bc-clock';
  const bcClockConfig = { showDate: false, showSeconds: false, format12: false };
  // Kolor, jaki panel AKTUALNIE ma ustawiony (baza) — zielony/czerwony ze wskaźnika, kolor własny itp.
  const panelColor = (devId) => {
    const base = panelBase.current[devId];
    if (base && base.kind === 'color' && Array.isArray(base.rgb)) return base.rgb;
    const st = deviceStatus[devId];
    if (st && Array.isArray(st.col0) && st.col0.some(v => v > 0)) return st.col0;
    return [255, 255, 255];
  };
  // Wyślij czas na panele — każdy w SWOIM kolorze bazy (używane też przez ticker broadcastu)
  const sendClockColored = async (deviceIds, str) => {
    for (const devId of deviceIds) {
      await captureBeforeDisplay(devId);
      const { fx, pal } = await wledMeta(devId);
      await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx, pal, c1: 0, n: asciiText(str), col: [panelColor(devId)] }] });
    }
  };

  // Żywe tykanie: dopóki dashboard jest otwarty, ponawiaj czas na panele z AKTYWNYM zegarem,
  // gdy zmieni się wyświetlany napis (co minutę, lub co sekundę przy showSeconds). Bez autoPush.
  const lastClockSent = useRef({});
  useEffect(() => {
    (activeDash?.tiles || []).forEach(tile => {
      if (tile.type !== 'clock') return;
      const targets = (tile.targetIds || []).filter(id => activeFn[id] === tile.id);
      if (!targets.length) return;
      const str = formatClock(tile.config || {}, now);
      if (lastClockSent.current[tile.id] === str) return;
      lastClockSent.current[tile.id] = str;
      sendClockNow(tile, targets);
    });
    // Zegar broadcastu na całą strefę — tyka tak samo (kolor każdego panelu)
    const bcTargets = (activeDash?.devices || []).map(d => d.id).filter(id => activeFn[id] === BC_CLOCK);
    if (bcTargets.length) {
      const str = formatClock(bcClockConfig, now);
      if (lastClockSent.current[BC_CLOCK] !== str) {
        lastClockSent.current[BC_CLOCK] = str;
        sendClockColored(bcTargets, str);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // Pula paneli do wyboru dla tekstu/zegara = wszystkie panele aktywnej strefy
  // (dzięki temu można wysłać na dowolne matryce, nie tylko przypisane do kafelka)
  const targetPool = () => (activeDash?.devices || []).map(d => d.id);

  // Efektywne cele wysyłki: wybór operatora, a domyślnie przypisane panele kafelka lub cała pula
  const effectiveTargets = (tile) => {
    const pool = targetPool();
    const sel = sendTargets[tile.id];
    if (sel && sel.length) return sel.filter(id => pool.includes(id));
    const assigned = (tile.targetIds || []).filter(id => pool.includes(id));
    return assigned.length ? assigned : pool;
  };
  const toggleSendTarget = (tile, devId) => {
    setSendTargets(prev => {
      const cur = prev[tile.id] && prev[tile.id].length ? prev[tile.id] : effectiveTargets(tile);
      const next = cur.includes(devId) ? cur.filter(x => x !== devId) : [...cur, devId];
      return { ...prev, [tile.id]: next.length ? next : targetPool() };
    });
  };
  const setAllTargets = (tile) => setSendTargets(prev => ({ ...prev, [tile.id]: targetPool() }));

  // Broadcast tekstu na całą strefę — każdy panel w swoim aktualnym kolorze bazy
  const broadcastText = async () => {
    const targets = targetPool();
    if (!targets.length) { showToast('error', 'Brak paneli w strefie'); return; }
    const text = (bcText || '').trim() || 'WLED WAREHOUSE';
    const sx = Math.max(0, Math.min(255, bcSpeed));
    for (const devId of targets) {
      await captureBeforeDisplay(devId);
      const { fx, pal } = await wledMeta(devId);
      await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, fx, pal, sx, c1: 0, n: asciiText(text), col: [panelColor(devId)] }] });
    }
    setActive(targets, BC_TEXT);
    showToast('success', `Tekst na ${targets.length} ${panelWord(targets.length)} (kolor panelu)`);
  };
  // Broadcast zegara na całą strefę — tyka, każdy panel w swoim kolorze bazy
  const broadcastClock = async () => {
    const targets = targetPool();
    if (!targets.length) { showToast('error', 'Brak paneli w strefie'); return; }
    const str = formatClock(bcClockConfig, new Date());
    lastClockSent.current[BC_CLOCK] = str;
    await sendClockColored(targets, str);
    setActive(targets, BC_CLOCK);
    showToast('success', `Zegar na ${targets.length} ${panelWord(targets.length)} (kolor panelu)`);
  };
  // Wyłącz tekst/zegar na całej strefie — przywróć bazę każdego panelu
  const broadcastOff = async () => {
    const targets = targetPool();
    if (!targets.length) return;
    await handleTurnOff(targets);
  };

  // Selektor matryc docelowych (pokazywany na kafelkach tekst/zegar gdy strefa ma >1 panel)
  const PanelTargets = ({ tile }) => {
    const pool = targetPool();
    if (pool.length <= 1) return null;
    const eff = effectiveTargets(tile);
    const allSel = eff.length === pool.length;
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-[9px] uppercase tracking-wider text-slate-500">Matryce:</span>
        <button onClick={() => setAllTargets(tile)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${allSel ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-400'}`}>
          Wszystkie ({pool.length})
        </button>
        {pool.map(id => (
          <button key={id} onClick={() => toggleSendTarget(tile, id)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${eff.includes(id) ? (allSel ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-emerald-600 border-emerald-400 text-white') : 'bg-slate-900 border-slate-600 text-slate-500'}`}>
            {getDeviceName(id)}
          </button>
        ))}
      </div>
    );
  };

  // Auto-wysyłka zegara realizowana jest teraz po stronie backendu (clockScheduler) —
  // działa niezależnie od otwartej przeglądarki, więc front już jej nie dubluje.

  if (!dashboards.length) {
    return <div className="p-8 text-center text-slate-400 mt-20">Brak przypisanych stref. Skontaktuj się z administratorem.</div>;
  }

  const getDeviceName = (id) => devices.find(d => d.id === id)?.name || `ID:${id}`;
  const getDeviceIp = (id) => devices.find(d => d.id === id)?.ip;
  // Efektywna liczba kolumn: ustawienie strefy, ale karta panelu musi mieć min. ~300 px
  // (od md boczne menu zajmuje 256 px, do tego marginesy widoku)
  const areaCols = activeDash?.grid_cols || 4;
  const availW = viewportW >= 768 ? viewportW - 256 - 64 : viewportW - 32;
  const gridCols = Math.max(1, Math.min(areaCols, Math.floor((availW + 16) / 316)));

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />

      {dashboards.length > 1 && (
        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2 overflow-x-auto">
          {dashboards.map(d => (
            <button key={d.id} onClick={() => setActiveDashId(d.id)}
              className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all shadow-lg ${activeDashId === d.id ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'}`}>
              {d.name}
            </button>
          ))}
        </div>
      )}

      {activeDash && (
        <>
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{activeDash.name}</h1>
            <div className="flex items-center gap-2">
              {adminLocked ? (
                <span className="text-xs text-amber-400 flex items-center gap-1 bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-500/20">
                  <Lock size={12} /> Układ zablokowany przez administratora
                </span>
              ) : (
                <>
                  <button onClick={() => setEditLayout(e => !e)}
                    className={`text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all ${editLayout ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'}`}
                    title="Przesuwanie kafelków (dotyk i mysz)">
                    {editLayout ? <CheckCircle2 size={14} /> : <Edit2 size={14} />} {editLayout ? 'Gotowe' : 'Edytuj układ'}
                  </button>
                  {editLayout && (
                    <button onClick={resetLayout} title="Przywróć domyślny układ"
                      className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white transition-all">
                      <RefreshCw size={12} /> Reset
                    </button>
                  )}
                </>
              )}
              <span className="text-xs text-slate-500 ml-1">{devices.length} {panelWord(devices.length)}</span>
            </div>
          </div>

          {!editLayout && targetPool().length > 0 && (
            <div className="mb-5 bg-slate-800/70 border border-slate-700 rounded-2xl p-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0"><Layers size={14} className="text-blue-400" /> Cała strefa</span>
              <input type="text" placeholder="Tekst na wszystkie panele..." value={bcText}
                onChange={e => setBcText(e.target.value)}
                className="flex-1 min-w-[160px] bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" />
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 flex-shrink-0">Prędkość</span>
                <input type="range" min="0" max="255" value={bcSpeed} onChange={e => setBcSpeed(parseInt(e.target.value))} className="flex-1 sm:flex-none sm:w-24 accent-emerald-500" />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={broadcastText} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap"><Type size={15} /> <span className="sm:hidden">Tekst</span><span className="hidden sm:inline">Wyślij tekst</span></button>
                <button onClick={broadcastClock} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap"><Clock size={15} /> <span className="sm:hidden">Zegar</span><span className="hidden sm:inline">Wyślij zegar</span></button>
                <button onClick={broadcastOff} title="Wyłącz tekst/zegar na całej strefie i przywróć panele" className="flex-1 sm:flex-none bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white font-bold text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 whitespace-nowrap"><Power size={15} /> Wyłącz</button>
              </div>
              <span className="w-full text-[10px] text-slate-500">Kolor tekstu/zegara = aktualny kolor każdego panelu (np. zielony „dostępne", czerwony „niedostępne").</span>
            </div>
          )}

          {editLayout && (
            <>
              <p className="text-xs text-slate-400 mb-3 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2">
                Tryb edycji: przeciągnij kartę panelu (mysz) lub użyj strzałek (dotyk), aby zmienić kolejność paneli. Kliknij „Gotowe", gdy skończysz.
              </p>
              <div className="grid gap-4 items-start"
                style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
                {orderedDevIds.map(devId => {
                  const cols = gridCols;
                  const dev = devices.find(d => d.id === devId);
                  const fnCount = (activeDash.tiles || []).filter(t => (t.targetIds || []).length === 1 && t.targetIds[0] === devId).length;
                  return (
                    <div key={devId}
                      draggable onDragStart={() => setDragPanelId(devId)} onDragOver={handleDragOver} onDrop={() => handlePanelDrop(devId)} onDragEnd={() => setDragPanelId(null)}
                      style={{ opacity: dragPanelId === devId ? 0.4 : 1 }}
                      className="rounded-2xl border-2 border-dashed border-emerald-500/40 bg-slate-800 flex flex-col gap-1 p-3 cursor-move select-none">
                      <div className="flex items-center gap-2 min-w-0">
                        <MonitorSmartphone size={14} className="text-emerald-400 flex-shrink-0" />
                        <span className="text-sm font-bold text-white truncate">{dev?.name || `ID:${devId}`}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{fnCount} {fnCount === 1 ? 'funkcja' : 'funkcji'}</span>
                      <div className="grid grid-cols-3 gap-1 w-full mt-1">
                        <span />
                        <button onClick={() => movePanelOrder(devId, -cols)} className="bg-slate-900 hover:bg-emerald-600 text-white rounded-lg py-1.5 flex items-center justify-center" title="W górę"><ChevronUp size={16} /></button>
                        <span />
                        <button onClick={() => movePanelOrder(devId, -1)} className="bg-slate-900 hover:bg-emerald-600 text-white rounded-lg py-1.5 flex items-center justify-center" title="W lewo"><ChevronLeft size={16} /></button>
                        <button onClick={() => movePanelOrder(devId, +1)} className="bg-slate-900 hover:bg-emerald-600 text-white rounded-lg py-1.5 flex items-center justify-center" title="W prawo"><ChevronRight size={16} /></button>
                        <button onClick={() => movePanelOrder(devId, +cols)} className="bg-slate-900 hover:bg-emerald-600 text-white rounded-lg py-1.5 flex items-center justify-center" title="W dół"><ChevronDown size={16} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!editLayout && (() => {
            // ===== Etap 1: grupowanie kafelków w karty paneli (jeden panel LED = jedna karta) =====
            // Render pojedynczej funkcji (dotychczasowy kafelek) — reużywany wewnątrz karty panelu.
            const renderStandaloneTile = (tile) => {
              const targetIds = tile.targetIds || [];
              const w = Math.min(tile.width || 1, gridCols);
              const h = tile.height || 1;
              const status = targetIds.length > 0 ? deviceStatus[targetIds[0]] : null;

              // POWER TOGGLE
              if (tile.type === 'power') {
                const isOn = status?.on || false;
                const isOnline = status?.online || false;
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className={`bg-slate-800 p-6 rounded-2xl border ${isOn ? 'border-blue-500/50 shadow-lg shadow-blue-500/20' : 'border-slate-700'} flex flex-col justify-between items-center text-center min-h-[160px]`}>
                    <h3 className="text-sm font-bold text-slate-300">{tile.title || 'ZASILANIE'}</h3>
                    <button onClick={() => handleTogglePower(targetIds)}
                      className={`p-6 rounded-full transition-all ${isOn ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-105' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      <Power size={32} />
                    </button>
                    <div className="flex items-center gap-2 mt-2">
                      <p className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isOnline ? <span className="w-2 h-2 bg-emerald-500 rounded-full pulse-dot" /> : <WifiOff size={10} />}
                        {targetIds.length > 1 ? `${targetIds.length} urządzeń` : getDeviceName(targetIds[0])}
                      </p>
                    </div>
                  </div>
                );
              }

              // SMART TOGGLE — 3 stany: stan1 / stan2 / wyłączony
              if (tile.type === 'smart-toggle') {
                const cfg = tile.config || {};
                const s1rgb = tileRgb(cfg.state1Color, cfg.state1CustomHex, [0, 255, 0]);
                const s2rgb = tileRgb(cfg.state2Color, cfg.state2CustomHex, [255, 0, 0]);
                const logical = smartLocal[tile.id] || (targetIds.length ? smartLogicalState(targetIds[0], s1rgb, s2rgb) : 'off');
                const rgbHex = (rgb) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
                let style, currentLabel;
                if (logical === 'off') {
                  style = { backgroundColor: '#1e293b' };
                  currentLabel = 'WYŁĄCZONE';
                } else if (logical === 'state2') {
                  style = { backgroundColor: rgbHex(s2rgb) };
                  currentLabel = cfg.state2Label || 'STAN 2';
                } else {
                  style = { backgroundColor: rgbHex(s1rgb) };
                  currentLabel = cfg.state1Label || 'STAN 1';
                }
                const cls = 'text-white';
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900 group">
                    <button onClick={() => handleSmartToggle(tile)}
                      className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center transition-colors duration-500 ${cls}`}
                      style={style}>
                      {tile.title && <span className="absolute top-4 text-white/80 font-black tracking-widest uppercase text-xs bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">{tile.title}</span>}
                      <span className="text-2xl md:text-3xl font-black uppercase tracking-widest text-center px-4 drop-shadow-md">{currentLabel}</span>
                    </button>
                    <div className="absolute bottom-0 left-0 w-full p-3 flex items-center justify-between pointer-events-none">
                      <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-white/90 text-[10px] font-bold flex items-center gap-2">
                        {targetIds.length > 1 ? `${targetIds.length} urządzeń` : getDeviceName(targetIds[0])}
                        <span className={`w-2 h-2 rounded-full ${status?.online ? 'bg-emerald-400 pulse-dot' : 'bg-red-500'}`} />
                      </div>
                    </div>
                  </div>
                );
              }

              // PLAYLIST PRESET BUTTON
              if (tile.type === 'playlist') {
                const cfg = tile.config || {};
                const colorData = TILE_COLORS.find(c => c.val === cfg.color) || TILE_COLORS[2];
                const isActive = status?.ps === cfg.presetId && status?.on;
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <p className={`text-[10px] font-bold tracking-wider uppercase ${status?.online ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                        <Zap size={10} className="inline mr-1" /> {targetIds.length > 1 ? `${targetIds.length} urządzeń` : getDeviceName(targetIds[0])}
                      </p>
                      {tile.title && <span className="text-white/50 text-[9px] uppercase font-bold bg-slate-900 px-2 py-0.5 rounded">{tile.title}</span>}
                    </div>
                    <button onClick={() => handlePlaylistPress(tile, targetIds)}
                      className={`flex-1 py-4 px-4 rounded-xl font-bold uppercase tracking-wider transition-all border ${isActive ? `${colorData.render} border-transparent shadow-lg` : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'}`}>
                      {cfg.graphicId ? '🖼️ ' : ''}{cfg.presetLabel || 'Uruchom'}
                    </button>
                  </div>
                );
              }

              // TEXT DISPLAY
              if (tile.type === 'text-display') {
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex flex-col shadow-xl justify-between min-h-[200px] relative">
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: textColors[tile.id] || '#ffffff' }} />
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-300">{tile.title || 'WYŚWIETLACZ'}</h3>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded ${status?.online ? 'bg-emerald-900/30 text-emerald-500' : 'bg-red-900/30 text-red-500'}`}>
                        {targetIds.length > 1 ? `${targetIds.length} sztuk` : getDeviceName(targetIds[0])}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 flex-1 justify-end">
                      <input type="text" placeholder="Wpisz tekst..." value={textInputs[tile.id] || ''}
                        onChange={e => setTextInputs({...textInputs, [tile.id]: e.target.value})}
                        className="bg-slate-900 border border-slate-600 rounded-lg p-4 text-white font-bold focus:border-blue-500 outline-none w-full" />
                      <PanelTargets tile={tile} />
                      <div className="flex gap-3 items-center">
                        <input type="color" value={textColors[tile.id] || '#ffffff'}
                          onChange={e => setTextColors({...textColors, [tile.id]: e.target.value})}
                          className="w-14 h-14 rounded-lg cursor-pointer bg-slate-900 border border-slate-600 p-1 flex-shrink-0" />
                        <button onClick={() => handleSendText(tile.id, effectiveTargets(tile))}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95">
                          <Type size={18} /> Wyślij ({effectiveTargets(tile).length})
                        </button>
                        <button onClick={() => handleTurnOff(effectiveTargets(tile))} title="Wyłącz wyświetlanie (zgaś matryce)"
                          className="bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white font-bold px-4 rounded-lg flex items-center justify-center transition-all">
                          <Power size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // STATUS INDICATOR
              if (tile.type === 'status-indicator') {
                const cfg = tile.config || {};
                const getColor = (colorVal, customHex) => {
                  if (colorVal === 'custom' && customHex) return { type: 'hex', val: customHex };
                  const found = TILE_COLORS.find(c => c.val === colorVal);
                  return { type: 'class', val: found ? found.bg : 'bg-slate-600' };
                };
                // Pola spójne z edytorem (state1 = dostępne, state2 = niedostępne); active*/inactive* jako fallback
                const activeColor = getColor(cfg.state1Color ?? cfg.activeColor, cfg.state1CustomHex ?? cfg.activeCustomHex);
                const inactiveColor = getColor(cfg.state2Color ?? cfg.inactiveColor, cfg.state2CustomHex ?? cfg.inactiveCustomHex);
                const isActive = statusCurrent(tile) === 'state1';
                const color = isActive ? activeColor : inactiveColor;
                const style = color.type === 'hex' ? { backgroundColor: color.val } : {};
                const cls = color.type === 'class' ? color.val : 'bg-slate-800';
                const activeLabel = cfg.state1Label || cfg.activeLabel || 'WOLNE';
                const inactiveLabel = cfg.state2Label || cfg.inactiveLabel || 'ZAJĘTE';
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-900 transition-all duration-500 ${!status?.online ? 'opacity-50' : ''}`}>
                    <button onClick={() => handleStatusToggle(tile)} title="Kliknij, aby przełączyć dostępność strefy"
                      className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center ${cls} transition-colors duration-500`} style={style}>
                      <span className="text-2xl md:text-3xl font-black uppercase tracking-widest text-center px-4 drop-shadow-md">
                        {isActive ? activeLabel : inactiveLabel}
                      </span>
                      {tile.title && <span className="mt-2 text-white/70 text-sm font-bold">{tile.title}</span>}
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none">
                      {!status?.online ? (
                        <span className="bg-black/60 px-3 py-1 rounded-full text-[10px] text-red-400 font-bold flex items-center gap-1"><WifiOff size={10} /> Offline</span>
                      ) : (
                        <span className="bg-black/30 px-2 py-0.5 rounded-full text-[9px] text-white/70 font-bold flex items-center gap-1">{isActive ? activeLabel : inactiveLabel}</span>
                      )}
                    </div>
                  </div>
                );
              }

              // COLOR PICKER
              if (tile.type === 'color') {
                const cfg = tile.config || {};
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col justify-center items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-300">{tile.title || 'KOLOR'}</h3>
                    <input type="color" defaultValue={cfg.defaultColor || '#00ff00'}
                      onChange={async (e) => {
                        const hex = e.target.value;
                        const r = parseInt(hex.slice(1,3), 16);
                        const g = parseInt(hex.slice(3,5), 16);
                        const b = parseInt(hex.slice(5,7), 16);
                        for (const devId of targetIds) {
                          await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, col: [[r, g, b]] }] });
                        }
                        setPanelBase(targetIds, { kind: 'color', rgb: [r, g, b], tileId: tile.id });
                        setActive(targetIds, tile.id);
                      }}
                      className="w-20 h-20 rounded-xl cursor-pointer bg-transparent border-0 p-0" />
                  </div>
                );
              }

              // CLOCK — zegar (data/godzina)
              if (tile.type === 'clock') {
                const cfg = tile.config || {};
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className="bg-slate-800 rounded-2xl border border-slate-700 flex flex-col justify-between p-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{tile.title || 'Zegar'}</h3>
                      {cfg.autoPush && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <RefreshCw size={9} /> AUTO {Math.max(15, parseInt(cfg.autoPushInterval) || 60)}s
                        </span>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-mono font-black text-white tabular-nums leading-none" style={{ fontSize: 'clamp(1.75rem, 6vw, 3.5rem)', color: cfg.color || '#ffffff' }}>
                        {(() => { const pad = n => String(n).padStart(2, '0'); const hh = cfg.format12 ? ((now.getHours() % 12) || 12) : now.getHours(); return `${pad(hh)}:${pad(now.getMinutes())}${cfg.showSeconds ? ':' + pad(now.getSeconds()) : ''}`; })()}
                      </div>
                      {cfg.showDate !== false && (
                        <div className="text-slate-400 text-sm mt-1 font-medium">
                          {now.toLocaleDateString('pl-PL', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    {targetIds.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <PanelTargets tile={tile} />
                        <div className="flex gap-2">
                          <button onClick={() => handleSendClock(tile, effectiveTargets(tile))}
                            className="flex-1 bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all">
                            <Type size={14} /> Wyślij ({effectiveTargets(tile).length})
                          </button>
                          <button onClick={() => handleTurnOff(effectiveTargets(tile))} title="Wyłącz wyświetlanie (zgaś matryce)"
                            className="bg-slate-900 hover:bg-red-600 text-slate-300 hover:text-white font-bold px-3 rounded-xl flex items-center justify-center transition-all">
                            <Power size={14} />
                          </button>
                        </div>
                        {cfg.autoPush && <p className="text-[9px] text-amber-400/80 text-center">Auto-wysyłka aktywna — wyłączenie potrwa do najbliższego odświeżenia</p>}
                      </div>
                    ) : <div className="h-2" />}
                  </div>
                );
              }

              // GRAFIKA (przycisk wyświetlający zapisaną grafikę/animację)
              if (tile.type === 'pattern') {
                const cfg = tile.config || {};
                const on = targetIds.length ? activeFn[targetIds[0]] === tile.id : false;
                const colorData = TILE_COLORS.find(c => c.val === cfg.color) || TILE_COLORS[5];
                return (
                  <div key={tile.id} draggable={canDrag} onDragStart={() => setDragId(tile.id)} onDragOver={handleDragOver} onDrop={() => handleDrop(tile.id)} onDragEnd={() => setDragId(null)} style={{ gridColumn: `span ${w}`, gridRow: `span ${h}`, cursor: canDrag ? 'grab' : undefined, opacity: dragId === tile.id ? 0.4 : 1 }}
                    className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex flex-col justify-between items-center text-center">
                    <h3 className="text-sm font-bold text-slate-300">{tile.title || 'GRAFIKA'}</h3>
                    <button onClick={() => handlePatternToggle(tile)}
                      className={`p-6 rounded-2xl transition-all ${on ? `${colorData.render} shadow-lg scale-105` : 'bg-slate-900 text-slate-400 hover:bg-slate-700'}`}>
                      <Palette size={32} />
                    </button>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${on ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {on ? 'WYŚWIETLA SIĘ — dotknij, by wyłączyć' : (cfg.patternId ? 'Dotknij, by wyświetlić' : 'Brak grafiki')}
                    </p>
                  </div>
                );
              }

              return null;
            };

            // Etap 2: kompaktowa mini-kontrolka jednej funkcji — wyświetlana wewnątrz karty panelu.
            const renderCompactControl = (tile) => {
              const targetIds = tile.targetIds || [];
              const status = targetIds.length ? deviceStatus[targetIds[0]] : null;
              const key = tile.id;
              const rowBase = "w-full rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 flex items-center gap-2 text-left transition-all hover:border-slate-500";
              const chip = "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0";
              const titleCls = "flex-1 min-w-0 truncate text-xs font-bold text-slate-200";
              const toggleExp = () => setExpandedCtrl(p => ({ ...p, [tile.id]: !p[tile.id] }));
              // Przełącznik on/off wyświetlania (tekst/zegar) — zielony gdy aktywny.
              const onOffSwitch = (on, onToggle) => (
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onToggle(); }}
                  title={on ? 'Wyłącz wyświetlanie' : 'Włącz wyświetlanie'}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition-all flex-shrink-0 select-none ${on ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`}>
                  <Power size={12} /> {on ? 'Wł' : 'Wył'}
                </span>
              );

              if (tile.type === 'power') {
                const isOn = status?.on;
                return (
                  <button key={key} onClick={() => handleTogglePower(targetIds)} className={rowBase}>
                    <span className={`${chip} ${isOn ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}><Power size={14} /></span>
                    <span className={titleCls}>{tile.title || 'Zasilanie'}</span>
                    <span className={`text-[10px] font-bold uppercase ${isOn ? 'text-blue-400' : 'text-slate-500'}`}>{isOn ? 'Wł' : 'Wył'}</span>
                  </button>
                );
              }

              if (tile.type === 'smart-toggle') {
                const cfg = tile.config || {};
                const s1 = tileRgb(cfg.state1Color, cfg.state1CustomHex, [0, 255, 0]);
                const s2 = tileRgb(cfg.state2Color, cfg.state2CustomHex, [255, 0, 0]);
                const logical = smartLocal[tile.id] || (targetIds.length ? smartLogicalState(targetIds[0], s1, s2) : 'off');
                const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
                let dot, label;
                if (logical === 'off') { dot = '#475569'; label = 'Wyłączone'; }
                else if (logical === 'state2') { dot = hex(s2); label = cfg.state2Label || 'Stan 2'; }
                else { dot = hex(s1); label = cfg.state1Label || 'Stan 1'; }
                return (
                  <button key={key} onClick={() => handleSmartToggle(tile)} className={rowBase}>
                    <span className={`${chip} bg-slate-800 text-slate-300`}><RefreshCw size={14} /></span>
                    <span className={titleCls}>{tile.title || 'Przełącznik'}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-white flex-shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot }} />{label}
                    </span>
                  </button>
                );
              }

              if (tile.type === 'status-indicator') {
                const cfg = tile.config || {};
                const isActive = statusCurrent(tile) === 'state1';
                const { s1, s2 } = statusColors(cfg);
                const col = isActive ? s1 : s2;
                const dot = '#' + col.map(v => v.toString(16).padStart(2, '0')).join('');
                const label = isActive ? (cfg.state1Label || cfg.activeLabel || 'Wolne') : (cfg.state2Label || cfg.inactiveLabel || 'Zajęte');
                return (
                  <button key={key} onClick={() => handleStatusToggle(tile)} className={rowBase}>
                    <span className={chip} style={{ backgroundColor: dot }}><Sparkles size={14} className="text-black/60" /></span>
                    <span className={titleCls}>{tile.title || 'Wskaźnik'}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-white flex-shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot }} />{label}
                    </span>
                  </button>
                );
              }

              if (tile.type === 'playlist') {
                const cfg = tile.config || {};
                const isActive = status?.ps === cfg.presetId && status?.on;
                return (
                  <button key={key} onClick={() => handlePlaylistPress(tile, targetIds)} className={rowBase}>
                    <span className={`${chip} ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}><Zap size={14} /></span>
                    <span className={titleCls}>{cfg.graphicId ? '🖼️ ' : ''}{cfg.presetLabel || tile.title || 'Preset'}</span>
                    <Play size={13} className="text-slate-400 flex-shrink-0" />
                  </button>
                );
              }

              if (tile.type === 'pattern') {
                const cfg = tile.config || {};
                const on = targetIds.length ? activeFn[targetIds[0]] === tile.id : false;
                return (
                  <button key={key} onClick={() => handlePatternToggle(tile)} className={rowBase}>
                    <span className={`${chip} ${on ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-300'}`}><Palette size={14} /></span>
                    <span className={titleCls}>{tile.title || 'Grafika'}</span>
                    <span className={`text-[10px] font-bold uppercase ${on ? 'text-fuchsia-400' : 'text-slate-500'}`}>{on ? 'Wł' : 'Wył'}</span>
                  </button>
                );
              }

              if (tile.type === 'color') {
                const cfg = tile.config || {};
                return (
                  <div key={key} className={rowBase}>
                    <span className={`${chip} bg-slate-800 text-slate-300`}><PaintBucket size={14} /></span>
                    <span className={titleCls}>{tile.title || 'Kolor'}</span>
                    <input type="color" defaultValue={cfg.defaultColor || '#00ff00'}
                      onChange={async (e) => {
                        const hx = e.target.value;
                        const r = parseInt(hx.slice(1, 3), 16), g = parseInt(hx.slice(3, 5), 16), b = parseInt(hx.slice(5, 7), 16);
                        for (const devId of targetIds) await API.sendCommand(devId, { on: true, seg: [{ id: 0, frz: false, col: [[r, g, b]] }] });
                        setPanelBase(targetIds, { kind: 'color', rgb: [r, g, b], tileId: tile.id });
                        setActive(targetIds, tile.id);
                      }}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 flex-shrink-0" />
                  </div>
                );
              }

              if (tile.type === 'text-display') {
                const open = !!expandedCtrl[tile.id];
                const active = targetIds.length ? activeFn[targetIds[0]] === tile.id : false;
                const toggle = () => active ? handleTurnOff(effectiveTargets(tile)) : handleSendText(tile.id, effectiveTargets(tile));
                return (
                  <div key={key} className={`rounded-xl border overflow-hidden ${active ? 'border-emerald-500/60 bg-emerald-950/20' : 'border-slate-700 bg-slate-900/50'}`}>
                    <div className="w-full px-3 py-2 flex items-center gap-2">
                      <button onClick={toggleExp} className="flex-1 min-w-0 flex items-center gap-2 text-left" title="Ustaw treść">
                        <span className={`${chip} ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}><Type size={14} /></span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className="truncate text-xs font-bold text-slate-200">{tile.title || 'Tekst'}</span>
                          {active && <span className="text-[9px] font-bold text-emerald-300 uppercase leading-tight">● na panelu</span>}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>
                      {onOffSwitch(active, toggle)}
                    </div>
                    {open && (
                      <div className="px-3 pb-3 flex flex-col gap-2">
                        <div className="flex gap-2 items-center">
                          <input type="text" placeholder="Wpisz tekst..." value={textInputs[tile.id] || ''}
                            onChange={e => setTextInputs({ ...textInputs, [tile.id]: e.target.value })}
                            className="flex-1 bg-slate-950 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" />
                          <input type="color" value={textColors[tile.id] || '#ffffff'}
                            onChange={e => setTextColors({ ...textColors, [tile.id]: e.target.value })}
                            className="w-9 h-9 rounded-lg cursor-pointer bg-slate-950 border border-slate-600 p-1 flex-shrink-0" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 flex-shrink-0">Prędkość</span>
                          <input type="range" min="0" max="255" value={textSpeeds[tile.id] ?? 128}
                            onChange={e => setTextSpeeds({ ...textSpeeds, [tile.id]: parseInt(e.target.value) })}
                            className="flex-1 accent-emerald-500" title="Prędkość przewijania (zastosuje się po włączeniu)" />
                          <span className="text-[10px] text-slate-500 w-7 text-right tabular-nums">{textSpeeds[tile.id] ?? 128}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (tile.type === 'clock') {
                const cfg = tile.config || {};
                const pad = n => String(n).padStart(2, '0');
                const hh = cfg.format12 ? ((now.getHours() % 12) || 12) : now.getHours();
                const timeStr = `${pad(hh)}:${pad(now.getMinutes())}${cfg.showSeconds ? ':' + pad(now.getSeconds()) : ''}`;
                const active = (targetIds.length && activeFn[targetIds[0]] === tile.id) || !!cfg.autoPush;
                const toggle = () => active ? handleTurnOff(effectiveTargets(tile)) : handleSendClock(tile, effectiveTargets(tile));
                return (
                  <div key={key} className={`rounded-xl border px-3 py-2 flex items-center gap-2 ${active ? 'border-emerald-500/60 bg-emerald-950/20' : 'border-slate-700 bg-slate-900/50'}`}>
                    <span className={`${chip} ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}><Clock size={14} /></span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="truncate text-xs font-bold text-slate-200">{tile.title || 'Zegar'}</span>
                      {(active || cfg.autoPush) && (
                        <span className="flex flex-wrap items-center gap-x-1.5 text-[9px] font-bold uppercase leading-tight">
                          {active && <span className="text-emerald-300">● na panelu</span>}
                          {cfg.autoPush && <span className="text-emerald-400 flex items-center gap-0.5"><RefreshCw size={9} />AUTO</span>}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums flex-shrink-0" style={{ color: cfg.color || '#fff' }}>{timeStr}</span>
                    {onOffSwitch(active, toggle)}
                  </div>
                );
              }

              // Nieznany typ — awaryjnie pełny render.
              return renderStandaloneTile(tile);
            };

            // Karta panelu LED: nagłówek (nazwa + status + zasilanie + WLED) i lista przypisanych funkcji.
            const renderPanelCard = (devId, tiles) => {
              const dev = devices.find(d => d.id === devId);
              const st = deviceStatus[devId];
              const online = !!st?.online;
              const isOn = !!st?.on;
              return (
                <div key={`dev-${devId}`}
                  className="bg-slate-800/70 rounded-3xl border border-slate-700 shadow-xl flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700 bg-slate-900/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${online ? 'bg-emerald-400 pulse-dot' : 'bg-red-500'}`} />
                      <h3 className="truncate font-bold text-white text-sm">{dev?.name || `ID:${devId}`}</h3>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleTogglePower([devId])} title="Zasilanie"
                        className={`p-2 rounded-lg transition-all ${isOn ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                        <Power size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {(!tiles || tiles.length === 0)
                      ? <p className="text-[11px] text-slate-500 text-center py-4">Brak przypisanych funkcji</p>
                      : (() => {
                          // Jedna funkcja jest aktualnie na panelu (activeFn) → pozostałe przygaszamy.
                          const cur = activeFn[devId];
                          return tiles.map(t => {
                            const dimmed = cur != null && cur !== t.id;
                            return (
                              <div key={t.id} className={dimmed ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
                                {renderCompactControl(t)}
                              </div>
                            );
                          });
                        })()}
                  </div>
                </div>
              );
            };

            // Podział: kafelki jednourządzeniowe → grupy per panel; wielourządzeniowe → osobno (jak dotąd).
            // Kolejność paneli pochodzi z orderedDevIds (Etap 4 — wspólna dla widoku i trybu edycji układu).
            const cols = gridCols;
            const singleByDevice = new Map();
            const multiTiles = [];
            for (const t of renderTiles) {
              const ids = t.targetIds || [];
              if (ids.length === 1) {
                if (!singleByDevice.has(ids[0])) singleByDevice.set(ids[0], []);
                singleByDevice.get(ids[0]).push(t);
              } else if (ids.length > 1) {
                multiTiles.push(t);
              }
            }

            return (
              <div className="grid gap-4 items-start"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {orderedDevIds.map(devId => renderPanelCard(devId, singleByDevice.get(devId) || []))}
                {multiTiles.map(tile => renderStandaloneTile(tile))}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

// ==========================================
// ADMIN: DEVICES VIEW
// ==========================================
function DevicesView({ devices, areas = [], fetchData, onOpenWled }) {
  const [form, setForm] = useState({ name: '', ip: '', size: '16x32', type: 'matrix', location: '', area_id: '' });
  const [editing, setEditing] = useState(null);
  const [scanResult, setScanResult] = useState({});
  const [scanning, setScanning] = useState({});
  const [toast, setToast] = useState(null);

  // Discovery: panel skanowania podsieci
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryForm, setDiscoveryForm] = useState({ subnet: '192.168.200', start: 1, end: 254 });
  const [netScanning, setNetScanning] = useState(false);
  const [netResults, setNetResults] = useState(null);
  const [adding, setAdding] = useState({});
  const [liveStatus, setLiveStatus] = useState({});

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  // Żywy status paneli (online/offline) — przez backend, co 5 s
  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const data = await API.getDeviceStatuses(); if (active && data && !data.error) setLiveStatus(data); } catch { /* pomiń */ }
    };
    check();
    const iv = setInterval(check, 5000);
    return () => { active = false; clearInterval(iv); };
  }, [devices.length]);

  const handleNetworkScan = async () => {
    setNetScanning(true);
    setNetResults(null);
    const res = await API.scanNetwork(discoveryForm);
    setNetResults(res);
    setNetScanning(false);
    if (res?.devices) showToast('success', `Znaleziono ${res.count} paneli WLED`);
  };

  const handleAddDiscovered = async (dev) => {
    setAdding(prev => ({ ...prev, [dev.ip]: true }));
    await API.createDevice({
      name: dev.name || `WLED-${dev.ip}`,
      ip: dev.ip,
      size: dev.matrix || '16x16',
      type: 'matrix',
    });
    // oznacz jako dodany w wynikach
    setNetResults(prev => prev ? { ...prev, devices: prev.devices.map(d => d.ip === dev.ip ? { ...d, alreadyAdded: true } : d) } : prev);
    setAdding(prev => ({ ...prev, [dev.ip]: false }));
    fetchData();
    showToast('success', `Dodano ${dev.name}`);
  };

  const handleProbeIp = async () => {
    if (!form.ip) return;
    const info = await API.probeDevice(form.ip);
    if (info?.ip) {
      setForm(f => ({ ...f, name: f.name || info.name, size: info.matrix || f.size }));
      showToast('success', `Wykryto: ${info.name} (${info.matrix || info.ledCount + ' LED'})`);
    } else {
      showToast('error', info?.error || 'Nie znaleziono WLED pod tym adresem');
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.ip) return;
    const payload = { ...form, area_id: form.area_id ? parseInt(form.area_id) : null };
    const res = editing ? await API.updateDevice(editing, payload) : await API.createDevice(payload);
    if (res?.error) { showToast('error', res.error); return; }  // np. duplikat adresu IP
    setForm({ name: '', ip: '', size: '16x32', type: 'matrix', location: '', area_id: '' });
    setEditing(null);
    fetchData();
    showToast('success', editing ? 'Urządzenie zaktualizowane' : 'Urządzenie dodane');
  };

  // Szybka zmiana strefy z karty urządzenia
  const handleAssignArea = async (deviceId, areaId) => {
    const res = await API.updateDevice(deviceId, { area_id: areaId ? parseInt(areaId) : null });
    if (res?.error) { showToast('error', res.error); return; }
    fetchData();
    showToast('success', 'Strefa zaktualizowana');
  };

  const handleEdit = (d) => {
    setForm({ name: d.name, ip: d.ip, size: d.size, type: d.type, location: d.location || '', area_id: d.area_id || '' });
    setEditing(d.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('Usunąć urządzenie?')) return;
    await API.deleteDevice(id);
    fetchData();
    showToast('success', 'Urządzenie usunięte');
  };

  const handleCopyDevice = async (d) => {
    const newIp = d.ip.replace(/(\d+)$/, m => parseInt(m) + 1);
    const name = d.name + ' (kopia)';
    await API.createDevice({ name, ip: newIp, size: d.size, type: d.type, location: d.location || '', notes: d.notes || '' });
    fetchData();
    showToast('success', 'Urządzenie skopiowane jako ' + name);
  };

  const handleScan = async (id) => {
    setScanning(prev => ({ ...prev, [id]: true }));
    const result = await API.scanDevice(id);
    setScanResult(prev => ({ ...prev, [id]: result }));
    setScanning(prev => ({ ...prev, [id]: false }));
    fetchData();
  };

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Urządzenia WLED</h1>
        <button onClick={() => setShowDiscovery(s => !s)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${showDiscovery ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-purple-500'}`}>
          <Search size={16} /> Skanuj sieć
        </button>
      </div>

      {/* Discovery — skan podsieci */}
      {showDiscovery && (
        <div className="bg-slate-800 border border-purple-500/30 rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Wifi size={18} className="text-purple-400" /> Wyszukaj panele w sieci</h2>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Podsieć</label>
              <input value={discoveryForm.subnet} onChange={e => setDiscoveryForm({ ...discoveryForm, subnet: e.target.value })}
                className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-mono w-40 focus:border-purple-500 outline-none" placeholder="192.168.200" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Od</label>
              <input type="number" min="0" max="255" value={discoveryForm.start} onChange={e => setDiscoveryForm({ ...discoveryForm, start: parseInt(e.target.value) || 0 })}
                className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white w-20 text-center focus:border-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Do</label>
              <input type="number" min="0" max="255" value={discoveryForm.end} onChange={e => setDiscoveryForm({ ...discoveryForm, end: parseInt(e.target.value) || 0 })}
                className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white w-20 text-center focus:border-purple-500 outline-none" />
            </div>
            <button onClick={handleNetworkScan} disabled={netScanning}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl px-5 py-3 flex items-center gap-2 transition-all">
              <RefreshCw size={16} className={netScanning ? 'animate-spin' : ''} /> {netScanning ? 'Skanuję…' : 'Skanuj'}
            </button>
          </div>

          {netScanning && <p className="text-sm text-slate-400">Sprawdzam {discoveryForm.subnet}.{discoveryForm.start}–{discoveryForm.end}… to może potrwać kilka sekund.</p>}

          {netResults && !netScanning && (
            netResults.devices?.length ? (
              <div className="space-y-2">
                {netResults.devices.map(dev => (
                  <div key={dev.ip} className="bg-slate-900 rounded-xl p-3 flex items-center justify-between border border-slate-700">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-purple-300">{dev.ip}</span>
                      <span className="text-sm font-bold text-white">{dev.name}</span>
                      {dev.matrix && <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{dev.matrix}</span>}
                      <span className="text-[10px] text-slate-500">{dev.ledCount} LED</span>
                      {dev.version && <span className="text-[10px] text-slate-500">v{dev.version}</span>}
                    </div>
                    {dev.alreadyAdded ? (
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1"><CheckCircle2 size={14} /> Dodany</span>
                    ) : (
                      <button onClick={() => handleAddDiscovered(dev)} disabled={adding[dev.ip]}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-all">
                        <Plus size={14} /> Dodaj
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Nie znaleziono paneli WLED w zakresie {netResults.subnet}.{netResults.start}–{netResults.end}.</p>
            )
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">{editing ? 'Edytuj urządzenie' : 'Dodaj urządzenie'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <input placeholder="Nazwa" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none" />
          <div className="flex gap-1">
            <input placeholder="Adres IP" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none font-mono" />
            <button onClick={handleProbeIp} disabled={!form.ip} title="Wykryj WLED pod tym IP (auto-uzupełnij)"
              className="bg-slate-700 hover:bg-purple-600 disabled:opacity-40 text-slate-300 hover:text-white rounded-xl px-3 transition-all"><Search size={16} /></button>
          </div>
          <input placeholder="Rozmiar (np. 16x32)" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none" />
          <input placeholder="Lokalizacja (opis)" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none" />
          <select value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none">
            <option value="">— bez strefy —</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!form.name || !form.ip}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all">
              <Save size={18} /> {editing ? 'Zapisz' : 'Dodaj'}
            </button>
            {editing && <button onClick={() => { setForm({ name: '', ip: '', size: '16x32', type: 'matrix', location: '', area_id: '' }); setEditing(null); }}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-3"><X size={18} /></button>}
          </div>
        </div>
      </div>

      {/* Devices List */}
      <div className="grid gap-4">
        {devices.map(d => (
          <div key={d.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${d.active ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  <MonitorSmartphone size={24} className={d.active ? 'text-emerald-400' : 'text-red-400'} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{d.name}</h3>
                  <div className="flex gap-3 mt-1 text-xs text-slate-400 items-center flex-wrap">
                    <span className="font-mono">{d.ip}</span>
                    <span>{d.size}</span>
                    {d.location && <span>📍 {d.location}</span>}
                    {liveStatus[d.id] ? (
                      <span className={liveStatus[d.id].online ? 'text-emerald-400' : 'text-red-400'}
                        title={d.last_seen ? `Ostatni skan: ${d.last_seen}` : undefined}>
                        {liveStatus[d.id].online ? 'Online' : 'Offline'}
                      </span>
                    ) : (
                      <span className="text-slate-500">sprawdzam…</span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500">
                      <Layers size={11} />
                      <select value={d.area_id || ''} onChange={e => handleAssignArea(d.id, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-300 focus:border-blue-500 outline-none cursor-pointer">
                        <option value="">— bez strefy —</option>
                        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onOpenWled(d)}
                  className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all">
                  <Sliders size={14} /> Steruj
                </button>
                <button onClick={() => handleScan(d.id)} disabled={scanning[d.id]}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all">
                  <RefreshCw size={14} className={scanning[d.id] ? 'animate-spin' : ''} /> Skanuj
                </button>
                <button onClick={() => handleCopyDevice(d)}
                  className="bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all" title="Kopiuj urządzenie"><Copy size={14} /></button>
                <button onClick={() => handleEdit(d)}
                  className="bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all" title="Edytuj"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(d.id)}
                  className="bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all" title="Usuń"><Trash2 size={14} /></button>
              </div>
            </div>
            {scanResult[d.id] && (
              <div className="mt-4 bg-slate-900 rounded-xl p-4 text-xs text-slate-300">
                {scanResult[d.id].online ? (
                  <div className="flex flex-wrap gap-4">
                    <span className="text-emerald-400 font-bold">✅ Online</span>
                    <span>Presety: {scanResult[d.id].presets?.length || 0}</span>
                    {scanResult[d.id].effects && <span>Efekty: {scanResult[d.id].effects.length}</span>}
                    {scanResult[d.id].palettes && <span>Palety: {scanResult[d.id].palettes.length}</span>}
                    {scanResult[d.id].info && <span>LED: {scanResult[d.id].info.leds?.count || '?'}</span>}
                    {scanResult[d.id].info && <span>Wersja: {scanResult[d.id].info.ver}</span>}
                  </div>
                ) : (
                  <span className="text-red-400">Offline: {scanResult[d.id].error}</span>
                )}
              </div>
            )}
          </div>
        ))}
        {devices.length === 0 && (
          <div className="text-center text-slate-500 py-16">
            <Settings size={48} className="mx-auto mb-4 opacity-30" />
            <p>Brak urządzeń. Dodaj pierwsze urządzenie WLED.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: STREFY (obszary)
// ==========================================
const TILE_TYPES = [
  { val: 'power', label: 'Włącz/Wyłącz', icon: '⚡' },
  { val: 'smart-toggle', label: 'Przełącznik dwustanowy', icon: '🔄' },
  { val: 'playlist', label: 'Przycisk presetu', icon: '🎬' },
  { val: 'text-display', label: 'Wyświetlacz tekstu', icon: '📝' },
  { val: 'status-indicator', label: 'Wskaźnik strefy', icon: '🚦' },
  { val: 'color', label: 'Wybór koloru', icon: '🎨' },
  { val: 'clock', label: 'Zegar (data/godzina)', icon: '🕐' },
  { val: 'pattern', label: 'Grafika', icon: '🖼️' },
];

const EMPTY_TILE = { type: 'status-indicator', title: '', width: 1, height: 1, config: {}, target_device_ids: [] };

function AreasView({ areas, users, userGroups, devices, fetchData }) {
  const [form, setForm] = useState({ name: '', description: '', grid_cols: 4 });
  const [editingArea, setEditingArea] = useState(null);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [tileForm, setTileForm] = useState(EMPTY_TILE);
  const [editingTileId, setEditingTileId] = useState(null);
  const [accessPick, setAccessPick] = useState('');
  const [toast, setToast] = useState(null);
  const [presetSrc, setPresetSrc] = useState('');     // panel, z którego czytamy presety
  const [presetOpts, setPresetOpts] = useState([]);   // [{id, name}]
  const [presetLoading, setPresetLoading] = useState(false);
  const [patterns, setPatterns] = useState([]);       // zapisane grafiki/animacje

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };
  useEffect(() => { API.getPatterns().then(r => setPatterns(Array.isArray(r) ? r : [])); }, []);

  // Pobiera listę presetów z wybranego panelu (przez backendowy proxy WLED)
  const loadPresets = async (deviceId) => {
    if (!deviceId) { setPresetOpts([]); return; }
    setPresetLoading(true);
    const r = await API.wledFetchAll(deviceId);
    setPresetOpts(r?.presets || []);
    setPresetLoading(false);
    if (!r?.presets?.length) showToast('error', 'Panel nie zwrócił presetów (sprawdź czy są zapisane)');
  };

  // Po wybraniu typu "playlist" automatycznie ustaw źródło i wczytaj presety
  useEffect(() => {
    if (tileForm.type === 'playlist' && !presetSrc) {
      const def = (tileForm.target_device_ids && tileForm.target_device_ids[0]) || (devices[0] && devices[0].id);
      if (def) { setPresetSrc(String(def)); loadPresets(def); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileForm.type]);
  const selectedArea = areas.find(a => a.id === selectedAreaId);

  const handleSaveArea = async () => {
    if (!form.name) return;
    const res = editingArea ? await API.updateArea(editingArea, form) : await API.createArea(form);
    if (res?.error) { showToast('error', res.error); return; }
    setForm({ name: '', description: '', grid_cols: 4 });
    setEditingArea(null);
    fetchData();
    showToast('success', editingArea ? 'Strefa zaktualizowana' : 'Strefa utworzona');
  };

  const handleEditArea = (a) => { setEditingArea(a.id); setForm({ name: a.name, description: a.description || '', grid_cols: a.grid_cols || 4 }); };

  const handleDeleteArea = async (id) => {
    if (!confirm('Usunąć strefę wraz z kafelkami i dostępami?')) return;
    await API.deleteArea(id);
    if (selectedAreaId === id) setSelectedAreaId(null);
    fetchData();
    showToast('success', 'Strefa usunięta');
  };

  const handleToggleLock = async () => {
    await API.updateArea(selectedArea.id, { layout_locked: selectedArea.layout_locked ? 0 : 1 });
    fetchData();
  };

  const resetTile = () => { setTileForm(EMPTY_TILE); setEditingTileId(null); };

  const handleAddTile = async () => {
    if (!selectedArea) return;
    const data = { ...tileForm, target_device_ids: tileForm.target_device_ids || [], config: tileForm.config || {} };
    if (editingTileId) await API.updateTile(editingTileId, data);
    else await API.addAreaTile(selectedArea.id, data);
    resetTile();
    fetchData();
    showToast('success', editingTileId ? 'Kafelek zaktualizowany' : 'Kafelek dodany');
  };

  const handleEditTile = (t) => {
    setTileForm({ type: t.type || 'power', title: t.title || '', width: t.width || 1, height: t.height || 1, config: t.config || {}, target_device_ids: t.targetIds || [] });
    setEditingTileId(t.id);
  };

  const handleCopyTile = async (t) => {
    await API.addAreaTile(selectedArea.id, { type: t.type, title: (t.title || 'Kafelek') + ' (kopia)', width: t.width || 1, height: t.height || 1, config: t.config || {}, target_device_ids: t.targetIds || [] });
    fetchData();
    showToast('success', 'Kafelek skopiowany');
  };

  // Kopiuje CAŁY układ funkcji jednego panelu na inny panel w tej strefie
  const handleCopyPanelLayout = async (sourceDevId, targetDevId) => {
    if (!targetDevId || targetDevId === sourceDevId) return;
    const srcTiles = (selectedArea.tiles || []).filter(t => (t.targetIds || []).length === 1 && t.targetIds[0] === sourceDevId);
    if (!srcTiles.length) { showToast('error', 'Panel źródłowy nie ma funkcji do skopiowania'); return; }
    const nameOf = (id) => devices.find(d => d.id === id)?.name || `#${id}`;
    if (!confirm(`Skopiować ${srcTiles.length} funkcji z „${nameOf(sourceDevId)}” do „${nameOf(targetDevId)}”?`)) return;
    for (const t of srcTiles) {
      await API.addAreaTile(selectedArea.id, { type: t.type, title: t.title || '', width: t.width || 1, height: t.height || 1, config: t.config || {}, target_device_ids: [targetDevId] });
    }
    fetchData();
    showToast('success', `Skopiowano ${srcTiles.length} funkcji do „${nameOf(targetDevId)}”`);
  };

  const handleRemoveTile = async (tileId) => {
    if (!confirm('Usunąć kafelek?')) return;
    await API.deleteTile(tileId);
    fetchData();
    showToast('success', 'Kafelek usunięty');
  };

  // Etap 3: dodawanie funkcji w kontekście konkretnego panelu (prefill formularza jego celem)
  const addFunctionToPanel = (devId) => {
    setEditingTileId(null);
    setTileForm({ ...EMPTY_TILE, target_device_ids: [devId] });
    setTimeout(() => document.getElementById('tile-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleToggleDevice = async (dev) => {
    const assigned = dev.area_id === selectedArea.id;
    await API.updateDevice(dev.id, { area_id: assigned ? null : selectedArea.id });
    fetchData();
  };

  const handleGrantAccess = async () => {
    if (!accessPick) return;
    const [kind, id] = accessPick.split(':');
    await API.grantAreaAccess(selectedArea.id, kind === 'u' ? { user_id: Number(id) } : { group_id: Number(id) });
    setAccessPick('');
    fetchData();
    showToast('success', 'Dostęp nadany');
  };

  const handleRevokeAccess = async (accessId) => {
    await API.revokeAreaAccess(selectedArea.id, accessId);
    fetchData();
  };

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-8">Strefy</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lista + tworzenie stref */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4">Lista stref</h2>
            <div className="space-y-2 mb-6">
              <input placeholder="Nazwa strefy" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
              <input placeholder="Opis (opcjonalnie)" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Kolumny:</span>
                <input type="number" min="1" max="8" value={form.grid_cols}
                  onChange={e => setForm({ ...form, grid_cols: parseInt(e.target.value) || 4 })}
                  className="w-20 bg-slate-900 border border-slate-600 rounded-xl p-2 text-white text-center focus:border-blue-500 outline-none" />
              </div>
              <button onClick={handleSaveArea} disabled={!form.name}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                <Plus size={18} /> {editingArea ? 'Zapisz zmiany' : 'Utwórz strefę'}
              </button>
              {editingArea && (
                <button onClick={() => { setEditingArea(null); setForm({ name: '', description: '', grid_cols: 4 }); }}
                  className="w-full text-xs text-slate-500 hover:text-white transition-colors">anuluj edycję</button>
              )}
            </div>
            <div className="space-y-2">
              {areas.map(a => (
                <div key={a.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedAreaId === a.id ? 'bg-blue-600/20 border-blue-500/30' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}
                  onClick={() => setSelectedAreaId(a.id)}>
                  <div>
                    <p className="font-bold text-sm text-white flex items-center gap-2">{a.name}
                      {a.layout_locked ? <Lock size={11} className="text-amber-400" /> : null}</p>
                    <p className="text-[10px] text-slate-500">{a.device_count ?? 0} {panelWord(a.device_count ?? 0)} • {a.tile_count ?? a.tiles?.length ?? 0} kafelków • {a.access?.length ?? 0} dostępów</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); handleEditArea(a); }}
                      className="p-1.5 hover:bg-blue-900/30 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); handleDeleteArea(a.id); }}
                      className="p-1.5 hover:bg-red-900/30 rounded-lg text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {areas.length === 0 && <p className="text-slate-500 text-center py-8">Brak stref</p>}
            </div>
          </div>
        </div>

        {/* Edytor wybranej strefy */}
        <div className="lg:col-span-2">
          {selectedArea ? (
            <div className="space-y-6">
              {/* Nagłówek + blokada układu */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedArea.name}</h2>
                  {selectedArea.description && <p className="text-sm text-slate-400">{selectedArea.description}</p>}
                  <p className="text-xs text-slate-500 mt-1">{selectedArea.grid_cols} kolumn</p>
                </div>
                <button onClick={handleToggleLock}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedArea.layout_locked ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-white'}`}>
                  {selectedArea.layout_locked ? <Lock size={16} /> : <Unlock size={16} />}
                  {selectedArea.layout_locked ? 'Układ zablokowany' : 'Układ odblokowany'}
                </button>
              </div>

              {/* Przypisanie paneli */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Panele w strefie</h3>
                <div className="flex flex-wrap gap-2">
                  {devices.map(dev => {
                    const assigned = dev.area_id === selectedArea.id;
                    const elsewhere = dev.area_id && dev.area_id !== selectedArea.id;
                    return (
                      <button key={dev.id} onClick={() => handleToggleDevice(dev)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${assigned ? 'bg-emerald-600 border-emerald-400 text-white' : elsewhere ? 'bg-slate-900 border-slate-700 text-slate-500' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'}`}
                        title={elsewhere ? 'Przypisany do innej strefy' : ''}>
                        {dev.name || `#${dev.id}`} <span className="opacity-60">{dev.ip}</span>
                      </button>
                    );
                  })}
                  {devices.length === 0 && <p className="text-slate-500 text-sm">Brak urządzeń. Dodaj je w zakładce „Urządzenia".</p>}
                </div>
              </div>

              {/* Dostęp użytkowników/grup */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-slate-300 mb-3">Dostęp do strefy</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(selectedArea.access || []).map(ac => (
                    <span key={ac.id} className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 ${ac.group_id ? 'bg-purple-600/20 border-purple-500/30 text-purple-300' : 'bg-blue-600/20 border-blue-500/30 text-blue-300'}`}>
                      {ac.group_id ? <FolderPlus size={11} /> : <Users size={11} />}
                      {ac.group_id ? ac.group_name : (ac.display_name || ac.username)}
                      <button onClick={() => handleRevokeAccess(ac.id)} className="hover:text-red-400"><X size={12} /></button>
                    </span>
                  ))}
                  {(!selectedArea.access || selectedArea.access.length === 0) && <span className="text-slate-500 text-sm">Brak nadanych dostępów</span>}
                </div>
                <div className="flex gap-2">
                  <select value={accessPick} onChange={e => setAccessPick(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-2 text-white text-sm focus:border-blue-500 outline-none">
                    <option value="">— Dodaj użytkownika lub grupę —</option>
                    <optgroup label="Grupy">
                      {(userGroups || []).map(g => <option key={'g'+g.id} value={`g:${g.id}`}>👥 {g.name}</option>)}
                    </optgroup>
                    <optgroup label="Użytkownicy">
                      {users.map(u => <option key={'u'+u.id} value={`u:${u.id}`}>{u.username} ({u.role})</option>)}
                    </optgroup>
                  </select>
                  <button onClick={handleGrantAccess} disabled={!accessPick}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-4 rounded-xl flex items-center gap-2 transition-all text-sm">
                    <Plus size={16} /> Nadaj
                  </button>
                </div>
              </div>

              {/* Edytor kafelków */}
              <div id="tile-form" className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold text-slate-300 mb-3">
                  {editingTileId ? 'Edytuj funkcję' : 'Dodaj funkcję'}
                  {!editingTileId && tileForm.target_device_ids?.length === 1 && (
                    <span className="ml-2 text-emerald-400 font-normal">→ {devices.find(d => d.id === tileForm.target_device_ids[0])?.name || `#${tileForm.target_device_ids[0]}`}</span>
                  )}
                  {editingTileId && <button onClick={resetTile} className="ml-3 text-xs text-slate-500 hover:text-white transition-colors">(anuluj)</button>}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <select value={tileForm.type} onChange={e => setTileForm({ ...tileForm, type: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                    {TILE_TYPES.map(t => <option key={t.val} value={t.val}>{t.icon} {t.label}</option>)}
                  </select>
                  <input placeholder="Tytuł" value={tileForm.title} onChange={e => setTileForm({ ...tileForm, title: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" />
                  <div className="flex gap-2">
                    <input type="number" value={tileForm.width} onChange={e => setTileForm({ ...tileForm, width: parseInt(e.target.value) || 1 })}
                      className="w-16 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none text-center" min="1" max="8" />
                    <span className="text-slate-500 self-center">×</span>
                    <input type="number" value={tileForm.height} onChange={e => setTileForm({ ...tileForm, height: parseInt(e.target.value) || 1 })}
                      className="w-16 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none text-center" min="1" max="4" />
                  </div>
                  <button onClick={handleAddTile}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-all text-sm">
                    {editingTileId ? <Save size={16} /> : <Plus size={16} />} {editingTileId ? 'Zapisz' : 'Dodaj'}
                  </button>
                </div>

                {tileForm.type === 'playlist' && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Etykieta przycisku (np. Tryb nocny)" value={tileForm.config.presetLabel || ''}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, presetLabel: e.target.value } })}
                        className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" />
                      <select value={tileForm.config.color || 'blue'} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, color: e.target.value } })}
                        className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        {TILE_COLORS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Czytaj presety z panelu</label>
                        <select value={presetSrc} onChange={e => { setPresetSrc(e.target.value); loadPresets(e.target.value); }}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                          <option value="">— wybierz panel —</option>
                          {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
                        </select>
                      </div>
                      <button onClick={() => loadPresets(presetSrc)} disabled={!presetSrc || presetLoading}
                        className="bg-slate-700 hover:bg-blue-600 disabled:opacity-40 text-slate-200 rounded-lg px-3 py-2 transition-all" title="Odśwież listę presetów">
                        <RefreshCw size={16} className={presetLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Preset</label>
                      <select value={tileForm.config.presetId || ''}
                        onChange={e => {
                          const id = parseInt(e.target.value) || 0;
                          const p = presetOpts.find(x => x.id === id);
                          setTileForm({ ...tileForm, config: { ...tileForm.config, presetId: id, presetLabel: tileForm.config.presetLabel || (p ? p.name : '') } });
                        }}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        <option value="">{presetLoading ? 'Wczytywanie…' : (presetOpts.length ? '— wybierz preset —' : '— wczytaj presety z panelu —')}</option>
                        {presetOpts.map(p => <option key={p.id} value={p.id}>#{p.id} {p.name}</option>)}
                        {tileForm.config.presetId && !presetOpts.find(p => p.id === tileForm.config.presetId) && (
                          <option value={tileForm.config.presetId}>#{tileForm.config.presetId} (zapisany)</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">…albo grafika zamiast presetu</label>
                      <select value={tileForm.config.graphicId || ''} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, graphicId: e.target.value ? Number(e.target.value) : null } })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        <option value="">— użyj presetu —</option>
                        {patterns.map(p => <option key={p.id} value={p.id}>🖼️ {p.name} ({p.width}×{p.height}{p.pixel_data?.frames?.length > 1 ? ' 🎞' : ''})</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {tileForm.type === 'pattern' && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Grafika do wyświetlenia</label>
                      <select value={tileForm.config.patternId || ''} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, patternId: e.target.value ? Number(e.target.value) : null } })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        <option value="">— wybierz grafikę —</option>
                        {patterns.map(p => <option key={p.id} value={p.id}>🖼️ {p.name} ({p.width}×{p.height}{p.pixel_data?.frames?.length > 1 ? ' 🎞 animacja' : ''})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Kolor przycisku (dashboard)</label>
                      <select value={tileForm.config.color || 'purple'} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, color: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        {TILE_COLORS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                      </select>
                    </div>
                    <p className="md:col-span-2 text-[10px] text-slate-500">Operator: dotknięcie wyświetla grafikę na panelach kafelka, ponowne dotknięcie ją wyłącza.</p>
                  </div>
                )}
                {(tileForm.type === 'smart-toggle' || tileForm.type === 'status-indicator') && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <input placeholder={tileForm.type === 'status-indicator' ? 'Etykieta: dostępne' : 'Etykieta stan 1'} value={tileForm.config.state1Label || ''}
                      onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state1Label: e.target.value } })}
                      className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" />
                    <select value={tileForm.config.state1Color || 'green'} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state1Color: e.target.value, state1CustomHex: '' } })}
                      className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                      {TILE_COLORS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                      <option value="custom">🎨 Własny</option>
                    </select>
                    {tileForm.config.state1Color === 'custom' && (
                      <input type="color" value={tileForm.config.state1CustomHex || '#00ff00'}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state1CustomHex: e.target.value } })}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                    )}
                    <input placeholder={tileForm.type === 'status-indicator' ? 'Etykieta: niedostępne' : 'Etykieta stan 2'} value={tileForm.config.state2Label || ''}
                      onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state2Label: e.target.value } })}
                      className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none" />
                    <select value={tileForm.config.state2Color || 'red'} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state2Color: e.target.value, state2CustomHex: '' } })}
                      className="bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                      {TILE_COLORS.map(c => <option key={c.val} value={c.val}>{c.label}</option>)}
                      <option value="custom">🎨 Własny</option>
                    </select>
                    {tileForm.config.state2Color === 'custom' && (
                      <input type="color" value={tileForm.config.state2CustomHex || '#ff0000'}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state2CustomHex: e.target.value } })}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                    )}
                  </div>
                )}
                {tileForm.type === 'smart-toggle' && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Stan 1 — grafika na panel (zamiast koloru)</label>
                      <select value={tileForm.config.state1Pattern || ''} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state1Pattern: e.target.value ? Number(e.target.value) : null } })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        <option value="">— tylko kolor —</option>
                        {patterns.map(p => <option key={p.id} value={p.id}>{p.name} ({p.width}×{p.height}{p.pixel_data?.frames?.length > 1 ? ' 🎞' : ''})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Stan 2 — grafika na panel (zamiast koloru)</label>
                      <select value={tileForm.config.state2Pattern || ''} onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, state2Pattern: e.target.value ? Number(e.target.value) : null } })}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:border-blue-500 outline-none">
                        <option value="">— tylko kolor —</option>
                        {patterns.map(p => <option key={p.id} value={p.id}>{p.name} ({p.width}×{p.height}{p.pixel_data?.frames?.length > 1 ? ' 🎞' : ''})</option>)}
                      </select>
                    </div>
                    <p className="md:col-span-2 text-[10px] text-slate-500">Kolor stanu = wygląd kafelka na dashboardzie. Grafika (jeśli wybrana) = co pojawi się na matrycy w tym stanie.</p>
                  </div>
                )}
                {tileForm.type === 'clock' && (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={tileForm.config.showDate !== false}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, showDate: e.target.checked } })} /> Data
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={!!tileForm.config.showSeconds}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, showSeconds: e.target.checked } })} /> Sekundy
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={!!tileForm.config.format12}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, format12: e.target.checked } })} /> 12h
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      Kolor
                      <input type="color" value={tileForm.config.color || '#ffffff'}
                        onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, color: e.target.value } })}
                        className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                    </label>
                    <div className="w-full flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700/50">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={!!tileForm.config.autoPush}
                          onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, autoPush: e.target.checked } })} />
                        Automatycznie wysyłaj na panel
                      </label>
                      {tileForm.config.autoPush && (
                        <label className="flex items-center gap-2 text-sm text-slate-400">
                          co
                          <input type="number" min="15" max="3600" value={tileForm.config.autoPushInterval || 60}
                            onChange={e => setTileForm({ ...tileForm, config: { ...tileForm.config, autoPushInterval: parseInt(e.target.value) || 60 } })}
                            className="w-20 bg-slate-900 border border-slate-600 rounded-lg p-1.5 text-white text-sm text-center focus:border-blue-500 outline-none" />
                          sek.
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <details open className="mt-3 bg-slate-900/50 rounded-lg p-3">
                  <summary className="text-xs font-semibold text-slate-400 cursor-pointer hover:text-slate-200 transition-colors">
                    Przypisz kafelek do paneli ({tileForm.target_device_ids.length} wybrano)
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {devices.map(dev => {
                      const checked = tileForm.target_device_ids.includes(dev.id);
                      return (
                        <button key={dev.id} onClick={() => setTileForm({ ...tileForm, target_device_ids: checked ? tileForm.target_device_ids.filter(id => id !== dev.id) : [...tileForm.target_device_ids, dev.id] })}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${checked ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'}`}>
                          {dev.name || `#${dev.id}`}
                        </button>
                      );
                    })}
                    {devices.length === 0 && <p className="text-slate-500 text-sm">Brak urządzeń</p>}
                  </div>
                </details>

                <h3 className="text-sm font-bold text-slate-400 mt-6 mb-3">Funkcje paneli</h3>
                {(() => {
                  // Grupowanie funkcji (kafelków) per panel — lustrzane odbicie dashboardu.
                  const tiles = selectedArea.tiles || [];
                  const singleByDev = new Map();
                  const multi = [];
                  tiles.forEach(t => {
                    const ids = t.targetIds || [];
                    if (ids.length === 1) {
                      if (!singleByDev.has(ids[0])) singleByDev.set(ids[0], []);
                      singleByDev.get(ids[0]).push(t);
                    } else { multi.push(t); }
                  });
                  const panels = selectedArea.devices || [];
                  const typeMeta = (t) => TILE_TYPES.find(x => x.val === t.type);
                  const renderTileRow = (tile) => {
                    const m = typeMeta(tile);
                    return (
                      <div key={tile.id} className="bg-slate-900 rounded-lg px-3 py-2 border border-slate-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span>{m?.icon}</span>
                          <span className="text-sm font-bold text-white truncate">{tile.title || m?.label || tile.type}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{m?.label || tile.type}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => handleCopyTile(tile)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Kopiuj"><Copy size={13} /></button>
                          <button onClick={() => handleEditTile(tile)} className="p-1.5 hover:bg-blue-900/30 rounded-lg text-slate-400 hover:text-blue-400 transition-colors" title="Edytuj"><Edit2 size={13} /></button>
                          <button onClick={() => handleRemoveTile(tile.id)} className="p-1.5 hover:bg-red-900/30 rounded-lg text-red-400 transition-colors" title="Usuń"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div className="space-y-3">
                      {panels.map(dev => {
                        const fns = singleByDev.get(dev.id) || [];
                        return (
                          <div key={dev.id} className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <MonitorSmartphone size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="font-bold text-white text-sm truncate">{dev.name || `#${dev.id}`}</span>
                                <span className="text-[10px] text-slate-500">{fns.length} {fns.length === 1 ? 'funkcja' : 'funkcji'}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {fns.length > 0 && panels.length > 1 && (
                                  <select value="" onChange={e => { const v = e.target.value; e.target.value = ''; if (v) handleCopyPanelLayout(dev.id, Number(v)); }}
                                    className="text-xs bg-slate-800 border border-slate-600 text-slate-300 rounded-lg px-2 py-1" title="Kopiuj wszystkie funkcje tego panelu do innego panelu w strefie">
                                    <option value="">Kopiuj układ do…</option>
                                    {panels.filter(p => p.id !== dev.id).map(p => <option key={p.id} value={p.id}>{p.name || `#${p.id}`}</option>)}
                                  </select>
                                )}
                                <button onClick={() => addFunctionToPanel(dev.id)}
                                  className="text-xs flex items-center gap-1 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 px-2.5 py-1 rounded-lg transition-all">
                                  <Plus size={13} /> Dodaj funkcję
                                </button>
                              </div>
                            </div>
                            {fns.length === 0
                              ? <p className="text-[11px] text-slate-600 py-1">Brak funkcji — na dashboardzie panel pokaże tylko nagłówek i zasilanie.</p>
                              : <div className="space-y-1.5">{fns.map(renderTileRow)}</div>}
                          </div>
                        );
                      })}
                      {panels.length === 0 && (
                        <p className="text-slate-500 text-center py-4 text-sm">Brak paneli w strefie — przypisz panel w sekcji „Panele w strefie" powyżej.</p>
                      )}
                      {multi.length > 0 && (
                        <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Layers size={14} className="text-slate-400" />
                            <span className="font-bold text-white text-sm">Wielopanelowe (wspólne)</span>
                            <span className="text-[10px] text-slate-500">{multi.length}</span>
                          </div>
                          <div className="space-y-1.5">{multi.map(renderTileRow)}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl text-center py-16">
              <Layers size={48} className="mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400">Wybierz strefę z listy, aby zarządzać panelami, dostępem i kafelkami.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: GRUPY UŻYTKOWNIKÓW
// ==========================================
function UserGroupsView({ users, userGroups, fetchData }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [members, setMembers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const reset = () => { setForm({ name: '', description: '' }); setMembers([]); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name) { showToast('error', 'Podaj nazwę grupy'); return; }
    const data = { ...form, user_ids: members };
    const res = editingId ? await API.updateUserGroup(editingId, data) : await API.createUserGroup(data);
    if (res?.error) { showToast('error', res.error); return; }  // np. duplikat nazwy grupy
    reset();
    fetchData();
    showToast('success', editingId ? 'Grupa zaktualizowana' : 'Grupa utworzona');
  };

  const handleEdit = (g) => { setEditingId(g.id); setForm({ name: g.name, description: g.description || '' }); setMembers((g.members || []).map(m => m.id)); };

  const handleDelete = async (id) => {
    if (!confirm('Usunąć grupę? Dostępy strefowe nadane tej grupie zostaną usunięte.')) return;
    await API.deleteUserGroup(id);
    if (editingId === id) reset();
    fetchData();
    showToast('success', 'Grupa usunięta');
  };

  const toggleMember = (uid) => setMembers(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-8">Grupy użytkowników</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4">{editingId ? 'Edytuj grupę' : 'Nowa grupa'}</h2>
            <div className="space-y-2 mb-4">
              <input placeholder="Nazwa grupy" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
              <input placeholder="Opis (opcjonalnie)" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
            </div>
            {/* Przenoszenie użytkowników: dostępni ↔ w grupie */}
            <p className="text-xs font-bold text-slate-400 mb-2">Skład grupy — kliknij, aby przenieść</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Dostępni */}
              <div className="border border-slate-700 rounded-xl bg-slate-900/50 overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center justify-between">
                  <span>Dostępni</span>
                  <button onClick={() => setMembers(users.map(u => u.id))} disabled={members.length === users.length}
                    className="text-blue-400 hover:text-blue-300 disabled:opacity-30 font-bold">dodaj wszystkich »</button>
                </div>
                <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                  {users.filter(u => !members.includes(u.id)).map(u => (
                    <button type="button" key={u.id} onClick={() => toggleMember(u.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-emerald-600/20 text-left transition-all group">
                      <Plus size={13} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-white truncate">{u.username}</span>
                      <span className="text-[9px] text-slate-500 ml-auto">{u.role}</span>
                    </button>
                  ))}
                  {users.filter(u => !members.includes(u.id)).length === 0 && <p className="text-[10px] text-slate-600 text-center py-3">— wszyscy w grupie —</p>}
                </div>
              </div>
              {/* W grupie */}
              <div className="border border-blue-500/30 rounded-xl bg-blue-900/10 overflow-hidden">
                <div className="px-3 py-1.5 bg-blue-900/20 text-[10px] uppercase tracking-wider text-blue-300/70 font-bold flex items-center justify-between">
                  <span>W grupie ({members.length})</span>
                  <button onClick={() => setMembers([])} disabled={members.length === 0}
                    className="text-slate-400 hover:text-white disabled:opacity-30 font-bold">« usuń wszystkich</button>
                </div>
                <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                  {users.filter(u => members.includes(u.id)).map(u => (
                    <button type="button" key={u.id} onClick={() => toggleMember(u.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-red-600/20 text-left transition-all">
                      <X size={13} className="text-red-400 flex-shrink-0" />
                      <span className="text-xs text-white truncate">{u.username}</span>
                      <span className="text-[9px] text-slate-500 ml-auto">{u.role}</span>
                    </button>
                  ))}
                  {members.length === 0 && <p className="text-[10px] text-slate-600 text-center py-3">— brak członków —</p>}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 mb-4">Zmiany zapiszą się dopiero po kliknięciu „{editingId ? 'Zapisz zmiany' : 'Utwórz grupę'}".</p>
            <button onClick={handleSave} disabled={!form.name}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
              <Save size={18} /> {editingId ? 'Zapisz zmiany' : 'Utwórz grupę'}
            </button>
            {editingId && <button onClick={reset} className="w-full mt-2 text-xs text-slate-500 hover:text-white transition-colors">anuluj edycję</button>}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4">Istniejące grupy</h2>
            <div className="space-y-2">
              {(userGroups || []).map(g => (
                <div key={g.id} className="bg-slate-900 rounded-xl p-4 border border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white flex items-center gap-2"><FolderPlus size={14} className="text-purple-400" /> {g.name}</p>
                    {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(g.members || []).map(m => <span key={m.id} className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">{m.username}</span>)}
                      {(!g.members || g.members.length === 0) && <span className="text-[10px] text-slate-600">brak członków</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(g)} className="p-2 hover:bg-blue-900/30 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(g.id)} className="p-2 hover:bg-red-900/30 rounded-lg text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {(!userGroups || userGroups.length === 0) && <p className="text-slate-500 text-center py-8">Brak grup</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: SZABLONY KONFIGURACJI
// ==========================================
function rgbToHex(rgb) {
  if (!Array.isArray(rgb)) return '#334155';
  const [r = 0, g = 0, b = 0] = rgb;
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function TargetPicker({ devices, areas, value, onChange }) {
  const toggle = (key, id) => {
    const arr = value[key];
    onChange({ ...value, [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] });
  };
  return (
    <div className="space-y-3">
      {areas.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Strefy (wszystkie ich panele)</p>
          <div className="flex flex-wrap gap-2">
            {areas.map(a => {
              const checked = value.area_ids.includes(a.id);
              return (
                <button key={a.id} onClick={() => toggle('area_ids', a.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${checked ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400'}`}>
                  {a.name} <span className="opacity-60">({a.device_count ?? a.devices?.length ?? 0})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Pojedyncze panele</p>
        <div className="flex flex-wrap gap-2">
          {devices.map(d => {
            const checked = value.device_ids.includes(d.id);
            return (
              <button key={d.id} onClick={() => toggle('device_ids', d.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${checked ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-400'}`}>
                {d.name}
              </button>
            );
          })}
          {devices.length === 0 && <span className="text-slate-500 text-sm">Brak paneli</span>}
        </div>
      </div>
    </div>
  );
}

function ResultList({ results }) {
  if (!results) return null;
  return (
    <div className="mt-3 space-y-1">
      {results.results.map(r => (
        <div key={r.device_id} className="flex items-center gap-2 text-xs">
          {r.ok ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertCircle size={14} className="text-red-400" />}
          <span className="text-white font-medium">{r.name}</span>
          <span className="font-mono text-slate-500">{r.ip}</span>
          {!r.ok && <span className="text-red-400">{r.error}</span>}
        </div>
      ))}
    </div>
  );
}

function TemplatesView({ templates, devices, areas, fetchData }) {
  const [form, setForm] = useState({ name: '', description: '', from_device_id: '' });
  const [creating, setCreating] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [applyTarget, setApplyTarget] = useState({ device_ids: [], area_ids: [] });
  const [copyForm, setCopyForm] = useState({ source_device_id: '', device_ids: [], area_ids: [] });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };

  const handleCreate = async () => {
    if (!form.name || !form.from_device_id) return;
    setCreating(true);
    const res = await API.createTemplate({ name: form.name, description: form.description, from_device_id: Number(form.from_device_id) });
    setCreating(false);
    if (res?.id) {
      setForm({ name: '', description: '', from_device_id: '' });
      fetchData();
      showToast('success', `Zapisano szablon „${res.name}” z bieżącej konfiguracji panelu`);
    } else {
      showToast('error', res?.error || 'Nie udało się utworzyć szablonu');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Usunąć szablon?')) return;
    await API.deleteTemplate(id);
    if (applyingId === id) setApplyingId(null);
    fetchData();
    showToast('success', 'Szablon usunięty');
  };

  const openApply = (id) => { setApplyingId(applyingId === id ? null : id); setApplyTarget({ device_ids: [], area_ids: [] }); setResults(null); };

  const handleApply = async () => {
    if (!applyTarget.device_ids.length && !applyTarget.area_ids.length) { showToast('error', 'Wskaż panele lub strefy'); return; }
    setBusy(true);
    const res = await API.applyTemplate(applyingId, applyTarget);
    setBusy(false);
    if (res?.results) { setResults({ ...res }); showToast(res.applied === res.total ? 'success' : 'error', `Zastosowano na ${res.applied}/${res.total} panelach`); }
    else showToast('error', res?.error || 'Błąd zastosowania');
  };

  const handleCopy = async () => {
    if (!copyForm.source_device_id) { showToast('error', 'Wybierz panel źródłowy'); return; }
    if (!copyForm.device_ids.length && !copyForm.area_ids.length) { showToast('error', 'Wskaż panele/strefy docelowe'); return; }
    setBusy(true);
    const res = await API.copyConfig({ source_device_id: Number(copyForm.source_device_id), device_ids: copyForm.device_ids, area_ids: copyForm.area_ids });
    setBusy(false);
    if (res?.results) { setResults({ ...res }); showToast(res.applied === res.total ? 'success' : 'error', `Skopiowano na ${res.applied}/${res.total} panelach`); }
    else showToast('error', res?.error || 'Błąd kopiowania');
  };

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-2">Szablony konfiguracji</h1>
      <p className="text-sm text-slate-400 mb-8">Zapisz „wygląd” panelu (kolor, efekt, paleta, jasność) i zastosuj go na innych panelach lub całych strefach.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tworzenie szablonu + kopiowanie */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Sparkles size={18} className="text-amber-400" /> Nowy szablon z panelu</h2>
            <div className="space-y-2">
              <input placeholder="Nazwa (np. Strefa wolna)" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-amber-500 outline-none" />
              <input placeholder="Opis (opcjonalnie)" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-amber-500 outline-none" />
              <select value={form.from_device_id} onChange={e => setForm({ ...form, from_device_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-amber-500 outline-none">
                <option value="">— Panel źródłowy (pobierz bieżący stan) —</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
              </select>
              <button onClick={handleCreate} disabled={!form.name || !form.from_device_id || creating}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                <Save size={18} /> {creating ? 'Pobieram stan…' : 'Zapisz szablon'}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Copy size={18} className="text-cyan-400" /> Kopiuj konfigurację 1:1</h2>
            <select value={copyForm.source_device_id} onChange={e => setCopyForm({ ...copyForm, source_device_id: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-cyan-500 outline-none mb-3">
              <option value="">— Panel źródłowy —</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
            </select>
            <p className="text-xs font-bold text-slate-400 mb-2">Docelowe:</p>
            <TargetPicker devices={devices.filter(d => String(d.id) !== String(copyForm.source_device_id))} areas={areas}
              value={copyForm} onChange={v => setCopyForm({ ...copyForm, device_ids: v.device_ids, area_ids: v.area_ids })} />
            <button onClick={handleCopy} disabled={busy}
              className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
              <Copy size={18} /> {busy ? 'Kopiuję…' : 'Kopiuj teraz'}
            </button>
          </div>
        </div>

        {/* Lista szablonów */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4">Zapisane szablony</h2>
            <div className="space-y-3">
              {templates.map(t => {
                const seg = t.state?.seg?.[0] || {};
                const hex = rgbToHex(seg.col?.[0]);
                return (
                  <div key={t.id} className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg border border-slate-600 shadow-inner" style={{ backgroundColor: hex }} title={hex} />
                        <div>
                          <p className="font-bold text-white">{t.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {t.description ? t.description + ' • ' : ''}efekt {seg.fx ?? 0} • jasność {t.state?.bri ?? '?'}
                            {t.source_name ? ` • z: ${t.source_name}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openApply(t.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${applyingId === t.id ? 'bg-emerald-600 text-white' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white'}`}>
                          <Play size={14} /> Zastosuj
                        </button>
                        <button onClick={() => handleDelete(t.id)}
                          className="p-2 hover:bg-red-900/30 rounded-xl text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {applyingId === t.id && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <TargetPicker devices={devices} areas={areas} value={applyTarget} onChange={setApplyTarget} />
                        <button onClick={handleApply} disabled={busy}
                          className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                          <Play size={18} /> {busy ? 'Stosuję…' : 'Zastosuj na wybranych'}
                        </button>
                        {results && applyingId === t.id && <ResultList results={results} />}
                      </div>
                    )}
                  </div>
                );
              })}
              {templates.length === 0 && (
                <div className="text-center text-slate-500 py-12">
                  <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Brak szablonów. Ustaw panel jak chcesz (zakładka Urządzenia → Steruj), a potem zapisz jego stan jako szablon.</p>
                </div>
              )}
            </div>
            {results && applyingId === null && (
              <div className="mt-4 bg-slate-900 rounded-xl p-4 border border-slate-700">
                <p className="text-sm font-bold text-white mb-1">Wynik kopiowania: {results.applied}/{results.total}</p>
                <ResultList results={results} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: USERS (unchanged)
// ==========================================
function UsersView({ users, fetchData }) {
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'operator' });
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3000); };

  const handleSave = async () => {
    let res;
    if (editing) {
      if (!form.username?.trim()) { showToast('error', 'Login nie może być pusty'); return; }
      const data = { username: form.username.trim(), display_name: form.display_name };
      if (form.role) data.role = form.role;
      if (form.password) data.password = form.password;
      res = await API.updateUser(editing, data);
    } else {
      if (!form.username || !form.password) return;
      if (form.password.length < 6) { showToast('error', 'Hasło musi mieć minimum 6 znaków'); return; }
      res = await API.createUser(form);
    }
    if (res?.error) { showToast('error', res.error); return; }  // np. duplikat loginu / krótkie hasło
    setForm({ username: '', password: '', display_name: '', role: 'operator' });
    setEditing(null);
    fetchData();
    showToast('success', editing ? 'Użytkownik zaktualizowany' : 'Użytkownik utworzony');
  };

  const handleEdit = (u) => {
    setForm({ username: u.username, password: '', display_name: u.display_name, role: u.role });
    setEditing(u.id);
  };

  const handleDelete = async (id) => {
    if (!confirm('Usunąć tego użytkownika?')) return;
    await API.deleteUser(id);
    fetchData();
    showToast('success', 'Użytkownik usunięty');
  };

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-8">Użytkownicy</h1>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">{editing ? 'Edytuj użytkownika' : 'Dodaj użytkownika'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <input placeholder="Login" value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none" />
          <input type="password" placeholder={editing ? 'Nowe hasło (puste = bez zmian)' : 'Hasło'} value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none" />
          <input placeholder="Wyświetlana nazwa" value={form.display_name}
            onChange={e => setForm({ ...form, display_name: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none" />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-medium focus:border-blue-500 outline-none">
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!editing && (!form.username || !form.password)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all">
              <Save size={18} /> {editing ? 'Zapisz' : 'Dodaj'}
            </button>
            {editing && <button onClick={() => { setForm({ username: '', password: '', display_name: '', role: 'operator' }); setEditing(null); }}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-3"><X size={18} /></button>}
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        {users.map(u => (
          <div key={u.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center justify-between hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${u.role === 'admin' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                <Users size={20} className={u.role === 'admin' ? 'text-purple-400' : 'text-blue-400'} />
              </div>
              <div>
                <h3 className="font-bold text-white">{u.display_name || u.username}</h3>
                <div className="flex gap-3 text-xs text-slate-400 mt-1">
                  <span>@{u.username}</span>
                  <span className={u.role === 'admin' ? 'text-purple-400 font-bold uppercase' : 'text-blue-400 uppercase'}>{u.role}</span>
                  <span className={u.active ? 'text-emerald-400' : 'text-red-400'}>{u.active ? 'Aktywny' : 'Nieaktywny'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(u)}
                className="bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all"><Edit2 size={14} /></button>
              <button onClick={() => handleDelete(u.id)}
                className="bg-red-900/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: LOGI (audyt)
// ==========================================
const ACTION_META = {
  login: { label: 'Logowanie', cls: 'bg-slate-600/20 text-slate-300' },
  create_device: { label: 'Dodano urządzenie', cls: 'bg-emerald-600/20 text-emerald-400' },
  update_device: { label: 'Zmieniono urządzenie', cls: 'bg-blue-600/20 text-blue-400' },
  delete_device: { label: 'Usunięto urządzenie', cls: 'bg-red-600/20 text-red-400' },
  scan_device: { label: 'Skan urządzenia', cls: 'bg-slate-600/20 text-slate-300' },
  command_device: { label: 'Komenda do panelu', cls: 'bg-cyan-600/20 text-cyan-400' },
  scan_network: { label: 'Skan sieci', cls: 'bg-purple-600/20 text-purple-300' },
  create_area: { label: 'Utworzono strefę', cls: 'bg-emerald-600/20 text-emerald-400' },
  update_area: { label: 'Zmieniono strefę', cls: 'bg-blue-600/20 text-blue-400' },
  delete_area: { label: 'Usunięto strefę', cls: 'bg-red-600/20 text-red-400' },
  grant_area_access: { label: 'Nadano dostęp', cls: 'bg-emerald-600/20 text-emerald-400' },
  revoke_area_access: { label: 'Odebrano dostęp', cls: 'bg-amber-600/20 text-amber-400' },
  create_tile: { label: 'Dodano kafelek', cls: 'bg-emerald-600/20 text-emerald-400' },
  update_tile: { label: 'Zmieniono kafelek', cls: 'bg-blue-600/20 text-blue-400' },
  delete_tile: { label: 'Usunięto kafelek', cls: 'bg-red-600/20 text-red-400' },
  create_user: { label: 'Dodano użytkownika', cls: 'bg-emerald-600/20 text-emerald-400' },
  update_user: { label: 'Zmieniono użytkownika', cls: 'bg-blue-600/20 text-blue-400' },
  delete_user: { label: 'Usunięto użytkownika', cls: 'bg-red-600/20 text-red-400' },
  create_user_group: { label: 'Utworzono grupę', cls: 'bg-emerald-600/20 text-emerald-400' },
  update_user_group: { label: 'Zmieniono grupę', cls: 'bg-blue-600/20 text-blue-400' },
  delete_user_group: { label: 'Usunięto grupę', cls: 'bg-red-600/20 text-red-400' },
  create_template: { label: 'Utworzono szablon', cls: 'bg-emerald-600/20 text-emerald-400' },
  update_template: { label: 'Zmieniono szablon', cls: 'bg-blue-600/20 text-blue-400' },
  delete_template: { label: 'Usunięto szablon', cls: 'bg-red-600/20 text-red-400' },
  apply_template: { label: 'Zastosowano szablon', cls: 'bg-amber-600/20 text-amber-400' },
  copy_config: { label: 'Skopiowano konfigurację', cls: 'bg-cyan-600/20 text-cyan-400' },
};

function AuditView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await API.getAuditLog();
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fmtDetails = (raw) => {
    try {
      const o = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      const entries = Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '');
      if (!entries.length) return null;
      return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' • ');
    } catch { return String(raw || ''); }
  };

  const fmtTime = (s) => {
    const d = new Date((s || '').replace(' ', 'T') + (s && s.endsWith('Z') ? '' : 'Z'));
    return isNaN(d) ? s : d.toLocaleString('pl-PL');
  };

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? logs.filter(l => [l.username, l.action, l.target_type, ACTION_META[l.action]?.label, l.details]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
    : logs;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-white">Logi systemowe</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtruj…"
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white text-sm focus:border-blue-500 outline-none w-48" />
          </div>
          <button onClick={load} className="bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 rounded-xl px-3 py-2 text-sm flex items-center gap-2 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Odśwież
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
          <span className="col-span-3">Czas</span>
          <span className="col-span-2">Użytkownik</span>
          <span className="col-span-3">Akcja</span>
          <span className="col-span-4">Szczegóły</span>
        </div>
        <div className="divide-y divide-slate-700/50 max-h-[70vh] overflow-y-auto">
          {filtered.map(l => {
            const meta = ACTION_META[l.action] || { label: l.action, cls: 'bg-slate-600/20 text-slate-300' };
            const details = fmtDetails(l.details);
            return (
              <div key={l.id} className="grid grid-cols-12 gap-3 px-5 py-3 text-sm hover:bg-slate-900/30 items-center">
                <span className="col-span-3 text-slate-400 text-xs font-mono">{fmtTime(l.created_at)}</span>
                <span className="col-span-2 text-white font-medium truncate">{l.username || '—'}</span>
                <span className="col-span-3">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${meta.cls}`}>{meta.label}</span>
                  {l.target_type ? <span className="text-[10px] text-slate-500 ml-2">{l.target_type}{l.target_id ? ` #${l.target_id}` : ''}</span> : null}
                </span>
                <span className="col-span-4 text-slate-400 text-xs truncate" title={details || ''}>{details || '—'}</span>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-slate-500 py-16">
              <History size={40} className="mx-auto mb-3 opacity-30" />
              <p>{logs.length ? 'Brak wyników dla filtra.' : 'Brak zdarzeń w logu.'}</p>
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-600 mt-3">Wyświetlane jest ostatnie 200 zdarzeń.</p>
    </div>
  );
}

// ==========================================
// ADMIN: FLOTA (zarządzanie całością paneli)
// ==========================================
function FleetView({ devices, areas, onOpenWled }) {
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [scope, setScope] = useState('all');          // 'all' | 'area' | 'device'
  const [scopeArea, setScopeArea] = useState('');
  const [scopeDevice, setScopeDevice] = useState('');
  const [status, setStatus] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const preDisplayState = useRef({});  // zapas z odczytu (proste kolory)
  // Wspólna baza paneli (ta sama co w panelu sterowania) — z localStorage, by odtworzyć grafikę/logo
  const panelBase = useRef({});  // wspólna baza paneli — z backendu

  const showToast = (t, m) => { setToast({ type: t, msg: m }); setTimeout(() => setToast(null), 3000); };
  const loadBases = async () => { try { const r = await API.getPanelBases(); if (r && !r.error) panelBase.current = r; } catch { /* keep */ } };

  const captureBeforeDisplay = (devId) => {
    if (panelBase.current[devId] || preDisplayState.current[devId]) return;
    const st = status[devId];
    preDisplayState.current[devId] = st ? { on: st.on !== false, bri: st.bri, col0: st.col0 } : { on: true };
  };

  // Status paneli + bazy — przez backend, co 5 s
  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const data = await API.getDeviceStatuses(); if (active && data && !data.error) setStatus(data); } catch { /* pomiń */ }
      if (active) loadBases();
    };
    check();
    const iv = setInterval(check, 5000);
    return () => { active = false; clearInterval(iv); };
  }, [devices.length]);

  const targets = () => {
    if (scope === 'area') return devices.filter(d => String(d.area_id) === String(scopeArea));
    if (scope === 'device') return devices.filter(d => String(d.id) === String(scopeDevice));
    return devices;
  };
  const tg = targets();

  const sendText = async () => {
    if (!tg.length) { showToast('error', 'Brak paneli w wybranym zakresie'); return; }
    const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    setBusy(true);
    for (const d of tg) {
      await captureBeforeDisplay(d.id);
      const { fx, pal } = await wledMeta(d.id);
      await API.sendCommand(d.id, { on: true, seg: [{ id: 0, frz: false, fx, pal, n: asciiText(text || "WLED"), col: [[r, g, b]] }] });
    }
    setBusy(false);
    showToast('success', `Wysłano tekst na ${tg.length} ${panelWord(tg.length)}`);
  };
  // Wyłącza tekst w zakresie — PRZYWRACA bazę (grafika/kolor/preset), bez gaszenia włączonego panelu
  const turnOff = async () => {
    if (!tg.length) return;
    setBusy(true);
    let restored = 0;
    await loadBases(); // świeże bazy z backendu (mogły być ustawione z innej przeglądarki)
    for (const d of tg) {
      const base = panelBase.current[d.id];
      if (base) {
        if (base.kind === 'graphic') await API.sendPattern(base.patternId, { device_ids: [d.id] });
        else if (base.kind === 'color') await API.sendCommand(d.id, { on: true, bri: base.bri || 140, seg: [{ id: 0, frz: false, fx: 0, col: [base.rgb] }] });
        else if (base.kind === 'preset') await API.sendCommand(d.id, { on: true, ps: base.presetId });
        else if (base.kind === 'off') await API.sendCommand(d.id, { on: false });
        else await API.sendCommand(d.id, { on: true, seg: [{ id: 0, frz: false, fx: 0 }] });
        restored++;
      } else {
        const saved = preDisplayState.current[d.id];
        if (saved && saved.on === false) await API.sendCommand(d.id, { on: false });
        else if (saved && saved.col0) { await API.sendCommand(d.id, { on: true, bri: saved.bri || 140, seg: [{ id: 0, frz: false, fx: 0, col: [saved.col0] }] }); restored++; }
        else { await API.sendCommand(d.id, { on: true, seg: [{ id: 0, frz: false, fx: 0 }] }); restored++; }
      }
      delete preDisplayState.current[d.id];
    }
    setBusy(false);
    showToast('success', restored ? `Przywrócono poprzedni stan (${restored})` : `Wyłączono ${tg.length} ${panelWord(tg.length)}`);
  };
  const powerAll = async (on) => {
    setBusy(true);
    for (const d of devices) await API.sendCommand(d.id, { on });
    setBusy(false);
    showToast('success', on ? 'Włączono wszystkie panele' : 'Wyłączono wszystkie panele');
  };

  const areaName = (id) => areas.find(a => a.id === id)?.name;

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-white">Flota paneli</h1>
        <div className="flex gap-2">
          <button onClick={() => powerAll(true)} disabled={busy}
            className="bg-slate-800 border border-slate-700 hover:border-emerald-500 text-slate-200 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all">
            <Power size={15} className="text-emerald-400" /> Włącz wszystkie
          </button>
          <button onClick={() => powerAll(false)} disabled={busy}
            className="bg-slate-800 border border-slate-700 hover:border-red-500 text-slate-200 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 transition-all">
            <Power size={15} className="text-red-400" /> Wyłącz wszystkie
          </button>
        </div>
      </div>

      {/* Wysyłka tekstu na flotę */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Type size={18} className="text-blue-400" /> Wyświetl tekst</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Treść</label>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Tekst do wyświetlenia…"
              className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Kolor</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-14 h-12 rounded-xl cursor-pointer bg-slate-900 border border-slate-600 p-1" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Zakres</label>
            <select value={scope} onChange={e => setScope(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
              <option value="all">Wszystkie panele</option>
              <option value="area">Strefa</option>
              <option value="device">Pojedynczy panel</option>
            </select>
          </div>
          {scope === 'area' && (
            <select value={scopeArea} onChange={e => setScopeArea(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
              <option value="">— wybierz strefę —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {scope === 'device' && (
            <select value={scopeDevice} onChange={e => setScopeDevice(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none">
              <option value="">— wybierz panel —</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
            </select>
          )}
          <button onClick={sendText} disabled={busy}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl px-5 py-3 flex items-center gap-2 transition-all">
            <Type size={16} /> Wyślij ({tg.length})
          </button>
          <button onClick={turnOff} disabled={busy} title="Zgaś panele w wybranym zakresie"
            className="bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white font-bold rounded-xl px-4 py-3 flex items-center gap-2 transition-all">
            <Power size={16} /> Wyłącz
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">Zakres obejmuje teraz <b className="text-slate-300">{tg.length}</b> {panelWord(tg.length)}. Tekst wymaga matrycy 2D na panelu.</p>
      </div>

      {/* Przegląd floty */}
      <div className="grid gap-3 md:grid-cols-2">
        {devices.map(d => {
          const st = status[d.id];
          return (
            <div key={d.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${st?.online ? (st.on ? 'bg-emerald-400 pulse-dot' : 'bg-slate-500') : 'bg-red-500'}`} />
                <div>
                  <p className="font-bold text-white">{d.name}</p>
                  <div className="flex gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{d.ip}</span>
                    <span>{d.size}</span>
                    <span className="text-purple-300/70">{areaName(d.area_id) || 'bez strefy'}</span>
                    <span className={st?.online ? 'text-emerald-400' : 'text-red-400'}>{st?.online ? (st.on ? 'WŁ' : 'WYŁ') : 'offline'}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => onOpenWled(d)}
                className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all">
                <Sliders size={14} /> Steruj
              </button>
            </div>
          );
        })}
        {devices.length === 0 && <p className="text-slate-500 text-center py-12 md:col-span-2">Brak paneli. Dodaj je w zakładce „Urządzenia".</p>}
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: USTAWIENIA (sieć / wdrożenie)
// ==========================================
function SettingsView() {
  const [app, setApp] = useState({ scan_subnet: '', scan_start: '1', scan_end: '254' });
  const [deployment, setDeployment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (t, m) => { setToast({ type: t, msg: m }); setTimeout(() => setToast(null), 3500); };

  const load = async () => {
    setLoading(true);
    const r = await API.getSettings();
    if (r?.app) { setApp(r.app); setDeployment(r.deployment); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(app.scan_subnet || '')) { showToast('error', 'Podsieć w formacie np. 192.168.200'); return; }
    setSaving(true);
    const r = await API.updateSettings(app);
    setSaving(false);
    if (r?.error) { showToast('error', r.error); return; }
    showToast('success', 'Ustawienia zapisane');
  };

  const Dep = ({ label, value }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-700/50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono text-sm">{value || '—'}</span>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-2">Ustawienia</h1>
      <p className="text-sm text-slate-400 mb-8">Konfiguracja sieci i parametry wdrożenia.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ustawienia aplikacji — edytowalne, efektywne od razu */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Wifi size={18} className="text-blue-400" /> Skanowanie sieci</h2>
          <p className="text-xs text-slate-500 mb-4">Domyślne wartości dla wyszukiwania paneli (zakładka Urządzenia → Skanuj sieć). Zmiana działa od razu.</p>
          {loading ? <p className="text-slate-500">Ładowanie…</p> : (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Prefiks podsieci</label>
                <input value={app.scan_subnet} onChange={e => setApp({ ...app, scan_subnet: e.target.value })}
                  placeholder="192.168.200"
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white font-mono focus:border-blue-500 outline-none" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Zakres od</label>
                  <input type="number" min="0" max="255" value={app.scan_start} onChange={e => setApp({ ...app, scan_start: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-center focus:border-blue-500 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Zakres do</label>
                  <input type="number" min="0" max="255" value={app.scan_end} onChange={e => setApp({ ...app, scan_end: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white text-center focus:border-blue-500 outline-none" />
                </div>
              </div>
              <button onClick={save} disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                <Save size={18} /> {saving ? 'Zapisuję…' : 'Zapisz'}
              </button>
            </div>
          )}
        </div>

        {/* Parametry wdrożenia — tylko do odczytu */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Settings size={18} className="text-purple-400" /> Wdrożenie</h2>
          <p className="text-xs text-slate-500 mb-4">Parametry z pliku <span className="font-mono">.env</span>. Zmiana wymaga edycji <span className="font-mono">.env</span> i <span className="font-mono">docker compose up -d</span> na serwerze.</p>
          {deployment && (
            <div>
              <Dep label="Adres IP kontenera" value={deployment.container_ip} />
              <Dep label="Port" value={deployment.port} />
              <Dep label="Strefa czasowa (zegar)" value={deployment.tz} />
              <Dep label="Sieć docker" value={deployment.network} />
              <Dep label="Środowisko" value={deployment.node_env} />
            </div>
          )}
          <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-400">
            Migracja na inny serwer: zobacz <span className="font-mono text-slate-300">MIGRATION.md</span> w katalogu aplikacji.
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// APP
// ==========================================
// ADMIN: GRAFIKA (edytor pikselowy + animacja)
// ==========================================
const PAL = ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#00ffff','#ff00ff','#ff8000','#8000ff','#ff0080','#0080ff','#80ff00','#808080','#00ff80','#ff4040'];
const SIZE_PRESETS = [[16,16],[16,32],[32,16],[8,32],[32,8],[32,32],[8,8]];
const blankFrame = (w, h) => Array(w * h).fill('#000000');

// Biblioteka ikon — rysowane wektorowo, skalują się do dowolnego rozmiaru matrycy
const ICONS = [
  { id: 'up', label: '↑' }, { id: 'down', label: '↓' }, { id: 'left', label: '←' }, { id: 'right', label: '→' },
  { id: 'check', label: '✓' }, { id: 'cross', label: '✗' }, { id: 'warn', label: '⚠' }, { id: 'dot', label: '●' },
];
function drawIconShape(ctx, name, w, h, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.round(Math.min(w, h) * 0.16));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tri = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); };
  if (name === 'up') { tri([[w * 0.5, h * 0.08], [w * 0.12, h * 0.52], [w * 0.88, h * 0.52]]); ctx.fillRect(w * 0.38, h * 0.48, w * 0.24, h * 0.44); }
  else if (name === 'down') { tri([[w * 0.5, h * 0.92], [w * 0.12, h * 0.48], [w * 0.88, h * 0.48]]); ctx.fillRect(w * 0.38, h * 0.08, w * 0.24, h * 0.44); }
  else if (name === 'left') { tri([[w * 0.08, h * 0.5], [w * 0.52, h * 0.12], [w * 0.52, h * 0.88]]); ctx.fillRect(w * 0.48, h * 0.38, w * 0.44, h * 0.24); }
  else if (name === 'right') { tri([[w * 0.92, h * 0.5], [w * 0.48, h * 0.12], [w * 0.48, h * 0.88]]); ctx.fillRect(w * 0.08, h * 0.38, w * 0.44, h * 0.24); }
  else if (name === 'check') { ctx.beginPath(); ctx.moveTo(w * 0.18, h * 0.55); ctx.lineTo(w * 0.42, h * 0.8); ctx.lineTo(w * 0.84, h * 0.22); ctx.stroke(); }
  else if (name === 'cross') { ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.2); ctx.lineTo(w * 0.8, h * 0.8); ctx.moveTo(w * 0.8, h * 0.2); ctx.lineTo(w * 0.2, h * 0.8); ctx.stroke(); }
  else if (name === 'warn') { tri([[w * 0.5, h * 0.1], [w * 0.92, h * 0.86], [w * 0.08, h * 0.86]]); ctx.fillStyle = '#000'; ctx.fillRect(w * 0.45, h * 0.34, Math.max(1, w * 0.1), h * 0.3); ctx.fillRect(w * 0.45, h * 0.72, Math.max(1, w * 0.1), Math.max(1, h * 0.08)); }
  else if (name === 'dot') { ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2); ctx.fill(); }
}

function PatternThumb({ frame, w, h, size = 64 }) {
  const cw = size, ch = Math.round(size * h / w);
  return (
    <div style={{ width: cw, height: ch, display: 'grid', gridTemplateColumns: `repeat(${w}, 1fr)`, gap: 0, background: '#000', borderRadius: 4, overflow: 'hidden' }}>
      {Array.from({ length: w * h }, (_, i) => (
        <div key={i} style={{ background: (frame && frame[i]) || '#000', width: '100%', height: '100%' }} />
      ))}
    </div>
  );
}

function PatternsView({ devices, areas }) {
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [w, setW] = useState(32);
  const [h, setH] = useState(16);
  const [frames, setFrames] = useState(() => [blankFrame(32, 16)]);
  const [active, setActive] = useState(0);
  const [color, setColor] = useState('#00ff00');
  const [speed, setSpeed] = useState(300);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [scope, setScope] = useState('all');
  const [scopeArea, setScopeArea] = useState('');
  const [scopeDevice, setScopeDevice] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const painting = useRef(false);
  const fileRef = useRef(null);

  const showToast = (t, m) => { setToast({ type: t, msg: m }); setTimeout(() => setToast(null), 3500); };
  const pixels = frames[active] || blankFrame(w, h);
  const isAnim = frames.length > 1;

  // Odczyt pikseli z canvasu w×h → tablica hex (przezroczyste = czarne)
  const canvasToFrame = (ctx) => {
    const data = ctx.getImageData(0, 0, w, h).data;
    const px = [];
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      px.push(a < 32 ? '#000000' : '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
    }
    return px;
  };

  // Import obrazka (PNG/JPG) → skalowanie do matrycy z zachowaniem proporcji (contain) → piksele
  const importImage = (file) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      const scale = Math.min(w / img.width, h / img.height);
      const dw = Math.max(1, Math.round(img.width * scale));
      const dh = Math.max(1, Math.round(img.height * scale));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh);
      pushHistory();
      setFrames(prev => { const fr = [...prev]; fr[active] = canvasToFrame(ctx); return fr; });
      URL.revokeObjectURL(img.src);
      showToast('success', 'Obrazek wczytany do bieżącej klatki');
    };
    img.onerror = () => showToast('error', 'Nie udało się wczytać obrazka');
    img.src = URL.createObjectURL(file);
  };

  // Wstaw ikonę (rysowaną wektorowo, skalowaną do bieżącego rozmiaru) bieżącym kolorem
  const insertIcon = (nameIcon) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    drawIconShape(ctx, nameIcon, w, h, color);
    pushHistory();
    setFrames(prev => { const fr = [...prev]; fr[active] = canvasToFrame(ctx); return fr; });
    showToast('success', 'Wstawiono ikonę');
  };

  // Tryb miganie: zamienia bieżącą klatkę na 2-klatkowe miganie wł/wył (działa też z ikoną/grafiką)
  const makeBlink = () => {
    pushHistory();
    setFrames([frames[active], blankFrame(w, h)]);
    setActive(0); setSpeed(500); setLoop(true); setPlaying(false);
    showToast('success', 'Utworzono miganie (wł/wył)');
  };
  // Alarm: pełne czerwone miganie
  const makeAlarm = () => {
    pushHistory();
    setFrames([Array(w * h).fill('#ff0000'), blankFrame(w, h)]);
    setActive(0); setSpeed(350); setLoop(true); setColor('#ff0000'); setPlaying(false);
    if (!name.trim()) setName('Alarm');
    showToast('success', 'Tryb alarmu (czerwone miganie)');
  };

  const load = async () => { const r = await API.getPatterns(); setList(Array.isArray(r) ? r : []); };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const up = () => { painting.current = false; };
    window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, []);
  // Lokalny podgląd animacji
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const iv = setInterval(() => setPreviewIdx(p => (p + 1) % frames.length), Math.max(120, speed));
    return () => clearInterval(iv);
  }, [playing, frames.length, speed]);

  const resize = (nw, nh) => {
    setFrames(prev => prev.map(fr => {
      const next = blankFrame(nw, nh);
      for (let y = 0; y < Math.min(h, nh); y++) for (let x = 0; x < Math.min(w, nw); x++) next[y * nw + x] = fr[y * w + x] || '#000000';
      return next;
    }));
    setW(nw); setH(nh);
  };

  const paint = (i) => setFrames(prev => {
    if (prev[active][i] === color) return prev;
    const fr = [...prev]; const f = [...fr[active]]; f[i] = color; fr[active] = f; return fr;
  });
  // Historia do cofania/ponawiania (snapshoty klatek)
  const histRef = useRef([]); const redoRef = useRef([]);
  const pushHistory = () => { histRef.current.push(JSON.stringify(frames)); if (histRef.current.length > 60) histRef.current.shift(); redoRef.current = []; };
  const undo = () => { if (!histRef.current.length) return; redoRef.current.push(JSON.stringify(frames)); setFrames(JSON.parse(histRef.current.pop())); };
  const redoAction = () => { if (!redoRef.current.length) return; histRef.current.push(JSON.stringify(frames)); setFrames(JSON.parse(redoRef.current.pop())); };
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoAction(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames]);

  const setActiveFrameTo = (mapFn) => setFrames(prev => { const fr = [...prev]; fr[active] = mapFn(fr[active]); return fr; });
  const clearFrame = () => { pushHistory(); setActiveFrameTo(() => blankFrame(w, h)); };
  const fillFrame = () => { pushHistory(); setActiveFrameTo(() => Array(w * h).fill(color)); };

  // Operacje na klatkach
  const addFrame = (dup) => { pushHistory(); setFrames(prev => { const fr = [...prev]; fr.splice(active + 1, 0, dup ? [...prev[active]] : blankFrame(w, h)); return fr; }); };
  const delFrame = () => { pushHistory(); setFrames(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== active)); };
  const moveFrame = (i, dir) => {
    const to = i + dir;
    if (to < 0 || to >= frames.length) return;
    pushHistory();
    setFrames(prev => { const fr = [...prev]; [fr[i], fr[to]] = [fr[to], fr[i]]; return fr; });
    setActive(to);
  };
  useEffect(() => { if (active >= frames.length) setActive(frames.length - 1); }, [frames.length, active]);

  const newPattern = () => { setEditingId(null); setName(''); setFrames([blankFrame(w, h)]); setActive(0); setSpeed(300); setLoop(true); setPlaying(false); };
  const loadPattern = (p) => {
    setEditingId(p.id); setName(p.name); setW(p.width); setH(p.height);
    const fr = (p.pixel_data?.frames || []).filter(f => f.length === p.width * p.height);
    setFrames(fr.length ? fr.map(f => [...f]) : [blankFrame(p.width, p.height)]);
    setActive(0); setSpeed(p.pixel_data?.speed || 300); setLoop(p.pixel_data?.loop !== false); setPlaying(false);
  };

  const save = async () => {
    if (!name.trim()) { showToast('error', 'Podaj nazwę wzoru'); return; }
    const data = { name: name.trim(), width: w, height: h, pixel_data: { frames, speed: Math.max(120, parseInt(speed) || 300), loop, bri: 140, mapping: {} } };
    const res = editingId ? await API.updatePattern(editingId, data) : await API.createPattern(data);
    if (res?.error) { showToast('error', res.error); return; }
    if (!editingId && res?.id) setEditingId(res.id);
    load(); showToast('success', 'Wzór zapisany');
  };
  const remove = async (id) => { if (!confirm('Usunąć wzór?')) return; await API.deletePattern(id); if (editingId === id) newPattern(); load(); };

  const scopeBody = () => scope === 'area' ? { area_ids: scopeArea ? [Number(scopeArea)] : [] }
    : scope === 'device' ? { device_ids: scopeDevice ? [Number(scopeDevice)] : [] }
    : { device_ids: devices.map(d => d.id) };
  const send = async (id) => {
    const body = scopeBody();
    if (!(body.device_ids?.length || body.area_ids?.length)) { showToast('error', 'Wybierz cel (panel/strefa)'); return; }
    setBusy(true); const res = await API.sendPattern(id, body); setBusy(false);
    if (res?.error) { showToast('error', res.error); return; }
    showToast('success', `Wysłano na ${res.devices} ${panelWord(res.devices)}${res.animated ? ' (animacja)' : ''}`);
  };
  const stop = async () => { setBusy(true); await API.stopPattern(scopeBody()); setBusy(false); showToast('success', 'Zatrzymano / wygaszono'); };
  // Wyślij BIEŻĄCY rysunek z edytora (aktualne klatki), bez potrzeby zapisywania wzoru
  const sendCurrent = async () => {
    const body = scopeBody();
    if (!(body.device_ids?.length || body.area_ids?.length)) { showToast('error', 'Wybierz cel (panel/strefa)'); return; }
    if (frames.every(f => f.every(px => px === '#000000'))) { showToast('error', 'Pusty rysunek — najpierw coś narysuj'); return; }
    setBusy(true);
    const res = await API.sendPatternAdhoc({ ...body, frames, width: w, height: h, speed: Math.max(120, parseInt(speed) || 300), loop, bri: 140, mapping: {} });
    setBusy(false);
    if (res?.error) { showToast('error', res.error); return; }
    showToast('success', `Wysłano bieżący na ${res.devices} ${panelWord(res.devices)}${res.animated ? ' (animacja)' : ''}`);
  };

  const displayFrame = (playing && isAnim) ? frames[previewIdx % frames.length] : pixels;

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-2">Grafika</h1>
      <p className="text-sm text-slate-400 mb-6">Twórz grafikę i animacje dla matryc, zapętlaj z regulacją prędkości i wysyłaj na panele/strefy.</p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa wzoru"
              className="bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none flex-1 min-w-[150px]" />
            <select value={`${w}x${h}`} onChange={e => { const [a, b] = e.target.value.split('x').map(Number); resize(a, b); }}
              className="bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none">
              {SIZE_PRESETS.map(([a, b]) => <option key={`${a}x${b}`} value={`${a}x${b}`}>{a}×{b}</option>)}
              {!SIZE_PRESETS.some(([a, b]) => a === w && b === h) && <option value={`${w}x${h}`}>{w}×{h}</option>}
            </select>
            <button onClick={save} className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-4 py-2.5 flex items-center gap-2"><Save size={16} /> {editingId ? 'Zapisz' : 'Utwórz'}</button>
            <button onClick={newPattern} className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-3 py-2.5" title="Nowy"><Plus size={16} /></button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {PAL.map(c => (
              <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-md border-2 ${color === c ? 'border-white scale-110' : 'border-slate-600'} transition-all`} style={{ background: c }} title={c} />
            ))}
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-9 h-9 rounded-md bg-transparent border border-slate-600 cursor-pointer p-0.5" title="Własny kolor" />
            <button onClick={() => setColor('#000000')} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"><Square size={13} /> Gumka</button>
            <button onClick={fillFrame} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"><PaintBucket size={13} /> Wypełnij</button>
            <button onClick={clearFrame} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"><Trash2 size={13} /> Wyczyść</button>
            <span className="w-px h-5 bg-slate-600 mx-1" />
            <button onClick={undo} title="Cofnij (Ctrl+Z)" className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-1"><ChevronLeft size={13} /> Cofnij</button>
            <button onClick={redoAction} title="Ponów (Ctrl+Y)" className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold flex items-center gap-1">Ponów <ChevronRight size={13} /></button>
            <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold flex items-center gap-1" title="Wczytaj PNG/JPG do bieżącej klatki"><Plus size={13} /> Importuj obrazek</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importImage(f); e.target.value = ''; }} />
            <span className="w-px h-5 bg-slate-600 mx-1" />
            {ICONS.map(ic => (
              <button key={ic.id} onClick={() => insertIcon(ic.id)} title={`Wstaw ikonę (${ic.label})`}
                className="w-7 h-7 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm flex items-center justify-center leading-none">{ic.label}</button>
            ))}
            <span className="w-px h-5 bg-slate-600 mx-1" />
            <button onClick={makeBlink} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1" title="Zamień bieżącą klatkę na miganie wł/wył"><RefreshCw size={13} /> Miganie</button>
            <button onClick={makeAlarm} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1" title="Czerwone miganie alarmowe"><AlertCircle size={13} /> Alarm</button>
          </div>

          {/* Siatka (pokazuje podgląd animacji gdy odtwarzanie) */}
          <div className="flex justify-center bg-slate-900 rounded-xl p-3 border border-slate-700">
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${w}, 1fr)`, width: '100%', maxWidth: w >= h ? 700 : 700 * w / h, aspectRatio: `${w} / ${h}`, gap: 1, background: '#1e293b', touchAction: 'none' }}>
              {displayFrame.map((c, i) => (
                <div key={i}
                  onMouseDown={() => { if (!playing) { painting.current = true; pushHistory(); paint(i); } }}
                  onMouseEnter={() => { if (painting.current && !playing) paint(i); }}
                  onTouchStart={() => { if (!playing) { painting.current = true; pushHistory(); paint(i); } }}
                  style={{ background: c, aspectRatio: '1', cursor: playing ? 'default' : 'crosshair' }} />
              ))}
            </div>
          </div>

          {/* Klatki + animacja */}
          <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">Klatki ({frames.length}) {isAnim && <span className="text-amber-400">• animacja</span>}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => addFrame(true)} className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1" title="Powiel klatkę"><Copy size={12} /> Powiel</button>
                <button onClick={() => addFrame(false)} className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center gap-1" title="Pusta klatka"><Plus size={12} /> Pusta</button>
                <button onClick={delFrame} disabled={frames.length <= 1} className="text-xs px-2 py-1 rounded-lg bg-slate-700 hover:bg-red-600 disabled:opacity-40 text-slate-200 flex items-center gap-1"><Trash2 size={12} /></button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {frames.map((f, i) => (
                <div key={i} className={`flex-shrink-0 rounded-lg p-1 border-2 ${active === i && !playing ? 'border-blue-400' : 'border-transparent'} ${playing && previewIdx % frames.length === i ? 'ring-2 ring-amber-400' : ''}`}>
                  <button onClick={() => { setActive(i); setPlaying(false); }} title={`Klatka ${i + 1}`}>
                    <PatternThumb frame={f} w={w} h={h} size={48} />
                  </button>
                  <div className="flex items-center justify-between mt-0.5">
                    <button onClick={() => moveFrame(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-white disabled:opacity-30" title="W lewo"><ChevronLeft size={13} /></button>
                    <span className="text-[9px] text-slate-500">{i + 1}</span>
                    <button onClick={() => moveFrame(i, +1)} disabled={i === frames.length - 1} className="text-slate-400 hover:text-white disabled:opacity-30" title="W prawo"><ChevronRight size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">Prędkość
                <input type="number" min="120" max="5000" step="20" value={speed} onChange={e => setSpeed(parseInt(e.target.value) || 300)}
                  className="w-20 bg-slate-900 border border-slate-600 rounded-lg p-1.5 text-white text-center text-sm" /> ms/klatkę
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Zapętlaj
              </label>
              <button onClick={() => setPlaying(p => !p)} disabled={frames.length < 2}
                className={`text-sm px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 disabled:opacity-40 ${playing ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                {playing ? <><Square size={13} /> Stop podglądu</> : <><Play size={13} /> Podgląd</>}
              </button>
              <span className="text-[10px] text-slate-500">min. 120 ms (ochrona panelu)</span>
            </div>
          </div>

          {/* Wysyłka */}
          <div className="mt-4 flex flex-wrap items-end gap-3 bg-slate-900/60 border border-slate-700 rounded-xl p-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Wyślij na</label>
              <select value={scope} onChange={e => setScope(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-xl p-2 text-white text-sm">
                <option value="all">Wszystkie panele</option><option value="area">Strefa</option><option value="device">Panel</option>
              </select>
            </div>
            {scope === 'area' && <select value={scopeArea} onChange={e => setScopeArea(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-xl p-2 text-white text-sm"><option value="">— strefa —</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
            {scope === 'device' && <select value={scopeDevice} onChange={e => setScopeDevice(e.target.value)} className="bg-slate-900 border border-slate-600 rounded-xl p-2 text-white text-sm"><option value="">— panel —</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
            <button onClick={sendCurrent} disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl px-4 py-2 flex items-center gap-2"><Play size={16} /> Wyślij bieżący</button>
            <button onClick={stop} disabled={busy} className="bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white rounded-xl px-3 py-2 flex items-center gap-2" title="Zatrzymaj/wygaś"><Square size={16} /></button>
          </div>
        </div>

        {/* Lista wzorów */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-3">Zapisane wzory ({list.length})</h2>
          <div className="space-y-2 max-h-[75vh] overflow-y-auto">
            {list.map(p => (
              <div key={p.id} className={`flex items-center gap-2 p-2 rounded-xl border ${editingId === p.id ? 'border-blue-500/40 bg-blue-600/10' : 'border-slate-700 bg-slate-900'}`}>
                <button onClick={() => loadPattern(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity" title="Wczytaj do edytora">
                  <PatternThumb frame={p.pixel_data?.frames?.[0]} w={p.width} h={p.height} size={56} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.name}{editingId === p.id && <span className="ml-2 text-[9px] text-blue-400 font-normal">edytowany</span>}</p>
                    <p className="text-[10px] text-slate-500">{p.width}×{p.height}{(p.pixel_data?.frames?.length > 1) ? ` • 🎞 ${p.pixel_data.frames.length} klatek` : ''}</p>
                  </div>
                </button>
                <button onClick={() => send(p.id)} className="p-2 hover:bg-emerald-900/30 rounded-lg text-emerald-400 flex-shrink-0" title="Wyślij zapisany"><Play size={14} /></button>
                <button onClick={stop} disabled={busy} className="p-2 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-400 disabled:opacity-40 flex-shrink-0" title="Zatrzymaj / wygaś (wg zakresu „Wyślij na”)"><Square size={14} /></button>
                <button onClick={() => remove(p.id)} className="p-2 hover:bg-red-900/30 rounded-lg text-red-400 flex-shrink-0" title="Usuń"><Trash2 size={14} /></button>
              </div>
            ))}
            {list.length === 0 && <p className="text-slate-500 text-center py-10 text-sm">Brak wzorów. Narysuj i zapisz pierwszy.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ADMIN: HARMONOGRAM (ściemnianie wg godzin)
// ==========================================
const WEEKDAYS = [[1,'Pn'],[2,'Wt'],[3,'Śr'],[4,'Cz'],[5,'Pt'],[6,'So'],[0,'Nd']];

function ScheduleView({ areas }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ time: '22:00', action: 'bri', value: 40, scope: 'all', area_id: '', days: '*' });
  const [pickDays, setPickDays] = useState(false);
  const [selDays, setSelDays] = useState([1,2,3,4,5,6,0]);
  const [toast, setToast] = useState(null);

  const showToast = (t, m) => { setToast({ type: t, msg: m }); setTimeout(() => setToast(null), 3000); };
  const load = async () => { const r = await API.getSchedules(); setList(Array.isArray(r) ? r : []); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!/^\d{2}:\d{2}$/.test(form.time)) { showToast('error', 'Godzina HH:MM'); return; }
    if (form.scope === 'area' && !form.area_id) { showToast('error', 'Wybierz strefę'); return; }
    const days = pickDays ? (selDays.length ? selDays.join(',') : '*') : '*';
    const body = { ...form, value: Math.round((form.value / 100) * 255), days };
    const res = await API.createSchedule(body);
    if (res?.error) { showToast('error', res.error); return; }
    load(); showToast('success', 'Reguła dodana');
  };
  const toggle = async (r) => { await API.updateSchedule(r.id, { enabled: !r.enabled }); load(); };
  const del = async (id) => { await API.deleteSchedule(id); load(); };
  const toggleDay = (d) => setSelDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  const actionLabel = (r) => r.action === 'off' ? 'Wyłącz' : r.action === 'on' ? 'Włącz' : `Jasność ${Math.round((r.value / 255) * 100)}%`;
  const daysLabel = (d) => (!d || d === '*') ? 'codziennie' : d.split(',').map(n => (WEEKDAYS.find(w => w[0] === parseInt(n)) || [,'?'])[1]).join(' ');

  return (
    <div className="p-4 md:p-8">
      <Toast type={toast?.type} msg={toast?.msg} />
      <h1 className="text-3xl font-bold text-white mb-2">Harmonogram jasności</h1>
      <p className="text-sm text-slate-400 mb-6">Automatyczne ściemnianie / wyłączanie paneli wg godzin (czas serwera). Działa niezależnie od przeglądarki.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nowa reguła */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">Nowa reguła</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Godzina</label>
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Akcja</label>
              <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none">
                <option value="bri">Ustaw jasność</option>
                <option value="off">Wyłącz panele</option>
                <option value="on">Włącz panele</option>
              </select>
            </div>
            {form.action === 'bri' && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Jasność: {form.value}%</label>
                <input type="range" min="0" max="100" value={form.value} onChange={e => setForm({ ...form, value: parseInt(e.target.value) })} className="w-full" />
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Zakres</label>
              <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none">
                <option value="all">Wszystkie panele</option>
                <option value="area">Strefa</option>
              </select>
            </div>
            {form.scope === 'area' && (
              <select value={form.area_id} onChange={e => setForm({ ...form, area_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-2.5 text-white focus:border-blue-500 outline-none">
                <option value="">— wybierz strefę —</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                <input type="checkbox" checked={pickDays} onChange={e => setPickDays(e.target.checked)} /> Wybrane dni (domyślnie codziennie)
              </label>
              {pickDays && (
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map(([d, l]) => (
                    <button key={d} onClick={() => toggleDay(d)}
                      className={`text-xs px-2.5 py-1 rounded-lg border ${selDays.includes(d) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-400'}`}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={add} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
              <Plus size={18} /> Dodaj regułę
            </button>
          </div>
        </div>

        {/* Lista reguł */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">Reguły ({list.length})</h2>
          <div className="space-y-2">
            {list.map(r => (
              <div key={r.id} className={`flex items-center gap-4 p-3 rounded-xl border ${r.enabled ? 'bg-slate-900 border-slate-700' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}>
                <span className="text-2xl font-mono font-bold text-white tabular-nums">{r.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{actionLabel(r)}</p>
                  <p className="text-[11px] text-slate-500">
                    {r.scope === 'area' ? (r.area_name || 'strefa') : 'wszystkie panele'} • {daysLabel(r.days)}
                  </p>
                </div>
                <button onClick={() => toggle(r)} title={r.enabled ? 'Wyłącz regułę' : 'Włącz regułę'}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${r.enabled ? 'bg-emerald-600/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {r.enabled ? 'Aktywna' : 'Wyłączona'}
                </button>
                <button onClick={() => del(r.id)} className="p-2 hover:bg-red-900/30 rounded-lg text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
            {list.length === 0 && <p className="text-slate-500 text-center py-12">Brak reguł. Dodaj pierwszą (np. 22:00 → jasność 20%).</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('App render error:', err, info); }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-6 overflow-auto">
          <h1 className="text-2xl font-bold text-red-400 mb-3">Błąd aplikacji</h1>
          <pre className="bg-slate-800 p-4 rounded-xl text-xs text-red-300 whitespace-pre-wrap">{String(this.state.err?.message || this.state.err)}{'\n\n'}{this.state.err?.stack}</pre>
          <button onClick={() => window.location.reload()} className="mt-4 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold">Odśwież</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('wled_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('wled_token'));
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [areas, setAreas] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wledPanelDevice, setWledPanelDevice] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('wled_theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('wled_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const fetchData = useCallback(async () => {
    try {
      if (!token) return;
      const isAdmin = user?.role === 'admin';
      const [areaData, devData, userData, groupData, tplData] = await Promise.all([
        API.getAreas(),
        isAdmin ? API.getDevices() : Promise.resolve(null),
        isAdmin ? API.getUsers() : Promise.resolve([]),
        isAdmin ? API.getUserGroups() : Promise.resolve([]),
        isAdmin ? API.getTemplates() : Promise.resolve([]),
      ]);
      // Ustawiaj TYLKO gdy odpowiedź to tablica (błąd/401/429 zwraca obiekt {error} — nie nadpisuj stanu)
      if (Array.isArray(areaData)) setAreas(areaData);
      // Operator nie pobiera globalnej listy urządzeń — panele bierze z osadzonych w strefach.
      if (Array.isArray(devData)) setDevices(devData);
      if (Array.isArray(userData)) setUsers(userData);
      if (Array.isArray(groupData)) setUserGroups(groupData);
      if (Array.isArray(tplData)) setTemplates(tplData);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token, fetchData]);

  const handleLogin = async (username, password) => {
    const result = await API.login(username, password);
    if (result?.token) {
      localStorage.setItem('wled_token', result.token);
      localStorage.setItem('wled_user', JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
      setLoginError('');
      setActiveTab('dashboard');
    } else {
      setLoginError(result?.error || 'Błąd logowania');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wled_token');
    localStorage.removeItem('wled_user');
    setToken(null);
    setUser(null);
    setAreas([]);
    setDevices([]);
    setUsers([]);
    setUserGroups([]);
    setTemplates([]);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Ładowanie...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row">
      <Sidebar role={user.role} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} username={user.username} theme={theme} toggleTheme={toggleTheme} />
      <main className="flex-1 overflow-y-auto bg-slate-900 max-h-screen">
        <ErrorBoundary>
        {activeTab === 'dashboard' && (
          <DashboardView user={user} areas={areas} fetchData={fetchData} onOpenWled={setWledPanelDevice} />
        )}
        {user.role === 'admin' && activeTab === 'devices' && (
          <DevicesView devices={devices} areas={areas} fetchData={fetchData} onOpenWled={setWledPanelDevice} />
        )}
        {user.role === 'admin' && activeTab === 'fleet' && (
          <FleetView devices={devices} areas={areas} onOpenWled={setWledPanelDevice} />
        )}
        {user.role === 'admin' && activeTab === 'areas' && (
          <AreasView areas={areas} users={users} userGroups={userGroups} devices={devices} fetchData={fetchData} />
        )}
        {user.role === 'admin' && activeTab === 'templates' && (
          <TemplatesView templates={templates} devices={devices} areas={areas} fetchData={fetchData} />
        )}
        {user.role === 'admin' && activeTab === 'groups' && (
          <UserGroupsView users={users} userGroups={userGroups} fetchData={fetchData} />
        )}
        {user.role === 'admin' && activeTab === 'users' && (
          <UsersView users={users} fetchData={fetchData} />
        )}
        {user.role === 'admin' && activeTab === 'audit' && (
          <AuditView />
        )}
        {user.role === 'admin' && activeTab === 'graphics' && (
          <PatternsView devices={devices} areas={areas} />
        )}
        {user.role === 'admin' && activeTab === 'schedule' && (
          <ScheduleView areas={areas} />
        )}
        {user.role === 'admin' && activeTab === 'settings' && (
          <SettingsView />
        )}
        </ErrorBoundary>
      </main>

      {/* WLED Control Panel */}
      {wledPanelDevice && (
        <WledPanel
          device={wledPanelDevice}
          onClose={() => setWledPanelDevice(null)}
        />
      )}
    </div>
  );
}