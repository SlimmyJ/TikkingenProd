import { drawConnectorsFor, drawAllConnectorsQueued } from "./connectors.js";
import { exportTimelinesA4 } from "./export.js";
import { exportPrint } from "./print.js";
import { setupImport } from "./import.js"; 

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STORAGE_KEY = "geotracer_tikkingen_cards_v7";

const ICONS = Object.freeze({
  Prikklok: '<i class="fa-regular fa-clock"></i>',
  Voertuig: '<i class="fa-solid fa-car-side"></i>',
});

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(str = "") {
  return String(str).replace(/[&<>\"']/g, (ch) => HTML_ENTITIES[ch]);
}

function toggleDirection(badge) {
  const next = badge.dataset.dir === "IN" ? "OUT" : "IN";
  badge.dataset.dir = next;
  badge.textContent = next;
  badge.classList.toggle("in", next === "IN");
  badge.classList.toggle("out", next === "OUT");
}

function toggleType(typeBadge) {
  const current = typeBadge.dataset.type;
  const next = current === "Prikklok" ? "Voertuig" : "Prikklok";
  typeBadge.dataset.type = next;
  typeBadge.innerHTML = `${ICONS[next]} ${next}`;
  saveDebounced();
  drawAllConnectorsQueued();
}

function moveCard(card, dir) {
  const grid = card.closest(".track-grid");
  if (!grid) return;

  if (dir === "left") {
    const prev = card.previousElementSibling;
    if (prev) grid.insertBefore(card, prev);
  } else if (dir === "right") {
    const next = card.nextElementSibling;
    if (next) grid.insertBefore(next, card);
  }

  const wrap = card.closest(".gt-canvas")?.querySelector(".track-wrap");
  if (wrap) drawConnectorsFor(wrap);
  saveDebounced();
}

function makeMoveBtn(direction) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn btn-gt btn-xs move-${direction}`;
  b.setAttribute(
    "aria-label",
    direction === "left" ? "Verplaats naar links" : "Verplaats naar rechts"
  );
  b.innerHTML = direction === "left" ? "&lt;" : "&gt;";
  b.addEventListener("click", () =>
    moveCard(b.closest(".tikking.card"), direction)
  );
  b.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      moveCard(b.closest(".tikking.card"), direction);
    }
  });
  return b;
}

function attachResizeObserver(wrap) {
  const ro = new ResizeObserver(() => drawConnectorsFor(wrap));
  ro.observe(wrap);
  wrap._ro = ro; 
}

function makeTikkingCard(idx, data = {}) {
  const {
    type = "Prikklok",
    direction = "IN",
    title = `Tikking ${idx}`,
    desc = "Voeg een beschrijving toe",
  } = data;

  const card = document.createElement("div");
  card.className = "tikking card";
  card.innerHTML = `
    <div class="card-header">
      <span class="type-badge" role="button" tabindex="0" data-type="${type}" title="Klik om type te wisselen">
        ${ICONS[type] || ""} ${type}
      </span>
      <div class="header-controls">
        <div class="move-controls"></div>
        <span class="dir-badge ${direction === "IN" ? "in" : "out"}"
              role="button" tabindex="0" title="Klik om te wisselen"
              data-dir="${direction}">${direction}</span>
      </div>
    </div>
    <div class="card-body">
      <h6 class="card-title" contenteditable="true" data-placeholder="Titel">${escapeHtml(
        title
      )}</h6>
      <p class="card-text"  contenteditable="true" data-placeholder="Beschrijving">${escapeHtml(
        desc
      )}</p>
    </div>
  `;

  const moveWrap = card.querySelector(".move-controls");
  moveWrap.append(makeMoveBtn("left"), makeMoveBtn("right"));

  const typeBadge = card.querySelector(".type-badge");
  typeBadge.addEventListener("click", () => toggleType(typeBadge));
  typeBadge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleType(typeBadge);
    }
  });

  const badge = card.querySelector(".dir-badge");
  badge.addEventListener("click", () => {
    toggleDirection(badge);
    saveDebounced();
  });
  badge.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleDirection(badge);
      saveDebounced();
    }
  });

  return card;
}

function btn(label, onClick) {
  const b = document.createElement("button");
  b.className = "btn btn-gt btn-sm";
  b.type = "button";
  b.innerHTML = label;
  b.addEventListener("click", onClick);
  return b;
}

function controlsFor(grid, wrap) {
  const controls = document.createElement("div");
  controls.className = "controls d-flex gap-2 mt-2 flex-wrap";
  controls.append(
    btn('<i class="fa-solid fa-plus"></i> Nieuwe tikking', () => {
      grid.appendChild(
        makeTikkingCard(grid.querySelectorAll(".tikking").length + 1)
      );
      drawConnectorsFor(wrap);
      saveDebounced();
    }),
    btn("− Verwijder laatste", () => {
      const cards = grid.querySelectorAll(".tikking");
      if (cards.length <= 1) return;
      grid.lastElementChild.remove();
      drawConnectorsFor(wrap);
      saveDebounced();
    }),
    btn("Reset naar 4 tikkingen", () => {
      grid.innerHTML = "";
      for (let i = 1; i <= 4; i++) grid.appendChild(makeTikkingCard(i));
      drawConnectorsFor(wrap);
      saveDebounced();
    })
  );
  return controls;
}

function makeTimeline() {
  const canvas = document.createElement("section");
  canvas.className = "gt-canvas";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "gt-delete";
  del.textContent = "❌ Verwijder";
  del.addEventListener("click", () => {
    if (confirm("Weet je zeker dat je deze tijdlijn wilt verwijderen?")) {
      canvas.remove();
      drawAllConnectorsQueued();
      saveDebounced();
    }
  });

  const title = document.createElement("h2");
  title.className = "gt-title";
  title.setAttribute("contenteditable", "true");
  title.setAttribute("data-placeholder", "Titel van tijdlijn");
  title.textContent = "Nieuwe tijdlijn";
  title.addEventListener("input", saveDebounced);

  const wrap = document.createElement("div");
  wrap.className = "track-wrap";
  attachResizeObserver(wrap);

  const grid = document.createElement("div");
  grid.className = "track-grid";

  const overlay = document.createElement("canvas");
  overlay.className = "track-overlay";

  wrap.append(grid, overlay);
  canvas.append(del, title, wrap, controlsFor(grid, wrap));

  for (let i = 1; i <= 4; i++) grid.appendChild(makeTikkingCard(i));

  requestAnimationFrame(() => drawConnectorsFor(wrap));
  return canvas;
}

function clearAllTimelines() {
  if (
    !confirm(
      "Weet je zeker dat je ALLE tijdlijnen wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
    )
  )
    return;
  const host = document.getElementById("timelines");
  host.innerHTML = "";
  localStorage.removeItem(STORAGE_KEY);
  drawAllConnectorsQueued();
  flash("Alle tijdlijnen verwijderd 🗑️");
}

function serialize() {
  const timelines = $$(".gt-canvas").map((canvas) => {
    const title = canvas.querySelector(".gt-title")?.textContent?.trim() || "";
    const nodes = [...canvas.querySelectorAll(".tikking")].map((card) => ({
      type: card.querySelector(".type-badge").dataset.type,
      direction: card.querySelector(".dir-badge").dataset.dir,
      title: card.querySelector(".card-title").textContent.trim(),
      desc: card.querySelector(".card-text").textContent.trim(),
    }));
    return { title, nodes };
  });
  return { version: 7, updatedAt: Date.now(), timelines };
}

function deserialize(state) {
  $("#timelines").innerHTML = "";
  (state.timelines || []).forEach((tl) => {
    const canvas = makeTimeline();
    const wrap = canvas.querySelector(".track-wrap");
    const grid = canvas.querySelector(".track-grid");
    canvas.querySelector(".gt-title").textContent = tl.title || "Tijdlijn";
    grid.innerHTML = "";
    (tl.nodes || []).forEach((n, i) =>
      grid.appendChild(makeTikkingCard(i + 1, n))
    );
    $("#timelines").appendChild(canvas);
    drawConnectorsFor(wrap);
  });
  drawAllConnectorsQueued();
}

let saveTO = 0;
function saveDebounced() {
  clearTimeout(saveTO);
  saveTO = setTimeout(saveState, 250);
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
  flash("Opgeslagen ✅");
}
function restoreState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (s) deserialize(s);
    else flash("Niets te herstellen");
  } catch {
    flash("Herstellen mislukt");
  }
}

function onExportImages() {
  exportTimelinesA4(document);
}
function onPrint() {
  exportPrint(document);
}

function init() {
  $("#addTimeline").addEventListener("click", () => {
    $("#timelines").appendChild(makeTimeline());
    drawAllConnectorsQueued();
  });
  $("#downloadIMG").addEventListener("click", onExportImages);
  $("#printDoc").addEventListener("click", onPrint);
  $("#saveState").addEventListener("click", saveState);
  $("#restoreState").addEventListener("click", restoreState);
  $("#clearAll").addEventListener("click", clearAllTimelines);
  window.addEventListener("resize", () => drawAllConnectorsQueued());

  setupImport({ deserialize, saveState, flash });

  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (s) deserialize(s);
    else $("#timelines").appendChild(makeTimeline());
  } catch {
    $("#timelines").appendChild(makeTimeline());
  }
  drawAllConnectorsQueued();
}
function flash(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position = "fixed";
  el.style.bottom = "16px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.background = "#fff";
  el.style.border = "1px solid var(--gt-border)";
  el.style.padding = "6px 10px";
  el.style.borderRadius = "10px";
  el.style.boxShadow = "var(--gt-shadow)";
  el.style.zIndex = "9999";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

init();

export { makeTimeline };
