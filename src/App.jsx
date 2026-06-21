import { useState, Suspense, lazy } from 'react'
const StartMenu     = lazy(() => import('./components/StartMenu'))
const GameContainer = lazy(() => import('./components/GameContainer'))
import { SupabaseProvider } from './contexts/SupabaseContext'
import './styles/index.css'

const DEFAULT_TIME = 300 // 5 minutes in seconds

function App() {
  const [gameMode,      setGameMode]      = useState('menu')   // 'menu' | 'local' | 'bot' | 'online'
  const [gameCode,      setGameCode]      = useState('')
  const [botDifficulty, setBotDifficulty] = useState('medium') // 'easy' | 'medium' | 'hard'
  const [playerColor,   setPlayerColor]   = useState('X')      // 'X' | 'O'
  const [playerXTime,   setPlayerXTime]   = useState(DEFAULT_TIME)
  const [playerOTime,   setPlayerOTime]   = useState(DEFAULT_TIME)
  const [appClass,      setAppClass]      = useState('')

  const navigateTo = (targetMode) => {
    setAppClass('fade-out')
    window.setTimeout(() => {
      setGameMode(targetMode)
      setAppClass('fade-in')
      window.setTimeout(() => setAppClass(''), 260)
    }, 260)
  }

  const handleStartBotGame = (difficulty, color, xTime = DEFAULT_TIME, oTime = DEFAULT_TIME) => {
    setBotDifficulty(difficulty)
    setPlayerColor(color)
    setPlayerXTime(xTime)
    setPlayerOTime(oTime)
    navigateTo('bot')
  }

  const handleStartLocalGame = (xTime = DEFAULT_TIME, oTime = DEFAULT_TIME) => {
    setPlayerXTime(xTime)
    setPlayerOTime(oTime)
    navigateTo('local')
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
              onStartLocalGame={handleStartLocalGame}
            />
          )}
          {gameMode !== 'menu' && (
            <GameContainer
              gameMode={gameMode}
              gameCode={gameCode}
              onBackToMenu={() => navigateTo('menu')}
              botDifficulty={botDifficulty}
              playerColor={playerColor}
              playerXTime={playerXTime}
              playerOTime={playerOTime}
            />
          )}
        </Suspense>
      </div>
    </SupabaseProvider>
  )
}

export default App
