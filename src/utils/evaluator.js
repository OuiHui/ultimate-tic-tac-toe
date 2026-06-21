// Position evaluator for Ultimate Tic Tac Toe
// Returns score from X's perspective: +100 = X wins, -100 = O wins.

const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
]

// Center > corners > edges
const POSITION_WEIGHTS = [2, 1, 2, 1, 3, 1, 2, 1, 2]

/**
 * Score one set of 9 cells for a given player.
 * Rewards 2-in-a-rows and blocks, penalises opponent equivalents.
 */
function scoreBoard(cells, player) {
  const opp = player === 'X' ? 'O' : 'X'
  let score = 0
  for (const [a, b, c] of WIN_PATTERNS) {
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
  const metaBoard = wonBoards.map(w => (w === 'tie' ? '' : w))
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
        if      (boards[i][j] === 'X') score += POSITION_WEIGHTS[j] * 0.1
        else if (boards[i][j] === 'O') score -= POSITION_WEIGHTS[j] * 0.1
      }
    }
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
