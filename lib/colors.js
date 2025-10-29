const RECENT_COLORS_KEY = 'tt_recent_colors_v1';

export function toHex6(c) {
  if (!c) return '#000000';
  const s = String(c).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  const m = s.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (m) {
    const r = Number(m[1]).toString(16).padStart(2, '0');
    const g = Number(m[2]).toString(16).padStart(2, '0');
    const b = Number(m[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

export function loadRecentColors() {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(v => typeof v === 'string') : [];
  } catch { return []; }
}

export function saveRecentColors(list) {
  try { localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(list.slice(0, 4))); }
  catch {}
}

export function pushRecentColor(hex) {
  if (!hex || typeof hex !== 'string') return loadRecentColors();
  const norm = hex.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(norm)) return loadRecentColors();
  const list = loadRecentColors();
  const next = [norm, ...list.filter(c => c !== norm)];
  saveRecentColors(next);
  return next; 
}
