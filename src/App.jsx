import { useState, useEffect, Suspense, lazy } from 'react'
const lazyImport = (importFn) => {
  return lazy(async () => {
    try {
      return await importFn()
    } catch (error) {
      if (error.message.includes('Failed to fetch dynamically imported module') || error.message.includes('Importing a module script failed')) {
        const hasReloaded = sessionStorage.getItem('lazy_reload')
        if (!hasReloaded) {
          sessionStorage.setItem('lazy_reload', 'true')
          window.location.reload()
          return new Promise(() => {}) // Keep suspended while reloading
        }
      }
      return Promise.reject(error)
    }
  })
}

const StartMenu     = lazyImport(() => import('./components/StartMenu'))
const GameContainer = lazyImport(() => import('./components/GameContainer'))
import { SupabaseProvider } from './contexts/SupabaseContext'
import './styles/index.css'

const DEFAULT_TIME = 0 // 0 = disabled

function App() {
  const [gameMode,      setGameMode]      = useState('menu')   // 'menu' | 'local' | 'bot' | 'online'
  const [gameCode,      setGameCode]      = useState('')
  const [botDifficulty, setBotDifficulty] = useState('medium') // 'easy' | 'medium' | 'hard'
  const [playerColor,   setPlayerColor]   = useState('X')      // 'X' | 'O'
  const [playerXTime,   setPlayerXTime]   = useState(DEFAULT_TIME)
  const [playerOTime,   setPlayerOTime]   = useState(DEFAULT_TIME)
  const [appClass,      setAppClass]      = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codeFromUrl = params.get('room') || params.get('code')
    if (codeFromUrl) {
      setGameCode(codeFromUrl.toUpperCase())
      setGameMode('online')
    }
  }, [])

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

  const handleStartLocalGame = (xTime = DEFAULT_TIME, oTime = DEFAULT_TIME, startingColor = 'X') => {
    setPlayerColor(startingColor)
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
