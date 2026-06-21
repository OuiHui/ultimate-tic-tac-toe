import React, { useMemo } from 'react'
import SmallBoard from './SmallBoard'

function SuperBoard({ boards, wonBoards, activeBoard, gameOver, gameWinner, currentPlayer, onCellClick, isMyTurn, hintMove }) {
  const containerClass = useMemo(() => {
    if (gameOver) {
      if (gameWinner === 'tie') return 'super-board tie-winner'
      return `super-board ${gameWinner.toLowerCase()}-winner`
    }
    return `super-board ${currentPlayer.toLowerCase()}-turn`
  }, [gameOver, gameWinner, currentPlayer])

  return (
    <div className={containerClass}>
      {boards.map((board, boardIndex) => (
        <SmallBoard
          key={boardIndex}
          boardIndex={boardIndex}
          board={board}
          isActive={
            !gameOver &&
            !wonBoards[boardIndex] &&
            (activeBoard === null || activeBoard === boardIndex)
          }
          winner={wonBoards[boardIndex]}
          onCellClick={onCellClick}
          isMyTurn={isMyTurn}
          currentPlayer={currentPlayer}
          hintCellIndex={hintMove?.boardIndex === boardIndex ? hintMove.cellIndex : undefined}
        />
      ))}
    </div>
  )
}

export default React.memo(SuperBoard)
