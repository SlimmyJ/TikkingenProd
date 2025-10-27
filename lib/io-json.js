import { saveState, loadState } from './serialize.js'

export function wireJsonExport(btn, deps) {
  btn?.addEventListener('click', () => {
    const data = saveState(deps)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'designer.json'
    a.click()
  })
}

export function wireJsonImport(btn, input, deps) {
  btn?.addEventListener('click', () => input?.click())
  input?.addEventListener('change', async e => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      loadState(data, deps)
      deps.draw() // e.g. redraw timeline after load
    } catch (err) {
      console.error(err)
      alert('Kon JSON niet laden.')
    } finally {
      e.target.value = ''
    }
  })
}
