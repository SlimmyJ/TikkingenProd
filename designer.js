const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const board = $('#board');
const overlay = $('#overlay');
const snapCb = $('#snapToggle');
const gridSel = $('#gridSize');
const addNoteBtn = $('#addNote');
const clearBtn = $('#clearCanvas');
const exportBtn = $('#exportPng');
const segColorInp = $('#segColor');
const undoBtn = $('#undoLast');

let GRID = 20;
let timelineY = null;
let nextNodeId = 1;
const undoStack = [];
const segmentColorMap = new Map();
let selectedSegmentKey = null;

const snap = (v, g = GRID) => Math.round(v / g) * g;

function setGridBackground() {
  const cls = `grid-${GRID}`;
  board.classList.remove('grid-10', 'grid-20', 'grid-30', 'grid-40');
  board.classList.add(cls);
}

function iconFor(type) {
  if (type === 'Voertuig') return '<i class="fa-solid fa-car-side"></i>';
  if (type === 'Werf') return '<i class="fa-solid fa-person-digging"></i>';
  if (type === 'Huis') return '<i class="fa-solid fa-house"></i>';
  return '<i class="fa-regular fa-clock"></i>';
}

function getNodeCenter(n) {
  const x = parseFloat(n.style.left) + n.offsetWidth / 2;
  const y = parseFloat(n.style.top) + n.offsetHeight / 2;
  return { x, y };
}

function nodeCentersSorted() {
  const arr = $$('.node', board).map(n => {
    const { x, y } = getNodeCenter(n);
    return { x, y, el: n, id: Number(n.dataset.id) };
  });
  arr.sort((a, b) => a.x - b.x);
  return arr;
}

function computeBaselineY() {
  const pts = nodeCentersSorted();
  if (pts.length >= 2) {
    const left = pts[0];
    const right = pts[pts.length - 1];
    return snap((left.y + right.y) / 2);
  }
  return snap(board.clientHeight * 0.65);
}

$$('.palette-item').forEach(btn => {
  btn.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', btn.dataset.type);
  });
});

board.addEventListener('dragover', e => e.preventDefault());

board.addEventListener('drop', e => {
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain') || 'Prikklok';
  const rect = board.getBoundingClientRect();
  let x = e.clientX - rect.left - 27;
  let y = e.clientY - rect.top - 27;
  if (snapCb.checked) {
    x = snap(x);
    y = snap(y);
  }
  const node = addNode(type, x, y);
  undoStack.push({ type: 'addNode', id: Number(node.dataset.id) });
  const count = $$('.node', board).length;
  if (count === 2 && timelineY == null) timelineY = computeBaselineY();
  drawTimeline();
});

function addNode(type, x, y) {
  const node = document.createElement('div');
  node.className = 'node';
  node.dataset.type = type;
  node.dataset.id = String(nextNodeId++);
  node.innerHTML = iconFor(type);
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  makeDraggable(node);
  board.appendChild(node);
  return node;
}

