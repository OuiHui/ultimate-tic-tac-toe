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

export const GRID_ALGEBRAIC_BOARD = [
  'A1', 'B1', 'C1',
  'A2', 'B2', 'C2',
  'A3', 'B3', 'C3'
]

export const GRID_ALGEBRAIC_CELL = [
  'a1', 'b1', 'c1',
  'a2', 'b2', 'c2',
  'a3', 'b3', 'c3'
]

/**
 * Returns formatted notation based on selected style:
 * - 'full': "Top-Left → Center"
 * - 'algebraic': "A1 → b2"
 * - 'numeric': "Board 1 → Cell 5"
 * - 'short': "TL → C"
 */
export function formatMoveNotation(boardIndex, cellIndex, style = 'full') {
  if (boardIndex == null || cellIndex == null) return ''

  switch (style) {
    case 'algebraic': {
      const b = GRID_ALGEBRAIC_BOARD[boardIndex] ?? `B${boardIndex + 1}`
      const c = GRID_ALGEBRAIC_CELL[cellIndex] ?? `c${cellIndex + 1}`
      return `${b} → ${c}`
    }
    case 'numeric': {
      return `Board ${boardIndex + 1} → Cell ${cellIndex + 1}`
    }
    case 'short': {
      const b = GRID_NAMES_SHORT[boardIndex] ?? `B${boardIndex + 1}`
      const c = GRID_NAMES_SHORT[cellIndex] ?? `C${cellIndex + 1}`
      return `${b} → ${c}`
    }
    case 'full':
    default: {
      const b = GRID_NAMES_LONG[boardIndex] ?? `Board ${boardIndex + 1}`
      const c = GRID_NAMES_LONG[cellIndex] ?? `Cell ${cellIndex + 1}`
      return `${b} → ${c}`
    }
  }
}

/**
 * Returns short notation for a move, e.g. "C → BR"
 */
export function formatMoveNotationShort(boardIndex, cellIndex) {
  return formatMoveNotation(boardIndex, cellIndex, 'short')
}

/**
 * Returns descriptive notation for a move, e.g. "Center Board → Bottom-Right Cell"
 */
export function formatMoveNotationLong(boardIndex, cellIndex) {
  const b = GRID_NAMES_LONG[boardIndex] ?? `Board ${boardIndex + 1}`
  const c = GRID_NAMES_LONG[cellIndex] ?? `Cell ${cellIndex + 1}`
  return `${b} Board → ${c} Cell`
}

/**
 * Returns detailed object with all notation representations for a board and cell.
 */
export function getBoardCellDetails(boardIndex, cellIndex) {
  const bLong = GRID_NAMES_LONG[boardIndex] ?? `Board ${boardIndex + 1}`
  const cLong = GRID_NAMES_LONG[cellIndex] ?? `Cell ${cellIndex + 1}`
  const bShort = GRID_NAMES_SHORT[boardIndex] ?? `B${boardIndex + 1}`
  const cShort = GRID_NAMES_SHORT[cellIndex] ?? `C${cellIndex + 1}`
  const bAlg = GRID_ALGEBRAIC_BOARD[boardIndex] ?? `B${boardIndex + 1}`
  const cAlg = GRID_ALGEBRAIC_CELL[cellIndex] ?? `c${cellIndex + 1}`

  return {
    boardLong: bLong,
    cellLong: cLong,
    boardShort: bShort,
    cellShort: cShort,
    boardAlg: bAlg,
    cellAlg: cAlg,
    boardNum: boardIndex + 1,
    cellNum: cellIndex + 1,
  }
}
