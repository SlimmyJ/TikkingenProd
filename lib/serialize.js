export function saveState({ board, timelineY, segmentColorMap, grid }) {
  const w = board.clientWidth, h = board.clientHeight
  const g = Number(grid) || 20

  const nodes = Array.from(board.querySelectorAll('.node')).map((n, idx) => {
    const x = parseFloat(n.style.left || '0')
    const y = parseFloat(n.style.top  || '0')
    const dy = (timelineY != null) ? (y - Number(timelineY)) : null
    return {
      id: Number(n.dataset.id),
      type: n.dataset.type,
      x, y,
      fx: w ? x / w : null,             // keeps column alignment when width changes
      dy,                                // pixel delta from baseline (kept for v3 compat)
      dyUnits: (dy != null) ? Math.round(dy / g) : null, // grid units — makes stacks precise
      order: idx
    }
  })

  const key = v => Math.round((v * 100000) || 0)
  const fxKeys = [...new Set(nodes.map(n => key(n.fx || 0)))].sort((a,b)=>a-b)
  const columnsFx = fxKeys.map(k => k / 100000)
  nodes.forEach(n => { n.col = fxKeys.indexOf(key(n.fx || 0)) })

  const segments = {}
  segmentColorMap.forEach((v, k) => { segments[k] = v })

  return {
    version: 5,
    grid: g,
    timelineY,
    boardSize: { w, h },
    columnsFx,
    nodes,
    segments
  }
}

export function loadState(
  state,
  { board, setGridValue, setTimeline, setSegmentColorMap, addNode, draw },
  { scaleToBoard = true, disableSnapDuringImport = true } = {}
) {
  board.querySelectorAll('.node').forEach(n => n.remove())

  if (typeof setGridValue === 'function' && typeof state.grid === 'number') {
    setGridValue(state.grid)
  }
  const g = Number(state.grid) || 20

  if (typeof setTimeline === 'function') {
    setTimeline(state.timelineY ?? null)
  }

  if (typeof setSegmentColorMap === 'function') {
    setSegmentColorMap(new Map(Object.entries(state.segments || {})))
  }

  let scaleX = 1, scaleY = 1
  if (scaleToBoard && state.boardSize && state.boardSize.w && state.boardSize.h) {
    scaleX = board.clientWidth  / state.boardSize.w
    scaleY = board.clientHeight / state.boardSize.h
  }

  const cols = Array.isArray(state.columnsFx) ? state.columnsFx : null
  const restoreSnap = disableSnapDuringImport ? toggleSnap(false) : null

  const list = Array.isArray(state.nodes) ? [...state.nodes] : []
  list.sort((a,b) => (a.order ?? 0) - (b.order ?? 0))

  list.forEach(nd => {
    let x
    if (cols && typeof nd.col === 'number' && cols[nd.col] != null) {
      x = Math.round(cols[nd.col] * board.clientWidth)
    } else if (typeof nd.fx === 'number' && isFinite(nd.fx)) {
      x = Math.round(nd.fx * board.clientWidth)
    } else {
      x = Math.round((nd.x || 0) * scaleX)
    }

    const baseY = state.timelineY ?? 0
    let y
    if (Number.isFinite(nd.dyUnits)) {
      y = baseY + (nd.dyUnits * g)           // STRICT grid-based vertical alignment
    } else if (Number.isFinite(nd.dy) && state.timelineY != null) {
      y = Math.round(baseY + nd.dy * scaleY) // legacy v3 path
    } else {
      y = Math.round((nd.y || 0) * scaleY)
    }

    const node = addNode(nd.type, x, y)
    if (nd.id != null) node.dataset.id = String(nd.id)
  })

  if (typeof draw === 'function') draw()
  if (restoreSnap) restoreSnap()
}

function toggleSnap(enabled) {
  const cb = document.getElementById('snapToggle')
  if (!cb) return null
  const prev = cb.checked
  cb.checked = !!enabled
  return () => { cb.checked = prev }
}
