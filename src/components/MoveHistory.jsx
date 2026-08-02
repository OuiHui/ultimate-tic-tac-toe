import React, { useState, useRef, useEffect } from 'react'
import { formatMoveNotationShort, formatMoveNotationLong } from '../utils/notationUtils'

function MoveHistory({
  moveHistory = [],
  viewingIndex = null,
  onStepTo,
  onStepForward,
  onStepBackward,
  onStepToStart,
  onStepToLive,
  onBranchFrom,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const listEndRef = useRef(null)

  const isLive = viewingIndex === null || viewingIndex === moveHistory.length - 1
  const selectedMove = viewingIndex !== null && viewingIndex < moveHistory.length
    ? moveHistory[viewingIndex]
    : null

  // Auto-scroll move list to bottom when new moves arrive (only if live)
  useEffect(() => {
    if (isLive && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [moveHistory.length, isLive])

  const renderBadge = (classification) => {
    switch (classification) {
      case 'BLUNDER':
        return <span className="badge badge-blunder" title="Blunder: Significant drop in position eval">🔴 Blunder</span>
      case 'MISTAKE':
        return <span className="badge badge-mistake" title="Mistake: Missed a better move">⚠️ Mistake</span>
      case 'INACCURACY':
        return <span className="badge badge-inaccuracy" title="Inaccuracy">💬 Inaccuracy</span>
      case 'BEST':
        return <span className="badge badge-best" title="Best move!">⭐ Best</span>
      default:
        return null
    }
  }

  return (
    <div className={`move-history-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="move-history-header">
        <div className="move-history-title">
          <span className="icon">📜</span>
          <span>Move History</span>
          <span className={`status-pill ${isLive ? 'live' : 'history'}`}>
            {isLive ? 'LIVE' : `VIEWING #${(viewingIndex ?? 0) + 1}`}
          </span>
        </div>
        <button
          className="collapse-toggle"
          onClick={() => setIsCollapsed(prev => !prev)}
          title={isCollapsed ? 'Expand Move History' : 'Collapse Move History'}
        >
          {isCollapsed ? '◀' : '▶'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Step Navigation Controls */}
          <div className="history-controls">
            <button
              className="ctrl-btn"
              onClick={onStepToStart}
              disabled={moveHistory.length === 0 || viewingIndex === 0}
              title="First move (Start)"
            >
              ⏮
            </button>
            <button
              className="ctrl-btn"
              onClick={onStepBackward}
              disabled={moveHistory.length === 0 || viewingIndex === 0}
              title="Previous move"
            >
              ◀
            </button>
            <button
              className="ctrl-btn"
              onClick={onStepForward}
              disabled={isLive}
              title="Next move"
            >
              ▶
            </button>
            <button
              className="ctrl-btn"
              onClick={onStepToLive}
              disabled={isLive}
              title="Return to Live Game"
            >
              ⏭
            </button>
          </div>

          {/* Move List */}
          <div className="move-list-container">
            {moveHistory.length === 0 ? (
              <div className="empty-history">
                <span>No moves played yet</span>
              </div>
            ) : (
              <div className="move-list">
                {moveHistory.map((item, idx) => {
                  const isSelected = viewingIndex === idx || (viewingIndex === null && idx === moveHistory.length - 1)
                  const notation = formatMoveNotationShort(item.boardIndex, item.cellIndex)
                  const classification = item.analysis?.classification

                  return (
                    <div
                      key={idx}
                      className={`move-item ${isSelected ? 'selected' : ''} ${classification ? classification.toLowerCase() : ''}`}
                      onClick={() => onStepTo(idx)}
                    >
                      <span className="move-num">#{item.moveNumber}</span>
                      <span className={`player-icon ${item.player.toLowerCase()}`}>
                        {item.player}
                      </span>
                      <span className="move-notation">{notation}</span>
                      <div className="move-badges">
                        {renderBadge(classification)}
                      </div>
                    </div>
                  )
                })}
                <div ref={listEndRef} />
              </div>
            )}
          </div>

          {/* Inspection / Blunder Details Card */}
          {selectedMove && (
            <div className="inspection-card">
              <div className="inspection-header">
                <span className="inspection-title">
                  Move #{selectedMove.moveNumber} ({selectedMove.player})
                </span>
                {renderBadge(selectedMove.analysis?.classification)}
              </div>

              <div className="inspection-notation">
                {formatMoveNotationLong(selectedMove.boardIndex, selectedMove.cellIndex)}
              </div>

              {selectedMove.analysis && (
                <div className="inspection-stats">
                  <span className="stat-label">Position Eval:</span>
                  <span className="stat-val">
                    {selectedMove.analysis.scoreAfter > 0 ? `+${selectedMove.analysis.scoreAfter}` : selectedMove.analysis.scoreAfter}
                  </span>
                </div>
              )}

              {/* Recommended Best Move for Blunders/Mistakes */}
              {(selectedMove.analysis?.isBlunder || selectedMove.analysis?.classification === 'MISTAKE') && selectedMove.analysis?.bestMove && (
                <div className="blunder-recommendation">
                  <div className="recommend-title">💡 Better Alternative:</div>
                  <div className="recommend-move">
                    {formatMoveNotationLong(selectedMove.analysis.bestMove.boardIndex, selectedMove.analysis.bestMove.cellIndex)}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="inspection-actions">
                <button
                  className="branch-btn"
                  onClick={() => onBranchFrom(viewingIndex)}
                  title="Resume match from this board state"
                >
                  🌿 Branch from Here
                </button>
                {!isLive && (
                  <button className="live-btn" onClick={onStepToLive}>
                    ▶ Return to Live
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default React.memo(MoveHistory)
