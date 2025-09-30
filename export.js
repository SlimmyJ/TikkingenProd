// export.js
import { drawConnectorsFor } from './connectors.js';

export async function exportTimelinesA4(root = document) {
  const A4W = 2480, A4H = 1754;         // landscape pixels at 300dpi-ish
  const MARGIN = 80, TITLE_H = 120;

  const oneRow = !!root.getElementById('exportOneRow')?.checked;

  // Ensure webfonts are ready (prevents blank text on some browsers)
  if (root.fonts && root.fonts.ready) {
    try { await root.fonts.ready; } catch {}
  }

  const timelines = [...root.querySelectorAll('.gt-canvas')];

  for (let idx = 0; idx < timelines.length; idx++) {
    const src = timelines[idx];

    // --- 1) Clone timeline (remove UI controls) ---
    const clone = src.cloneNode(true);
    clone.querySelectorAll('.controls, .gt-delete').forEach(el => el.remove());

    // --- 2) Layout rules for the clone ---
    if (oneRow) {
      // force all cards in one horizontal row
      clone.classList.add('export-row');
      const grid = clone.querySelector('.track-grid');
      if (grid) {
        grid.style.display  = 'inline-flex';
        grid.style.flexWrap = 'nowrap';
        grid.style.gap      = '20px';
      }
    }

    // Offscreen host that still participates in layout
    const host = root.createElement('div');
    host.style.position = 'absolute';
    host.style.left = '-99999px';
    host.style.top = '0';
    host.style.overflow = 'visible';

    if (!oneRow) {
      // CRITICAL: match on-screen width so CSS grid computes the SAME columns.
      const srcRect = src.getBoundingClientRect();
      const widthPx = Math.max(320, Math.floor(srcRect.width)) + 'px';
      host.style.width = widthPx;
      // also cap the clone to that width for consistent grid wrapping
      clone.style.width = widthPx;
      clone.style.maxWidth = widthPx;
      clone.style.boxSizing = 'border-box';
    } else {
      // allow the host to expand to natural width in one-row mode
      host.style.width = 'max-content';
    }

    host.appendChild(clone);
    root.body.appendChild(host);

    // --- 3) Redraw connectors on the CLONE so lines match its layout ---
    const wrap = clone.querySelector('.track-wrap');
    if (wrap) {
      // ensure overlay exists
      let overlay = wrap.querySelector('.track-overlay');
      if (!overlay) {
        overlay = root.createElement('canvas');
        overlay.className = 'track-overlay';
        wrap.appendChild(overlay);
      }
      await nextFrame();
      drawConnectorsFor(wrap);
    }

    // --- 4) Measure full content size after layout settles ---
    await nextFrame();
    const rect = clone.getBoundingClientRect();
    const fullWidth  = Math.max(Math.ceil(clone.scrollWidth),  Math.ceil(rect.width));
    const fullHeight = Math.max(Math.ceil(clone.scrollHeight), Math.ceil(rect.height));

    // Guard against bad layout producing tiny canvases
    if (fullWidth < 20 || fullHeight < 20) {
      console.warn('Export skipped due to tiny size', { fullWidth, fullHeight, rect });
      root.body.removeChild(host);
      continue;
    }

    // lock width to avoid reflow between measure & capture
    clone.style.width = fullWidth + 'px';
    clone.style.boxSizing = 'border-box';

    // --- 5) Render with html2canvas using FULL element size ---
    const full = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 2,
      width: fullWidth,
      height: fullHeight,
      windowWidth:  Math.max(fullWidth,  root.documentElement.clientWidth),
      windowHeight: Math.max(fullHeight, root.documentElement.clientHeight),
      scrollX: 0,
      scrollY: 0,
      useCORS: true // needed for logo; also add crossorigin="anonymous" on <img>
    });

    root.body.removeChild(host);

    if (!full.width || !full.height) {
      console.warn('Export skipped: html2canvas returned empty canvas');
      continue;
    }

    // --- 6) Slice into A4 pages with a title ---
    const scale = (A4W - 2*MARGIN) / full.width;
    const usableHeight = A4H - 2*MARGIN - TITLE_H;
    const sliceH = usableHeight / scale;

    for (let y = 0; y < full.height; y += sliceH) {
      const h = Math.min(sliceH, full.height - y);

      const page = root.createElement('canvas');
      page.width = A4W; page.height = A4H;
      const ctx = page.getContext('2d');

      // white page
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, A4W, A4H);

      // title
      const titleText = src.querySelector('.gt-title')?.textContent?.trim() || `Tijdlijn ${idx+1}`;
      ctx.fillStyle = '#000';
      ctx.font = '700 42px Open Sans, Arial, sans-serif';
      ctx.fillText(titleText, MARGIN, MARGIN + 48);

      // slice from big render
      ctx.drawImage(
        full,
        0, y, full.width, h,
        MARGIN, MARGIN + TITLE_H,
        A4W - 2*MARGIN, h * scale
      );

      const a = root.createElement('a');
      a.href = page.toDataURL('image/png');
      a.download = `tijdlijn_${String(idx+1).padStart(2,'0')}_p${String(Math.floor(y/sliceH)+1).padStart(2,'0')}.png`;
      a.click();
    }
  }
}

function nextFrame() {
  return new Promise(r => requestAnimationFrame(r));
}
