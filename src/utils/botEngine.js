// Bot engine: pure game-logic minimax with alpha-beta pruning.
// No React state — works on plain JS objects mirroring the game hook's state shape.

import { evaluatePosition } from './evaluator.js'

import { WIN_PATTERNS } from './constants.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function checkWinner(cells) {
  for (const [a, b, c] of WIN_PATTERNS) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]
  }
  return cells.every(c => c !== '') ? 'tie' : ''
}

function getLegalMoves(state) {
  if (state.gameOver) return []
  const { boards, wonBoards, activeBoard } = state
  const moves = []
  for (let bi = 0; bi < 9; bi++) {
    if (wonBoards[bi]) continue
    if (activeBoard !== null && activeBoard !== bi) continue
    for (let ci = 0; ci < 9; ci++) {
      if (!boards[bi][ci]) moves.push({ boardIndex: bi, cellIndex: ci })
    }
  }
  return moves
}

/**
 * Pure apply-move: returns a new state object without touching React.
 */
function applyMove(state, boardIndex, cellIndex) {
  const player = state.currentPlayer

  // Update boards
  const newBoards = state.boards.map((board, bi) =>
    bi === boardIndex
      ? board.map((cell, ci) => (ci === cellIndex ? player : cell))
      : board
  )

  // Update won boards
  const newWonBoards = [...state.wonBoards]
  const localResult = checkWinner(newBoards[boardIndex])
  if (localResult) newWonBoards[boardIndex] = localResult

  // Check overall game result
  const metaResult = checkWinner(newWonBoards.map(w => (w === 'tie' ? '' : w)))
  const allDone = newWonBoards.every(w => w !== '')
  const gameOver = !!(metaResult) || allDone
  const gameWinner =
    metaResult && metaResult !== 'tie'
      ? metaResult
      : allDone
        ? 'tie'
        : ''

  // Determine next active board
  let nextActive = null
  if (!gameOver) {
    const target = cellIndex
    if (!newWonBoards[target] && newBoards[target].some(c => !c)) {
      nextActive = target
    }
  }

  return {
    boards: newBoards,
    wonBoards: newWonBoards,
    currentPlayer: player === 'X' ? 'O' : 'X',
    activeBoard: nextActive,
    gameWinner,
    gameOver,
    gameStarted: true,
    playerXTime: state.playerXTime,
    playerOTime: state.playerOTime,
  }
}

// ─── Transposition Table & Search Optimization ────────────────────────────────
const EXACT = 0
const LOWERBOUND = 1
const UPPERBOUND = 2
const transpositionTable = new Map()

function getGameStateKey(state) {
  let boardStr = ''
  for (let bi = 0; bi < 9; bi++) {
    for (let ci = 0; ci < 9; ci++) {
      const cell = state.boards[bi][ci]
      boardStr += cell === 'X' ? 'X' : cell === 'O' ? 'O' : '.'
    }
  }
  const activeStr = state.activeBoard === null ? 'N' : state.activeBoard
  return `${boardStr}|${state.currentPlayer}|${activeStr}`
}

function minimax(state, depth, alpha, beta) {
  const originalAlpha = alpha
  const key = getGameStateKey(state)

  if (transpositionTable.has(key)) {
    const entry = transpositionTable.get(key)
    if (entry.depth >= depth) {
      if (entry.flag === EXACT) {
        return entry.score
      } else if (entry.flag === LOWERBOUND) {
        alpha = Math.max(alpha, entry.score)
      } else if (entry.flag === UPPERBOUND) {
        beta = Math.min(beta, entry.score)
      }
      if (alpha >= beta) {
        return entry.score
      }
    }
  }

  if (state.gameOver || depth === 0) return evaluatePosition(state, depth)

  const moves = getLegalMoves(state)
  if (!moves.length) return evaluatePosition(state, depth)

  let cachedBestMove = null
  if (transpositionTable.has(key)) {
    cachedBestMove = transpositionTable.get(key).bestMove
  }

  if (cachedBestMove) {
    moves.sort((a, b) => {
      const aIsBest = a.boardIndex === cachedBestMove.boardIndex && a.cellIndex === cachedBestMove.cellIndex
      const bIsBest = b.boardIndex === cachedBestMove.boardIndex && b.cellIndex === cachedBestMove.cellIndex
      return bIsBest - aIsBest
    })
  }

  const maximizing = state.currentPlayer === 'X'
  let bestVal = maximizing ? -Infinity : Infinity
  let bestMove = null

  if (maximizing) {
    for (const move of moves) {
      const child = applyMove(state, move.boardIndex, move.cellIndex)
      const val = minimax(child, depth - 1, alpha, beta)
      if (val > bestVal) {
        bestVal = val
        bestMove = move
      }
      alpha = Math.max(alpha, bestVal)
      if (beta <= alpha) break
    }
  } else {
    for (const move of moves) {
      const child = applyMove(state, move.boardIndex, move.cellIndex)
      const val = minimax(child, depth - 1, alpha, beta)
      if (val < bestVal) {
        bestVal = val
        bestMove = move
      }
      beta = Math.min(beta, bestVal)
      if (beta <= alpha) break
    }
  }

  let flag = EXACT
  if (bestVal <= originalAlpha) {
    flag = UPPERBOUND
  } else if (bestVal >= beta) {
    flag = LOWERBOUND
  }

  transpositionTable.set(key, {
    depth,
    score: bestVal,
    flag,
    bestMove
  })

  return bestVal
}

