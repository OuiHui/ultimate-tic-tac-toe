import { useState, useEffect, useRef, useCallback, Suspense, lazy, useMemo } from 'react'
import SuperBoard from './SuperBoard'
import GameStatus from './GameStatus'
import Timer from './Timer'
import EvalBar from './EvalBar'
const RulesLazy = lazy(() => import('./Rules'))
import { useSupabase } from '../contexts/SupabaseContext'
import { useSuperTicTacToe } from '../hooks/useSuperTicTacToe'
import { useBot } from '../hooks/useBot'
import { evaluatePosition } from '../utils/evaluator'
import { getBestMoveScore } from '../utils/botEngine'

function GameContainer({ gameMode, gameCode, onBackToMenu, botDifficulty, playerColor, playerXTime, playerOTime }) {
  const {
    supabase,
    joinRoom,
    makeMove: makeMoveSupabase,
    subscribeToGame,
    unsubscribeFromGame,
  } = useSupabase()

  const [myPlayer, setMyPlayer]               = useState(null)
  const [supabaseChannel, setSupabaseChannel] = useState(null)

  // Hint state
  const [hintMove,     setHintMove]     = useState(null) // { boardIndex, cellIndex } | null
  const [isHinting,    setIsHinting]    = useState(false)
  const hintWorkerRef                   = useRef(null)

  // 'local' and 'bot' both use local timer management; 'online' does not
  const { gameState, makeMove, resetGame, undoMove, canUndo, setGameState } =
    useSuperTicTacToe(gameMode !== 'online', playerXTime, playerOTime)

  // Bot plays the opposite colour of the human player
  const botPlayer = playerColor === 'X' ? 'O' : 'X'

  const { isThinking, cancelThink } = useBot(
    gameState,
    gameMode,
    botDifficulty,
    botPlayer,
    makeMove,
  )

  const evalScore = useMemo(() => {
    if (gameState.gameOver) return evaluatePosition(gameState)
    return getBestMoveScore(gameState)
  }, [gameState])

  // Hint worker — created once
  useEffect(() => {
    try {
      hintWorkerRef.current = new Worker(
        new URL('../utils/botWorker.js', import.meta.url),
        { type: 'module' }
      )
    } catch (_) {
      hintWorkerRef.current = null
    }
    return () => {
      hintWorkerRef.current?.terminate()
      hintWorkerRef.current = null
    }
  }, [])

  // ── Online multiplayer setup ──────────────────────────────────────────────
  useEffect(() => {
    if (gameMode === 'online' && supabase && gameCode) {
      setupMultiplayer()
    }
    return () => {
      if (supabaseChannel) unsubscribeFromGame(supabaseChannel)
    }
  }, [gameMode, supabase, gameCode])

  const setupMultiplayer = async () => {
    const displayName = localStorage.getItem('displayName') || 'Anonymous'
    try {
      const room = await joinRoom(supabase, gameCode)
      let assignedPlayer
      let updateData = {}
      if (!room.player_x) {
        assignedPlayer = 'X'; updateData = { player_x: displayName }
      } else if (!room.player_o && room.player_x !== displayName) {
        assignedPlayer = 'O'; updateData = { player_o: displayName }
      } else if (room.player_x === displayName) {
        assignedPlayer = 'X'
      } else if (room.player_o === displayName) {
        assignedPlayer = 'O'
      } else {
        assignedPlayer = 'spectator'
      }
      setMyPlayer(assignedPlayer)
      localStorage.setItem('super-ttt-player-' + gameCode, assignedPlayer)
      if (Object.keys(updateData).length > 0) {
        await supabase.from('games').update(updateData).eq('code', gameCode)
      }
      if (room.state) setGameState(room.state)
      const channel = subscribeToGame(supabase, gameCode, (updated) => {
        if (updated?.state) setGameState(updated.state)
      })
      setSupabaseChannel(channel)
    } catch (err) {
      console.error('Error setting up multiplayer:', err)
    }
  }

  // ── Move handlers ─────────────────────────────────────────────────────────
  const handleMove = useCallback(async (boardIndex, cellIndex) => {
    if (gameMode === 'online') {
      if (gameState.gameOver || myPlayer !== gameState.currentPlayer) return
      if (gameState.wonBoards[boardIndex] || gameState.boards[boardIndex][cellIndex]) return
      if (gameState.activeBoard !== null && gameState.activeBoard !== boardIndex) return
      const newState = makeMove(boardIndex, cellIndex)
      if (newState && supabase) {
        try { await makeMoveSupabase(supabase, gameCode, newState, myPlayer) }
        catch (err) { console.error('Error syncing move:', err) }
      }
    } else {
      makeMove(boardIndex, cellIndex)
    }
    // Clear hint when a move is made
    setHintMove(null)
  }, [gameMode, gameState, myPlayer, makeMove, supabase, gameCode, makeMoveSupabase])

  const handleReset = async () => {
    cancelThink()
    setHintMove(null)
    if (gameMode === 'online' && supabase) {
      const newState = resetGame()
      try { await supabase.from('games').update({ state: newState }).eq('code', gameCode) }
      catch (err) { console.error('Error resetting game:', err) }
    } else {
      resetGame()
    }
  }

  const handleBackToMenu = () => {
    cancelThink()
    if (supabaseChannel) unsubscribeFromGame(supabaseChannel)
    onBackToMenu()
  }

  // ── Undo ──────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    cancelThink()
    setHintMove(null)
    undoMove(2) // undo human + bot response
  }, [cancelThink, undoMove])

  // ── Hint ──────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (isHinting || isThinking) return
    if (gameState.gameOver || gameState.currentPlayer !== playerColor) return

    setIsHinting(true)

    const snapshot = { ...gameState }

    if (hintWorkerRef.current) {
      const worker = hintWorkerRef.current
      const handler = (e) => {
        worker.removeEventListener('message', handler)
        setHintMove(e.data.move ?? null)
        setIsHinting(false)
      }
      worker.addEventListener('message', handler)
      worker.postMessage({
        type: 'HINT',
        gameState: snapshot,
        difficulty: botDifficulty,
        botPlayer: playerColor, // compute best move for the human player
      })
    } else {
      // Fallback: synchronous (import dynamically to avoid top-level await)
      import('../utils/botEngine.js').then(({ getBotMove }) => {
        const move = getBotMove(snapshot, botDifficulty, playerColor)
        setHintMove(move ?? null)
        setIsHinting(false)
      })
    }
  }, [isHinting, isThinking, gameState, playerColor, botDifficulty])

  // ── Derived display values ────────────────────────────────────────────────
  const winnerClass =
    gameState.gameOver && gameState.gameWinner !== 'tie'
      ? `${gameState.gameWinner.toLowerCase()}-winner`
      : gameState.gameOver && gameState.gameWinner === 'tie'
      ? 'tie-winner'
      : `${gameState.currentPlayer.toLowerCase()}-turn`

  const titleGlowClass =
    gameState.gameOver && gameState.gameWinner !== 'tie'
      ? `${gameState.gameWinner.toLowerCase()}-glow`
      : gameState.gameOver && gameState.gameWinner === 'tie'
      ? ''
      : `${gameState.currentPlayer.toLowerCase()}-glow`

  const isMyTurn =
    gameMode === 'local' ||
    (gameMode === 'bot'    && !isThinking && gameState.currentPlayer === playerColor) ||
    (gameMode === 'online' && myPlayer === gameState.currentPlayer)

  const showEvalBar = gameMode !== 'online'

  // Can undo = bot mode + at least 2 half-moves in history + not currently thinking
  const showUndo = gameMode === 'bot' && canUndo() && !isThinking && !gameState.gameOver

  // Show hint button during human's turn in bot mode
  const showHint = gameMode === 'bot' && isMyTurn && !gameState.gameOver

  return (
    <div className={`game-container ${winnerClass}`}>
      <h1 className={`game-title ${titleGlowClass}`}>ULTIMATE TIC TAC TOE</h1>

      <GameStatus
        gameState={gameState}
        myPlayer={gameMode === 'online' ? myPlayer : null}
        gameMode={gameMode}
        playerColor={playerColor}
      />

      <Timer
        playerXTime={gameState.playerXTime}
        playerOTime={gameState.playerOTime}
        currentPlayer={gameState.currentPlayer}
        gameState={gameState}
      />

      {/* Board + eval bar side by side */}
      <div className="board-area">
        {showEvalBar && (
          <EvalBar
            score={evalScore}
            playerColor={gameMode === 'bot' ? playerColor : 'X'}
          />
        )}
        <SuperBoard
          boards={gameState.boards}
          wonBoards={gameState.wonBoards}
          activeBoard={gameState.activeBoard}
          gameOver={gameState.gameOver}
          gameWinner={gameState.gameWinner}
          currentPlayer={gameState.currentPlayer}
          onCellClick={handleMove}
          isMyTurn={isMyTurn}
          hintMove={hintMove}
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
        {showHint && (
          <button
            className="button button-hint"
            onClick={handleHint}
            disabled={isHinting}
            title="Show best move"
          >
            {isHinting ? '…' : '💡 Hint'}
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
        <RulesLazy gameState={gameState} />
      </Suspense>

      {gameState.gameOver && (
        <div className={`game-over ${gameState.gameWinner.toLowerCase()}`}>
          {gameState.gameWinner === 'tie'
            ? 'Draw!'
            : gameMode === 'bot'
            ? gameState.gameWinner === playerColor
              ? 'You Win! 🎉'
              : 'AI Wins!'
            : gameMode === 'online' && myPlayer && myPlayer !== 'spectator'
            ? gameState.gameWinner === myPlayer
              ? 'You Win!'
              : 'Opponent Wins!'
            : `Player ${gameState.gameWinner} Wins!`}
        </div>
      )}
    </div>
  )
}

export default GameContainer
