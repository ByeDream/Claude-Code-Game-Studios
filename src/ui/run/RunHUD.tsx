/**
 * Run HUD — Persistent Status Display
 *
 * Shows gold, material, honor, roster count, and node progress
 * at the top of the run screen.
 *
 * @module src/ui/run/RunHUD
 */

import type { RunState } from '../../gameplay/run/types'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RunHUDProps {
  runState: RunState
}

/**
 * Persistent heads-up display showing run resources and status.
 */
export function RunHUD({ runState }: RunHUDProps) {
  const { economy, honor, roster, nodeIndex, completedNodeIds, map } = runState
  const totalNodes = map.layers.reduce((sum, l) => sum + l.nodes.length, 0)

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 24px',
      background: '#16213e',
      borderBottom: '2px solid #34495e',
      color: '#ecf0f1',
      fontFamily: 'sans-serif',
      flexWrap: 'wrap',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <span title="金币">💰 {economy.gold}</span>
        <span title="材料">🪨 {economy.material}</span>
        <span title="荣誉" style={{ color: honor <= 30 ? '#e74c3c' : '#ecf0f1' }}>
          🏆 {honor}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <span title="阵容">👥 {roster.length} 名武将</span>
        <span title="进度">📍 节点 {nodeIndex + 1} / ~{totalNodes}</span>
        <span title="已完成">✅ {completedNodeIds.length} 已清</span>
      </div>
    </div>
  )
}
