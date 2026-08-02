import React from 'react'

function Cell({ value, onClick, disabled, currentPlayer, isHint, isPlayed, isBestMove }) {
  const cellClasses = ['cell']
  if (value) cellClasses.push(value.toLowerCase())
  if (currentPlayer) cellClasses.push(`current-${currentPlayer.toLowerCase()}`)
  if (isHint && !value) cellClasses.push('hint')
  if (isPlayed) cellClasses.push('played-cell')
  if (isBestMove && !value) cellClasses.push('best-move-cell')

  return (
    <button
      className={cellClasses.join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {value}
      {isHint && !value && <span className="hint-indicator" aria-hidden="true" />}
    </button>
  )
}

export default React.memo(Cell, (prev, next) => (
  prev.value === next.value &&
  prev.disabled === next.disabled &&
  prev.currentPlayer === next.currentPlayer &&
  prev.onClick === next.onClick &&
  prev.isHint === next.isHint &&
  prev.isPlayed === next.isPlayed &&
  prev.isBestMove === next.isBestMove
))
