function Rules({ gameState }) {
  const getThemeClass = () => {
    if (gameState?.gameOver) {
      if (gameState.gameWinner === 'tie') {
        return 'neutral-theme'
      } else {
        return `${gameState.gameWinner.toLowerCase()}-theme`
      }
    }
    return `${gameState?.currentPlayer?.toLowerCase()}-theme`
  }

  const getGlowClass = () => {
    if (gameState?.gameOver) {
      if (gameState.gameWinner === 'tie') {
        return 'neutral-glow'
      } else {
        return `${gameState.gameWinner.toLowerCase()}-glow`
      }
    }
    return `${gameState?.currentPlayer?.toLowerCase()}-glow`
  }

  return (
    <div className={`rules ${getThemeClass()}`}>
      <h3 className={`rules-title ${getGlowClass()}`}>How to Play:</h3>
      <ul>
        <li>Win small grids by getting 3 in a row within each section</li>
        <li>Your move determines which grid your opponent plays in next</li>
        <li>If target grid is won or full, play anywhere available</li>
        <li>Win by getting 3 small grids in a row</li>
      </ul>
    </div>
  )
}

export default Rules
