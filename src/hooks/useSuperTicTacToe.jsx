import { useState, useEffect, useRef } from 'react'
import { initTimers, startTicking, stopTicking } from '../stores/timerStore'
import { WIN_PATTERNS } from '../utils/constants.js'
import { analyzeMove } from '../utils/blunderAnalyzer.js'

const DEFAULT_TIME = 0 // 0 = disabled

function makeInitialState(xTime, oTime, startingPlayer = 'X') {
  return {
    boards: Array(9).fill(null).map(() => Array(9).fill('')),
    currentPlayer: startingPlayer,
    activeBoard: null,
    wonBoards: Array(9).fill(''),
    gameWinner: '',
    gameOver: false,
    playerXTime: xTime,
    playerOTime: oTime,
    gameStarted: false,
  }
}

export function useSuperTicTacToe(isLocalGame = true, initialXTime = DEFAULT_TIME, initialOTime = DEFAULT_TIME, startingPlayer = 'X', isPaused = false) {
  const [gameState, setGameState] = useState(() => makeInitialState(initialXTime, initialOTime, startingPlayer))
  const [moveHistory, setMoveHistory] = useState([])
  const [viewingIndex, setViewingIndex] = useState(null)

  // Snapshots for undo
  const historyRef = useRef([])

  // Track initial times so resetGame uses the same values
  const initTimesRef = useRef({ x: initialXTime, o: initialOTime })
  const hasInitializedRemoteTimerRef = useRef(false)

  useEffect(() => {
    initTimesRef.current = { x: initialXTime, o: initialOTime }
    initTimers(initialXTime, initialOTime)
  }, [initialXTime, initialOTime])

  useEffect(() => {
    if (!gameState.gameStarted || gameState.gameOver || isPaused) {
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
  }, [gameState.currentPlayer, gameState.gameOver, gameState.gameStarted, isPaused])

  const syncRemoteState = (remoteState, remoteHistory = null) => {
    if (!remoteState) return

    const incomingHistory = (remoteHistory && Array.isArray(remoteHistory))
      ? remoteHistory
      : (remoteState.moveHistory && Array.isArray(remoteState.moveHistory) ? remoteState.moveHistory : null)

    // Guard against applying stale remote updates if local state is already ahead
    if (incomingHistory && incomingHistory.length < moveHistory.length) {
      console.warn('Skipped stale remote state update:', incomingHistory.length, '<', moveHistory.length)
      return
    }

    setGameState(remoteState)
    if (!hasInitializedRemoteTimerRef.current && typeof remoteState.playerXTime === 'number' && typeof remoteState.playerOTime === 'number') {
      hasInitializedRemoteTimerRef.current = true
      initTimesRef.current = { x: remoteState.playerXTime, o: remoteState.playerOTime }
      initTimers(remoteState.playerXTime, remoteState.playerOTime)
    }
    if (incomingHistory) {
      setMoveHistory(incomingHistory)
    }
    setViewingIndex(null)
  }

  const checkWin = (board) => {
    for (const pattern of WIN_PATTERNS) {
      const [a, b, c] = pattern
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a]
      }
    }
    return board.every(cell => cell !== '') ? 'tie' : ''
  }

  const isBoardFull = (board) => board.every(cell => cell !== '')

  const sanitizeStateForHistory = (stateObj) => {
    if (!stateObj) return null
    const { moveHistory, ...cleanState } = stateObj
    return cleanState
  }

  const makeMove = (boardIndex, cellIndex) => {
    // If currently browsing a past move, branch from that state
    let baseState = gameState
    let currentHistory = moveHistory

    if (viewingIndex !== null && viewingIndex < moveHistory.length - 1) {
      const branchEntry = moveHistory[viewingIndex]
      baseState = branchEntry.stateAfter
      currentHistory = moveHistory.slice(0, viewingIndex + 1)
      historyRef.current = historyRef.current.slice(0, viewingIndex + 1)
      setViewingIndex(null)
    }

    if (baseState.gameOver) return null
    if (baseState.wonBoards[boardIndex]) return null
    if (baseState.boards[boardIndex][cellIndex]) return null
    if (baseState.activeBoard !== null && baseState.activeBoard !== boardIndex) return null

    // Save snapshot for undo
    historyRef.current.push(baseState)

    const newState = {
      ...baseState,
      gameStarted: true,
      boards: baseState.boards.map((board, idx) =>
        idx === boardIndex
          ? board.map((cell, cellIdx) =>
              cellIdx === cellIndex ? baseState.currentPlayer : cell
            )
          : board
      )
    }

    const boardResult = checkWin(newState.boards[boardIndex])
    if (boardResult && boardResult !== 'tie') {
      newState.wonBoards = [...baseState.wonBoards]
      newState.wonBoards[boardIndex] = boardResult
    } else if (boardResult === 'tie') {
      newState.wonBoards = [...baseState.wonBoards]
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

    newState.currentPlayer = baseState.currentPlayer === 'X' ? 'O' : 'X'

    // Blunder analysis
    const analysis = analyzeMove(baseState, { boardIndex, cellIndex }, newState)

    const newEntry = {
      moveNumber: currentHistory.length + 1,
      player: baseState.currentPlayer,
      boardIndex,
      cellIndex,
      prevState: sanitizeStateForHistory(baseState),
      stateAfter: sanitizeStateForHistory(newState),
      analysis,
    }

    const updatedHistory = [...currentHistory, newEntry]
    setMoveHistory(updatedHistory)
    setGameState({ ...newState, moveHistory: updatedHistory })
    return { newState, moveHistory: updatedHistory }
  }

  const undoMove = (steps = 2) => {
    if (historyRef.current.length === 0) return false
    let target = null
    for (let i = 0; i < steps; i++) {
      if (historyRef.current.length > 0) {
        target = historyRef.current.pop()
      }
    }
    if (!target) return false

    setMoveHistory(prev => prev.slice(0, Math.max(0, prev.length - steps)))
    setViewingIndex(null)
    setGameState(target)
    return true
  }

  const resetGame = () => {
    stopTicking()
    historyRef.current = []
    setMoveHistory([])
    setViewingIndex(null)
    hasInitializedRemoteTimerRef.current = false
    const { x, o } = initTimesRef.current
    const newState = makeInitialState(x, o, startingPlayer)
    setGameState(newState)
    initTimers(x, o)
    return newState
  }

  // Time Travel Controls
  const stepTo = (index) => {
    if (index === null || index < 0 || index >= moveHistory.length) {
      setViewingIndex(null)
    } else {
      setViewingIndex(index)
    }
  }

  const stepForward = () => {
    if (viewingIndex === null) return
    if (viewingIndex >= moveHistory.length - 1) {
      setViewingIndex(null)
    } else {
      setViewingIndex(viewingIndex + 1)
    }
  }

  const stepBackward = () => {
    if (moveHistory.length === 0) return
    if (viewingIndex === null) {
      setViewingIndex(moveHistory.length - 1)
    } else if (viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1)
    }
  }

  const stepToStart = () => {
    if (moveHistory.length > 0) {
      setViewingIndex(0)
    }
  }

  const stepToLive = () => {
    setViewingIndex(null)
  }

  const branchFrom = (index) => {
    if (index < 0 || index >= moveHistory.length) return
    const entry = moveHistory[index]
    const truncatedHistory = moveHistory.slice(0, index + 1)
    setMoveHistory(truncatedHistory)
    historyRef.current = historyRef.current.slice(0, index + 1)
    setGameState(entry.stateAfter)
    setViewingIndex(null)
  }

  // Determine displayed state
  const isBrowsingHistory = viewingIndex !== null && viewingIndex < moveHistory.length
  const displayedState = isBrowsingHistory
    ? moveHistory[viewingIndex].stateAfter
    : gameState

  return {
    gameState,
    displayedState,
    moveHistory,
    viewingIndex,
    isBrowsingHistory,
    makeMove,
    resetGame,
    undoMove,
    canUndo: () => historyRef.current.length >= 2,
    setGameState,
    syncRemoteState,
    stepTo,
    stepForward,
    stepBackward,
    stepToStart,
    stepToLive,
    branchFrom,
  }
}
