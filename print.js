// print.js
const BRAND_RED = '#c20e1a';

export async function exportPrint(root = document) {
  let printRoot = root.getElementById('gt-print-root');
  if (printRoot) printRoot.remove();

  // Read the same toggle the exporter uses
  const oneRow = !!root.getElementById('exportOneRow')?.checked;

  printRoot = root.createElement('div');
  printRoot.id = 'gt-print-root';
  printRoot.className = 'gt-print-doc';
  root.body.appendChild(printRoot);

  printRoot.appendChild(header(root));

  const canvases = [...root.querySelectorAll('.gt-canvas')];
  canvases.forEach((canvasEl, idx) => {
    const title = canvasEl.querySelector('.gt-title')?.textContent?.trim() || `Tijdlijn ${idx+1}`;
    const nodes = [...canvasEl.querySelectorAll('.tikking')].map(card => ({
      type:  card.querySelector('.type-badge')?.dataset?.type || 'Prikklok',
      dir:   card.querySelector('.dir-badge')?.dataset?.dir  || 'IN',
      title: card.querySelector('.card-title')?.textContent?.trim() || '',
      desc:  card.querySelector('.card-text')?.textContent?.trim()  || ''
    }));

    const section = oneRow
      ? timelineSectionHorizontal(root, title, nodes)
      : timelineSectionVertical(root, title, nodes);

    printRoot.appendChild(section);
  });

  root.body.classList.add('gt-printing');
  await new Promise(r => requestAnimationFrame(r));
  window.print();
  root.body.classList.remove('gt-printing');
  printRoot.remove();
}

function header(doc) {
  const wrap = doc.createElement('div');
  wrap.className = 'print-header';
  wrap.innerHTML = `
    <div class="ph-left">
      <img src="Pin_Rood_Transparant-002-cut.png" alt="GeoTracer" class="ph-logo" />
      <div class="ph-title">GeoTracer</div>
    </div>
    <div class="ph-right">
      <div class="ph-meta">Gegenereerd: ${formatNow()}</div>
    </div>
  `;
  return wrap;
}

/* ---------- Vertical (existing) ---------- */
function timelineSectionVertical(doc, title, nodes) {
  const sec = doc.createElement('section');
  sec.className = 'tl-section';
  sec.innerHTML = `<h2 class="tl-title">${escapeHtml(title)}</h2><ol class="tl-list"></ol>`;
  const list = sec.querySelector('.tl-list');

  nodes.forEach(n => list.appendChild(makeVerticalEntry(doc, n)));
  return sec;
}
function makeVerticalEntry(doc, n) {
  const li = doc.createElement('li');
  li.className = 'tl-entry';
  const isIn = (n.dir || '').toUpperCase() === 'IN';
  li.innerHTML = `
    <div class="tl-node"><div class="tl-dot"></div><div class="tl-stem"></div></div>
    <div class="tl-card">
      <div class="tl-topline">
        <span class="tl-time">${escapeHtml(n.title || '')}</span>
        <span class="tl-badge ${isIn ? 'in' : 'out'}">${isIn ? 'IN' : 'OUT'}</span>
      </div>
      <div class="tl-subline">
        <span class="tl-type">${n.type === 'Voertuig' ? carIcon() : clockIcon()} ${escapeHtml(n.type)}</span>
        ${n.desc ? `<span class="tl-desc">${escapeHtml(n.desc)}</span>` : ''}
      </div>
    </div>`;
  return li;
}

/* ---------- NEW: Horizontal single-row ---------- */
function timelineSectionHorizontal(doc, title, nodes) {
  const sec = doc.createElement('section');
  sec.className = 'tl-section row-mode';
  sec.innerHTML = `<h2 class="tl-title">${escapeHtml(title)}</h2><ol class="tl-list"></ol>`;
  const list = sec.querySelector('.tl-list');

  nodes.forEach((n, i) => list.appendChild(makeHorizontalEntry(doc, n, i, nodes.length)));
  return sec;
}
function makeHorizontalEntry(doc, n, index, len) {
  const li = doc.createElement('li');
  li.className = 'tl-entry tl-entry-h';
  const isIn = (n.dir || '').toUpperCase() === 'IN';
  li.innerHTML = `
    <div class="tl-node">
      <div class="tl-dot"></div>
    </div>
    <div class="tl-card">
      <div class="tl-topline">
        <span class="tl-time">${escapeHtml(n.title || '')}</span>
        <span class="tl-badge ${isIn ? 'in' : 'out'}">${isIn ? 'IN' : 'OUT'}</span>
      </div>
      <div class="tl-subline">
        <span class="tl-type">${n.type === 'Voertuig' ? carIcon() : clockIcon()} ${escapeHtml(n.type)}</span>
        ${n.desc ? `<span class="tl-desc">${escapeHtml(n.desc)}</span>` : ''}
      </div>
    </div>`;
  // Connector to next card (horizontal rail) via CSS ::after on li
  if (index === len - 1) li.classList.add('is-last');
  return li;
}

/* ---------- helpers ---------- */
function escapeHtml(str=''){
  const ENT = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'};
  return String(str).replace(/[&<>\"']/g, ch => ENT[ch]);
}
function formatNow(){
  const d = new Date(); const p = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function clockIcon(){ return `<svg class="tl-ico" viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`; }
function carIcon(){ return `<svg class="tl-ico" viewBox="0 0 24 24" width="16" height="16"><path d="M3 13v4c0 .6.4 1 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1c.6 0 1-.4 1-1v-4l-2-5a2 2 0 0 0-1.9-1.3H6.9A2 2 0 0 0 5 8l-2 5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7" cy="17" r="1.5" fill="currentColor"/><circle cx="17" cy="17" r="1.5" fill="currentColor"/></svg>`; }
