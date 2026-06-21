import { useState } from 'react'
import { useSupabase } from '../contexts/SupabaseContext'

function StartMenu({ onGameModeSelect, onGameCodeSet, onStartBotGame }) {
  // ── Online options ────────────────────────────────────────────
  const [showOnlineOptions, setShowOnlineOptions] = useState(false)
  const [displayName, setDisplayName]   = useState('')
  const [joinCode, setJoinCode]         = useState('')
  const [joinError, setJoinError]       = useState('')
  const [createdGameCode, setCreatedGameCode] = useState('')

  // ── AI options ────────────────────────────────────────────────
  const [showAIOptions, setShowAIOptions] = useState(false)
  const [aiDifficulty, setAIDifficulty]  = useState('medium')
  const [aiColor, setAIColor]            = useState('X')

  const { supabase, createRoom, joinRoom } = useSupabase()

  // ── Local ─────────────────────────────────────────────────────
  const handleLocalGame = () => onGameModeSelect('local')

  // ── Bot ───────────────────────────────────────────────────────
  const handleStartAI = () => {
    onStartBotGame(aiDifficulty, aiColor)
  }

  // ── Online ────────────────────────────────────────────────────
  const handleOnlineMultiplayer = () => setShowOnlineOptions(true)

  const handleCreateGame = async () => {
    if (!supabase) return
    if (displayName.trim()) localStorage.setItem('displayName', displayName.trim())
    try {
      const code = await createRoom(supabase)
      setCreatedGameCode(code)
      onGameCodeSet(code)
      onGameModeSelect('online')
    } catch (err) {
      console.error('Error creating game:', err)
    }
  }

  const handleJoinGame = async () => {
    if (!supabase || !joinCode.trim()) return
    if (displayName.trim()) localStorage.setItem('displayName', displayName.trim())
    const code = joinCode.trim().toUpperCase()
    try {
      await joinRoom(supabase, code)
      onGameCodeSet(code)
      onGameModeSelect('online')
    } catch (err) {
      console.error('Error joining game:', err)
      setJoinError('Game not found!')
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
      {!showAIOptions && !showOnlineOptions && (
        <>
          <button onClick={handleLocalGame}>Local Play</button>
          <button onClick={() => setShowAIOptions(true)}>Play AI</button>
          <button onClick={handleOnlineMultiplayer}>Online Multiplayer</button>
        </>
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

          <button onClick={handleStartAI}>Start Game</button>
          <button onClick={() => setShowAIOptions(false)}>← Back</button>
        </div>
      )}

      {/* ── Online options panel ── */}
      {showOnlineOptions && (
        <div className="online-options">
          <input
            type="text"
            className="display-name-input"
            placeholder="Enter display name"
            maxLength="20"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
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
