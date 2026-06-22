// Position evaluator for Ultimate Tic Tac Toe
// Returns score from X's perspective: +100 = X wins, -100 = O wins.

import { WIN_PATTERNS, POSITION_WEIGHTS } from './constants.js'

/**
 * Score one set of 9 cells for a given player.
 * Rewards 2-in-a-rows and blocks, penalises opponent equivalents.
 */
function scoreBoard(cells, player) {
  const opp = player === 'X' ? 'O' : 'X'
  let score = 0
  for (const [a, b, c] of WIN_PATTERNS) {
    if (cells[a] === 'tie' || cells[b] === 'tie' || cells[c] === 'tie') continue
    const pc = (cells[a] === player) + (cells[b] === player) + (cells[c] === player)
    const oc = (cells[a] === opp)    + (cells[b] === opp)    + (cells[c] === opp)
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

/**
 * Evaluate the full game state from X's perspective.
 * Clamped to (-99, +99); terminal states return ±100 or 0.
 */
export function evaluatePosition(gameState) {
  const { boards, wonBoards, gameOver, gameWinner } = gameState

  if (gameOver) {
    if (gameWinner === 'X') return 100
    if (gameWinner === 'O') return -100
    return 0
  }

  let score = 0

  // --- Macro-board pattern score (won boards form a meta 3×3) ---
  const metaBoard = wonBoards
  score += scoreBoard(metaBoard, 'X') * 3

  // --- Individual small-board wins with positional weight ---
  for (let i = 0; i < 9; i++) {
    const w = wonBoards[i]
    const wt = POSITION_WEIGHTS[i]
    if (w === 'X')   score += 10 * wt
    else if (w === 'O') score -= 10 * wt
    else if (!w) {
      // Internal board threats
      score += scoreBoard(boards[i], 'X') * 0.3
    }
  }

  // --- Positional bonus for cell occupation in live boards ---
  for (let i = 0; i < 9; i++) {
    if (!wonBoards[i]) {
      for (let j = 0; j < 9; j++) {
        if      (boards[i][j] === 'X') score += POSITION_WEIGHTS[j] * 0.05
        else if (boards[i][j] === 'O') score -= POSITION_WEIGHTS[j] * 0.05
      }
    }
  }

  // --- Active board advantage ---
  const { currentPlayer, activeBoard } = gameState
  let activeAdvantage = 0

  if (activeBoard === null) {
    activeAdvantage = 15 // Free move anywhere
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

/**
 * Normalise score to [0, 1] for the UI bar.
 * 0.5 = equal, >0.5 = X favoured, <0.5 = O favoured.
 */
export function normalizeScore(score) {
  return (score + 100) / 200
}
