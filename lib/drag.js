export function attachNodeDrag(node, { board, snap, snapEnabled, onMoveStart, onMove, onMoveEnd }) {
  let s = null
  function down(e) {
    if (e.button !== 0) return
    s = { mx: e.clientX, my: e.clientY, x: parseFloat(node.style.left || '0'), y: parseFloat(node.style.top || '0') }
    onMoveStart && onMoveStart(node)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }
  function move(e) {
    if (!s) return
    let nx = s.x + (e.clientX - s.mx)
    let ny = s.y + (e.clientY - s.my)
    if (snapEnabled && snapEnabled()) { nx = snap(nx); ny = snap(ny) }
    node.style.left = nx + 'px'
    node.style.top  = ny + 'px'
    onMove && onMove(node)
  }
  function up() {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    onMoveEnd && onMoveEnd(node)
    s = null
  }
  node.addEventListener('mousedown', down)
  return () => node.removeEventListener('mousedown', down)
}