// ─── Public API ──────────────────────────────────────────────────────────────
const DEPTHS = { easy: 1, medium: 3, hard: 8 }

export function getBotMove(gameState, difficulty, botPlayer) {
  transpositionTable.clear()
  const moves = getLegalMoves(gameState)
  if (!moves.length) return null

  const depth = DEPTHS[difficulty] ?? 1
  const botMaximizes = botPlayer === 'X'

  let bestMove = moves[0]
  let bestScore = botMaximizes ? -Infinity : Infinity

  for (const move of moves) {
    const child = applyMove(gameState, move.boardIndex, move.cellIndex)
    const score =
      depth <= 1
        ? evaluatePosition(child, depth)
        : minimax(child, depth - 1, -Infinity, Infinity)

    if (botMaximizes ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}

export function getBestMoves(gameState, difficulty, botPlayer) {
  transpositionTable.clear()
  const moves = getLegalMoves(gameState)
  if (!moves.length) return []

  const depth = DEPTHS[difficulty] ?? 1
  const botMaximizes = botPlayer === 'X'

  let bestScore = botMaximizes ? -Infinity : Infinity
  let bestMoves = []

  for (const move of moves) {
    const child = applyMove(gameState, move.boardIndex, move.cellIndex)
    const score =
      depth <= 1
        ? evaluatePosition(child, depth)
        : minimax(child, depth - 1, -Infinity, Infinity)

    if (botMaximizes) {
      if (score > bestScore) {
        bestScore = score
        bestMoves = [move]
      } else if (score === bestScore) {
        bestMoves.push(move)
      }
    } else {
      if (score < bestScore) {
        bestScore = score
        bestMoves = [move]
      } else if (score === bestScore) {
        bestMoves.push(move)
      }
    }
  }

  return bestMoves
}

export function getBestMoveScore(gameState) {
  transpositionTable.clear()
  let depth = 1
  let bestScore = 0
  const startTime = Date.now()
  const TIME_LIMIT = 150
  
  while (depth <= 12) {
    const elapsed = Date.now() - startTime
    if (elapsed > TIME_LIMIT && depth > 6) {
      break
    }
    
    const score = minimax(gameState, depth, -Infinity, Infinity)
    bestScore = score
    
    if (Math.abs(bestScore) >= 100) {
      break
    }
    depth++
  }
  return bestScore
}

export function evaluateAllMoves(gameState, difficulty = 'hard', botPlayer) {
  transpositionTable.clear()
  const moves = getLegalMoves(gameState)
  if (!moves.length) return []

  const depth = DEPTHS[difficulty] ?? 4
  const player = botPlayer || gameState.currentPlayer

  const moveEvaluations = []
  for (const move of moves) {
    const child = applyMove(gameState, move.boardIndex, move.cellIndex)
    const rawScore = child.gameOver
      ? evaluatePosition(child, depth)
      : depth <= 1
        ? evaluatePosition(child, depth)
        : minimax(child, depth - 1, -Infinity, Infinity)

    const score = player === 'X' ? rawScore : -rawScore
    moveEvaluations.push({ move, score, rawScore })
  }

  return moveEvaluations
}

