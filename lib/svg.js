// lib/svg.js
export function svgLine(x1, y1, x2, y2, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  el.setAttribute('x1', x1); el.setAttribute('y1', y1)
  el.setAttribute('x2', x2); el.setAttribute('y2', y2)
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v)
  return el
}

export function clearOverlay(overlayEl) {
  if (!overlayEl) return
  while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild)
}
