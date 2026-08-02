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
  let key = ''
  for (let bi = 0; bi < 9; bi++) {
    for (let ci = 0; ci < 9; ci++) {
      const cell = state.boards[bi][ci]
      key += cell === 'X' ? 'X' : cell === 'O' ? 'O' : '.'
    }
  }
  return `${key}|${state.currentPlayer}|${state.activeBoard === null ? 'N' : state.activeBoard}`
}

// ── Heuristic move ordering ───────────────────────────────────────────────────
function scoreMoveHeuristic(state, move, ttBestMove) {
  if (ttBestMove &&
      move.boardIndex === ttBestMove.boardIndex &&
      move.cellIndex === ttBestMove.cellIndex) return 1000

  const { boardIndex: bi, cellIndex: ci } = move
  const board = state.boards[bi]
  const player = state.currentPlayer
  const opp = player === 'X' ? 'O' : 'X'

  const next = board.map((c, i) => (i === ci ? player : c))
  if (checkWinner(next) === player) return 500
  const nextOpp = board.map((c, i) => (i === ci ? opp : c))
  if (checkWinner(nextOpp) === opp) return 400

  return POSITION_WEIGHTS[ci]
}

function orderMoves(state, moves, ttBestMove) {
  return moves
    .map(m => ({ m, score: scoreMoveHeuristic(state, m, ttBestMove) }))
    .sort((a, b) => b.score - a.score)
    .map(({ m }) => m)
}

function minimax(state, depth, alpha, beta) {
  const originalAlpha = alpha
  const key = getGameStateKey(state)

  const cached = transpositionTable.get(key)
  if (cached && cached.depth >= depth) {
    if (cached.flag === EXACT) return cached.score
    if (cached.flag === LOWERBOUND) alpha = Math.max(alpha, cached.score)
    else if (cached.flag === UPPERBOUND) beta = Math.min(beta, cached.score)
    if (alpha >= beta) return cached.score
  }

  if (state.gameOver || depth === 0) return evaluatePosition(state, depth)
  const rawMoves = getLegalMoves(state)
  if (!rawMoves.length) return evaluatePosition(state, depth)

  const ttBestMove = cached?.bestMove ?? null
  const moves = orderMoves(state, rawMoves, ttBestMove)

  const maximizing = state.currentPlayer === 'X'
  let bestVal = maximizing ? -Infinity : Infinity
  let bestMove = null

  for (const move of moves) {
    const child = applyMove(state, move.boardIndex, move.cellIndex)
    const val = minimax(child, depth - 1, alpha, beta)
    if (maximizing) {
      if (val > bestVal) { bestVal = val; bestMove = move }
      alpha = Math.max(alpha, bestVal)
    } else {
      if (val < bestVal) { bestVal = val; bestMove = move }
      beta = Math.min(beta, bestVal)
    }
    if (beta <= alpha) break
  }

  const flag = bestVal <= originalAlpha ? UPPERBOUND : bestVal >= beta ? LOWERBOUND : EXACT
  transpositionTable.set(key, { depth, score: bestVal, flag, bestMove })

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

// Synchronous fallback: used only when Web Worker is unavailable.
// Returns the score at the deepest depth reached within the time limit.
export function getBestMoveScore(gameState) {
  transpositionTable.clear()
  const startTime = Date.now()
  let bestScore = 0
  for (let depth = 1; depth <= 12; depth++) {
    if (Date.now() - startTime > 150 && depth > 4) break
    const score = minimax(gameState, depth, -Infinity, Infinity)
    bestScore = score
    if (Math.abs(score) >= 100) break
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

