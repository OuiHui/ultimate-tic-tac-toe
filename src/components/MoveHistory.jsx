import React, { useState, useRef, useEffect } from 'react'
import {
  formatMoveNotation,
  formatMoveNotationLong,
  getBoardCellDetails,
  GRID_NAMES_LONG,
  GRID_ALGEBRAIC_BOARD,
  GRID_NAMES_SHORT
} from '../utils/notationUtils'
import {
  exportHistoryToJSON,
  exportHistoryToText,
  downloadFile,
  copyToClipboard
} from '../utils/exportUtils'

function MoveHistory({
  moveHistory = [],
  viewingIndex = null,
  gameState = {},
  gameMode = 'pvp',
  onStepTo,
  onStepForward,
  onStepBackward,
  onStepToStart,
  onStepToLive,
  onBranchFrom,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [notationStyle, setNotationStyle] = useState(() => {
    return localStorage.getItem('ttt_notation_style') || 'full'
  })
  const listEndRef = useRef(null)

  const isLive = viewingIndex === null || viewingIndex === moveHistory.length - 1
  const selectedMove = viewingIndex !== null && viewingIndex < moveHistory.length
    ? moveHistory[viewingIndex]
    : null

  const handleStyleChange = (newStyle) => {
    setNotationStyle(newStyle)
    localStorage.setItem('ttt_notation_style', newStyle)
  }

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 2500)
  }

  const handleCopyJSON = async () => {
    const jsonStr = exportHistoryToJSON(moveHistory, gameState, gameMode)
    const success = await copyToClipboard(jsonStr)
    if (success) {
      triggerToast('Copied JSON to Clipboard! 📋')
    }
  }

  const handleDownloadJSON = () => {
    const jsonStr = exportHistoryToJSON(moveHistory, gameState, gameMode)
    downloadFile(jsonStr, `uttt_game_${Date.now()}.json`, 'application/json')
    triggerToast('Downloaded JSON File! 💾')
  }

  const handleCopyText = async () => {
    const textStr = exportHistoryToText(moveHistory, gameState, notationStyle)
    const success = await copyToClipboard(textStr)
    if (success) {
      triggerToast('Copied Text Log to Clipboard! 📋')
    }
  }

  const handleDownloadText = () => {
    const textStr = exportHistoryToText(moveHistory, gameState, notationStyle)
    downloadFile(textStr, `uttt_game_${Date.now()}.txt`, 'text/plain')
    triggerToast('Downloaded Text File! 💾')
  }

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
      case 'GOOD':
        return <span className="badge badge-good" title="Good move">👍 Good</span>
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
        <div className="header-actions">
          <button
            className={`export-header-btn ${showExportModal ? 'active' : ''}`}
            onClick={() => {
              setShowExportModal(prev => !prev)
              if (showLegend) setShowLegend(false)
            }}
            title="Export Game History"
          >
            📤 Export
          </button>
          <button
            className="collapse-toggle"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Expand Move History' : 'Collapse Move History'}
          >
            {isCollapsed ? '◀' : '▶'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Notation Style Selector & Legend Toggle */}
          <div className="notation-toolbar">
            <label htmlFor="notation-select" className="notation-label">
              Notation:
            </label>
            <select
              id="notation-select"
              className="notation-select"
              value={notationStyle}
              onChange={(e) => handleStyleChange(e.target.value)}
              title="Select notation format style"
            >
              <option value="full">Full Words (Top-Left → Center)</option>
              <option value="algebraic">Algebraic (A1 → b2)</option>
              <option value="numeric">Numbers (Board 1 → Cell 5)</option>
              <option value="short">Short (TL → C)</option>
            </select>
            <button
              className={`legend-toggle-btn ${showLegend ? 'active' : ''}`}
              onClick={() => {
                setShowLegend(prev => !prev)
                if (showExportModal) setShowExportModal(false)
              }}
              title="Show Notation Grid Guide"
            >
              ❓ Guide
            </button>
          </div>

          {/* Interactive Notation Legend Overlay */}
          {showLegend && (
            <div className="notation-legend-card">
              <div className="legend-card-header">
                <span>📍 Grid Coordinates Guide</span>
                <button className="legend-close-btn" onClick={() => setShowLegend(false)}>✕</button>
              </div>
              <p className="legend-desc">
                Format: <strong>Sub-Board → Target Cell</strong>. Both use the 3x3 layout:
              </p>
              <div className="legend-grid">
                {GRID_NAMES_LONG.map((name, idx) => (
                  <div key={idx} className="legend-grid-item">
                    <span className="legend-name">{name}</span>
                    <div className="legend-codes">
                      <span className="code-badge alg">{GRID_ALGEBRAIC_BOARD[idx]}</span>
                      <span className="code-badge num">#{idx + 1}</span>
                      <span className="code-badge srt">{GRID_NAMES_SHORT[idx]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Game History Overlay */}
          {showExportModal && (
            <div className="export-modal-card">
              <div className="modal-header">
                <span>📤 Export Game History</span>
                <button className="modal-close-btn" onClick={() => setShowExportModal(false)}>✕</button>
              </div>
              <div className="export-actions-grid">
                <button className="export-action-btn" onClick={handleCopyJSON} title="Copy JSON history to clipboard">
                  <span>📋 Copy JSON</span>
                </button>
                <button className="export-action-btn" onClick={handleDownloadJSON} title="Download .json game file">
                  <span>💾 Save JSON</span>
                </button>
                <button className="export-action-btn" onClick={handleCopyText} title="Copy formatted text log to clipboard">
                  <span>📋 Copy Text</span>
                </button>
                <button className="export-action-btn" onClick={handleDownloadText} title="Download .txt notation file">
                  <span>💾 Save Text</span>
                </button>
              </div>
              <div className="export-preview-box">
                <div className="preview-label">JSON Preview:</div>
                <textarea
                  className="export-textarea"
                  readOnly
                  value={exportHistoryToJSON(moveHistory, gameState, gameMode)}
                />
              </div>
            </div>
          )}

          {toastMessage && (
            <div className="history-toast-notification">
              {toastMessage}
            </div>
          )}

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
                  const notation = formatMoveNotation(item.boardIndex, item.cellIndex, notationStyle)
                  const fullTooltip = formatMoveNotationLong(item.boardIndex, item.cellIndex)
                  const classification = item.analysis?.classification

                  return (
                    <div
                      key={idx}
                      className={`move-item ${isSelected ? 'selected' : ''} ${classification ? classification.toLowerCase() : ''}`}
                      onClick={() => onStepTo(idx)}
                      title={`Move #${item.moveNumber} by ${item.player}: ${fullTooltip}`}
                    >
                      <span className="move-num">#{item.moveNumber}</span>
                      <span className={`player-icon ${item.player.toLowerCase()}`}>
                        {item.player}
                      </span>
                      <span className="move-notation" title={fullTooltip}>{notation}</span>
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
          {selectedMove && (() => {
            const details = getBoardCellDetails(selectedMove.boardIndex, selectedMove.cellIndex)
            return (
              <div className="inspection-card">
                <div className="inspection-header">
                  <span className="inspection-title">
                    Move #{selectedMove.moveNumber} ({selectedMove.player})
                  </span>
                  {renderBadge(selectedMove.analysis?.classification)}
                </div>

                <div className="inspection-notation">
                  {formatMoveNotation(selectedMove.boardIndex, selectedMove.cellIndex, notationStyle)}
                </div>

                <div className="inspection-breakdown">
                  <div className="breakdown-item">
                    <span className="bd-label">Board:</span>
                    <span className="bd-val">{details.boardLong} ({details.boardShort} / {details.boardAlg})</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="bd-label">Cell:</span>
                    <span className="bd-val">{details.cellLong} ({details.cellShort} / {details.cellAlg})</span>
                  </div>
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
                      {formatMoveNotation(
                        selectedMove.analysis.bestMove.boardIndex,
                        selectedMove.analysis.bestMove.cellIndex,
                        notationStyle
                      )}
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
            )
          })()}
        </>
      )}
    </div>
  )
}

export default React.memo(MoveHistory)