function makeDraggable(el, handleSelector = null) {
  const handle = handleSelector ? el.querySelector(handleSelector) : el;
  if (!handle) return;

  let start = null;

  const onDown = e => {
    if (e.button !== 0) return;
    (handle || el).style.cursor = 'grabbing';
    const p = getPoint(e);
    const r = el.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    start = { x: p.x, y: p.y, left: r.left - br.left, top: r.top - br.top };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const onMove = e => {
    if (!start) return;
    const p = getPoint(e);
    let nx = start.left + (p.x - start.x);
    let ny = start.top + (p.y - start.y);
    if (snapCb.checked) {
      nx = snap(nx);
      ny = snap(ny);
    }
    nx = Math.max(0, Math.min(nx, board.clientWidth - el.offsetWidth));
    ny = Math.max(0, Math.min(ny, board.clientHeight - el.offsetHeight));
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
    drawTimeline();
  };

  const onUp = () => {
    (handle || el).style.cursor = 'grab';
    window.removeEventListener('pointermove', onMove);
    start = null;
    drawTimeline();
  };

  handle.addEventListener('pointerdown', onDown);
}

function getPoint(e) {
  const rect = board.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

addNoteBtn?.addEventListener('click', () => {
  const y = (timelineY ?? computeBaselineY()) + 24;
  const note = document.createElement('div');
  note.className = 'note';
  note.innerHTML = `
    <div class="note-handle"><i class="fa-solid fa-grip-lines"></i></div>
    <div class="note-body" contenteditable="true">Opmerking…</div>
  `;
  note.style.left = `${snap((board.clientWidth - 200) / 2)}px`;
  note.style.top = `${snap(y)}px`;
  makeDraggable(note, '.note-handle');
  board.appendChild(note);
});

clearBtn?.addEventListener('click', () => {
  if (!confirm('Canvas leegmaken?')) return;
  $$('.node', board).forEach(n => n.remove());
  $$('.note', board).forEach(n => n.remove());
  timelineY = null;
  selectedSegmentKey = null;
  segmentColorMap.clear();
  undoStack.length = 0;
  clearOverlay();
});

gridSel.addEventListener('change', () => {
  GRID = parseInt(gridSel.value, 10) || 20;
  setGridBackground();
  drawTimeline();
});

setGridBackground();

segColorInp?.addEventListener('input', () => {
  if (!selectedSegmentKey) return;
  segmentColorMap.set(selectedSegmentKey, toHex6(segColorInp.value));
  drawTimeline();
});

undoBtn?.addEventListener('click', () => {
  for (;;) {
    const action = undoStack.pop();
    if (!action) return;
    if (action.type === 'addNode') {
      const node = $(`.node[data-id="${action.id}"]`, board);
      if (node) {
        node.remove();
        const keysToDelete = [];
        segmentColorMap.forEach((_, key) => {
          const [l, r] = key.split('->').map(Number);
          if (l === action.id || r === action.id) keysToDelete.push(key);
        });
        keysToDelete.forEach(k => segmentColorMap.delete(k));
        if ($$('.node', board).length < 2) timelineY = null;
        if (selectedSegmentKey && keysToDelete.includes(selectedSegmentKey)) selectedSegmentKey = null;
        drawTimeline();
        return;
      }
    }
  }
});

function toHex6(c) {
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

function svgLine(x1, y1, x2, y2, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  el.setAttribute('x1', x1);
  el.setAttribute('y1', y1);
  el.setAttribute('x2', x2);
  el.setAttribute('y2', y2);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

function clearOverlay() {
  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
}

function startBaselineDrag(startClientY) {
  const startVal = timelineY ?? computeBaselineY();
  const move = ev => {
    let ny = startVal + (ev.clientY - startClientY);
    if (snapCb.checked) ny = snap(ny);
    ny = Math.max(20, Math.min(board.clientHeight - 20, ny));
    timelineY = ny;
    drawTimeline();
  };
  const up = () => {
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  document.body.style.cursor = 'ns-resize';
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

function drawTimeline() {
  clearOverlay();
  const pts = nodeCentersSorted();
  if (pts.length < 2) return;
  if (timelineY == null) timelineY = computeBaselineY();
  const minX = pts[0].x;
  const maxX = pts[pts.length - 1].x;

  const base = svgLine(minX, timelineY, maxX, timelineY, {
    stroke: '#000',
    'stroke-width': 4,
    'stroke-linecap': 'round'
  });
  overlay.appendChild(base);

  const hit = svgLine(minX, timelineY, maxX, timelineY, {
    stroke: 'rgba(0,0,0,0)',
    'stroke-width': 18,
    'stroke-linecap': 'round'
  });
  hit.style.cursor = 'ns-resize';
  hit.addEventListener('pointerdown', e => startBaselineDrag(e.clientY));
  overlay.appendChild(hit);

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const key = `${a.id}->${b.id}`;
    const stroke = toHex6(segmentColorMap.get(key) || '#000000');

    if (selectedSegmentKey === key) {
      overlay.appendChild(svgLine(a.x, timelineY, b.x, timelineY, { class: 'seg-halo' }));
    }

    const seg = svgLine(a.x, timelineY, b.x, timelineY, {
      class: 'timeline-segment',
      stroke,
      'stroke-width': 8,
      'stroke-linecap': 'round',
      'data-key': key
    });
    seg.style.cursor = 'pointer';
    seg.addEventListener('click', () => {
      if (selectedSegmentKey === key) {
        selectedSegmentKey = null;
      } else {
        selectedSegmentKey = key;
        if (segColorInp) segColorInp.value = toHex6(stroke);
      }
      drawTimeline();
    });
    overlay.appendChild(seg);
  }

  pts.forEach(p => {
    overlay.appendChild(
      svgLine(p.x, timelineY - 14, p.x, timelineY + 14, {
        stroke: '#000',
        'stroke-width': 3,
        'stroke-linecap': 'round'
      })
    );
  });
}

window.addEventListener('resize', drawTimeline);

exportBtn?.addEventListener('click', async () => {
  try {
    drawTimeline();
    document.body.classList.add('export-text-only');
    const canvas = await html2canvas(board, { backgroundColor: '#fff', scale: 2, useCORS: true, logging: false });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `timeline-${ts}.png`;
    a.click();
  } catch {
    alert('Exporteren mislukt. Probeer opnieuw.');
  } finally {
    document.body.classList.remove('export-text-only');
  }
});

window.addEventListener('load', () => {

  if (!document.getElementById('board').classList.contains('grid-10') &&
      !document.getElementById('board').classList.contains('grid-20') &&
      !document.getElementById('board').classList.contains('grid-30') &&
      !document.getElementById('board').classList.contains('grid-40')) {
    document.getElementById('board').classList.add('grid-20');
  }
});