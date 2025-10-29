import { $, $$ } from "./lib/dom.js";
import { iconFor } from "./lib/icons.js";
import { toHex6 } from "./lib/colors.js";
import { attachNodeDrag } from "./lib/drag.js";
import { GRID, setGrid, snap } from "./lib/grid.js";
import { attachNoteDrag } from "./lib/drag-note.js";
import { svgLine, clearOverlay } from "./lib/svg.js";
import { wireJsonExport, wireJsonImport } from "./lib/io-json.js";
import {
  nodeCentersSorted,
  computeBaselineY as computeBaselineYUtil
} from "./lib/timeline-utils.js";
import {
  renderRecentColors,
  applySelectionColor,
  selectedColor,
  commitRecentColor
} from "./lib/segments.js";

const board = $("#board");
const overlay = $("#overlay");
const snapCb = $("#snapToggle");
const gridSel = $("#gridSize");
const addNoteBtn = $("#addNote");
const clearBtn = $("#clearCanvas");
const exportPngBtn = $("#exportPng");
const segColorInp = $("#segColor");
const undoBtn = $("#undoLast");
const undoStack = [];
const segmentColorMap = new Map();
const exportJsonBtn = document.getElementById("exportJson");
const importJsonInp = document.getElementById("importJson");
const importJsonBtn = document.getElementById("importJsonBtn");

let timelineY = null;
let nextNodeId = 1;
let selectedSegmentKey = null;
let colorClipboard = null;

function setGridValue(v) {
  setGrid(Number(v));
  gridSel.value = String(v);
  setGridBackground();
}
function setTimeline(v) {
  timelineY = v == null ? null : Number(v);
}
function setSegmentColorMap(m) {
  segmentColorMap.clear();
  m.forEach((v, k) => segmentColorMap.set(k, v));
}

function reseedNextNodeId() {
  const maxId = Math.max(
    0,
    ...$$(".node", board).map((n) => Number(n.dataset.id) || 0)
  );
  nextNodeId = maxId + 1;
}

wireJsonExport(exportJsonBtn, {
  board,
  get timelineY() {
    return timelineY;
  },
  segmentColorMap,
  get grid() {
    return GRID;
  }
});

wireJsonImport(importJsonBtn, importJsonInp, {
  board,
  setGridValue,
  setTimeline,
  setSegmentColorMap,
  addNode: (type, x, y, forcedId) => {
    const node = addNode(type, x, y);
    if (forcedId != null) node.dataset.id = String(forcedId);
    return node;
  },
  draw: () => {
    reseedNextNodeId();
    drawTimeline();
  }
});

function setGridBackground() {
  const cls = `grid-${GRID}`;
  board.classList.remove("grid-10", "grid-20", "grid-30", "grid-40");
  board.classList.add(cls);
}

const computeBaselineY = () => computeBaselineYUtil(board, snap);

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
  const node = addNode(type, x, y);
  undoStack.push({ type: "addNode", id: Number(node.dataset.id) });
  const count = $$(".node", board).length;
  if (count === 2 && timelineY == null) timelineY = computeBaselineY();
  drawTimeline();
});

function addNode(type, x, y) {
  const node = document.createElement("div");
  node.className = "node";
  node.dataset.type = type;
  node.dataset.id = String(nextNodeId++);
  node.innerHTML = iconFor(type);
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  board.appendChild(node);
  attachNodeDrag(node, {
    board,
    snap,
    snapEnabled: () => snapCb.checked,
    onMove: () => {
      drawTimeline();
    }
  });
  return node;
}

addNoteBtn?.addEventListener("click", () => {
  const y = (timelineY ?? computeBaselineY()) + 24;
  const note = document.createElement("div");
  note.className = "note";
  note.innerHTML = `
    <div class="note-handle"><i class="fa-solid fa-grip-lines"></i></div>
    <div class="note-body" contenteditable="true">Opmerking…</div>
  `;
  note.style.left = `${snap((board.clientWidth - 200) / 2)}px`;
  note.style.top = `${snap(y)}px`;
  attachNoteDrag(
    note,
    board,
    ".note-handle",
    snap,
    () => snapCb.checked,
    () => {
      drawTimeline();
    }
  );
  board.appendChild(note);
});

