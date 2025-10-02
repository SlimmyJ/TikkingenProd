const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const board = $("#board");
const overlay = $("#overlay");
const snapCb = $("#snapToggle");
const gridSel = $("#gridSize");
const addNoteBtn = $("#addNote");
const clearBtn = $("#clearCanvas");
const exportBtn = document.getElementById("exportPng");
const recenterBtn = $("#recenterLine");

let GRID = 20;
let timelineY = null;

const snap = (v, g = GRID) => Math.round(v / g) * g;

function setGridBackground() {
  const cls = `grid-${GRID}`;
  board.classList.remove("grid-10", "grid-20", "grid-30", "grid-40");
  board.classList.add(cls);
}

function iconFor(type) {
  if (type === "Voertuig") return '<i class="fa-solid fa-car-side"></i>';
  if (type === "Werf") return '<i class="fa-solid fa-person-digging"></i>';
  return '<i class="fa-regular fa-clock"></i>';
}

function nodeCenters() {
  return $$(".node", board).map((n) => {
    const x = parseFloat(n.style.left) + n.offsetWidth / 2;
    const y = parseFloat(n.style.top) + n.offsetHeight / 2;
    return { x, y, el: n };
  });
}

function computeBaselineY() {
  const pts = nodeCenters();
  if (pts.length >= 2) {
    const left = pts.reduce((a, b) => (b.x < a.x ? b : a), pts[0]);
    const right = pts.reduce((a, b) => (b.x > a.x ? b : a), pts[0]);
    return snap((left.y + right.y) / 2);
  }

  return snap(board.clientHeight * 0.65);
}

$$(".palette-item").forEach((btn) => {
  btn.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", btn.dataset.type);
  });
});
board.addEventListener("dragover", (e) => e.preventDefault());
board.addEventListener("drop", (e) => {
  e.preventDefault();
  const type = e.dataTransfer.getData("text/plain") || "Prikklok";
  const rect = board.getBoundingClientRect();
  let x = e.clientX - rect.left - 27;
  let y = e.clientY - rect.top - 27;
  if (snapCb.checked) {
    x = snap(x);
    y = snap(y);
  }
  addNode(type, x, y);

  const count = $$(".node", board).length;
  if (count === 2 && timelineY == null) {
    timelineY = computeBaselineY();
  }
  drawTimeline();
});

function addNode(type, x, y) {
  const node = document.createElement("div");
  node.className = "node";
  node.dataset.type = type;
  node.innerHTML = iconFor(type);
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  makeDraggable(node);
  board.appendChild(node);
}

function makeDraggable(el, handleSelector = null) {
  const handle = handleSelector ? el.querySelector(handleSelector) : el;
  if (!handle) return;

  let startX = 0,
    startY = 0,
    elX = 0,
    elY = 0,
    dragging = false;

  const onDown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    (handle || el).style.cursor = "grabbing";

    const p = getPoint(e);
    startX = p.x;
    startY = p.y;

    const r = el.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    elX = r.left - br.left;
    elY = r.top - br.top;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const onMove = (e) => {
    if (!dragging) return;
    const p = getPoint(e);
    let nx = elX + (p.x - startX);
    let ny = elY + (p.y - startY);
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
    dragging = false;
    (handle || el).style.cursor = "grab";
    window.removeEventListener("pointermove", onMove);
    drawTimeline();
  };

  handle.addEventListener("pointerdown", onDown);
}

function getPoint(e) {
  const rect = board.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

addNoteBtn?.addEventListener("click", () => {
  const y = (timelineY ?? computeBaselineY()) + 24;
  const note = document.createElement("div");
  note.className = "note";
  note.innerHTML = `
    <div class="note-handle" title="Sleep om te verplaatsen"><i class="fa-solid fa-grip-lines"></i></div>
    <div class="note-body" contenteditable="true">Opmerking…</div>
  `;

  note.style.left = `${snap((board.clientWidth - 200) / 2)}px`;
  note.style.top = `${snap(y)}px`;

  makeDraggable(note, ".note-handle");
  board.appendChild(note);
});

clearBtn?.addEventListener("click", () => {
  if (!confirm("Canvas leegmaken?")) return;
  $$(".node", board).forEach((n) => n.remove());
  $$(".note", board).forEach((n) => n.remove());
  timelineY = null;
  clearOverlay();
});

recenterBtn?.addEventListener("click", () => {
  if ($$(".node", board).length < 2) return;
  timelineY = computeBaselineY();
  drawTimeline();
});
overlay.addEventListener("dblclick", () => {
  if ($$(".node", board).length < 2) return;
  timelineY = computeBaselineY();
  drawTimeline();
});

gridSel.addEventListener("change", () => {
  GRID = parseInt(gridSel.value, 10) || 20;
  setGridBackground();
});
setGridBackground();

function drawTimeline() {
  clearOverlay();

  const pts = nodeCenters();
  if (pts.length < 2) return;

  if (timelineY == null) {
    timelineY = computeBaselineY();
  }

  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", minX);
  line.setAttribute("y1", timelineY);
  line.setAttribute("x2", maxX);
  line.setAttribute("y2", timelineY);
  line.setAttribute("class", "timeline-line");
  overlay.appendChild(line);

  pts.forEach((p) => {
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", p.x);
    tick.setAttribute("y1", timelineY - 14);
    tick.setAttribute("x2", p.x);
    tick.setAttribute("y2", timelineY + 14);
    tick.setAttribute("class", "timeline-tick");
    overlay.appendChild(tick);
  });
}

function clearOverlay() {
  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
}

window.addEventListener("resize", drawTimeline);

exportBtn?.addEventListener("click", async () => {
  try {
    drawTimeline();
    document.body.classList.add("gt-exporting");
    
    // Hide box/handle, keep text
    document.body.classList.add('export-text-only');
    const node = board;
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const dataURL = canvas.toDataURL("image/png");

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `timeline-${ts}.png`;
    a.click();
  } catch (err) {
    console.error("PNG export failed", err);
    alert("Exporteren mislukt. Probeer opnieuw.");
  } finally {
    document.body.classList.remove("gt-exporting");
        document.body.classList.remove('export-text-only');
  }
});
