function GameStatus({ gameState, myPlayer, gameMode, playerColor }) {
  const getPlayerStatusClass = () => {
    if (gameState.gameOver) {
      if (gameState.gameWinner === 'tie') {
        return 'current-player winner tie-winner'
      } else {
        return `current-player winner ${gameState.gameWinner.toLowerCase()}-winner`
      }
    }
    return `current-player ${gameState.currentPlayer.toLowerCase()}-player`
  }

  const getPlayerDisplayText = () => {
    if (gameState.gameOver) {
      if (gameState.gameWinner === 'tie') {
        return 'Game Tied!'
      } else if (gameMode === 'bot') {
        return gameState.gameWinner === playerColor ? 'You Win!' : 'AI Wins!'
      } else if (gameMode === 'online' && myPlayer && myPlayer !== 'spectator') {
        return gameState.gameWinner === myPlayer ? 'You Win!' : 'Opponent Wins!'
      } else {
        return `Player ${gameState.gameWinner} Wins!`
      }
    }
    return 'Current Player:'
  }

  const getPlayerSymbol = () => {
    if (gameState.gameOver) {
      return '' // Don't show symbol when game is over
    }
    return gameState.currentPlayer
  }

  const getPlayerColor = () => {
    if (gameState.gameOver) {
      if (gameState.gameWinner === 'tie') return '#888'
      return gameState.gameWinner === 'X' ? '#ff3250' : '#00c8ff'
    }
    return gameState.currentPlayer === 'X' ? '#ff3250' : '#00c8ff'
  }

  return (
    <div className="game-status">
      <div className={getPlayerStatusClass()}>
        <span className="current-player-label">{getPlayerDisplayText()}</span>
        {getPlayerSymbol() && (
          <span 
            className={`player-symbol ${gameState.gameOver ? gameState.gameWinner?.toLowerCase() : gameState.currentPlayer.toLowerCase()}`}
            style={{ 
              color: getPlayerColor(),
              marginLeft: '8px',
              fontWeight: 'bold'
            }}
          >
            {getPlayerSymbol()}
          </span>
        )}
        {myPlayer && !gameState.gameOver && (
          <span style={{ marginLeft: '16px', fontSize: '0.9em', color: '#aaa' }}>
            (You are {myPlayer})
          </span>
        )}
      </div>
      
      <div className={`game-instruction ${
        gameState.gameOver 
          ? gameState.gameWinner === 'tie' ? '' : `${gameState.gameWinner.toLowerCase()}-theme`
          : `${gameState.currentPlayer.toLowerCase()}-theme`
      }`}>
        {gameState.gameOver 
          ? gameState.gameWinner === 'tie' 
            ? 'Neither player could achieve victory!' 
            : `Congratulations! Victory achieved!`
          : gameState.activeBoard === null 
            ? 'Play anywhere' 
            : `Target grid ${gameState.activeBoard + 1}`}
      </div>
    </div>
  )
}

export default GameStatus
