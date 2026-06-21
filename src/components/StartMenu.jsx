import { useState } from 'react'
import { useSupabase } from '../contexts/SupabaseContext'

function StartMenu({ onGameModeSelect, onGameCodeSet }) {
  const [showOnlineOptions, setShowOnlineOptions] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [createdGameCode, setCreatedGameCode] = useState('')
  const { supabase, createRoom, joinRoom } = useSupabase()

  const handleLocalGame = () => {
    onGameModeSelect('local')
  }

  const handleOnlineMultiplayer = () => {
    setShowOnlineOptions(true)
  }

  const handleCreateGame = async () => {
    if (!supabase) return
    if (displayName.trim()) {
      localStorage.setItem('displayName', displayName.trim())
    }
    
    try {
      const code = await createRoom(supabase)
      setCreatedGameCode(code)
      onGameCodeSet(code)
      onGameModeSelect('online')
    } catch (error) {
      console.error('Error creating game:', error)
    }
  }

  const handleJoinGame = async () => {
    if (!supabase || !joinCode.trim()) return
    if (displayName.trim()) {
      localStorage.setItem('displayName', displayName.trim())
    }
    
    const code = joinCode.trim().toUpperCase()
    
    try {
      await joinRoom(supabase, code)
      onGameCodeSet(code)
      onGameModeSelect('online')
    } catch (error) {
      console.error('Error joining game:', error)
      setJoinError('Game not found!')
    }
  }


  return (
    <div className="start-menu">
      <h2 className="menu-title">
        <span className="menu-title-line menu-title-super">Ultimate</span>
        <span className="menu-title-line menu-title-ttt">Tic Tac Toe</span>
      </h2>
      <p className="subtitle">Made by Huy Nguyen</p>
  <button onClick={handleLocalGame}>Local Play</button>
  <button onClick={handleOnlineMultiplayer}>Online Multiplayer</button>
      
      {showOnlineOptions && (
        <div className="online-options">
          <input
            type="text"
            className="display-name-input"
            placeholder="Enter display name"
            maxLength="20"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button onClick={handleCreateGame}>Create Room</button>
          <div style={{ margin: '0.5em 0', color: '#888' }}>or</div>
          <input
            type="text"
            className="join-code-input"
            placeholder="Room Code"
            maxLength="8"
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value)
              setJoinError('')
            }}
          />
          <button onClick={handleJoinGame}>Join Room</button>
          {joinError && <div className="join-error">{joinError}</div>}
          {createdGameCode && (
            <div className="game-code-box">
              Room Code: <span className="code-highlight">{createdGameCode}</span>
              <div className="code-instruction">Share this code to invite players</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default StartMenu
