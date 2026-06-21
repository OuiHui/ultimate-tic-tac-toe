import React, { useMemo } from 'react'

/**
 * Vertical chess-style evaluation bar.
 *
 * @param {{ score: number, playerColor: 'X'|'O' }} props
 *   score: -100 (O dominates) … 0 (equal) … +100 (X dominates)
 */
function EvalBar({ score, playerColor }) {
  const xPct = useMemo(() => {
    const clamped = Math.max(-100, Math.min(100, score ?? 0))
    return ((clamped + 100) / 200) * 100
  }, [score])

  const scoreLabel = useMemo(() => {
    const rounded = Math.round(score ?? 0)
    if (Math.abs(rounded) < 1) return '='
    return (rounded > 0 ? '+' : '') + rounded
  }, [score])

  const humanIsX = playerColor === 'X'

  return (
    <div className="eval-bar-wrapper" aria-label={`Evaluation: ${scoreLabel}`}>
      <div className="eval-bar-top-label">
        <span className="eval-bar-player-label eval-bar-x-label">X</span>
        {humanIsX && <span className="eval-bar-you-tag">you</span>}
      </div>

      <div className="eval-bar">
        <div
          className="eval-bar-x-fill"
          style={{ height: `${xPct}%` }}
        />
        <div className="eval-bar-divider" style={{ top: `${xPct}%` }} />
        <div className="eval-bar-o-fill" />
      </div>

      <div className="eval-bar-score">{scoreLabel}</div>

      <div className="eval-bar-bottom-label">
        {!humanIsX && <span className="eval-bar-you-tag">you</span>}
        <span className="eval-bar-player-label eval-bar-o-label">O</span>
      </div>
    </div>
  )
}

export default React.memo(EvalBar)

