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

// ─── Minimax with alpha-beta pruning ─────────────────────────────────────────
// isMaximizing is derived from state.currentPlayer so we don't need to pass it.
function minimax(state, depth, alpha, beta) {
  if (state.gameOver || depth === 0) return evaluatePosition(state)

  const moves = getLegalMoves(state)
  if (!moves.length) return evaluatePosition(state)

  const maximizing = state.currentPlayer === 'X'

  if (maximizing) {
    let best = -Infinity
    for (const { boardIndex, cellIndex } of moves) {
      const child = applyMove(state, boardIndex, cellIndex)
      const val = minimax(child, depth - 1, alpha, beta)
      if (val > best) best = val
      if (val > alpha) alpha = val
      if (beta <= alpha) break // β cut-off
    }
    return best
  } else {
    let best = Infinity
    for (const { boardIndex, cellIndex } of moves) {
      const child = applyMove(state, boardIndex, cellIndex)
      const val = minimax(child, depth - 1, alpha, beta)
      if (val < best) best = val
      if (val < beta) beta = val
      if (beta <= alpha) break // α cut-off
    }
    return best
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
const DEPTHS = { easy: 1, medium: 3, hard: 8 }

/**
 * Returns the best move for the bot.
 * @param {object} gameState  - current game state from the React hook
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {'X'|'O'} botPlayer - which colour the bot plays
 * @returns {{ boardIndex: number, cellIndex: number } | null}
 */
export function getBotMove(gameState, difficulty, botPlayer) {
  const moves = getLegalMoves(gameState)
  if (!moves.length) return null

  const depth = DEPTHS[difficulty] ?? 1
  const botMaximizes = botPlayer === 'X'

  let bestMove = moves[0]
  let bestScore = botMaximizes ? -Infinity : Infinity

  for (const move of moves) {
    const child = applyMove(gameState, move.boardIndex, move.cellIndex)

    // depth=1 → evaluate the child directly (greedy / best-immediate-move)
    const score =
      depth <= 1
        ? evaluatePosition(child)
        : minimax(child, depth - 1, -Infinity, Infinity)

    if (botMaximizes ? score > bestScore : score < bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}

/**
 * Returns all moves sharing the best evaluation score.
 *
 * @param {object} gameState - current game state
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {'X'|'O'} botPlayer - player to optimize for
 * @returns {Array<{boardIndex: number, cellIndex: number}>}
 */
export function getBestMoves(gameState, difficulty, botPlayer) {
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
        ? evaluatePosition(child)
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

/**
 * Returns the evaluation score of the current state under the assumption
 * that both players play optimally (minimax search to depth 8).
 *
 * @param {object} gameState - current game state
 * @returns {number} score from X's perspective (-100 … +100)
 */
export function getBestMoveScore(gameState) {
  return minimax(gameState, 8, -Infinity, Infinity)
}
