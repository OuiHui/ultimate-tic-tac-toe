import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SupabaseContext = createContext()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function SupabaseProvider({ children }) {
  const [supabase] = useState(() => 
    supabaseUrl && supabaseAnonKey 
      ? createClient(supabaseUrl, supabaseAnonKey)
      : null
  )

  if (!supabase) {
    console.error('Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
  }

  const value = {
    supabase,
    createRoom,
    joinRoom,
    makeMove,
    claimTimeout,
    subscribeToGame,
    unsubscribeFromGame
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
    lastMoveTimestamp: now
  }

  const { data, error } = await supabase
    .from('games')
    .insert({
      code,
      state: initialState,
      player_x: null,
      player_o: null,
      created_at: now,
      updated_at: now
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating room:', error)
    throw error
  }

  return code
}

// Join an existing game room
async function joinRoom(supabase, code) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('code', code)
    .single()

  if (error || !data) {
    throw new Error('Game not found')
  }

  return data
}

// Make a move in the game
async function makeMove(supabase, code, newState, currentPlayerRole) {
  const now = new Date().toISOString()
  const currentTime = Date.now()

  // Call server function to validate and make move
  const { data, error } = await supabase.rpc('make_move', {
    game_code: code,
    new_state: newState,
    player_role: currentPlayerRole,
    move_timestamp: now
  })

  if (error) {
    console.error('Error making move:', error)
    throw error
  }

  return data
}

// Claim timeout for opponent
async function claimTimeout(supabase, code, timedOutPlayer) {
  const { data, error } = await supabase.rpc('claim_timeout', {
    game_code: code,
    timed_out_player: timedOutPlayer
  })

  if (error) {
    console.error('Error claiming timeout:', error)
    throw error
  }

  return data
}

// Subscribe to game updates
function subscribeToGame(supabase, code, callback) {
  const channel = supabase
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

  return channel
}

// Unsubscribe from game updates
async function unsubscribeFromGame(channel) {
  if (channel) {
    await channel.unsubscribe()
  }
}

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}
