import { useState, useEffect, useRef } from 'react'
import { initTimers, startTicking, stopTicking } from '../stores/timerStore'

const DEFAULT_TIME = 300 // 5 minutes in seconds

function makeInitialState(xTime, oTime) {
  return {
    boards: Array(9).fill(null).map(() => Array(9).fill('')),
    currentPlayer: 'X',
    activeBoard: null,
    wonBoards: Array(9).fill(''),
    gameWinner: '',
    gameOver: false,
    playerXTime: xTime,
    playerOTime: oTime,
    gameStarted: false,
  }
}

export function useSuperTicTacToe(isLocalGame = true, initialXTime = DEFAULT_TIME, initialOTime = DEFAULT_TIME) {
  const [gameState, setGameState] = useState(() => makeInitialState(initialXTime, initialOTime))

  // Move history for undo — stored in a ref so it doesn't cause re-renders
  const historyRef = useRef([])

  // Track the initial times so resetGame uses the same values
  const initTimesRef = useRef({ x: initialXTime, o: initialOTime })
  initTimesRef.current = { x: initialXTime, o: initialOTime }

  useEffect(() => {
    initTimers(initialXTime, initialOTime)
  }, [])

  useEffect(() => {
    if (!isLocalGame) return
    if (!gameState.gameStarted || gameState.gameOver) {
      stopTicking()
      return
    }

    startTicking(
      () => gameState.currentPlayer,
      () => gameState.gameOver,
      (timedOutPlayer) => {
        setGameState(prev => ({
          ...prev,
          gameOver: true,
          gameWinner: timedOutPlayer === 'X' ? 'O' : 'X',
          activeBoard: null
        }))
        stopTicking()
      }
    )

    return () => {
      stopTicking()
    }
  }, [isLocalGame, gameState.currentPlayer, gameState.gameOver, gameState.gameStarted])

  const checkWin = (board) => {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ]
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }
    return board.every(cell => cell !== '') ? 'tie' : ''
  }

  const isBoardFull = (board) => board.every(cell => cell !== '')

  const makeMove = (boardIndex, cellIndex) => {
    if (gameState.gameOver) return null
    if (gameState.wonBoards[boardIndex]) return null
    if (gameState.boards[boardIndex][cellIndex]) return null
    if (gameState.activeBoard !== null && gameState.activeBoard !== boardIndex) return null

    // Save snapshot for undo before applying the move
    historyRef.current.push(gameState)

    const newState = {
      ...gameState,
      gameStarted: true,
      boards: gameState.boards.map((board, idx) =>
        idx === boardIndex
          ? board.map((cell, cellIdx) =>
              cellIdx === cellIndex ? gameState.currentPlayer : cell
            )
          : board
      )
    }

    const boardResult = checkWin(newState.boards[boardIndex])
    if (boardResult && boardResult !== 'tie') {
      newState.wonBoards = [...gameState.wonBoards]
      newState.wonBoards[boardIndex] = boardResult
    } else if (boardResult === 'tie') {
      newState.wonBoards = [...gameState.wonBoards]
      newState.wonBoards[boardIndex] = 'tie'
    }

    const overallWinner = checkWin(newState.wonBoards.map(r => r === 'tie' ? '' : r))
    if (overallWinner && overallWinner !== 'tie') {
      newState.gameWinner = overallWinner
      newState.gameOver = true
      newState.activeBoard = null
      stopTicking()
    } else if (newState.wonBoards.every(r => r !== '')) {
      newState.gameWinner = 'tie'
      newState.gameOver = true
      newState.activeBoard = null
      stopTicking()
    } else {
      const nextBoardIndex = cellIndex
      if (newState.wonBoards[nextBoardIndex] || isBoardFull(newState.boards[nextBoardIndex])) {
        newState.activeBoard = null
      } else {
        newState.activeBoard = nextBoardIndex
      }
    }

    newState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X'

    setGameState(newState)
    return newState
  }

  /**
   * Undo the last N half-moves (default 2 = human + bot response).
   * Returns true if undo was possible, false otherwise.
   */
  const undoMove = (steps = 2) => {
    if (historyRef.current.length === 0) return false
    // Pop `steps` states; restore the oldest of those
    let target = null
    for (let i = 0; i < steps; i++) {
      if (historyRef.current.length > 0) {
        target = historyRef.current.pop()
      }
    }
    if (!target) return false
    stopTicking()
    setGameState(target)
    // Re-init timer store to match the restored state
    initTimers(target.playerXTime, target.playerOTime)
    return true
  }

  const resetGame = () => {
    stopTicking()
    historyRef.current = []
    const { x, o } = initTimesRef.current
    const newState = makeInitialState(x, o)
    setGameState(newState)
    initTimers(x, o)
    return newState
  }

  return {
    gameState,
    makeMove,
    resetGame,
    undoMove,
    canUndo: () => historyRef.current.length >= 2,
    setGameState
  }
}
