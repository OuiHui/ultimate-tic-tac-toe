// Web Worker: runs minimax / getBotMove off the main thread.
// Receives: { type: 'BOT_MOVE' | 'HINT', gameState, difficulty, botPlayer }
// Posts back: { type: ..., move: { boardIndex, cellIndex } | null }

import { WIN_PATTERNS, POSITION_WEIGHTS } from './constants.js'

// ── Inline copies of the pure-JS engine (no React imports) ───────────────────

function checkWinner(cells) {
  for (const [a, b, c] of WIN_PATTERNS) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a]
  }
  return cells.every(c => c !== '') ? 'tie' : ''
}

function scoreBoard(cells, player) {
  const opp = player === 'X' ? 'O' : 'X'
  let score = 0
  for (const [a, b, c] of WIN_PATTERNS) {
    if (cells[a] === 'tie' || cells[b] === 'tie' || cells[c] === 'tie') continue
    const pc = (cells[a] === player) + (cells[b] === player) + (cells[c] === player)
    const oc = (cells[a] === opp) + (cells[b] === opp) + (cells[c] === opp)
    if (oc === 0) {
      if (pc === 2) score += 10
      else if (pc === 1) score += 2
    }
    if (pc === 0) {
      if (oc === 2) score -= 10
      else if (oc === 1) score -= 2
    }
  }
  return score
}

