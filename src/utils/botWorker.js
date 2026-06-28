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

function minimax(state, depth, alpha, beta) {
  if (state.gameOver || depth === 0) return evaluatePosition(state, depth)
  const moves = getLegalMoves(state)
  if (!moves.length) return evaluatePosition(state, depth)
  const maximizing = state.currentPlayer === 'X'
  if (maximizing) {
    let best = -Infinity
    for (const { boardIndex, cellIndex } of moves) {
      const val = minimax(applyMove(state, boardIndex, cellIndex), depth - 1, alpha, beta)
      if (val > best) best = val
      if (val > alpha) alpha = val
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const { boardIndex, cellIndex } of moves) {
      const val = minimax(applyMove(state, boardIndex, cellIndex), depth - 1, alpha, beta)
      if (val < best) best = val
      if (val < beta) beta = val
      if (beta <= alpha) break
    }
    return best
  }
}

const DEPTHS = { easy: 1, medium: 3, hard: 8 }

function getBotMove(gameState, difficulty, botPlayer) {
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

function getBestMoveScore(gameState) {
  return minimax(gameState, 8, -Infinity, Infinity)
}

// ── Message handler ───────────────────────────────────────────────────────────
self.onmessage = (e) => {
  const { type, gameState, difficulty, botPlayer } = e.data
  if (type === 'HINT') {
    const moves = getBestMoves(gameState, difficulty, botPlayer)
    self.postMessage({ type, moves })
  } else if (type === 'EVALUATE') {
    const score = getBestMoveScore(gameState)
    self.postMessage({ type, score })
  } else {
    const move = getBotMove(gameState, difficulty, botPlayer)
    self.postMessage({ type, move })
  }
}
