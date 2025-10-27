export let GRID = 20
export const setGrid = v => GRID = v
export const snap = (v, g = GRID) => Math.round(v / g) * g
