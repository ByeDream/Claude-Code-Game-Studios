/**
 * 煮酒 (Heroes' Toast) — Main App
 *
 * Sprint 1 prototype: 5v5 auto-battle visualization.
 * Canvas renders the battle, React controls playback.
 */

import { createHeroInstance } from './gameplay/hero/heroFactory'
import { GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU } from './gameplay/hero/testHeroes'
import { NamelessTemplateType } from './gameplay/enemy/types'
import { createNamelessUnit } from './gameplay/enemy/enemyFactory'
import { BattleCanvas } from './ui/battle/BattleCanvas'
import { useBattleSimulation } from './ui/battle/useBattleSimulation'

function App() {
  const sim = useBattleSimulation()

  const handleStartBattle = () => {
    const playerHeroes = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h =>
      createHeroInstance(h)
    )
    // Mid-strength enemies: mixed types at node 10
    const enemies = [
      createNamelessUnit(NamelessTemplateType.LegionLeader, 10, 0),
      createNamelessUnit(NamelessTemplateType.Lieutenant, 10, 1),
      createNamelessUnit(NamelessTemplateType.CavalryLeader, 10, 2),
      createNamelessUnit(NamelessTemplateType.Advisor, 10, 3),
      createNamelessUnit(NamelessTemplateType.LegionLeader, 10, 4),
    ]
    sim.startBattle(playerHeroes, enemies)
  }

  const handleStartHardBattle = () => {
    const playerHeroes = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h =>
      createHeroInstance(h)
    )
    // Tough enemies: scaled to node 22
    const enemies = Array.from({ length: 5 }, (_, i) =>
      createNamelessUnit(NamelessTemplateType.LegionLeader, 22, i)
    )
    sim.startBattle(playerHeroes, enemies)
  }

  return (
    <div style={{
      padding: '1rem 2rem',
      fontFamily: 'sans-serif',
      background: '#0d1117',
      color: '#e6edf3',
      minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        煮酒 — 战斗原型
      </h1>
      <p style={{ color: '#8b949e', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Sprint 1 · 5v5 自走棋自动战斗 · Canvas 可视化
      </p>

      {/* Controls */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleStartBattle} style={btnStyle}>
          ⚔️ 开战 (弱敌)
        </button>
        <button onClick={handleStartHardBattle} style={btnStyle}>
          ⚔️ 开战 (强敌)
        </button>
        {sim.frames.length > 0 && (
          <>
            {sim.isPlaying ? (
              <button onClick={sim.pause} style={btnStyle}>⏸ 暂停</button>
            ) : (
              <button onClick={sim.play} style={btnStyle}>▶ 播放</button>
            )}
            <button onClick={sim.nextFrame} style={btnStyle}>⏭ 下一帧</button>
            <button onClick={sim.reset} style={btnStyle}>⏮ 重置</button>
          </>
        )}
      </div>

      {/* Battle Canvas */}
      <BattleCanvas frame={sim.currentFrame} />

      {/* Info bar */}
      {sim.frames.length > 0 && (
        <div style={{
          marginTop: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#8b949e',
          fontSize: '0.85rem',
        }}>
          <span>帧: {sim.currentFrameIndex + 1} / {sim.frames.length}</span>
          <span>
            {sim.isFinished
              ? sim.outcome === 'player_win'
                ? '🎉 玩家胜利'
                : sim.outcome === 'enemy_win'
                  ? '💀 敌方胜利'
                  : '⏰ 超时'
              : sim.isPlaying
                ? '⚔️ 战斗中...'
                : '⏸ 已暂停'}
          </span>
        </div>
      )}

      {/* Hero roster info */}
      <details style={{ marginTop: '1rem', color: '#8b949e', fontSize: '0.8rem' }}>
        <summary style={{ cursor: 'pointer' }}>阵容信息</summary>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '2rem' }}>
          <div>
            <strong style={{ color: '#52b788' }}>我方:</strong>
            <ul style={{ paddingLeft: '1rem', margin: '0.25rem 0' }}>
              {[GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => (
                <li key={h.id}>{h.name} ({h.faction}) — STR:{h.baseStats.STR} INT:{h.baseStats.INT} DEF:{h.baseStats.DEF} HP:{h.baseStats.HP} SPD:{h.baseStats.SPD}</li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#21262d',
  color: '#e6edf3',
  border: '1px solid #30363d',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.85rem',
}

export default App
