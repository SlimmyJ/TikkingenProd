import { toHex6, loadRecentColors, pushRecentColor } from './colors.js'

export function renderRecentColors(containerEl, onPick, limit = 4) {
  if (!containerEl) return
  containerEl.innerHTML = ''
  const list = loadRecentColors().slice(0, limit)
  list.forEach(c => {
    const b = document.createElement('button')
    b.className = 'color-swatch'
    b.title = c
    b.setAttribute('aria-label', `Use color ${c}`)
    b.style.background = c
    b.addEventListener('click', () => onPick(c))
    containerEl.appendChild(b)
  })
}

export function applySelectionColor(segmentColorMap, selectedKey, color, redraw) {
  if (!selectedKey) return
  segmentColorMap.set(selectedKey, color)
  redraw && redraw()
}

export function selectedColor(segmentColorMap, selectedKey, fallback = '#000000') {
  if (!selectedKey) return fallback
  return toHex6(segmentColorMap.get(selectedKey) || fallback)
}

export function commitRecentColor(hex, rerender) {
  pushRecentColor(hex)
  rerender && rerender()
}