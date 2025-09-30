// connectors.js
const LINE_COLOR = "#d6d6d6";
const LINE_WIDTH = 2;

export function drawConnectorsFor(wrap) {
  if (!wrap) return;
  const grid = wrap.querySelector(".track-grid");
  const canvas = wrap.querySelector(".track-overlay");
  if (!grid || !canvas) return;

  const cards = [...grid.querySelectorAll(".tikking")];
  if (cards.length < 2) {
    // Nothing (or only one) to connect
    const ctx0 = canvas.getContext("2d");
    ctx0 && ctx0.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const rect = wrap.getBoundingClientRect();
  // If the element is not laid out (display:none), skip
  if (rect.width < 2 || rect.height < 2) return;

  // Hi-DPI scaling
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.style.width = `${Math.floor(rect.width)}px`;
  canvas.style.height = `${Math.floor(rect.height)}px`;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = LINE_COLOR;

  const boxes = cards.map((c) => c.getBoundingClientRect());
  const pts = boxes.map((r) => ({
    left: { x: r.left - rect.left, y: r.top + r.height / 2 - rect.top },
    right: { x: r.right - rect.left, y: r.top + r.height / 2 - rect.top },
    top: { x: r.left + r.width / 2 - rect.left, y: r.top - rect.top },
    bottom: { x: r.left + r.width / 2 - rect.left, y: r.bottom - rect.top },
    center: {
      x: r.left + r.width / 2 - rect.left,
      y: r.top + r.height / 2 - rect.top,
    },
    h: r.height,
  }));

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1];
    const sameRow =
      Math.abs(a.center.y - b.center.y) < Math.min(a.h, b.h) * 0.6;

    ctx.beginPath();
    if (sameRow) {
      // horizontal elbow
      const midX = (a.right.x + b.left.x) / 2;
      ctx.moveTo(a.right.x, a.right.y);
      ctx.lineTo(midX, a.right.y);
      ctx.lineTo(midX, b.left.y);
      ctx.lineTo(b.left.x, b.left.y);
      ctx.stroke();

      // Arrowhead pointing to b.left
      drawArrowhead(ctx, b.left.x, b.left.y, Math.atan2(0, -1)); // leftwards
    } else {
      // vertical elbow (wrap)
      const midY = (a.bottom.y + b.top.y) / 2;
      ctx.moveTo(a.bottom.x, a.bottom.y);
      ctx.lineTo(a.bottom.x, midY);
      ctx.lineTo(b.top.x, midY);
      ctx.lineTo(b.top.x, b.top.y);
      ctx.stroke();

      // Arrowhead pointing down to b.top
      drawArrowhead(ctx, b.top.x, b.top.y, Math.atan2(1, 0)); // downward
    }
  }
}

function drawArrowhead(ctx, x, y, angle) {
  // Small, subtle arrowhead
  const size = 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2);
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, size / 2);
  ctx.stroke();
  ctx.restore();
}

let raf = 0;
export function drawAllConnectorsQueued(root = document) {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    root.querySelectorAll(".track-wrap").forEach(drawConnectorsFor);
  });
}
