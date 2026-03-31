/**
 * Node Interaction Panels — UI for each node type
 *
 * Each panel handles one type of node interaction:
 * - BattlePanel: auto-battle with Canvas replay
 * - RecruitPanel: hero recruitment with candidate cards
 * - ShopPanel: equipment purchase with inventory
 * - RestPanel: train or forge selection (with cost display)
 * - MysteryPanel: event resolution display
 *
 * @module src/ui/run/NodePanels
 * @see src/gameplay/event/types — NodeType
 */

import { useState, useEffect } from 'react'
import { NodeType } from '../../gameplay/event/types'
import { RestChoice } from '../../gameplay/event/types'
import type { HeroInstance } from '../../gameplay/hero/types'
import type { HeroData } from '../../gameplay/hero/types'
import type { NamelessUnit } from '../../gameplay/enemy/types'
import { BattleCanvas } from '../battle/BattleCanvas'
import { useBattleSimulation } from '../battle/useBattleSimulation'
import type { NodeInteractionState } from './useRunLoop'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  background: '#1a1a2e',
  border: '2px solid #34495e',
  borderRadius: '12px',
  padding: '24px',
  color: '#ecf0f1',
  maxWidth: '600px',
  margin: '0 auto',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '6px',
  border: 'none',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
  margin: '4px',
}

const primaryButton: React.CSSProperties = {
  ...buttonStyle,
  background: '#e74c3c',
  color: '#fff',
}

const secondaryButton: React.CSSProperties = {
  ...buttonStyle,
  background: '#34495e',
  color: '#ecf0f1',
}

const successButton: React.CSSProperties = {
  ...buttonStyle,
  background: '#27ae60',
  color: '#fff',
}

// ---------------------------------------------------------------------------
// Battle Panel
// ---------------------------------------------------------------------------

interface BattlePanelProps {
  interaction: NodeInteractionState
  /** Player roster for battle simulation. */
  playerHeroes: HeroInstance[]
  /** Enemies generated for this node. */
  enemies: Array<HeroData | NamelessUnit>
  onResolveBattle: () => void
  onComplete: () => void
}

