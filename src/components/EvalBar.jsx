import React, { useMemo } from 'react'

/**
 * Vertical chess-style evaluation bar.
 *
 * @param {{ score: number, playerColor: 'X'|'O' }} props
 *   score: -100 (O dominates) … 0 (equal) … +100 (X dominates)
 */
function EvalBar({ score, playerColor }) {
  const rounded = Math.round(score ?? 0)
  const clamped = Math.max(-100, Math.min(100, score ?? 0))
  const xPct = ((clamped + 100) / 200) * 100

  const scoreLabel = useMemo(() => {
    if (Math.abs(rounded) < 1) return '='
    return (rounded > 0 ? '+' : '') + rounded
  }, [rounded])

  const scoreColor = useMemo(() => {
    if (Math.abs(rounded) < 1) return 'rgba(255, 255, 255, 0.7)'
    return rounded > 0 ? '#ff3250' : '#00c8ff'
  }, [rounded])

  const humanIsX = playerColor === 'X'

  return (
    <div className="eval-bar-wrapper" aria-label={`Evaluation: ${scoreLabel}`}>
      <div className="eval-bar-top-label">
        <span className="eval-bar-player-label eval-bar-x-label">X</span>
        {humanIsX && <span className="eval-bar-you-tag">you</span>}
        {rounded > 0 && (
          <span className="eval-bar-score" style={{ color: scoreColor }}>
            {scoreLabel}
          </span>
        )}
      </div>

      <div className="eval-bar">
        <div
          className="eval-bar-x-fill"
          style={{ height: `${xPct}%` }}
        />
        <div className="eval-bar-divider" style={{ top: `${xPct}%` }} />
        <div className="eval-bar-o-fill" />
        {rounded === 0 && (
          <span className="eval-bar-score eval-bar-score-center" style={{ color: scoreColor }}>
            {scoreLabel}
          </span>
        )}
      </div>

      <div className="eval-bar-bottom-label">
        {rounded < 0 && (
          <span className="eval-bar-score" style={{ color: scoreColor }}>
            {scoreLabel}
          </span>
        )}
        {!humanIsX && <span className="eval-bar-you-tag">you</span>}
        <span className="eval-bar-player-label eval-bar-o-label">O</span>
      </div>
    </div>
  )
}

export default React.memo(EvalBar)

