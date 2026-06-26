import React, { useMemo } from 'react'
import SmallBoard from './SmallBoard'

function SuperBoard({ boards, wonBoards, activeBoard, gameOver, gameWinner, currentPlayer, onCellClick, isMyTurn, hintMoves = [] }) {
  const containerClass = useMemo(() => {
    if (gameOver) {
      if (gameWinner === 'tie') return 'super-board tie-winner'
      return `super-board ${gameWinner.toLowerCase()}-winner`
    }
    return `super-board ${currentPlayer.toLowerCase()}-turn`
  }, [gameOver, gameWinner, currentPlayer])

  return (
    <div className={containerClass}>
      {boards.map((board, boardIndex) => {
        const boardHintMoves = hintMoves.filter(m => m.boardIndex === boardIndex)
        const hintCellIndices = boardHintMoves.map(m => m.cellIndex)
        return (
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
            hintCellIndices={hintCellIndices}
          />
        )
      })}
    </div>
  )
}

export default React.memo(SuperBoard)
