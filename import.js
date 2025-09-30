// import.js
// Excel/CSV import → one timeline per day (START → IN, STOP → OUT).
// Ignores: id, chauffeur code, jobname, key type.

export function setupImport(deps) {
  const input = document.getElementById('importFile');
  const btn   = document.getElementById('importBtn');

  if (!input || !btn) return;

  // Single-button UX: click button → open hidden input
  btn.addEventListener('click', () => input.click());

  // After a file is chosen → import immediately
  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await handleImportFile(file, deps);
    } finally {
      // allow picking the same file again
      e.target.value = '';
    }
  });
}

/**
 * Handle a chosen file (xlsx/xls/csv) end-to-end:
 * read → parse → deserialize → save
 */
export async function handleImportFile(file, { deserialize, saveState, flash } = {}) {
  if (typeof XLSX === 'undefined') {
    flash?.('Parser ontbreekt: XLSX niet geladen');
    throw new Error('XLSX not available');
  }
  try {
    const wb    = await readWorkbook(file);
    const state = parseWorkbookToState(wb);
    deserialize?.(state);
    saveState?.();
    flash?.(`Import voltooid ✅ (${file.name})`);
  } catch (err) {
    console.error(err);
    flash?.('Import mislukt ❌');
    throw err;
  }
}

/* ---------------- I/O utilities ---------------- */

async function readWorkbook(file) {
  const buf = await fileToArrayBuffer(file);
  // XLSX.read can parse xlsx/xls/csv from an ArrayBuffer
  return XLSX.read(buf, { type: 'array' });
}

function fileToArrayBuffer(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsArrayBuffer(file);
  });
}

/* ---------------- Parsing → App State ---------------- */

export function parseWorkbookToState(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  // defval:'' => keep empty strings; raw:true => keep numbers (Excel serials)
  const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });

  const normRows = rows.map(normalizeRowKeys);

  const parsed = normRows
    .map(toRecord)                        // map fields we care about
    .filter(r => r && r.Date && r.Time)   // only valid rows
    .map(r => ({
      ...r,
      DateTime: combineDateAndTime(r.Date, r.Time), // for sorting
      DateKey:  toDateKey(r.Date)                   // YYYY-MM-DD
    }))
    .sort((a, b) => a.DateTime - b.DateTime);

  // group by day
  const byDay = new Map();
  for (const r of parsed) {
    if (!byDay.has(r.DateKey)) byDay.set(r.DateKey, []);
    byDay.get(r.DateKey).push(r);
  }

  // build timelines
  const timelines = [];
  for (const [dateKey, items] of byDay.entries()) {
    const nodes = items.map(i => {
      const direction = inferDirection(i.Status);

      // Type selection logic based on the Voertuig column:
      // - exactly "prikklok" → Prikklok
      // - any other non-empty → Voertuig
      // - empty → Prikklok
      const rawVeh = (i.Vehicle || '').trim().toLowerCase();
      const isPrik = rawVeh === 'prikklok';
      const hasVeh = rawVeh.length > 0;
      const type   = isPrik ? 'Prikklok' : (hasVeh ? 'Voertuig' : 'Prikklok');

      // Title: time only (no suffix)
      const title = toHMS(i.Time);

      // Description: only place (no vehicle text as requested)
      const desc = i.Place ? i.Place : '';

      return { type, direction, title, desc };
    });
    timelines.push({ title: dateKey, nodes });
  }

  return { version: 7, updatedAt: Date.now(), timelines };
}

/* -------------- Field mapping & parsing -------------- */

// Lowercase/trim keys for flexible matching
function normalizeRowKeys(row) {
  const out = {};
  for (const k of Object.keys(row)) {
    out[k.trim().toLowerCase()] = row[k];
  }
  return out;
}

// Get a field by any alias (case-insensitive)
function getField(row, ...aliases) {
  for (const a of aliases) {
    const key = a.toLowerCase();
    if (row.hasOwnProperty(key)) {
      const v = row[key];
      if (v === null || v === undefined) return '';
      return v; // keep numbers for Excel serials
    }
  }
  return '';
}

// Map one row → normalized record
function toRecord(row) {
  // Ignored: id, chauffeur code, jobname, key type (we simply don't read them)
  const dateRaw   = getField(row, 'datum', 'date');
  const timeRaw   = getField(row, 'tijd', 'time');
  const statusRaw = getField(row, 'statustext', 'status', 'type'); // accepts START/STOP/IN/OUT
  const vehRaw    = getField(row, 'voertuig', 'vehicle', 'kenteken', 'nummerplaat');
  const placeRaw  = getField(row, 'plaats', 'location', 'locatie', 'plaatsnaam');

  const DateVal = parseExcelDateLike(dateRaw);  // Date object (midnight local)
  const TimeVal = parseExcelTimeLike(timeRaw);  // seconds in day
  const Status  = (statusRaw + '').trim().toUpperCase();
  const Vehicle = sanitizeText(vehRaw);
  const Place   = sanitizeText(placeRaw);

  if (!DateVal || !TimeVal) return null;
  return { Date: DateVal, Time: TimeVal, Status, Vehicle, Place };
}

/* -------------- Date/Time helpers -------------- */

// Excel dates: serial days since 1899-12-30
function parseExcelDateLike(val) {
  if (val instanceof Date && !isNaN(val)) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate());
  }
  if (typeof val === 'number' && isFinite(val)) {
    const ms = (val - 25569) * 86400 * 1000; // 25569 days between 1899-12-30 and 1970-01-01
    const d  = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    const d1 = new Date(s);
    if (!isNaN(d1)) return new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = parseInt(m[1],10), mm = parseInt(m[2],10)-1, yyyy = normalizeYear(parseInt(m[3],10));
      return new Date(yyyy, mm, dd);
    }
  }
  return null;
}

function normalizeYear(y) { return y < 100 ? (y + 2000) : y; }

// Returns YYYY-MM-DD from a Date
function toDateKey(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Excel time fraction or "HH:MM[:SS]"
function parseExcelTimeLike(val) {
  if (typeof val === 'number' && isFinite(val)) {
    const secs = Math.round(val * 86400);
    return Math.max(0, Math.min(secs, 86399));
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const hh = parseInt(m[1],10), mm = parseInt(m[2],10), ss = m[3]?parseInt(m[3],10):0;
      if (hh>=0 && hh<24 && mm>=0 && mm<60 && ss>=0 && ss<60) return hh*3600 + mm*60 + ss;
    }
  }
  return null;
}

function toHMS(timeVal) {
  const hh = Math.floor(timeVal / 3600);
  const mm = Math.floor((timeVal % 3600) / 60);
  const ss = Math.floor(timeVal % 60);
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

function combineDateAndTime(dateObj, timeVal) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0, 0);
  return new Date(d.getTime() + timeVal * 1000);
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function sanitizeText(val) {
  if (val == null) return '';
  return String(val).trim();
}

/* -------------- Direction inference -------------- */
function inferDirection(status) {
  const s = (status || '').toUpperCase().trim();
  if (s === 'START' || s === 'IN')  return 'IN';
  if (s === 'STOP'  || s === 'OUT') return 'OUT';
  return 'IN'; // fallback
}