/** Battle node interaction: run battle with Canvas visualization. */
export function BattlePanel({ interaction, playerHeroes, enemies, onResolveBattle, onComplete }: BattlePanelProps) {
  const sim = useBattleSimulation()
  const [battleStarted, setBattleStarted] = useState(false)

  const typeLabel = interaction.type === NodeType.Elite ? '🔥 精英战斗'
    : interaction.type === NodeType.Boss ? '👹 Boss 战斗'
    : '⚔️ 战斗'

  const handleStartBattle = () => {
    setBattleStarted(true)
    sim.startBattle(playerHeroes, enemies)
  }

  // When playback finishes, resolve the battle in the run loop
  useEffect(() => {
    if (battleStarted && sim.isFinished && !interaction.resolved) {
      onResolveBattle()
    }
  }, [battleStarted, sim.isFinished, interaction.resolved, onResolveBattle])

  return (
    <div style={panelStyle}>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>{typeLabel}</h2>

      {!battleStarted ? (
        <div style={{ textAlign: 'center' }}>
          <p>敌军正在集结... ({enemies.length} 名敌人)</p>
          <button style={primaryButton} onClick={handleStartBattle}>
            开始战斗！
          </button>
        </div>
      ) : (
        <div>
          {/* Battle Canvas visualization */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <BattleCanvas frame={sim.currentFrame} />
          </div>

          {/* Playback controls */}
          <div style={{ textAlign: 'center', marginBottom: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {sim.isPlaying ? (
              <button onClick={sim.pause} style={secondaryButton}>⏸ 暂停</button>
            ) : !sim.isFinished ? (
              <button onClick={sim.play} style={secondaryButton}>▶ 播放</button>
            ) : null}
            {!sim.isFinished && (
              <button onClick={sim.nextFrame} style={secondaryButton}>⏭ 下一帧</button>
            )}
            <span style={{ color: '#8b949e', fontSize: '12px', lineHeight: '36px' }}>
              帧 {sim.currentFrameIndex + 1} / {sim.frames.length}
            </span>
          </div>

          {/* Result display (only after playback finishes) */}
          {interaction.resolved && (
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: interaction.battleOutcome === 'win' ? '#2ecc71' : '#e74c3c',
              }}>
                {interaction.resultMessage}
              </p>
              <button style={successButton} onClick={onComplete}>
                继续
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recruit Panel
// ---------------------------------------------------------------------------

interface RecruitPanelProps {
  interaction: NodeInteractionState
  gold: number
  onResolveRecruit: (index: number | null) => void
  onComplete: () => void
}

/** Recruit node: display candidates and let player choose. */
export function RecruitPanel({ interaction, gold, onResolveRecruit, onComplete }: RecruitPanelProps) {
  if (interaction.resolved) {
    return (
      <div style={panelStyle}>
        <h2 style={{ textAlign: 'center', marginTop: 0 }}>🎖️ 招募站</h2>
        <p style={{ textAlign: 'center', fontSize: '18px' }}>{interaction.resultMessage}</p>
        <div style={{ textAlign: 'center' }}>
          <button style={successButton} onClick={onComplete}>继续</button>
        </div>
      </div>
    )
  }

  const pool = interaction.recruitPool ?? []

  return (
    <div style={panelStyle}>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>🎖️ 招募站</h2>
      <p style={{ textAlign: 'center', color: '#bdc3c7' }}>
        💰 当前金币: {gold}
      </p>

      {pool.length === 0 ? (
        <p style={{ textAlign: 'center' }}>没有可招募的武将。</p>
      ) : (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {pool.map((candidate, i) => {
            const canAfford = gold >= candidate.cost
            return (
              <div key={i} style={{
                background: '#2c3e50',
                borderRadius: '8px',
                padding: '16px',
                minWidth: '140px',
                textAlign: 'center',
                opacity: canAfford ? 1 : 0.5,
              }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{candidate.hero.name}</div>
                <div style={{ color: '#bdc3c7', fontSize: '12px' }}>
                  {candidate.hero.faction} · {candidate.hero.tier}
                </div>
                <div style={{ color: '#f1c40f', margin: '8px 0' }}>💰 {candidate.cost}</div>
                <button
                  style={canAfford ? primaryButton : { ...buttonStyle, background: '#555', color: '#999', cursor: 'not-allowed' }}
                  disabled={!canAfford}
                  onClick={() => onResolveRecruit(i)}
                >
                  招募
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button style={secondaryButton} onClick={() => onResolveRecruit(null)}>
          跳过
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shop Panel
// ---------------------------------------------------------------------------

interface ShopPanelProps {
  interaction: NodeInteractionState
  gold: number
  onResolveShop: (indices: number[]) => void
  onComplete: () => void
}

/** Shop node: display inventory and let player purchase. */
export function ShopPanel({ interaction, gold, onResolveShop, onComplete }: ShopPanelProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])

  if (interaction.resolved) {
    return (
      <div style={panelStyle}>
        <h2 style={{ textAlign: 'center', marginTop: 0 }}>🛒 商店</h2>
        <p style={{ textAlign: 'center', fontSize: '18px' }}>{interaction.resultMessage}</p>
        <div style={{ textAlign: 'center' }}>
          <button style={successButton} onClick={onComplete}>继续</button>
        </div>
      </div>
    )
  }

  const inventory = interaction.shopInventory ?? []

  const toggleItem = (i: number) => {
    setSelectedIndices(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    )
  }

  const totalCost = selectedIndices.reduce((sum, i) => sum + (inventory[i]?.price ?? 0), 0)

  return (
    <div style={panelStyle}>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>🛒 商店</h2>
      <p style={{ textAlign: 'center', color: '#bdc3c7' }}>
        💰 金币: {gold} | 已选: {totalCost}
      </p>

      {inventory.length === 0 ? (
        <p style={{ textAlign: 'center' }}>商店空空如也。</p>
      ) : (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {inventory.map((item, i) => {
            const isSelected = selectedIndices.includes(i)
            return (
              <div
                key={i}
                onClick={() => toggleItem(i)}
                style={{
                  background: isSelected ? '#1a5276' : '#2c3e50',
                  border: isSelected ? '2px solid #3498db' : '2px solid transparent',
                  borderRadius: '8px',
                  padding: '12px',
                  minWidth: '120px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.equipment.name}</div>
                <div style={{ color: '#bdc3c7', fontSize: '11px' }}>{item.equipment.slot}</div>
                <div style={{ color: '#f1c40f', margin: '6px 0' }}>💰 {item.price}</div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          style={totalCost <= gold && selectedIndices.length > 0 ? primaryButton : secondaryButton}
          disabled={totalCost > gold || selectedIndices.length === 0}
          onClick={() => onResolveShop(selectedIndices)}
        >
          购买 ({totalCost}💰)
        </button>
        <button style={secondaryButton} onClick={() => onResolveShop([])}>
          离开
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rest Panel
// ---------------------------------------------------------------------------

interface RestPanelProps {
  interaction: NodeInteractionState
  gold: number
  material: number
  onResolveRest: (choice: RestChoice) => void
  onComplete: () => void
}

/** Rest node: choose between training and forging. Shows costs. */
export function RestPanel({ interaction, gold, material, onResolveRest, onComplete }: RestPanelProps) {
  const trainCost = { gold: 20, material: 20 }
  const forgeCost = { gold: 30, material: 30 }
  const canTrain = gold >= trainCost.gold && material >= trainCost.material
  const canForge = gold >= forgeCost.gold && material >= forgeCost.material

  if (interaction.resolved) {
    return (
      <div style={panelStyle}>
        <h2 style={{ textAlign: 'center', marginTop: 0 }}>🏕️ 休息站</h2>
        <p style={{ textAlign: 'center', fontSize: '18px' }}>{interaction.resultMessage}</p>
        <div style={{ textAlign: 'center' }}>
          <button style={successButton} onClick={onComplete}>继续</button>
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>🏕️ 休息站</h2>
      <p style={{ textAlign: 'center', color: '#bdc3c7' }}>
        💰 金币: {gold} | 🪨 材料: {material}
      </p>
      <p style={{ textAlign: 'center', color: '#bdc3c7' }}>选择一项行动：</p>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <div
          onClick={() => canTrain && onResolveRest(RestChoice.Train)}
          style={{
            background: '#2c3e50',
            borderRadius: '8px',
            padding: '20px',
            minWidth: '150px',
            textAlign: 'center',
            cursor: canTrain ? 'pointer' : 'not-allowed',
            border: '2px solid transparent',
            opacity: canTrain ? 1 : 0.5,
          }}
          onMouseEnter={e => canTrain && (e.currentTarget.style.borderColor = '#3498db')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          <div style={{ fontSize: '32px' }}>🏋️</div>
          <div style={{ fontWeight: 'bold', marginTop: '8px' }}>训练</div>
          <div style={{ color: '#bdc3c7', fontSize: '12px' }}>提升队伍经验</div>
          <div style={{ color: '#f1c40f', fontSize: '12px', marginTop: '4px' }}>
            💰 {trainCost.gold} 🪨 {trainCost.material}
          </div>
        </div>

        <div
          onClick={() => canForge && onResolveRest(RestChoice.Forge)}
          style={{
            background: '#2c3e50',
            borderRadius: '8px',
            padding: '20px',
            minWidth: '150px',
            textAlign: 'center',
            cursor: canForge ? 'pointer' : 'not-allowed',
            border: '2px solid transparent',
            opacity: canForge ? 1 : 0.5,
          }}
          onMouseEnter={e => canForge && (e.currentTarget.style.borderColor = '#e67e22')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          <div style={{ fontSize: '32px' }}>🔨</div>
          <div style={{ fontWeight: 'bold', marginTop: '8px' }}>锻造</div>
          <div style={{ color: '#bdc3c7', fontSize: '12px' }}>强化装备</div>
          <div style={{ color: '#f1c40f', fontSize: '12px', marginTop: '4px' }}>
            💰 {forgeCost.gold} 🪨 {forgeCost.material}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <button style={secondaryButton} onClick={onComplete}>
          跳过
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mystery Panel
// ---------------------------------------------------------------------------

interface MysteryPanelProps {
  interaction: NodeInteractionState
  onResolveMystery: () => void
  onComplete: () => void
}

/** Mystery node: resolve the event and display outcome. */
export function MysteryPanel({ interaction, onResolveMystery, onComplete }: MysteryPanelProps) {
  return (
    <div style={panelStyle}>
      <h2 style={{ textAlign: 'center', marginTop: 0 }}>❓ 神秘事件</h2>

      {!interaction.resolved ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#bdc3c7' }}>前方传来了神秘的气息...</p>
          <button style={primaryButton} onClick={onResolveMystery}>
            探索
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px' }}>{interaction.resultMessage}</p>
          <button style={successButton} onClick={onComplete}>
            继续
          </button>
        </div>
      )}
    </div>
  )
}
