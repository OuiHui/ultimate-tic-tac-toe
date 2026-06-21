// Web Worker: runs minimax / getBotMove off the main thread.
// Receives: { type: 'BOT_MOVE' | 'HINT', gameState, difficulty, botPlayer }
// Posts back: { type: ..., move: { boardIndex, cellIndex } | null }

// ── Inline copies of the pure-JS engine (no React imports) ───────────────────

const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

const POSITION_WEIGHTS = [2, 1, 2, 1, 3, 1, 2, 1, 2]

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

function evaluatePosition(gameState) {
  const { boards, wonBoards, gameOver, gameWinner } = gameState
  if (gameOver) {
    if (gameWinner === 'X') return 100
    if (gameWinner === 'O') return -100
    return 0
  }
  let score = 0
  const metaBoard = wonBoards.map(w => (w === 'tie' ? '' : w))
  score += scoreBoard(metaBoard, 'X') * 3
  for (let i = 0; i < 9; i++) {
    const w = wonBoards[i]
    const wt = POSITION_WEIGHTS[i]
    if (w === 'X')        score += 10 * wt
    else if (w === 'O')   score -= 10 * wt
    else if (!w)          score += scoreBoard(boards[i], 'X') * 0.3
  }
  for (let i = 0; i < 9; i++) {
    if (!wonBoards[i]) {
      for (let j = 0; j < 9; j++) {
        if      (boards[i][j] === 'X') score += POSITION_WEIGHTS[j] * 0.1
        else if (boards[i][j] === 'O') score -= POSITION_WEIGHTS[j] * 0.1
      }
    }
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
  if (state.gameOver || depth === 0) return evaluatePosition(state)
  const moves = getLegalMoves(state)
  if (!moves.length) return evaluatePosition(state)
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

const DEPTHS = { easy: 1, medium: 3, hard: 5 }

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
      ? evaluatePosition(child)
      : minimax(child, depth - 1, -Infinity, Infinity)
    if (botMaximizes ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = move
    }
  }
  return bestMove
}

// ── Message handler ───────────────────────────────────────────────────────────
self.onmessage = (e) => {
  const { type, gameState, difficulty, botPlayer } = e.data
  const move = getBotMove(gameState, difficulty, botPlayer)
  self.postMessage({ type, move })
}
