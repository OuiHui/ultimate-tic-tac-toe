// Blunder Analyzer for Ultimate Tic Tac Toe
import { evaluatePosition } from './evaluator.js'
import { getBestMoves } from './botEngine.js'

/**
 * Returns evaluation score from the given player's perspective.
 */
function getPlayerScore(gameState, player) {
  const evalX = evaluatePosition(gameState)
  return player === 'X' ? evalX : -evalX
}

/**
 * Analyzes a move by comparing the evaluation of the played move
 * against the top recommended move available in that turn.
 * 
 * @param {Object} prevState - Game state before move was made
 * @param {Object} move - { boardIndex, cellIndex } played
 * @param {Object} nextState - Game state after move was made
 * @returns {Object} Analysis result containing classification, evalDelta, and bestMove
 */
export function analyzeMove(prevState, move, nextState) {
  const player = prevState.currentPlayer
  const scoreAfter = getPlayerScore(nextState, player)

  // Find top engine moves at hard depth (matching Hint Mode depth)
  const bestMoves = getBestMoves(prevState, 'hard', player)
  if (!bestMoves || bestMoves.length === 0) {
    return {
      classification: 'BEST',
      evalDelta: 0,
      scoreAfter,
      bestMove: move,
      isBlunder: false,
    }
  }

  // Check if played move is one of the top recommended engine moves
  const isPlayedMoveBest = bestMoves.some(
    bm => bm.boardIndex === move.boardIndex && bm.cellIndex === move.cellIndex
  )

  if (isPlayedMoveBest) {
    return {
      classification: 'BEST',
      evalDelta: 0,
      scoreAfter,
      bestMove: move,
      isBlunder: false,
    }
  }

  // Best alternative move
  const topBestMove = bestMoves[0]

  // Compare position evaluation before & after relative to optimal expectation
  const scoreBefore = getPlayerScore(prevState, player)
  const evalDelta = Math.max(0, Math.round(scoreBefore - scoreAfter))

  let classification = 'BEST'
  let isBlunder = false

  if (evalDelta >= 25 || (scoreBefore >= -10 && scoreAfter <= -30)) {
    classification = 'BLUNDER'
    isBlunder = true
  } else if (evalDelta >= 15) {
    classification = 'MISTAKE'
  } else if (evalDelta >= 6) {
    classification = 'INACCURACY'
  } else {
    classification = 'BEST'
  }

  return {
    classification,
    evalDelta,
    scoreAfter,
    bestMove: topBestMove,
    isBlunder,
  }
}
