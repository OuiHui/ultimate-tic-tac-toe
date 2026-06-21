import { useEffect, useRef, useState } from 'react'
import { getBotMove } from '../utils/botEngine'

/**
 * Triggers the bot to make a move whenever it is the bot's turn.
 *
 * @param {object}            gameState    - live game state from useSuperTicTacToe
 * @param {string}            gameMode     - 'local' | 'bot' | 'online'
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {'X'|'O'}           botPlayer    - which colour the bot plays
 * @param {Function}          makeMove     - (boardIndex, cellIndex) => void
 * @returns {{ isThinking: boolean }}
 */
export function useBot(gameState, gameMode, difficulty, botPlayer, makeMove) {
  const [isThinking, setIsThinking] = useState(false)

  // Keep a stable ref to the latest state so the setTimeout closure isn't stale
  const stateRef = useRef(gameState)
  stateRef.current = gameState

  // Keep a ref to the latest makeMove to avoid stale closures
  const makeMoveRef = useRef(makeMove)
  makeMoveRef.current = makeMove

  // Guard: prevent double-triggering
  const thinkingRef = useRef(false)

  useEffect(() => {
    if (gameMode !== 'bot') return
    if (gameState.gameOver) return
    if (gameState.currentPlayer !== botPlayer) return
    if (thinkingRef.current) return

    thinkingRef.current = true
    setIsThinking(true)

    // Delay gives React a frame to render before the synchronous minimax runs
    const id = setTimeout(() => {
      const move = getBotMove(stateRef.current, difficulty, botPlayer)
      if (move) {
        makeMoveRef.current(move.boardIndex, move.cellIndex)
      }
      thinkingRef.current = false
      setIsThinking(false)
    }, 450)

    return () => {
      clearTimeout(id)
      // Do NOT reset thinkingRef here — if the effect re-fires due to fast
      // re-renders before the timeout fires, we don't want a double move.
    }
  }, [
    gameMode,
    gameState.currentPlayer,
    gameState.gameOver,
    botPlayer,
    difficulty,
  ])

  return { isThinking }
}
