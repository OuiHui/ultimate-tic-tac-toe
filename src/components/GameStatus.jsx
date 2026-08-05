function GameStatus({ gameState, myPlayer, gameMode, playerColor }) {
  if (!gameState) {
    return (
      <div className="game-status">
        <div className="current-player">
          <span className="current-player-label">Loading...</span>
        </div>
      </div>
    )
  }

  const currentPlayer = gameState.currentPlayer || 'X'
  const isGameOver = Boolean(gameState.gameOver)
  const winner = gameState.gameWinner || ''

  const getPlayerStatusClass = () => {
    if (isGameOver) {
      if (winner === 'tie') {
        return 'current-player winner tie-winner'
      }
      return `current-player winner ${(winner || 'X').toLowerCase()}-winner`
    }
    return `current-player ${currentPlayer.toLowerCase()}-player`
  }

  const getPlayerDisplayText = () => {
    if (isGameOver) {
      if (winner === 'tie') {
        return 'Game Tied!'
      }
      if (gameMode === 'bot') {
        return winner === playerColor ? 'You Win!' : 'AI Wins!'
      }
      if (gameMode === 'online' && myPlayer && myPlayer !== 'spectator') {
        return winner === myPlayer ? 'You Win!' : 'Opponent Wins!'
      }
      return `Player ${winner || 'X'} Wins!`
    }

    if (gameMode === 'online') {
      if (myPlayer === 'spectator') {
        return `Current Turn: Player ${currentPlayer}`
      }
      if (myPlayer) {
        return currentPlayer === myPlayer ? 'Your Turn' : "Opponent's Turn"
      }
      return `Current Turn: Player ${currentPlayer}`
    }

    if (gameMode === 'bot') {
      return currentPlayer === playerColor ? 'Your Turn' : "AI's Turn"
    }

    return `Current Turn: Player ${currentPlayer}`
  }

  const showSymbol = !isGameOver && gameMode === 'local'

  return (
    <div className="game-status">
      <div className={getPlayerStatusClass()}>
        <span className="current-player-label">{getPlayerDisplayText()}</span>
        {showSymbol && (
          <span 
            className={`player-symbol ${currentPlayer.toLowerCase()}`}
            style={{ 
              color: currentPlayer === 'X' ? '#ff3250' : '#00c8ff',
              marginLeft: '8px',
              fontWeight: 'bold'
            }}
          >
            {currentPlayer}
          </span>
        )}
      </div>
      
      <div className={`game-instruction ${
        isGameOver 
          ? winner === 'tie' ? '' : `${(winner || 'X').toLowerCase()}-theme`
          : `${currentPlayer.toLowerCase()}-theme`
      }`}>
        {isGameOver 
          ? winner === 'tie' 
            ? 'Neither player could achieve victory!' 
            : 'Congratulations! Victory achieved!'
          : gameState.activeBoard === null 
            ? 'Play anywhere' 
            : `Target grid ${gameState.activeBoard + 1}`}
      </div>
    </div>
  )
}

export default GameStatus
