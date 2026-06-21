// Lightweight timer store using subscribe/getSnapshot pattern
// Avoids re-rendering the entire app every second; only subscribers update.
// A timer value of 0 means "disabled" — it never counts down.

let subscribers = new Set()
let state = { x: 300, o: 300 }
let interval = null

export function initTimers(x = 300, o = 300) {
  state = { x, o }
  emit()
}

export function getSnapshot() {
  return state
}

export function subscribe(cb) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

function emit() {
  subscribers.forEach(cb => cb())
}

/**
 * Format seconds as MM:SS. Returns '∞' when value is 0 (disabled).
 */
export function formatTime(seconds) {
  if (seconds === 0) return '∞'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function startTicking(getCurrentPlayer, getGameOver, onTimeout) {
  stopTicking()
  interval = setInterval(() => {
    try {
      if (typeof getGameOver === 'function' && getGameOver()) return
      const player = typeof getCurrentPlayer === 'function' ? getCurrentPlayer() : 'X'
      const key = player === 'O' ? 'o' : 'x'
      const current = state[key] ?? 0
      // 0 means disabled — never tick down
      if (current === 0) return
      const nextVal = Math.max(0, current - 1)
      state = { ...state, [key]: nextVal }
      emit()
      if (nextVal <= 0 && typeof onTimeout === 'function') {
        onTimeout(player)
      }
    } catch (_) {
      stopTicking()
    }
  }, 1000)
}

export function stopTicking() {
  if (interval) clearInterval(interval)
  interval = null
}
