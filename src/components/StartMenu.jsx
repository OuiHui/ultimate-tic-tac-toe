import { useState } from 'react'
import { useSupabase } from '../contexts/SupabaseContext'

// Timer presets: label → seconds (0 = disabled)
const TIMER_PRESETS = [
  { label: 'Off',  value: 0    },
  { label: '1m',   value: 60   },
  { label: '3m',   value: 180  },
  { label: '5m',   value: 300  },
  { label: '10m',  value: 600  },
]
const DEFAULT_TIMER = 0 // Off (disabled) by default

function TimerPresets({ selected, onChange }) {
  return (
    <div className="ai-option-group">
      <div className="ai-option-label">Timer (per player)</div>
      <div className="ai-option-buttons timer-presets">
        {TIMER_PRESETS.map(({ label, value }) => (
          <button
            key={label}
            className={`ai-option-btn${selected === value ? ' selected-neutral' : ''}`}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StartMenu({ onGameModeSelect, onGameCodeSet, onStartBotGame, onStartLocalGame }) {
  // ── Online options ────────────────────────────────────────────
  const [showOnlineOptions, setShowOnlineOptions] = useState(false)
  const [displayName, setDisplayName]   = useState(() => localStorage.getItem('displayName') || '')
  const [joinCode, setJoinCode]         = useState('')
  const [joinError, setJoinError]       = useState('')
  const [createdGameCode, setCreatedGameCode] = useState('')
  const [onlineTimer, setOnlineTimer]   = useState(DEFAULT_TIMER)
  const [onlineColor, setOnlineColor]   = useState('X')

  // ── AI options ────────────────────────────────────────────────
  const [showAIOptions, setShowAIOptions] = useState(false)
  const [aiDifficulty, setAIDifficulty]  = useState('medium')
  const [aiColor, setAIColor]            = useState('X')
  const [aiTimer, setAITimer]            = useState(DEFAULT_TIMER)

  // ── Local options ─────────────────────────────────────────────
  const [showLocalOptions, setShowLocalOptions] = useState(false)
  const [localTimer, setLocalTimer]             = useState(DEFAULT_TIMER)
  const [localFirstPlayer, setLocalFirstPlayer] = useState('X')

  const { supabase, createRoom, joinRoom, getPlayerId } = useSupabase()

  // ── Local ─────────────────────────────────────────────────────
  const handleLocalGame = () => {
    // If no timer customisation needed, start directly; otherwise show options
    if (onStartLocalGame) {
      onStartLocalGame(localTimer, localTimer, localFirstPlayer)
    } else {
      onGameModeSelect('local')
    }
  }

  // ── Bot ───────────────────────────────────────────────────────
  const handleStartAI = () => {
    onStartBotGame(aiDifficulty, aiColor, aiTimer, aiTimer)
  }

  // ── Online ────────────────────────────────────────────────────
  const handleOnlineMultiplayer = () => setShowOnlineOptions(true)

  const handleCreateGame = async () => {
    const trimmedName = displayName.trim()
    if (trimmedName) {
      localStorage.setItem('displayName', trimmedName)
    } else {
      localStorage.removeItem('displayName')
    }
    const defaultName = onlineColor === 'X' ? 'Player X' : 'Player O'
    const name = trimmedName || defaultName
    try {
      const myId = getPlayerId()
      const code = await createRoom(supabase, name, myId, onlineTimer, onlineColor)
      setCreatedGameCode(code)
      onGameCodeSet(code)
      onGameModeSelect('online')
    } catch (err) {
      console.error('Error creating game:', err)
      setJoinError('Error creating room. Please try again.')
    }
  }

  const handleJoinGame = async () => {
    if (!joinCode.trim()) return
    const trimmedName = displayName.trim()
    if (trimmedName) {
      localStorage.setItem('displayName', trimmedName)
    } else {
      localStorage.removeItem('displayName')
    }
    const code = joinCode.trim().toUpperCase()
    try {
      await joinRoom(supabase, code)
      onGameCodeSet(code)
      onGameModeSelect('online')
    } catch (err) {
      console.error('Error joining game:', err)
      if (!supabase) {
        setJoinError(`Room "${code}" not found! In local mode (no Supabase), open a 2nd tab in the same browser window where the room was created.`)
      } else {
        setJoinError(`Room "${code}" not found. Check the code and try again.`)
      }
    }
  }

  // ── Difficulty button class helper ────────────────────────────
  const diffClass = (d) =>
    `ai-option-btn ${aiDifficulty === d ? 'selected-neutral' : ''}`

  // ── Color button class helper ─────────────────────────────────
  const colorClass = (c) =>
    `ai-option-btn ${aiColor === c ? (c === 'X' ? 'selected-x' : 'selected-o') : ''}`

  return (
    <div className="start-menu">
      <h2 className="menu-title">
        <span className="menu-title-line menu-title-super">Ultimate</span>
        <span className="menu-title-line menu-title-ttt">Tic Tac Toe</span>
      </h2>
      <p className="subtitle">Made by Huy Nguyen</p>

      {/* ── Main buttons ── */}
      {!showAIOptions && !showOnlineOptions && !showLocalOptions && (
        <>
          <button onClick={() => setShowLocalOptions(true)}>Local Play</button>
          <button onClick={() => setShowAIOptions(true)}>Play AI</button>
          <button onClick={handleOnlineMultiplayer}>Online Multiplayer</button>
        </>
      )}

      {/* ── Local settings panel ── */}
      {showLocalOptions && (
        <div className="ai-options">
          <div className="ai-options-title">Local Play Settings</div>

          <div className="ai-option-group">
            <div className="ai-option-label">First Move</div>
            <div className="ai-option-buttons">
              <button
                className={`ai-option-btn ${localFirstPlayer === 'X' ? 'selected-x' : ''}`}
                onClick={() => setLocalFirstPlayer('X')}
              >
                X&nbsp;<span style={{ fontSize: '0.6em', opacity: 0.7 }}>(1st)</span>
              </button>
              <button
                className={`ai-option-btn ${localFirstPlayer === 'O' ? 'selected-o' : ''}`}
                onClick={() => setLocalFirstPlayer('O')}
              >
                O&nbsp;<span style={{ fontSize: '0.6em', opacity: 0.7 }}>(1st)</span>
              </button>
            </div>
          </div>

          <TimerPresets selected={localTimer} onChange={setLocalTimer} />

          <button onClick={handleLocalGame}>Start Game</button>
          <button onClick={() => setShowLocalOptions(false)}>← Back</button>
        </div>
      )}

      {/* ── AI settings panel ── */}
      {showAIOptions && (
        <div className="ai-options">
          <div className="ai-options-title">AI Settings</div>

          <div className="ai-option-group">
            <div className="ai-option-label">Difficulty</div>
            <div className="ai-option-buttons">
              {['easy', 'medium', 'hard'].map(d => (
                <button
                  key={d}
                  className={diffClass(d)}
                  onClick={() => setAIDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-option-group">
            <div className="ai-option-label">Play as</div>
            <div className="ai-option-buttons">
              <button className={colorClass('X')} onClick={() => setAIColor('X')}>
                X&nbsp;<span style={{ fontSize: '0.6em', opacity: 0.7 }}>(1st)</span>
              </button>
              <button className={colorClass('O')} onClick={() => setAIColor('O')}>
                O&nbsp;<span style={{ fontSize: '0.6em', opacity: 0.7 }}>(2nd)</span>
              </button>
            </div>
          </div>

          <TimerPresets selected={aiTimer} onChange={setAITimer} />

          <button onClick={handleStartAI}>Start Game</button>
          <button onClick={() => setShowAIOptions(false)}>← Back</button>
        </div>
      )}

      {/* ── Online options panel ── */}
      {showOnlineOptions && (
        <div className="online-options">
          <div className="multiplayer-mode-badge">
            {supabase ? '🌐 Cloud Online Mode' : '⚡ Local Multi-Tab Mode'}
          </div>

          <input
            type="text"
            className="display-name-input"
            placeholder="Enter display name"
            maxLength="20"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />

          <div className="ai-option-group">
            <div className="ai-option-label">Play as</div>
            <div className="ai-option-buttons">
              <button
                className={`ai-option-btn ${onlineColor === 'X' ? 'selected-x' : ''}`}
                onClick={() => setOnlineColor('X')}
              >
                X&nbsp;<span style={{ fontSize: '0.6em', opacity: 0.7 }}>(1st)</span>
              </button>
              <button
                className={`ai-option-btn ${onlineColor === 'O' ? 'selected-o' : ''}`}
                onClick={() => setOnlineColor('O')}
              >
                O&nbsp;<span style={{ fontSize: '0.6em', opacity: 0.7 }}>(2nd)</span>
              </button>
            </div>
          </div>

          <TimerPresets selected={onlineTimer} onChange={setOnlineTimer} />

          <button onClick={handleCreateGame}>Create Room</button>
          <div style={{ margin: '0.5em 0', color: '#888' }}>or</div>
          <input
            type="text"
            className="join-code-input"
            placeholder="Room Code"
            maxLength="8"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value); setJoinError('') }}
          />
          <button onClick={handleJoinGame}>Join Room</button>
          {joinError && <div className="join-error">{joinError}</div>}
          {createdGameCode && (
            <div className="game-code-box">
              Room Code: <span className="code-highlight">{createdGameCode}</span>
              <div className="code-instruction">Share this code to invite players</div>
            </div>
          )}
          <button onClick={() => setShowOnlineOptions(false)}>← Back</button>
        </div>
      )}
    </div>
  )
}

export default StartMenu
