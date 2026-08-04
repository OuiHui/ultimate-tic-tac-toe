// Blunder Analyzer for Ultimate Tic Tac Toe
import { evaluatePosition } from './evaluator.js'
import { evaluateAllMoves } from './botEngine.js'

/**
 * Returns evaluation score from the given player's perspective.
 */
function getPlayerScore(gameState, player) {
  const evalX = evaluatePosition(gameState)
  return player === 'X' ? evalX : -evalX
}

/**
 * Fast synchronous analysis of a played move (< 10ms).
 * Compares played move against engine recommended moves derived from depth search.
 * 
 * @param {Object} prevState - Game state before move was made
 * @param {Object} move - { boardIndex, cellIndex } played
 * @param {Object} nextState - Game state after move was made
 * @returns {Object} Analysis result containing classification, evalDelta, and bestMove
 */
export function analyzeMove(prevState, move, nextState, difficulty = 'medium') {
  const player = prevState.currentPlayer

  // Evaluate legal moves at state before move was made using engine search aligned with hint depth
  const moveEvals = evaluateAllMoves(prevState, difficulty, player)

  if (!moveEvals || moveEvals.length === 0) {
    const scoreAfter = getPlayerScore(nextState, player)
    return {
      classification: 'BEST',
      evalDelta: 0,
      scoreAfter,
      bestMove: move,
      isBlunder: false,
    }
  }

  // Sort move evaluations descending (best engine move for player comes first)
  moveEvals.sort((a, b) => b.score - a.score)

  const topEval = moveEvals[0]
  const bestScore = topEval.score

  // Top moves are moves that tie for bestScore (within 0.5 pts)
  const topBestMoves = moveEvals.filter(item => bestScore - item.score <= 0.5).map(item => item.move)
  const topBestMove = topBestMoves[0]

  const isPlayedMoveBest = topBestMoves.some(
    bm => bm.boardIndex === move.boardIndex && bm.cellIndex === move.cellIndex
  )

  // Find evaluation of played move
  const playedEvalObj = moveEvals.find(
    item => item.move.boardIndex === move.boardIndex && item.move.cellIndex === move.cellIndex
  )

  const playedScore = playedEvalObj ? playedEvalObj.score : getPlayerScore(nextState, player)
  const evalDelta = Math.max(0, Math.round(bestScore - playedScore))

  let classification = 'GOOD'
  let isBlunder = false

  if (isPlayedMoveBest) {
    classification = 'BEST'
  } else if (evalDelta >= 25 || (bestScore >= -10 && playedScore <= -40) || playedScore <= -90) {
    classification = 'BLUNDER'
    isBlunder = true
  } else if (evalDelta >= 11) {
    classification = 'MISTAKE'
  } else if (evalDelta >= 4) {
    classification = 'INACCURACY'
  } else {
    classification = 'GOOD'
  }

  return {
    classification,
    evalDelta,
    scoreAfter: Math.round(playedScore),
    bestMove: topBestMove,
    isBlunder,
  }
}



