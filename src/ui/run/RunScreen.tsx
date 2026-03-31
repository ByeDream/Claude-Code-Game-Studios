/**
 * Run Screen — Main Run Loop UI Container
 *
 * Top-level screen that orchestrates the entire run loop:
 * - Start screen (new run button)
 * - Map view with RunMapCanvas + RunHUD
 * - Node interaction panels
 * - End screen (victory/defeat)
 *
 * @module src/ui/run/RunScreen
 * @see src/ui/run/useRunLoop
 */

import { useCallback } from 'react'
import { RunPhase, RunEndReason } from '../../gameplay/run/types'
import type { RunConfig } from '../../gameplay/run/types'
import { NodeType } from '../../gameplay/event/types'
import { TEST_HEROES } from '../../gameplay/hero/testHeroes'
import { useRunLoop } from './useRunLoop'
import { RunMapCanvas } from './RunMapCanvas'
import { RunHUD } from './RunHUD'
import { BattlePanel, RecruitPanel, ShopPanel, RestPanel, MysteryPanel } from './NodePanels'

// ---------------------------------------------------------------------------
// Default config for MVP
// ---------------------------------------------------------------------------

const DEFAULT_RUN_CONFIG: RunConfig = {
  campaignId: 'yellow_turban',
  startingHeroes: TEST_HEROES.slice(0, 3), // Start with 3 heroes
  startingHonor: 100,
  equipmentPool: [], // No equipment in MVP
  heroPool: TEST_HEROES,
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const screenStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f0f23',
  color: '#ecf0f1',
  fontFamily: 'sans-serif',
}

const startScreenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: '24px',
}

const endScreenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: '24px',
}

const mapContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  padding: '20px',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The main Run Screen — orchestrates the entire roguelike run loop UI.
 */
export function RunScreen() {
  const {
    runState,
    interaction,
    selectableNodeIds,
    startNewRun,
    onSelectNode,
    onResolveBattle,
    onResolveRecruit,
    onResolveShop,
    onResolveRest,
    onResolveMystery,
    onCompleteInteraction,
    onAbandonRun,
  } = useRunLoop(TEST_HEROES, [])

  const handleStartRun = useCallback(() => {
    startNewRun(DEFAULT_RUN_CONFIG)
  }, [startNewRun])

  // --- Start screen ---
  if (!runState) {
    return (
      <div style={screenStyle}>
        <div style={startScreenStyle}>
          <h1 style={{ fontSize: '48px', margin: 0 }}>⚔️ 英雄自走棋</h1>
          <p style={{ color: '#bdc3c7', fontSize: '18px' }}>三国 · 肉鸽模式</p>
          <button
            onClick={handleStartRun}
            style={{
              padding: '16px 48px',
              borderRadius: '8px',
              border: 'none',
              background: '#e74c3c',
              color: '#fff',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            开始征途
          </button>
          <div style={{ color: '#7f8c8d', fontSize: '12px', marginTop: '16px' }}>
            初始阵容: {DEFAULT_RUN_CONFIG.startingHeroes.map(h => h.name).join(', ')}
          </div>
        </div>
      </div>
    )
  }

  // --- End screen ---
  if (runState.phase === RunPhase.Ended) {
    const isVictory = runState.endReason === RunEndReason.Victory
    return (
      <div style={screenStyle}>
        <div style={endScreenStyle}>
          <div style={{ fontSize: '64px' }}>{isVictory ? '🎉' : '💀'}</div>
          <h1 style={{ margin: 0, color: isVictory ? '#2ecc71' : '#e74c3c' }}>
            {isVictory ? '征途胜利！' : '征途结束'}
          </h1>
          <p style={{ color: '#bdc3c7' }}>
            {isVictory
              ? '恭喜你击败了最终 Boss！'
              : runState.endReason === RunEndReason.HonorDepleted
                ? '荣誉耗尽，战败归来...'
                : '主动放弃了征途。'}
          </p>
          <div style={{
            display: 'flex',
            gap: '16px',
            background: '#1a1a2e',
            padding: '16px 32px',
            borderRadius: '8px',
          }}>
            <span>📍 已清节点: {runState.completedNodeIds.length}</span>
            <span>👥 阵容: {runState.roster.length}</span>
            <span>💰 金币: {runState.economy.gold}</span>
          </div>
          <button
            onClick={handleStartRun}
            style={{
              padding: '12px 36px',
              borderRadius: '8px',
              border: 'none',
              background: '#e74c3c',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '16px',
            }}
          >
            再来一局
          </button>
        </div>
      </div>
    )
  }

  // --- Active run ---
  return (
    <div style={screenStyle}>
      <RunHUD runState={runState} />

      {/* Map View */}
      {runState.phase === RunPhase.MapView && (
        <div>
          <div style={mapContainerStyle}>
            <RunMapCanvas
              map={runState.map}
              currentNodeId={runState.currentNodeId}
              completedNodeIds={runState.completedNodeIds}
              selectableNodeIds={selectableNodeIds}
              onNodeClick={onSelectNode}
            />
          </div>
          <div style={{ textAlign: 'center', color: '#7f8c8d', padding: '8px' }}>
            {selectableNodeIds.length > 0
              ? `点击黄色高亮节点选择下一步 (${selectableNodeIds.length} 条可选路径)`
              : '没有可选节点'}
          </div>
          <div style={{ textAlign: 'center', padding: '16px' }}>
            <button
              onClick={onAbandonRun}
              style={{
                padding: '8px 24px',
                borderRadius: '6px',
                border: '1px solid #7f8c8d',
                background: 'transparent',
                color: '#7f8c8d',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              放弃征途
            </button>
          </div>
        </div>
      )}

      {/* Node Interaction */}
      {runState.phase === RunPhase.NodeInteraction && interaction && (
        <div style={{ padding: '24px' }}>
          {(interaction.type === NodeType.Battle ||
            interaction.type === NodeType.Elite ||
            interaction.type === NodeType.Boss) && (
            <BattlePanel
              interaction={interaction}
              playerHeroes={runState.roster}
              enemies={interaction.enemies ?? []}
              onResolveBattle={onResolveBattle}
              onComplete={onCompleteInteraction}
            />
          )}

          {interaction.type === NodeType.Recruit && (
            <RecruitPanel
              interaction={interaction}
              gold={runState.economy.gold}
              onResolveRecruit={onResolveRecruit}
              onComplete={onCompleteInteraction}
            />
          )}

          {interaction.type === NodeType.Shop && (
            <ShopPanel
              interaction={interaction}
              gold={runState.economy.gold}
              onResolveShop={onResolveShop}
              onComplete={onCompleteInteraction}
            />
          )}

          {interaction.type === NodeType.Rest && (
            <RestPanel
              interaction={interaction}
              gold={runState.economy.gold}
              material={runState.economy.material}
              onResolveRest={onResolveRest}
              onComplete={onCompleteInteraction}
            />
          )}

          {interaction.type === NodeType.Mystery && (
            <MysteryPanel
              interaction={interaction}
              onResolveMystery={onResolveMystery}
              onComplete={onCompleteInteraction}
            />
          )}
        </div>
      )}
    </div>
  )
}
