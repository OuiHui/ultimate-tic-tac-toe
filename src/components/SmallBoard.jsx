import React, { useCallback, useMemo } from 'react'
import Cell from './Cell'

function SmallBoard({ boardIndex, board, isActive, winner, onCellClick, isMyTurn, currentPlayer, hintCellIndices = [] }) {
  const boardClasses = useMemo(() => {
    const classes = ['small-board']
    if (isActive) {
      classes.push('active')
      classes.push(`active-${currentPlayer.toLowerCase()}`)
    }
    if (winner) {
      classes.push('won')
      if (winner === 'X') classes.push('x-winner')
      else if (winner === 'O') classes.push('o-winner')
      else if (winner === 'tie') classes.push('tie-winner')
    }
    return classes
  }, [isActive, winner, currentPlayer])

  const handleClick = useCallback((cellIndex) => {
    onCellClick(boardIndex, cellIndex)
  }, [onCellClick, boardIndex])

  return (
    <div className={boardClasses.join(' ')}>
      <div className="board-grid">
        {board.map((cell, cellIndex) => (
          <Cell
            key={cellIndex}
            value={cell}
            onClick={() => handleClick(cellIndex)}
            disabled={!isActive || winner || cell || !isMyTurn}
            currentPlayer={currentPlayer}
            isHint={hintCellIndices.includes(cellIndex)}
          />
        ))}
      </div>

      {winner && (
        <div className={`board-winner ${winner.toLowerCase()}`}>
          {winner === 'tie' ? 'TIE' : winner}
        </div>
      )}
    </div>
  )
}

export default React.memo(SmallBoard)
