const S = new Set()

export function select(node) {
  if (!S.has(node)) {
    S.add(node)
    node.classList.add('selected')
  }
}

export function deselect(node) {
  if (S.has(node)) {
    S.delete(node)
    node.classList.remove('selected')
  }
}

export function toggle(node) {
  if (S.has(node)) {
    S.delete(node)
    node.classList.remove('selected')
  } else {
    S.add(node)
    node.classList.add('selected')
  }
}

export function clear() {
  S.forEach(n => n.classList.remove('selected'))
  S.clear()
}

export function isSelected(node) { return S.has(node) }
export function getSelected() { return Array.from(S) }
export function count() { return S.size }
