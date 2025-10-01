// print.js
export async function exportPrint(root = document) {
  // Build print container
  const wrap = root.createElement("div");
  wrap.className = "gt-print-doc";

  // Header
  const header = root.createElement("div");
  header.className = "print-header";
  header.innerHTML = `
    <div class="ph-left">
      <img src="Pin_Rood_Transparant-002-cut.png" alt="GeoTracer" class="ph-logo" crossorigin="anonymous">
      <div class="ph-title">GeoTracer — Tijdlijnen</div>
    </div>
    <div class="ph-meta">${new Date().toLocaleString()}</div>
  `;
  wrap.appendChild(header);

  // For each timeline on the page
  const canvases = [...root.querySelectorAll(".gt-canvas")];
  for (const canvas of canvases) {
    const titleText = canvas.querySelector(".gt-title")?.textContent?.trim() || "Tijdlijn";

    const section = root.createElement("section");
    section.className = "tl-section";

    const h = root.createElement("h3");
    h.className = "tl-title";
    h.textContent = titleText;
    section.appendChild(h);

    const list = root.createElement("ul");
    list.className = "tl-list";

    const cards = [...canvas.querySelectorAll(".tikking")].map((card) => {
      const dir = card.querySelector(".dir-badge")?.dataset.dir || "IN";
      const type = card.querySelector(".type-badge")?.dataset.type || "Prikklok";
      const time = card.querySelector(".card-title")?.textContent?.trim() || "";
      const desc = card.querySelector(".card-text")?.textContent?.trim() || "";
      return { dir, type, time, desc };
    });

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const li = root.createElement("li");
      li.className = "tl-entry";
      li.innerHTML = `
        <div class="tl-node">
          <div class="tl-dot"></div>
          ${i < cards.length - 1 ? '<div class="tl-stem"></div>' : ""}
        </div>
        <div class="tl-card">
          <div class="tl-topline">
            <div class="tl-time">${escapeHTML(c.time)}</div>
            <span class="tl-badge ${c.dir === "IN" ? "in" : "out"}">${c.dir}</span>
          </div>
          <div class="tl-subline">
            <span class="tl-type"><i class="fa-solid ${
              c.type === "Voertuig" ? "fa-car-side" : "fa-clock"
            } tl-ico"></i> ${escapeHTML(c.type)}</span>
            ${c.desc ? `<span class="tl-desc">${escapeHTML(c.desc)}</span>` : ""}
          </div>
        </div>
      `;
      list.appendChild(li);
    }

    section.appendChild(list);
    wrap.appendChild(section);
  }

  // Inject and print
  root.body.classList.add("gt-printing");
  root.body.appendChild(wrap);
  await nextFrame();
  root.defaultView.print();
  // Clean up after print
  root.body.removeChild(wrap);
  root.body.classList.remove("gt-printing");
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
  });
}
