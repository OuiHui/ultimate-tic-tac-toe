import { createContext, useContext, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const SupabaseContext = createContext()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mlgfesypltoasmqxfccp.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dAY08kILqT_CKKyglUmMnQ_IBm2iH_i'

const supabaseClient = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

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
  const supabase = supabaseClient

  useEffect(() => {
    if (!supabase) {
      console.warn('Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured. Online multiplayer will be disabled.')
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
    notifyPlayerLeft,
    notifyPlayerRejoined,
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
async function createRoom(supabase, hostDisplayName = '', hostPlayerId = null, timerSeconds = 0, hostRole = 'X') {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please check environment variables.')
  }

  const code = generateGameCode().toUpperCase()
  const now = new Date().toISOString()
  const defaultDefaultName = hostRole === 'X' ? 'Player X' : 'Player O'
  const name = (hostDisplayName || '').trim() || defaultDefaultName
  const playerId = hostPlayerId || getPlayerId()
  
  const initialState = {
    boards: Array(9).fill(null).map(() => Array(9).fill('')),
    currentPlayer: 'X',
    activeBoard: null,
    wonBoards: Array(9).fill(''),
    gameWinner: '',
    gameOver: false,
    playerXTime: timerSeconds,
    playerOTime: timerSeconds,
    gameStarted: false,
    turnStartTimestamp: now,
    lastMoveTimestamp: now,
    moveHistory: []
  }

  const { error } = await supabase
    .from('games')
    .insert({
      code,
      state: initialState,
      player_x: hostRole === 'X' ? name : null,
      player_o: hostRole === 'O' ? name : null,
      player_x_id: hostRole === 'X' ? playerId : null,
      player_o_id: hostRole === 'O' ? playerId : null,
      created_at: now,
      updated_at: now
    })

  if (error) {
    console.error('Supabase createRoom error:', error.message)
    throw new Error(error.message)
  }

  return code
}

// Join an existing game room
async function joinRoom(supabase, rawCode) {
  if (!rawCode) throw new Error('Game room not found')
  if (!supabase) throw new Error('Supabase client is not configured. Please check environment variables.')
  
  const code = rawCode.trim().toUpperCase()

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('code', code)
    .single()

  if (error || !data) {
    throw new Error('Game room not found')
  }

  return data
}

// Make a move in the game
async function makeMove(supabase, code, newState, currentPlayerRole, moveHistory = []) {
  if (!supabase) throw new Error('Supabase client is not configured. Please check environment variables.')

  const now = new Date().toISOString()
  const rawHistory = moveHistory.length > 0 ? moveHistory : (newState.moveHistory || [])
  const cleanHistory = rawHistory.map(entry => {
    if (!entry) return entry
    const cleanPrev = entry.prevState ? { ...entry.prevState } : null
    if (cleanPrev && cleanPrev.moveHistory) delete cleanPrev.moveHistory
    const cleanAfter = entry.stateAfter ? { ...entry.stateAfter } : null
    if (cleanAfter && cleanAfter.moveHistory) delete cleanAfter.moveHistory
    return {
      ...entry,
      prevState: cleanPrev,
      stateAfter: cleanAfter,
    }
  })

  const payload = {
    ...newState,
    moveHistory: cleanHistory
  }

  const { data, error } = await supabase
    .from('games')
    .update({
      state: payload,
      updated_at: now
    })
    .eq('code', code)
    .select()

  if (error) {
    console.error('Supabase update error:', error.message)
    throw new Error(error.message)
  }
  return data
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

// Notify opponent when a player leaves the room
async function notifyPlayerLeft(supabase, code, playerRole) {
  if (!code || !playerRole || !supabase) return

  try {
    const channel = supabase.channel(`game-${code}`)
    await channel.send({
      type: 'broadcast',
      event: 'PLAYER_LEFT',
      payload: { player: playerRole }
    })
  } catch (err) {
    console.error('Error notifying player left:', err)
  }
}

// Notify opponent when a player rejoins the room
async function notifyPlayerRejoined(supabase, code, playerRole) {
  if (!code || !playerRole || !supabase) return

  try {
    const channel = supabase.channel(`game-${code}`)
    await channel.send({
      type: 'broadcast',
      event: 'PLAYER_REJOINED',
      payload: { player: playerRole }
    })
  } catch (err) {
    console.error('Error notifying player rejoined:', err)
  }
}

// Subscribe to game updates
function subscribeToGame(supabase, code, callback) {
  if (!supabase) return null

  const channelName = `game-${code}`
  const existingChannel = supabase.getChannels?.().find(ch => ch.topic === `realtime:${channelName}`)
  if (existingChannel) {
    supabase.removeChannel(existingChannel)
  }

  const supabaseChannel = supabase
    .channel(channelName)
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
    .on('broadcast', { event: 'PLAYER_LEFT' }, (payload) => {
      if (payload?.payload) {
        callback({ type: 'PLAYER_LEFT', ...payload.payload })
      }
    })
    .on('broadcast', { event: 'PLAYER_REJOINED' }, (payload) => {
      if (payload?.payload) {
        callback({ type: 'PLAYER_REJOINED', ...payload.payload })
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && supabaseChannel) {
        try {
          supabaseChannel.track({ online_at: new Date().toISOString(), player_id: getPlayerId() })
        } catch (_) {}
      }
    })

  return { supabaseChannel }
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
}

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
