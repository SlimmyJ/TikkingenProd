export function attachNoteDrag(el, board, handleSelector = null, snap, snapEnabled, onMove) {
  const handle = handleSelector ? el.querySelector(handleSelector) : el
  if (!handle) return
  let start = null

  const getPoint = (e) => {
    const rect = board.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onMoveFn = (e) => {
    if (!start) return
    const p = getPoint(e)
    let nx = start.left + (p.x - start.x)
    let ny = start.top  + (p.y - start.y)
    if (snapEnabled && snapEnabled()) { nx = snap(nx); ny = snap(ny) }
    nx = Math.max(0, Math.min(nx, board.clientWidth  - el.offsetWidth))
    ny = Math.max(0, Math.min(ny, board.clientHeight - el.offsetHeight))
    el.style.left = `${nx}px`
    el.style.top  = `${ny}px`
    onMove && onMove()
  }

  const onUp = () => {
    (handle || el).style.cursor = 'grab'
    window.removeEventListener('pointermove', onMoveFn)
    start = null
    onMove && onMove()
  }

  const onDown = (e) => {
    if (e.button !== 0) return
    ;(handle || el).style.cursor = 'grabbing'
    const p  = getPoint(e)
    const r  = el.getBoundingClientRect()
    const br = board.getBoundingClientRect()
    start = { x: p.x, y: p.y, left: r.left - br.left, top: r.top - br.top }
    window.addEventListener('pointermove', onMoveFn)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  handle.addEventListener('pointerdown', onDown)
  return () => handle.removeEventListener('pointerdown', onDown)
}
