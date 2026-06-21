import { useState, useEffect, Suspense, lazy, useMemo } from 'react'
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

function GameContainer({ gameMode, gameCode, onBackToMenu, botDifficulty, playerColor }) {
  const {
    supabase,
    joinRoom,
    makeMove: makeMoveSupabase,
    subscribeToGame,
    unsubscribeFromGame,
  } = useSupabase()

  const [myPlayer, setMyPlayer]           = useState(null)
  const [supabaseChannel, setSupabaseChannel] = useState(null)

  // 'local' and 'bot' both use local timer management; 'online' does not
  const { gameState, makeMove, resetGame, setGameState } =
    useSuperTicTacToe(gameMode !== 'online')

  // Bot plays the opposite colour of the human player
  const botPlayer = playerColor === 'X' ? 'O' : 'X'

  // Activate the bot when it is its turn (no-op for non-bot modes)
  const { isThinking } = useBot(
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
  const handleMove = async (boardIndex, cellIndex) => {
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
  }

  const handleReset = async () => {
    if (gameMode === 'online' && supabase) {
      const newState = resetGame()
      try { await supabase.from('games').update({ state: newState }).eq('code', gameCode) }
      catch (err) { console.error('Error resetting game:', err) }
    } else {
      resetGame()
    }
  }

  const handleBackToMenu = () => {
    if (supabaseChannel) unsubscribeFromGame(supabaseChannel)
    onBackToMenu()
  }

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

  // In bot mode the human can only move on their own turn while bot isn't thinking
  const isMyTurn =
    gameMode === 'local' ||
    (gameMode === 'bot'    && !isThinking && gameState.currentPlayer === playerColor) ||
    (gameMode === 'online' && myPlayer === gameState.currentPlayer)

  const showEvalBar = gameMode !== 'online'

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
          gameState={gameState}
          onCellClick={handleMove}
          isMyTurn={isMyTurn}
          currentPlayer={gameState.currentPlayer}
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

      <button className="button" onClick={handleReset}>New Game</button>
      <button className="button" onClick={handleBackToMenu}>Back to Menu</button>

      <Suspense fallback={null}>
        <RulesLazy gameState={gameState} />
      </Suspense>

      {gameState.gameOver && (
        <div className={`game-over ${gameState.gameWinner.toLowerCase()}`}>
          {gameState.gameWinner === 'tie'
            ? 'Draw!'
            : gameMode === 'bot'
            ? gameState.gameWinner === playerColor
              ? 'You Win!'
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
