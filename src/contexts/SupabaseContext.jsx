import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SupabaseContext = createContext()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helper to get or create persistent unique client ID
export function getPlayerId() {
  let id = sessionStorage.getItem('ttt-player-id')
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : 'player-' + Math.random().toString(36).substring(2, 9)
    sessionStorage.setItem('ttt-player-id', id)
  }
  return id
}

export function SupabaseProvider({ children }) {
  const [supabase] = useState(() => 
    supabaseUrl && supabaseAnonKey 
      ? createClient(supabaseUrl, supabaseAnonKey)
      : null
  )

  useEffect(() => {
    if (!supabase) {
      console.info('Supabase credentials not configured. Online multiplayer running in Local Cross-Tab Broadcast mode.')
    }
  }, [supabase])

  const value = {
    supabase,
    createRoom,
    joinRoom,
    makeMove,
    claimTimeout,
    subscribeToGame,
    unsubscribeFromGame,
    getPlayerId,
  }

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  )
}

// Generate random 6-character game code
function generateGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// Create a new game room
async function createRoom(supabase) {
  const code = generateGameCode()
  const now = new Date().toISOString()
  
  const initialState = {
    boards: Array(9).fill(null).map(() => Array(9).fill('')),
    currentPlayer: 'X',
    activeBoard: null,
    wonBoards: Array(9).fill(''),
    gameWinner: '',
    gameOver: false,
    playerXTime: 300,
    playerOTime: 300,
    gameStarted: false,
    turnStartTimestamp: now,
    lastMoveTimestamp: now,
    moveHistory: []
  }

  const roomData = {
    code,
    state: initialState,
    player_x: null,
    player_o: null,
    player_x_id: null,
    player_o_id: null,
    created_at: now,
    updated_at: now
  }

  // Save locally for cross-tab fallback
  try {
    localStorage.setItem(`ttt-room-${code}`, JSON.stringify(roomData))
  } catch (err) {
    console.debug('Failed to write to localStorage:', err)
  }

  if (supabase) {
    try {
      const { error } = await supabase
        .from('games')
        .insert({
          code,
          state: initialState,
          player_x: null,
          player_o: null,
          created_at: now,
          updated_at: now
        })
      if (error) console.warn('Supabase insert warning:', error.message)
    } catch (err) {
      console.warn('Supabase createRoom failed, relying on local broadcast:', err)
    }
  }

  return code
}

// Join an existing game room
async function joinRoom(supabase, code) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single()

      if (!error && data) {
        return data
      }
    } catch (err) {
      console.debug('Supabase join query skipped:', err)
    }
  }

  // Fallback to local storage room
  const localRoom = localStorage.getItem(`ttt-room-${code}`)
  if (localRoom) {
    try {
      return JSON.parse(localRoom)
    } catch (err) {
      console.debug('Failed to parse local room:', err)
    }
  }

  throw new Error('Game room not found')
}

// Make a move in the game
async function makeMove(supabase, code, newState, currentPlayerRole, moveHistory = []) {
  const now = new Date().toISOString()
  const payload = {
    ...newState,
    moveHistory: moveHistory.length > 0 ? moveHistory : (newState.moveHistory || [])
  }

  // Sync to local room store
  try {
    const raw = localStorage.getItem(`ttt-room-${code}`)
    if (raw) {
      const room = JSON.parse(raw)
      room.state = payload
      room.updated_at = now
      localStorage.setItem(`ttt-room-${code}`, JSON.stringify(room))
    }
  } catch (err) {
    console.debug('Local storage move sync error:', err)
  }

  // Broadcast locally across tabs
  try {
    const bc = new BroadcastChannel(`ttt-game-${code}`)
    bc.postMessage({ type: 'GAME_UPDATE', code, state: payload })
    bc.close()
  } catch (err) {
    console.debug('Broadcast channel error:', err)
  }

  if (!supabase) return payload

  // Direct table update
  try {
    const { data, error } = await supabase
      .from('games')
      .update({
        state: payload,
        updated_at: now
      })
      .eq('code', code)
      .select()

    if (error) {
      console.warn('Supabase update error (falling back to local broadcast):', error.message)
    }
    return data
  } catch (err) {
    console.warn('Supabase update failed:', err)
    return payload
  }
}

// Claim timeout for opponent
async function claimTimeout(supabase, code, timedOutPlayer) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('claim_timeout', {
      game_code: code,
      timed_out_player: timedOutPlayer
    })
    if (error) console.error('Error claiming timeout:', error)
    return data
  } catch (err) {
    console.error('Claim timeout failed:', err)
    return null
  }
}

// Subscribe to game updates
function subscribeToGame(supabase, code, callback) {
  let supabaseChannel = null
  let bc = null

  // BroadcastChannel listener for multi-tab
  try {
    bc = new BroadcastChannel(`ttt-game-${code}`)
    bc.onmessage = (e) => {
      if (e.data) {
        callback(e.data)
      }
    }
  } catch (err) {
    console.debug('Broadcast channel listen error:', err)
  }

  // Supabase subscription
  if (supabase) {
    supabaseChannel = supabase
      .channel(`game-${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `code=eq.${code}`
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
  }

  return { supabaseChannel, bc }
}

// Unsubscribe from game updates
async function unsubscribeFromGame(subscription) {
  if (!subscription) return
  if (subscription.supabaseChannel) {
    try {
      await subscription.supabaseChannel.unsubscribe()
    } catch (err) {
      console.debug('Unsubscribe error:', err)
    }
  }
  if (subscription.bc) {
    try {
      subscription.bc.close()
    } catch (err) {
      console.debug('BC close error:', err)
    }
  }
}

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}

