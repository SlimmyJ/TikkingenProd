export function getNodeCenter(n) {
  const x = parseFloat(n.style.left) + n.offsetWidth / 2
  const y = parseFloat(n.style.top) + n.offsetHeight / 2
  return { x, y }
}

export function nodeCentersSorted(board) {
  const arr = Array.from(board.querySelectorAll('.node')).map(n => {
    const { x, y } = getNodeCenter(n)
    return { x, y, el: n, id: Number(n.dataset.id) }
  })
  arr.sort((a,b) => a.x - b.x)
  return arr
}

export function computeBaselineY(board, snap) {
  const pts = nodeCentersSorted(board)
  if (pts.length >= 2) {
    const left = pts[0]
    const right = pts[pts.length - 1]
    return snap((left.y + right.y) / 2)
  }
  return snap(board.clientHeight * 0.65)
}
