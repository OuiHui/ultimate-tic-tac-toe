import React, { useCallback, useMemo } from 'react'
import Cell from './Cell'

function SmallBoard({
  boardIndex,
  board,
  isActive,
  winner,
  onCellClick,
  onCellContextMenu,
  isMyTurn,
  currentPlayer,
  hintCellIndices = [],
  playedCellIndex = null,
  bestCellIndex = null,
  markedCells = {},
}) {
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

  const handleContextMenu = useCallback((e, cellIndex) => {
    e.preventDefault()
    if (onCellContextMenu) {
      onCellContextMenu(boardIndex, cellIndex)
    }
  }, [onCellContextMenu, boardIndex])

  return (
    <div className={boardClasses.join(' ')}>
      <div className="board-grid">
        {board.map((cell, cellIndex) => (
          <Cell
            key={cellIndex}
            value={cell}
            onClick={() => handleClick(cellIndex)}
            onContextMenu={(e) => handleContextMenu(e, cellIndex)}
            disabled={!isActive || winner || cell || !isMyTurn}
            currentPlayer={currentPlayer}
            isHint={hintCellIndices.includes(cellIndex)}
            isPlayed={playedCellIndex === cellIndex}
            isBestMove={bestCellIndex === cellIndex}
            markedBy={markedCells[`${boardIndex}-${cellIndex}`] || null}
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