clearBtn?.addEventListener("click", () => {
  if (!confirm("Canvas leegmaken?")) return;
  $$(".node", board).forEach((n) => n.remove());
  $$(".note", board).forEach((n) => n.remove());
  timelineY = null;
  selectedSegmentKey = null;
  segmentColorMap.clear();
  undoStack.length = 0;
  clearOverlay(overlay);
});

gridSel.addEventListener("change", () => {
  setGrid(Number(gridSel.value) || 20);
  setGridBackground();
  drawTimeline();
});

setGridBackground();

undoBtn?.addEventListener("click", () => {
  for (;;) {
    const action = undoStack.pop();
    if (!action) return;
    if (action.type === "addNode") {
      const node = $(`.node[data-id="${action.id}"]`, board);
      if (node) {
        node.remove();
        const keysToDelete = [];
        segmentColorMap.forEach((_, key) => {
          const [l, r] = key.split("->").map(Number);
          if (l === action.id || r === action.id) keysToDelete.push(key);
        });
        keysToDelete.forEach((k) => segmentColorMap.delete(k));
        if ($$(".node", board).length < 2) timelineY = null;
        if (selectedSegmentKey && keysToDelete.includes(selectedSegmentKey))
          selectedSegmentKey = null;
        drawTimeline();
        return;
      }
    }
  }
});

function startBaselineDrag(startClientY) {
  const startVal = timelineY ?? computeBaselineY();
  const move = (ev) => {
    let ny = startVal + (ev.clientY - startClientY);
    if (snapCb.checked) ny = snap(ny);
    ny = Math.max(20, Math.min(board.clientHeight - 20, ny));
    timelineY = ny;
    drawTimeline();
  };
  const up = () => {
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  document.body.style.cursor = "ns-resize";
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function drawTimeline() {
  clearOverlay(overlay);

  const pts = nodeCentersSorted(board);
  if (pts.length < 2) return;

  if (timelineY == null) timelineY = computeBaselineY();

  const MARGIN = 20;
  timelineY = Math.max(
    MARGIN,
    Math.min(board.clientHeight - MARGIN, timelineY)
  );

  const minX = pts[0].x;
  const maxX = pts[pts.length - 1].x;

  const base = svgLine(minX, timelineY, maxX, timelineY, {
    stroke: "#000",
    "stroke-width": 4,
    "stroke-linecap": "round"
  });
  overlay.appendChild(base);

  const hit = svgLine(minX, timelineY, maxX, timelineY, {
    stroke: "rgba(0,0,0,0)",
    "stroke-width": 18,
    "stroke-linecap": "round"
  });
  hit.style.cursor = "ns-resize";
  hit.addEventListener("pointerdown", (e) => startBaselineDrag(e.clientY));
  overlay.appendChild(hit);

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const key = `${a.id}->${b.id}`;
    const stroke = toHex6(segmentColorMap.get(key) || "#000000");

    if (selectedSegmentKey === key) {
      overlay.appendChild(
        svgLine(a.x, timelineY, b.x, timelineY, { class: "seg-halo" })
      );
    }

    const seg = svgLine(a.x, timelineY, b.x, timelineY, {
      class: "timeline-segment",
      stroke,
      "stroke-width": 8,
      "stroke-linecap": "round",
      "data-key": key
    });
    seg.style.cursor = "pointer";
    seg.addEventListener("click", () => {
      if (selectedSegmentKey === key) {
        selectedSegmentKey = null;
      } else {
        selectedSegmentKey = key;
        if (segColorInp)
          segColorInp.value = selectedColor(
            segmentColorMap,
            selectedSegmentKey,
            toHex6(stroke)
          );
      }
      drawTimeline();
    });
    overlay.appendChild(seg);
  }

  pts.forEach((p) => {
    overlay.appendChild(
      svgLine(p.x, timelineY - 14, p.x, timelineY + 14, {
        stroke: "#000",
        "stroke-width": 3,
        "stroke-linecap": "round"
      })
    );
  });
}

segColorInp?.addEventListener("input", () => {
  applySelectionColor(
    segmentColorMap,
    selectedSegmentKey,
    segColorInp.value,
    () => drawTimeline()
  );
});

segColorInp?.addEventListener("change", () => {
  commitRecentColor(segColorInp.value, () => {
    renderRecentColors(document.getElementById("recentColors"), (c) => {
      segColorInp.value = c;
      applySelectionColor(segmentColorMap, selectedSegmentKey, c, () =>
        drawTimeline()
      );
    });
  });
});

window.addEventListener("resize", drawTimeline);

window.addEventListener("keydown", (e) => {
  const tag = (
    (document.activeElement && document.activeElement.tagName) ||
    ""
  ).toLowerCase();
  const typing =
    tag === "input" ||
    tag === "textarea" ||
    document.activeElement?.isContentEditable;
  if (typing) return;

  if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
    if (selectedSegmentKey) {
      const col = segmentColorMap.get(selectedSegmentKey) || segColorInp?.value;
      if (col) colorClipboard = col;
    }
  }

  if (e.ctrlKey && (e.key === "v" || e.key === "V")) {
    if (selectedSegmentKey && colorClipboard) {
      segmentColorMap.set(selectedSegmentKey, colorClipboard);
      if (segColorInp) segColorInp.value = colorClipboard;
      renderRecentColors(document.getElementById("recentColors"), (c) => {
        segColorInp.value = c;
        applySelectionColor(segmentColorMap, selectedSegmentKey, c, () =>
          drawTimeline()
        );
      });
      drawTimeline();
      commitRecentColor(colorClipboard, () => {
        renderRecentColors(document.getElementById("recentColors"), (c) => {
          segColorInp.value = c;
          applySelectionColor(segmentColorMap, selectedSegmentKey, c, () =>
            drawTimeline()
          );
        });
      });
      drawTimeline();
    }
  }
});

