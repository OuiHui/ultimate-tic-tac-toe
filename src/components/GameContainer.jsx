import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react'
import SuperBoard from './SuperBoard'
import GameStatus from './GameStatus'
import Timer from './Timer'
import EvalBar from './EvalBar'
import MoveHistory from './MoveHistory'
const RulesLazy = lazy(() => import('./Rules'))
import { useSupabase } from '../contexts/SupabaseContext'
import { useSuperTicTacToe } from '../hooks/useSuperTicTacToe'
import { useBot } from '../hooks/useBot'
import { evaluatePosition } from '../utils/evaluator'

function GameContainer({ gameMode, gameCode, onBackToMenu, botDifficulty, playerColor, playerXTime, playerOTime }) {
  // ── 1. Custom Context & Game Hooks ─────────────────────────────────────────
  const {
    supabase,
    joinRoom,
    makeMove: makeMoveSupabase,
    subscribeToGame,
    unsubscribeFromGame,
    getPlayerId,
  } = useSupabase()

  const {
    gameState,
    displayedState,
    moveHistory,
    viewingIndex,
    makeMove,
    resetGame,
    undoMove,
    canUndo,
    setGameState,
    syncRemoteState,
    stepTo,
    stepForward,
    stepBackward,
    stepToStart,
    stepToLive,
    branchFrom,
  } = useSuperTicTacToe(gameMode !== 'online', playerXTime, playerOTime)

  const botPlayer = playerColor === 'X' ? 'O' : 'X'

  const { isThinking, cancelThink } = useBot(
    gameState,
    gameMode,
    botDifficulty,
    botPlayer,
    makeMove,
  )

  // ── 2. Local State Hooks ───────────────────────────────────────────────────
  const [myPlayer, setMyPlayer] = useState(null)
  const [roomInfo, setRoomInfo] = useState(null)
  const [copied, setCopied] = useState(false)
  const [supabaseChannel, setSupabaseChannel] = useState(null)
  const [hintMode, setHintMode] = useState(() => localStorage.getItem('ttt-hint-mode') === 'true')
  const [hintMoves, setHintMoves] = useState([])
  const [isHinting, setIsHinting] = useState(false)
  const [evalScore, setEvalScore] = useState(0)
  const [markedCells, setMarkedCells] = useState({})

  // ── 3. Refs ────────────────────────────────────────────────────────────────
  const evalWorkerRef = useRef(null)

  // Copy code handler
  const handleCopyCode = useCallback(() => {
    if (!gameCode) return
    const textToCopy = gameCode
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => fallbackCopy(textToCopy))
    } else {
      fallbackCopy(textToCopy)
    }
  }, [gameCode])

  const fallbackCopy = (text) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Fallback copy failed', err)
    }
    document.body.removeChild(textArea)
  }

  // ── 4. Callbacks ───────────────────────────────────────────────────────────
  const handleCellContextMenu = useCallback((boardIndex, cellIndex) => {
    const key = `${boardIndex}-${cellIndex}`
    const activeColor = gameMode === 'online'
      ? (myPlayer === 'O' ? 'O' : 'X')
      : (gameMode === 'bot' ? playerColor : gameState.currentPlayer)

    setMarkedCells(prev => {
      const next = { ...prev }
      if (next[key]) {
        delete next[key]
      } else {
        next[key] = activeColor
      }
      return next
    })
  }, [gameMode, myPlayer, playerColor, gameState.currentPlayer])

  const handleClearMarks = useCallback(() => {
    setMarkedCells({})
  }, [])

  const handleMove = useCallback(async (boardIndex, cellIndex) => {
    if (gameMode === 'online') {
      if (gameState.gameOver || myPlayer !== gameState.currentPlayer) return
      if (gameState.wonBoards[boardIndex] || gameState.boards[boardIndex][cellIndex]) return
      if (gameState.activeBoard !== null && gameState.activeBoard !== boardIndex) return
      const result = makeMove(boardIndex, cellIndex)
      if (result && result.newState) {
        try {
          await makeMoveSupabase(supabase, gameCode, result.newState, myPlayer, result.moveHistory)
        } catch (err) {
          console.error('Error syncing move:', err)
        }
      }
    } else {
      makeMove(boardIndex, cellIndex)
    }
    setHintMoves([])
  }, [gameMode, gameState, myPlayer, makeMove, supabase, gameCode, makeMoveSupabase])

  const handleReset = useCallback(async () => {
    cancelThink()
    setHintMoves([])
    setMarkedCells({})
    const newState = resetGame()
    if (gameMode === 'online') {
      try {
        await makeMoveSupabase(supabase, gameCode, { ...newState, moveHistory: [] }, myPlayer, [])
      } catch (err) {
        console.error('Error resetting game:', err)
      }
    }
  }, [cancelThink, gameMode, supabase, gameCode, resetGame, makeMoveSupabase, myPlayer])


  const handleBackToMenu = useCallback(() => {
    cancelThink()
    if (supabaseChannel) unsubscribeFromGame(supabaseChannel)
    onBackToMenu()
  }, [cancelThink, supabaseChannel, unsubscribeFromGame, onBackToMenu])

  const handleUndo = useCallback(() => {
    cancelThink()
    setHintMoves([])
    undoMove(2)
  }, [cancelThink, undoMove])

  // ── 5. Effects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('ttt-hint-mode', hintMode)
  }, [hintMode])

  // Worker initialization
  useEffect(() => {
    try {
      evalWorkerRef.current = new Worker(
        new URL('../utils/botWorker.js', import.meta.url),
        { type: 'module' }
      )
    } catch (_) {
      evalWorkerRef.current = null
    }
    return () => {
      evalWorkerRef.current?.terminate()
      evalWorkerRef.current = null
    }
  }, [])

  // Asynchronous evaluation effect for displayed state
  useEffect(() => {
    if (gameMode === 'online') return
    if (displayedState.gameOver) {
      setEvalScore(evaluatePosition(displayedState))
      return
    }

    const snapshot = { ...displayedState }
    let active = true

    if (evalWorkerRef.current) {
      const worker = evalWorkerRef.current
      const handler = (e) => {
        if (e.data.type === 'EVAL_UPDATE' && active) {
          setEvalScore(e.data.score ?? 0)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'EVALUATE', gameState: snapshot })

      return () => {
        active = false
        worker.removeEventListener('message', handler)
      }
    } else {
      import('../utils/botEngine.js').then(({ getBestMoveScore }) => {
        if (active) setEvalScore(getBestMoveScore(snapshot))
      })
    }
  }, [displayedState, gameMode])


  // Online multiplayer setup
  useEffect(() => {
    if (gameMode === 'online' && gameCode) {
      setupMultiplayer()
    }
    return () => {
      if (supabaseChannel) unsubscribeFromGame(supabaseChannel)
    }
  }, [gameMode, supabase, gameCode])

  const setupMultiplayer = async () => {
    const displayName = localStorage.getItem('displayName') || 'Anonymous'
    const myId = getPlayerId()

    try {
      const room = await joinRoom(supabase, gameCode)
      setRoomInfo(room)
      let assignedPlayer
      let updateData = {}

      // Identify player by unique client ID or available slot
      if (room.player_x_id === myId || (room.player_x === displayName && !room.player_x_id)) {
        assignedPlayer = 'X'
        if (!room.player_x_id) updateData.player_x_id = myId
      } else if (room.player_o_id === myId || (room.player_o === displayName && !room.player_o_id)) {
        assignedPlayer = 'O'
        if (!room.player_o_id) updateData.player_o_id = myId
      } else if (!room.player_x && !room.player_x_id) {
        assignedPlayer = 'X'
        updateData = { player_x: displayName, player_x_id: myId }
      } else if (!room.player_o && !room.player_o_id) {
        assignedPlayer = 'O'
        updateData = { player_o: displayName, player_o_id: myId }
      } else {
        assignedPlayer = 'spectator'
      }

      setMyPlayer(assignedPlayer)
      localStorage.setItem('super-ttt-player-' + gameCode, assignedPlayer)

      if (Object.keys(updateData).length > 0) {
        const updatedRoom = { ...room, ...updateData }
        setRoomInfo(updatedRoom)
        try {
          localStorage.setItem(`ttt-room-${gameCode}`, JSON.stringify(updatedRoom))
          const bc = new BroadcastChannel(`ttt-game-${gameCode}`)
          bc.postMessage({ type: 'ROOM_UPDATE', room: updatedRoom })
          bc.close()
        } catch (_) {}

        if (supabase) {
          try {
            await supabase.from('games').update(updateData).eq('code', gameCode)
          } catch (_) {}
        }
      }

      if (room.state) {
        syncRemoteState(room.state, room.state.moveHistory)
      }

      const subscription = subscribeToGame(supabase, gameCode, (updated) => {
        if (updated) {
          if (updated.state) {
            syncRemoteState(updated.state, updated.state.moveHistory)
          }
          if (updated.room) {
            setRoomInfo(prev => ({ ...prev, ...updated.room }))
          } else if (updated.code) {
            setRoomInfo(prev => ({ ...prev, ...updated }))
          }
        }
      })
      setSupabaseChannel(subscription)
    } catch (err) {
      console.error('Error setting up multiplayer:', err)
    }
  }

  // Hint Mode Effect
  useEffect(() => {
    if (!hintMode) {
      setHintMoves([])
      return
    }
    if (gameMode !== 'bot') return
    if (displayedState.gameOver) {
      setHintMoves([])
      return
    }
    if (displayedState.currentPlayer !== playerColor) {
      setHintMoves([])
      return
    }
    if (isThinking) return

    setIsHinting(true)
    const snapshot = { ...displayedState }

    let worker = null
    try {
      worker = new Worker(new URL('../utils/botWorker.js', import.meta.url), { type: 'module' })
      worker.onmessage = (e) => {
        if (e.data.type === 'HINT') {
          setHintMoves(e.data.moves ?? [])
          setIsHinting(false)
          worker.terminate()
        }
      }
      worker.postMessage({
        type: 'HINT',
        gameState: snapshot,
        difficulty: 'hard',
        botPlayer: playerColor,
      })
    } catch (_) {
      import('../utils/botEngine.js').then(({ getBestMoves }) => {
        const moves = getBestMoves(snapshot, 'hard', playerColor)
        setHintMoves(moves ?? [])
        setIsHinting(false)
      })
    }

    return () => {
      if (worker) worker.terminate()
    }
  }, [hintMode, gameMode, displayedState, playerColor, isThinking])

  // ── Highlights for selected historical move ──────────────────────────────
  const selectedHistoryEntry = viewingIndex !== null && viewingIndex < moveHistory.length
    ? moveHistory[viewingIndex]
    : null

  const playedMove = selectedHistoryEntry
    ? { boardIndex: selectedHistoryEntry.boardIndex, cellIndex: selectedHistoryEntry.cellIndex }
    : null

  const recommendedMove = selectedHistoryEntry?.analysis?.isBlunder || selectedHistoryEntry?.analysis?.classification === 'MISTAKE'
    ? selectedHistoryEntry.analysis.bestMove
    : null

  // ── Derived display values ────────────────────────────────────────────────
  const winnerClass =
    displayedState.gameOver && displayedState.gameWinner !== 'tie'
      ? `${displayedState.gameWinner.toLowerCase()}-winner`
      : displayedState.gameOver && displayedState.gameWinner === 'tie'
        ? 'tie-winner'
        : `${displayedState.currentPlayer.toLowerCase()}-turn`

  const titleGlowClass =
    displayedState.gameOver && displayedState.gameWinner !== 'tie'
      ? `${displayedState.gameWinner.toLowerCase()}-glow`
      : displayedState.gameOver && displayedState.gameWinner === 'tie'
        ? ''
        : `${displayedState.currentPlayer.toLowerCase()}-glow`

  const isMyTurn =
    gameMode === 'local' ||
    (gameMode === 'bot' && !isThinking && gameState.currentPlayer === playerColor) ||
    (gameMode === 'online' && myPlayer === gameState.currentPlayer)

  const isOpponentConnected = roomInfo && (
    myPlayer === 'X' 
      ? Boolean(roomInfo.player_o || roomInfo.player_o_id) 
      : Boolean(roomInfo.player_x || roomInfo.player_x_id)
  )

  const showEvalBar = gameMode !== 'online'
  const showUndo = gameMode === 'bot' && canUndo() && !isThinking

  return (
    <div className="game-screen-wrapper">
      <div className={`game-container ${winnerClass}`}>
        <h1 className={`game-title ${titleGlowClass}`}>ULTIMATE TIC TAC TOE</h1>

        {gameMode === 'online' && gameCode && (
          <div className="online-room-banner">
            <div className="room-code-section">
              <span className="room-code-label">ROOM CODE:</span>
              <span className="room-code-value">{gameCode}</span>
              <button 
                className={`copy-code-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopyCode}
                title="Copy room code to clipboard"
              >
                {copied ? '✓ Copied!' : '📋 Copy Code'}
              </button>
            </div>
            <div className="room-status-section">
              <span className={`status-dot ${isOpponentConnected ? 'connected' : 'waiting'}`} />
              <span className="status-text">
                {isOpponentConnected 
                  ? `Connected vs ${myPlayer === 'X' ? (roomInfo?.player_o || 'Player O') : (roomInfo?.player_x || 'Player X')}`
                  : 'Waiting for opponent to join...'
                }
              </span>
            </div>
          </div>
        )}

        <GameStatus
          gameState={displayedState}
          myPlayer={gameMode === 'online' ? myPlayer : null}
          gameMode={gameMode}
          playerColor={playerColor}
        />

        <Timer
          playerXTime={displayedState.playerXTime}
          playerOTime={displayedState.playerOTime}
          currentPlayer={displayedState.currentPlayer}
          gameState={displayedState}
        />

        {/* Board area with EvalBar */}
        <div className="board-area">
          {showEvalBar && (
            <EvalBar
              score={evalScore}
              playerColor={gameMode === 'bot' ? playerColor : 'X'}
            />
          )}
          <SuperBoard
            boards={displayedState.boards}
            wonBoards={displayedState.wonBoards}
            activeBoard={displayedState.activeBoard}
            gameOver={displayedState.gameOver}
            gameWinner={displayedState.gameWinner}
            currentPlayer={displayedState.currentPlayer}
            onCellClick={handleMove}
            onCellContextMenu={handleCellContextMenu}
            isMyTurn={isMyTurn}
            hintMoves={hintMoves}
            playedMove={playedMove}
            recommendedMove={recommendedMove}
            markedCells={markedCells}
          />
        </div>

        {/* Bot thinking indicator */}
        {gameMode === 'bot' && isThinking && (
          <div className="bot-thinking-indicator">
            Bot thinking
            <span className="bot-thinking-dots">
              <span /><span /><span />
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="action-buttons">
          {gameMode === 'bot' && !gameState.gameOver && (
            <div className="hint-mode-container">
              <span className="hint-mode-label">💡 Hint Mode</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={hintMode}
                  onChange={(e) => setHintMode(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          )}
          {Object.keys(markedCells).length > 0 && (
            <button className="button" onClick={handleClearMarks} title="Clear all marked squares">
              <svg viewBox="0 0 24 24" width="14" height="14" style={{ marginRight: 6, verticalAlign: 'middle', display: 'inline-block' }}>
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Clear Marks
            </button>
          )}

          {showUndo && (
            <button className="button button-undo" onClick={handleUndo} title="Undo last move">
              ↩ Undo
            </button>
          )}

          <button className="button" onClick={handleReset}>New Game</button>
          <button className="button" onClick={handleBackToMenu}>Back to Menu</button>
        </div>

        <Suspense fallback={null}>
          <RulesLazy gameState={displayedState} />
        </Suspense>

        {displayedState.gameOver && (
          <div className={`game-over ${displayedState.gameWinner.toLowerCase()}`}>
            {displayedState.gameWinner === 'tie'
              ? 'Draw!'
              : gameMode === 'bot'
                ? displayedState.gameWinner === playerColor
                  ? 'You Win! 🎉'
                  : 'AI Wins!'
                : gameMode === 'online' && myPlayer && myPlayer !== 'spectator'
                  ? displayedState.gameWinner === myPlayer
                    ? 'You Win!'
                    : 'Opponent Wins!'
                  : `Player ${displayedState.gameWinner} Wins!`}
          </div>
        )}
      </div>

      {/* Move History sidebar panel */}
      <MoveHistory
        moveHistory={moveHistory}
        viewingIndex={viewingIndex}
        gameState={displayedState}
        gameMode={gameMode}
        onStepTo={stepTo}
        onStepForward={stepForward}
        onStepBackward={stepBackward}
        onStepToStart={stepToStart}
        onStepToLive={stepToLive}
        onBranchFrom={branchFrom}
      />
    </div>
  )
}

export default GameContainer
