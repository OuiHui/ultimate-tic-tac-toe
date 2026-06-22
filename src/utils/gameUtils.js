// Custom game utilities and helper functions
import { WIN_PATTERNS } from './constants.js'

export const GAME_CONSTANTS = {
  INITIAL_TIME: 500,
  BOARD_SIZE: 9,
  WIN_PATTERNS
}

export const generateGameCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const formatTimeDisplay = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
}

export const calculateBoardStatus = (board) => {
  for (const pattern of GAME_CONSTANTS.WIN_PATTERNS) {
    const [a, b, c] = pattern
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  return board.every(cell => cell !== '') ? 'tie' : ''
}

export const getRandomColor = () => {
  const colors = ['#e74c3c', '#3498db', '#9b59b6', '#e67e22', '#27ae60']
  return colors[Math.floor(Math.random() * colors.length)]
}
