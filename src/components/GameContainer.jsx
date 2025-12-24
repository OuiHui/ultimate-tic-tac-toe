import { useState, useEffect, Suspense, lazy } from 'react'
import SuperBoard from './SuperBoard'
import GameStatus from './GameStatus'
import Timer from './Timer'
const RulesLazy = lazy(() => import('./Rules'))
import { useFirebase } from '../contexts/FirebaseContext'
import { useSuperTicTacToe } from '../hooks/useSuperTicTacToe'

function GameContainer({ gameMode, gameCode, onBackToMenu }) {
  const { database, ref, set, get, onValue } = useFirebase()
  const [myPlayer, setMyPlayer] = useState(null)
  const [firebaseUnsubscribe, setFirebaseUnsubscribe] = useState(null)
  
  const {
    gameState,
    makeMove,
    resetGame,
    setGameState
  } = useSuperTicTacToe(gameMode === 'local')

  useEffect(() => {
    if (gameMode === 'online' && database && gameCode) {
      setupMultiplayer()
    }
    
    return () => {
      if (firebaseUnsubscribe) {
        firebaseUnsubscribe()
      }
    }
  }, [gameMode, database, gameCode])

  const setupMultiplayer = async () => {
    const displayName = localStorage.getItem('displayName') || 'Anonymous'
    
    // Assign player role
    const playersRef = ref(database, 'games/' + gameCode + '/players')
    const playersSnapshot = await get(playersRef)
    let players = playersSnapshot.exists() ? playersSnapshot.val() : {}
    
    let assignedPlayer
    if (!players.X) {
      assignedPlayer = 'X'
      players.X = displayName
    } else if (!players.O) {
      assignedPlayer = 'O'
      players.O = displayName
    } else {
      assignedPlayer = 'spectator'
    }
    
    setMyPlayer(assignedPlayer)
    localStorage.setItem('super-ttt-player-' + gameCode, assignedPlayer)
    await set(playersRef, players)

    // Listen for game state changes
    const gameStateRef = ref(database, 'games/' + gameCode + '/state')
    const unsubscribe = onValue(gameStateRef, (snapshot) => {
      const state = snapshot.val()
      if (state) {
        setGameState(state)
      }
    })
    
    setFirebaseUnsubscribe(() => unsubscribe)
  }

  const handleMove = (boardIndex, cellIndex) => {
    if (gameMode === 'online') {
      // Only allow if it's your turn
      if (gameState.gameOver || myPlayer !== gameState.currentPlayer) return
      if (gameState.wonBoards[boardIndex] || gameState.boards[boardIndex][cellIndex]) return
      if (gameState.activeBoard !== null && gameState.activeBoard !== boardIndex) return

      // Make move and sync to Firebase
      const newState = makeMove(boardIndex, cellIndex)
      if (newState && database) {
        set(ref(database, 'games/' + gameCode + '/state'), newState)
      }
    } else {
      makeMove(boardIndex, cellIndex)
    }
  }

  const handleReset = () => {
    if (gameMode === 'online' && database) {
      const newState = resetGame()
      set(ref(database, 'games/' + gameCode + '/state'), newState)
    } else {
      resetGame()
    }
  }

  const handleBackToMenu = () => {
    if (firebaseUnsubscribe) {
      firebaseUnsubscribe()
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
