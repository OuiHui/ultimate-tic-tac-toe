// Notation utilities for Ultimate Tic Tac Toe board and cell positions

export const GRID_NAMES_SHORT = [
  'TL', 'TC', 'TR',
  'ML', 'C',  'MR',
  'BL', 'BC', 'BR'
]

export const GRID_NAMES_LONG = [
  'Top-Left',    'Top-Center',    'Top-Right',
  'Mid-Left',    'Center',        'Mid-Right',
  'Bottom-Left', 'Bottom-Center', 'Bottom-Right'
]

/**
 * Returns short notation for a move, e.g. "C → BR"
 */
export function formatMoveNotationShort(boardIndex, cellIndex) {
  const b = GRID_NAMES_SHORT[boardIndex] ?? `B${boardIndex + 1}`
  const c = GRID_NAMES_SHORT[cellIndex] ?? `C${cellIndex + 1}`
  return `${b} → ${c}`
}

/**
 * Returns descriptive notation for a move, e.g. "Center Board → Bottom-Right Cell"
 */
export function formatMoveNotationLong(boardIndex, cellIndex) {
  const b = GRID_NAMES_LONG[boardIndex] ?? `Board ${boardIndex + 1}`
  const c = GRID_NAMES_LONG[cellIndex] ?? `Cell ${cellIndex + 1}`
  return `${b} Board → ${c} Cell`
}