function evaluatePosition(gameState, depth = 0) {
  const { boards, wonBoards, gameOver, gameWinner } = gameState
  if (gameOver) {
    if (gameWinner === 'X') return 100 + depth
    if (gameWinner === 'O') return -100 - depth
    return 0
  }
  let score = 0
  const metaBoard = wonBoards
  score += scoreBoard(metaBoard, 'X') * 3
  for (let i = 0; i < 9; i++) {
    const w = wonBoards[i]
    const wt = POSITION_WEIGHTS[i]
    if (w === 'X') score += 10 * wt
    else if (w === 'O') score -= 10 * wt
    else if (!w) score += scoreBoard(boards[i], 'X') * 0.3
  }
  for (let i = 0; i < 9; i++) {
    if (!wonBoards[i]) {
      for (let j = 0; j < 9; j++) {
        if (boards[i][j] === 'X') score += POSITION_WEIGHTS[j] * 0.05
        else if (boards[i][j] === 'O') score -= POSITION_WEIGHTS[j] * 0.05
      }
    }
  }
  const { currentPlayer, activeBoard } = gameState
  let activeAdvantage = 0
  if (activeBoard === null) {
    activeAdvantage = 15
  } else {
    activeAdvantage = POSITION_WEIGHTS[activeBoard] * 1.5
    activeAdvantage += scoreBoard(boards[activeBoard], currentPlayer) * 0.2
  }
  if (currentPlayer === 'X') {
    score += activeAdvantage
  } else {
    score -= activeAdvantage
  }
  return Math.max(-99, Math.min(99, score))
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

function applyMove(state, boardIndex, cellIndex) {
  const player = state.currentPlayer
  const newBoards = state.boards.map((board, bi) =>
    bi === boardIndex
      ? board.map((cell, ci) => (ci === cellIndex ? player : cell))
      : board
  )
  const newWonBoards = [...state.wonBoards]
  const localResult = checkWinner(newBoards[boardIndex])
  if (localResult) newWonBoards[boardIndex] = localResult
  const metaResult = checkWinner(newWonBoards.map(w => (w === 'tie' ? '' : w)))
  const allDone = newWonBoards.every(w => w !== '')
  const gameOver = !!(metaResult) || allDone
  const gameWinner = metaResult && metaResult !== 'tie'
    ? metaResult : allDone ? 'tie' : ''
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

// ─── Transposition Table ──────────────────────────────────────────────────────
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
// Prioritises: TT best move → winning a local board → blocking opponent win → cell weight
function scoreMoveHeuristic(state, move, ttBestMove) {
  if (ttBestMove &&
      move.boardIndex === ttBestMove.boardIndex &&
      move.cellIndex === ttBestMove.cellIndex) return 1000

  const { boardIndex: bi, cellIndex: ci } = move
  const board = state.boards[bi]
  const player = state.currentPlayer
  const opp = player === 'X' ? 'O' : 'X'

  // Simulate placing the piece
  const next = board.map((c, i) => (i === ci ? player : c))
  if (checkWinner(next) === player) return 500   // wins this local board
  const nextOpp = board.map((c, i) => (i === ci ? opp : c))
  if (checkWinner(nextOpp) === opp) return 400   // blocks opponent's local win (detect via hypothetical opp move)

  return POSITION_WEIGHTS[ci]
}

function orderMoves(state, moves, ttBestMove) {
  return moves
    .map(m => ({ m, score: scoreMoveHeuristic(state, m, ttBestMove) }))
    .sort((a, b) => b.score - a.score)
    .map(({ m }) => m)
}

// ── Minimax with alpha-beta + TT ─────────────────────────────────────────────
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

// ── Fixed-depth search (bot moves & hints) ────────────────────────────────────
const DEPTHS = { easy: 1, medium: 3, hard: 8 }

function getBotMove(gameState, difficulty, botPlayer) {
  transpositionTable.clear()
  const moves = getLegalMoves(gameState)
  if (!moves.length) return null
  const depth = DEPTHS[difficulty] ?? 1
  const botMaximizes = botPlayer === 'X'
  let bestMove = moves[0]
  let bestScore = botMaximizes ? -Infinity : Infinity
  for (const move of moves) {
    const child = applyMove(gameState, move.boardIndex, move.cellIndex)
    const score = depth <= 1
      ? evaluatePosition(child, depth)
      : minimax(child, depth - 1, -Infinity, Infinity)
    if (botMaximizes ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = move
    }
  }
  return bestMove
}

function getBestMoves(gameState, difficulty, botPlayer) {
  transpositionTable.clear()
  const moves = getLegalMoves(gameState)
  if (!moves.length) return []
  const depth = DEPTHS[difficulty] ?? 1
  const botMaximizes = botPlayer === 'X'
  let bestScore = botMaximizes ? -Infinity : Infinity
  let bestMoves = []
  for (const move of moves) {
    const child = applyMove(gameState, move.boardIndex, move.cellIndex)
    const score = depth <= 1
      ? evaluatePosition(child, depth)
      : minimax(child, depth - 1, -Infinity, Infinity)
    if (botMaximizes) {
      if (score > bestScore) { bestScore = score; bestMoves = [move] }
      else if (score === bestScore) bestMoves.push(move)
    } else {
      if (score < bestScore) { bestScore = score; bestMoves = [move] }
      else if (score === bestScore) bestMoves.push(move)
    }
  }
  return bestMoves
}

// ── Streaming iterative-deepening evaluation (Lichess-style) ─────────────────
// Posts EVAL_UPDATE after each depth starting at depth 1, and immediately for terminal states.
const MIN_DISPLAY_DEPTH = 1
const MAX_EVAL_DEPTH = 12
const EVAL_TIME_LIMIT_MS = 4500

function runStreamingEval(gameState) {
  if (transpositionTable.size > 50000) {
    transpositionTable.clear()
  }
  const startTime = Date.now()

  for (let depth = 1; depth <= MAX_EVAL_DEPTH; depth++) {
    if (Date.now() - startTime > EVAL_TIME_LIMIT_MS) break

    const score = minimax(gameState, depth, -Infinity, Infinity)

    if (depth >= MIN_DISPLAY_DEPTH || Math.abs(score) >= 100) {
      self.postMessage({ type: 'EVAL_UPDATE', score, depth })
    }

    if (Math.abs(score) >= 100) break
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
self.onmessage = (e) => {
  const { type, gameState, difficulty, botPlayer } = e.data
  if (type === 'HINT') {
    const moves = getBestMoves(gameState, difficulty, botPlayer)
    self.postMessage({ type, moves })
  } else if (type === 'EVALUATE') {
    runStreamingEval(gameState)
  } else {
    const move = getBotMove(gameState, difficulty, botPlayer)
    self.postMessage({ type, move })
  }
}
