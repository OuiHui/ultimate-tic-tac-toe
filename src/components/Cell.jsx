import React from 'react'

function Cell({ value, onClick, onContextMenu, disabled, currentPlayer, isHint, isPlayed, isBestMove, markedBy }) {
  const cellClasses = ['cell']
  if (value) cellClasses.push(value.toLowerCase())
  if (currentPlayer) cellClasses.push(`current-${currentPlayer.toLowerCase()}`)
  if (isHint && !value) cellClasses.push('hint')
  if (isPlayed) cellClasses.push('played-cell')
  if (isBestMove && !value) cellClasses.push('best-move-cell')
  if (markedBy && !value) {
    cellClasses.push('marked-no-go')
    cellClasses.push(`marked-${markedBy.toLowerCase()}`)
  }

  return (
    <button
      className={cellClasses.join(' ')}
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
    >
      {value}
      {isHint && !value && <span className="hint-indicator" aria-hidden="true" />}
      {markedBy && !value && (
        <span className="no-go-indicator" aria-hidden="true">
          <svg
            className={`no-go-svg ${markedBy.toLowerCase()}-color`}
            viewBox="0 0 24 24"
            width="24"
            height="24"
          >
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      )}

    </button>
  )
}

export default React.memo(Cell, (prev, next) => (
  prev.value === next.value &&
  prev.disabled === next.disabled &&
  prev.currentPlayer === next.currentPlayer &&
  prev.onClick === next.onClick &&
  prev.onContextMenu === next.onContextMenu &&
  prev.isHint === next.isHint &&
  prev.isPlayed === next.isPlayed &&
  prev.isBestMove === next.isBestMove &&
  prev.markedBy === next.markedBy
))