async function exportPNG() {
  if (!board) return;
  if (typeof drawTimeline === "function") drawTimeline();
  const originalClasses = [...board.classList];
  const gridClasses = originalClasses.filter((c) => /^grid-\d+$/i.test(c));
  document.body.classList.add("exporting");
  gridClasses.forEach((c) => board.classList.remove(c));

  try {
    const canvas = await html2canvas(board, {
      backgroundColor: "#fff",
      scale: 2,
      useCORS: true,
      removeContainer: true,

      onclone(doc) {
        const b = doc.getElementById("board");
        if (b) {
          [...b.classList].forEach((c) => {
            if (/^grid-\d+$/i.test(c)) b.classList.remove(c);
          });
          b.style.background = "none";
          b.style.backgroundImage = "none";
          b.style.backgroundSize = "0 0";
          b.style.boxShadow = "none";
        }
      }
    });

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `timeline-${ts}.png`;
    a.click();
  } catch (err) {
    console.error(err);
    alert("Exporteren mislukt. Probeer opnieuw.");
  } finally {
    gridClasses.forEach((c) => board.classList.add(c));
    document.body.classList.remove("exporting");
  }
}
exportPngBtn?.addEventListener("click", exportPNG);

window.addEventListener("load", () => {
  if (
    !document.getElementById("board").classList.contains("grid-10") &&
    !document.getElementById("board").classList.contains("grid-20") &&
    !document.getElementById("board").classList.contains("grid-30") &&
    !document.getElementById("board").classList.contains("grid-40")
  ) {
    document.getElementById("board").classList.add("grid-20");
  }
  renderRecentColors(document.getElementById("recentColors"), (c) => {
    segColorInp.value = c;
    applySelectionColor(segmentColorMap, selectedSegmentKey, c, () =>
      drawTimeline()
    );
  });
});
