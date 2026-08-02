import { formatMoveNotation } from './notationUtils'

/**
 * Serializes move history into a clean JSON structure for sharing and debugging.
 */
export function exportHistoryToJSON(moveHistory = [], gameState = {}, gameMode = 'pvp') {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    gameInfo: {
      gameMode,
      gameWinner: gameState?.gameWinner || 'In Progress',
      gameOver: !!gameState?.gameOver,
      totalMoves: moveHistory.length,
    },
    moves: moveHistory.map((entry) => ({
      moveNumber: entry.moveNumber,
      player: entry.player,
      boardIndex: entry.boardIndex,
      cellIndex: entry.cellIndex,
      notation: {
        full: formatMoveNotation(entry.boardIndex, entry.cellIndex, 'full'),
        algebraic: formatMoveNotation(entry.boardIndex, entry.cellIndex, 'algebraic'),
        short: formatMoveNotation(entry.boardIndex, entry.cellIndex, 'short'),
      },
      analysis: entry.analysis
        ? {
            classification: entry.analysis.classification,
            evalDelta: entry.analysis.evalDelta,
            scoreAfter: entry.analysis.scoreAfter,
            isBlunder: !!entry.analysis.isBlunder,
            bestAlternative: entry.analysis.bestMove
              ? formatMoveNotation(entry.analysis.bestMove.boardIndex, entry.analysis.bestMove.cellIndex, 'algebraic')
              : null,
          }
        : null,
    })),
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Formats move history as a human-readable text log.
 */
export function exportHistoryToText(moveHistory = [], gameState = {}, style = 'full') {
  const dateStr = new Date().toLocaleDateString()
  const winnerStr = gameState?.gameOver
    ? gameState.gameWinner
      ? `${gameState.gameWinner} Won`
      : 'Draw'
    : 'In Progress'

  const lines = [
    '========================================',
    '     ULTIMATE TIC-TAC-TOE GAME HISTORY   ',
    '========================================',
    `Date: ${dateStr}`,
    `Result: ${winnerStr}`,
    `Total Moves: ${moveHistory.length}`,
    '----------------------------------------',
    '',
  ]

  moveHistory.forEach((entry) => {
    const notation = formatMoveNotation(entry.boardIndex, entry.cellIndex, style)
    const classBadge = entry.analysis?.classification ? `[${entry.analysis.classification}]` : ''
    const evalScore = entry.analysis?.scoreAfter !== undefined
      ? `(Eval: ${entry.analysis.scoreAfter > 0 ? '+' : ''}${entry.analysis.scoreAfter})`
      : ''
    
    let altNote = ''
    if (entry.analysis?.bestMove && (entry.analysis.isBlunder || entry.analysis.classification === 'MISTAKE')) {
      const altNotation = formatMoveNotation(entry.analysis.bestMove.boardIndex, entry.analysis.bestMove.cellIndex, style)
      altNote = ` -> Best was ${altNotation}`
    }

    lines.push(`#${entry.moveNumber} ${entry.player}: ${notation} ${classBadge} ${evalScore}${altNote}`.trim())
  })

  lines.push('')
  lines.push('========================================')
  return lines.join('\n')
}

/**
 * Triggers browser file download.
 */
export function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copies text to system clipboard.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return true
  }
  
  // Fallback for older contexts
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  const success = document.execCommand('copy')
  document.body.removeChild(textArea)
  return success
}
