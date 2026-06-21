import { useState, Suspense, lazy } from 'react'
const StartMenu     = lazy(() => import('./components/StartMenu'))
const GameContainer = lazy(() => import('./components/GameContainer'))
import { SupabaseProvider } from './contexts/SupabaseContext'
import './styles/index.css'

function App() {
  const [gameMode,     setGameMode]     = useState('menu')   // 'menu' | 'local' | 'bot' | 'online'
  const [gameCode,     setGameCode]     = useState('')
  const [botDifficulty, setBotDifficulty] = useState('medium') // 'easy' | 'medium' | 'hard'
  const [playerColor,  setPlayerColor]  = useState('X')       // 'X' | 'O'
  const [appClass,     setAppClass]     = useState('')

  const navigateTo = (targetMode) => {
    setAppClass('fade-out')
    window.setTimeout(() => {
      setGameMode(targetMode)
      setAppClass('fade-in')
      window.setTimeout(() => setAppClass(''), 260)
    }, 260)
  }

  const handleStartBotGame = (difficulty, color) => {
    setBotDifficulty(difficulty)
    setPlayerColor(color)
    navigateTo('bot')
  }

  return (
    <SupabaseProvider>
      <div className={`App ${appClass}`}>
        <Suspense fallback={null}>
          {gameMode === 'menu' && (
            <StartMenu
              onGameModeSelect={navigateTo}
              onGameCodeSet={setGameCode}
              onStartBotGame={handleStartBotGame}
            />
          )}
          {gameMode !== 'menu' && (
            <GameContainer
              gameMode={gameMode}
              gameCode={gameCode}
              onBackToMenu={() => navigateTo('menu')}
              botDifficulty={botDifficulty}
              playerColor={playerColor}
            />
          )}
        </Suspense>
      </div>
    </SupabaseProvider>
  )
}

export default App
