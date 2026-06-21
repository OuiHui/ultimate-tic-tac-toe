import { useState, useEffect, Suspense, lazy } from 'react'
import SuperBoard from './SuperBoard'
import GameStatus from './GameStatus'
import Timer from './Timer'
const RulesLazy = lazy(() => import('./Rules'))
import { useSupabase } from '../contexts/SupabaseContext'
import { useSuperTicTacToe } from '../hooks/useSuperTicTacToe'

function GameContainer({ gameMode, gameCode, onBackToMenu }) {
  const {
    supabase,
    joinRoom,
    makeMove: makeMoveSupabase,
    subscribeToGame,
    unsubscribeFromGame
  } = useSupabase()
  const [myPlayer, setMyPlayer] = useState(null)
  const [supabaseChannel, setSupabaseChannel] = useState(null)
  
  const {
    gameState,
    makeMove,
    resetGame,
    setGameState
  } = useSuperTicTacToe(gameMode === 'local')

  useEffect(() => {
    if (gameMode === 'online' && supabase && gameCode) {
      setupMultiplayer()
    }
    
    return () => {
      if (supabaseChannel) {
        unsubscribeFromGame(supabaseChannel)
      }
    }
  }, [gameMode, supabase, gameCode])

  const setupMultiplayer = async () => {
    const displayName = localStorage.getItem('displayName') || 'Anonymous'
    
    try {
      const room = await joinRoom(supabase, gameCode)
      
      let assignedPlayer
      let updateData = {}
      if (!room.player_x) {
        assignedPlayer = 'X'
        updateData = { player_x: displayName }
      } else if (!room.player_o && room.player_x !== displayName) {
        assignedPlayer = 'O'
        updateData = { player_o: displayName }
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
        await supabase
          .from('games')
          .update(updateData)
          .eq('code', gameCode)
      }

      if (room.state) {
        setGameState(room.state)
      }

      // Listen for game state changes
      const channel = subscribeToGame(supabase, gameCode, (updatedGame) => {
        if (updatedGame && updatedGame.state) {
          setGameState(updatedGame.state)
        }
      })
      
      setSupabaseChannel(channel)
    } catch (err) {
      console.error('Error setting up multiplayer:', err)
    }
  }

  const handleMove = async (boardIndex, cellIndex) => {
    if (gameMode === 'online') {
      // Only allow if it's your turn
      if (gameState.gameOver || myPlayer !== gameState.currentPlayer) return
      if (gameState.wonBoards[boardIndex] || gameState.boards[boardIndex][cellIndex]) return
      if (gameState.activeBoard !== null && gameState.activeBoard !== boardIndex) return

      // Make move and sync to Supabase
      const newState = makeMove(boardIndex, cellIndex)
      if (newState && supabase) {
        try {
          await makeMoveSupabase(supabase, gameCode, newState, myPlayer)
        } catch (err) {
          console.error('Error syncing move to Supabase:', err)
        }
      }
    } else {
      makeMove(boardIndex, cellIndex)
    }
  }

  const handleReset = async () => {
    if (gameMode === 'online' && supabase) {
      const newState = resetGame()
      try {
        await supabase
          .from('games')
          .update({ state: newState })
          .eq('code', gameCode)
      } catch (err) {
        console.error('Error resetting game in Supabase:', err)
      }
    } else {
      resetGame()
    }
  }

  const handleBackToMenu = () => {
    if (supabaseChannel) {
      unsubscribeFromGame(supabaseChannel)
    }
    onBackToMenu()
  }


  return (
    <div className={`game-container ${
      gameState.gameOver && gameState.gameWinner !== 'tie' 
        ? `${gameState.gameWinner.toLowerCase()}-winner` 
        : gameState.gameOver && gameState.gameWinner === 'tie'
        ? 'tie-winner'
        : `${gameState.currentPlayer.toLowerCase()}-turn`
    }`}>
      <h1 data-text="ULTIMATE TIC TAC TOE" className={`game-title ${
        gameState.gameOver && gameState.gameWinner !== 'tie'
          ? `${gameState.gameWinner.toLowerCase()}-glow`
          : gameState.gameOver && gameState.gameWinner === 'tie'
          ? ''
          : `${gameState.currentPlayer.toLowerCase()}-glow`
      }`}>ULTIMATE TIC TAC TOE</h1>
      
      <GameStatus 
        gameState={gameState} 
        myPlayer={gameMode === 'online' ? myPlayer : null}
      />
      
      <Timer 
        playerXTime={gameState.playerXTime}
        playerOTime={gameState.playerOTime}
        currentPlayer={gameState.currentPlayer}
        gameState={gameState}
      />
      
      <SuperBoard
        gameState={gameState}
        onCellClick={handleMove}
        isMyTurn={gameMode === 'local' || myPlayer === gameState.currentPlayer}
        currentPlayer={gameState.currentPlayer}
      />
      
      <button className="button" onClick={handleReset}>
        New Game
      </button>
      <button className="button" onClick={handleBackToMenu}>
        Back to Menu
      </button>
      
      <Suspense fallback={null}>
        <RulesLazy gameState={gameState} />
      </Suspense>
      
      {gameState.gameOver && (
        <div className={`game-over ${gameState.gameWinner.toLowerCase()}`}>
          {gameState.gameWinner === 'tie' 
            ? 'Draw!' 
            : `Player ${gameState.gameWinner} Wins!`}
        </div>
      )}
    </div>
  )
}

export default GameContainer
