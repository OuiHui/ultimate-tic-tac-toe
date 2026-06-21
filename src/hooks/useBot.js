import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Triggers the bot to make a move whenever it is the bot's turn.
 * Uses a Web Worker so minimax doesn't block the main thread.
 *
 * @param {object}            gameState    - live game state from useSuperTicTacToe
 * @param {string}            gameMode     - 'local' | 'bot' | 'online'
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {'X'|'O'}           botPlayer    - which colour the bot plays
 * @param {Function}          makeMove     - (boardIndex, cellIndex) => void
 * @returns {{ isThinking: boolean, cancelThink: () => void }}
 */
export function useBot(gameState, gameMode, difficulty, botPlayer, makeMove) {
  const [isThinking, setIsThinking] = useState(false)

  // Keep stable refs to avoid stale closures
  const makeMoveRef = useRef(makeMove)
  makeMoveRef.current = makeMove

  // Guard: prevent double-triggering
  const thinkingRef = useRef(false)

  // Worker instance — created once, reused across turns
  const workerRef = useRef(null)

  // Ref for the startup delay timeout
  const timeoutRef = useRef(null)

  // Initialise worker on mount
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../utils/botWorker.js', import.meta.url),
        { type: 'module' }
      )
    } catch (_) {
      workerRef.current = null
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // Expose a way for the parent to cancel an in-flight think (e.g. on undo)
  const cancelThink = useCallback(() => {
    clearTimeout(timeoutRef.current)
    // Re-create worker to abort any running computation
    if (workerRef.current) {
      workerRef.current.terminate()
      try {
        workerRef.current = new Worker(
          new URL('../utils/botWorker.js', import.meta.url),
          { type: 'module' }
        )
      } catch (_) {
        workerRef.current = null
      }
    }
    thinkingRef.current = false
    setIsThinking(false)
  }, [])

  useEffect(() => {
    if (gameMode !== 'bot') return
    if (gameState.gameOver) return
    if (gameState.currentPlayer !== botPlayer) return
    if (thinkingRef.current) return

    thinkingRef.current = true
    setIsThinking(true)

    const snapshot = { ...gameState }

    if (workerRef.current) {
      const worker = workerRef.current

      const handleMessage = (e) => {
        worker.removeEventListener('message', handleMessage)
        const { move } = e.data
        if (move) makeMoveRef.current(move.boardIndex, move.cellIndex)
        thinkingRef.current = false
        setIsThinking(false)
      }

      // Small delay so React renders the "thinking" indicator first
      timeoutRef.current = setTimeout(() => {
        worker.addEventListener('message', handleMessage)
        worker.postMessage({
          type: 'BOT_MOVE',
          gameState: snapshot,
          difficulty,
          botPlayer,
        })
      }, 150)
    } else {
      // Fallback: run synchronously via dynamic import
      timeoutRef.current = setTimeout(() => {
        import('../utils/botEngine.js').then(({ getBotMove }) => {
          const move = getBotMove(snapshot, difficulty, botPlayer)
          if (move) makeMoveRef.current(move.boardIndex, move.cellIndex)
          thinkingRef.current = false
          setIsThinking(false)
        })
      }, 450)
    }

    return () => {
      clearTimeout(timeoutRef.current)
    }
  }, [
    gameMode,
    gameState.currentPlayer,
    gameState.gameOver,
    botPlayer,
    difficulty,
  ])

  return { isThinking, cancelThink }
}
