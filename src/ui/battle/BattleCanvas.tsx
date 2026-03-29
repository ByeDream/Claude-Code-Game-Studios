/**
 * Battle Canvas — Visual battle renderer
 *
 * Draws the 5v5 battlefield on an HTML Canvas:
 * - Two rows of unit slots (player bottom, enemy top)
 * - Each unit: colored rectangle + name + HP bar
 * - Damage/heal floating text
 * - Attack highlight lines
 * - Battle result overlay
 *
 * @module src/ui/battle/BattleCanvas
 * @see design/gdd/battle-ui.md
 */

import { useRef, useEffect } from 'react'
import type { BattleFrame, UnitSnapshot } from './useBattleSimulation'
import { BattleEventType } from '../../gameplay/battle/battleEngineTypes'
import { BattleOutcome } from '../../gameplay/battle/battleEngineTypes'

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CANVAS_W = 800
const CANVAS_H = 500

const UNIT_W = 100
const UNIT_H = 70

const PLAYER_Y = 340
const ENEMY_Y = 80

const SLOT_SPACING = 140
const LEFT_MARGIN = 60

/** Faction-ish colors for visual variety. */
const PLAYER_COLOR = '#2d6a4f'
const PLAYER_KO_COLOR = '#555'
const ENEMY_COLOR = '#9b2226'
const ENEMY_KO_COLOR = '#555'

const HP_BAR_H = 8
const HP_BAR_BG = '#333'
const HP_BAR_FG_PLAYER = '#52b788'
const HP_BAR_FG_ENEMY = '#e76f51'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUnitX(position: number): number {
  return LEFT_MARGIN + position * SLOT_SPACING
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: UnitSnapshot,
  x: number,
  y: number,
  isHighlighted: boolean,
) {
  const isPlayer = unit.side === 'player'

  // Unit rectangle
  if (unit.isKnockedOut) {
    ctx.fillStyle = isPlayer ? PLAYER_KO_COLOR : ENEMY_KO_COLOR
    ctx.globalAlpha = 0.4
  } else {
    ctx.fillStyle = isPlayer ? PLAYER_COLOR : ENEMY_COLOR
    ctx.globalAlpha = 1.0
  }

  // Highlight border
  if (isHighlighted && !unit.isKnockedOut) {
    ctx.shadowColor = '#ffd60a'
    ctx.shadowBlur = 12
  }

  ctx.fillRect(x, y, UNIT_W, UNIT_H)
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1.0

  // Border
  ctx.strokeStyle = isHighlighted ? '#ffd60a' : '#222'
  ctx.lineWidth = isHighlighted ? 3 : 1
  ctx.strokeRect(x, y, UNIT_W, UNIT_H)

  // Name
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(unit.name, x + UNIT_W / 2, y + 25, UNIT_W - 8)

  // HP text
  if (!unit.isKnockedOut) {
    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#ccc'
    ctx.fillText(`${unit.currentHP}/${unit.maxHP}`, x + UNIT_W / 2, y + 42)
  } else {
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#999'
    ctx.fillText('KO', x + UNIT_W / 2, y + 42)
  }

  // HP bar
  const barY = y + UNIT_H - HP_BAR_H - 4
  const barW = UNIT_W - 10
  const barX = x + 5
  const hpRatio = unit.maxHP > 0 ? Math.max(0, unit.currentHP / unit.maxHP) : 0

  ctx.fillStyle = HP_BAR_BG
  ctx.fillRect(barX, barY, barW, HP_BAR_H)

  ctx.fillStyle = isPlayer ? HP_BAR_FG_PLAYER : HP_BAR_FG_ENEMY
  ctx.fillRect(barX, barY, barW * hpRatio, HP_BAR_H)
}

function drawAttackLine(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
) {
  ctx.beginPath()
  ctx.moveTo(fromX + UNIT_W / 2, fromY + UNIT_H / 2)
  ctx.lineTo(toX + UNIT_W / 2, toY + UNIT_H / 2)
  ctx.strokeStyle = 'rgba(255, 214, 10, 0.6)'
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.stroke()
  ctx.setLineDash([])
}

function drawFloatingText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.font = 'bold 16px sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(text, x + UNIT_W / 2, y - 8)
}

function drawBattleResult(ctx: CanvasRenderingContext2D, outcome: BattleOutcome) {
  // Overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.font = 'bold 48px sans-serif'
  ctx.textAlign = 'center'

  if (outcome === BattleOutcome.PlayerWin) {
    ctx.fillStyle = '#52b788'
    ctx.fillText('胜 利', CANVAS_W / 2, CANVAS_H / 2)
  } else if (outcome === BattleOutcome.EnemyWin) {
    ctx.fillStyle = '#e76f51'
    ctx.fillText('战 败', CANVAS_W / 2, CANVAS_H / 2)
  } else {
    ctx.fillStyle = '#ffd60a'
    ctx.fillText('超 时', CANVAS_W / 2, CANVAS_H / 2)
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BattleCanvasProps {
  frame: BattleFrame | null
}

export function BattleCanvas({ frame }: BattleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    if (!frame) {
      ctx.fillStyle = '#aaa'
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('点击「开战」开始战斗', CANVAS_W / 2, CANVAS_H / 2)
      return
    }

    // Draw labels
    ctx.fillStyle = '#aaa'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('敌 方', 10, ENEMY_Y - 10)
    ctx.fillText('我 方', 10, PLAYER_Y - 10)

    // Round indicator
    ctx.textAlign = 'right'
    ctx.fillStyle = '#777'
    ctx.font = '13px sans-serif'
    ctx.fillText(`第 ${frame.round} 回合`, CANVAS_W - 10, 25)

    // Determine highlighted units from current event
    const sourceId = frame.event?.sourceId ?? ''
    const targetIds = frame.event?.targetIds ?? []

    // Draw enemy units
    for (const unit of frame.enemyUnits) {
      const x = getUnitX(unit.position)
      const isHighlighted = unit.id === sourceId || targetIds.includes(unit.id)
      drawUnit(ctx, unit, x, ENEMY_Y, isHighlighted)
    }

    // Draw player units
    for (const unit of frame.playerUnits) {
      const x = getUnitX(unit.position)
      const isHighlighted = unit.id === sourceId || targetIds.includes(unit.id)
      drawUnit(ctx, unit, x, PLAYER_Y, isHighlighted)
    }

    // Draw attack line if event has source and target
    if (frame.event && sourceId && targetIds.length > 0) {
      const allUnits = [...frame.playerUnits, ...frame.enemyUnits]
      const source = allUnits.find(u => u.id === sourceId)

      for (const tid of targetIds) {
        const target = allUnits.find(u => u.id === tid)
        if (source && target) {
          const fromX = getUnitX(source.position)
          const fromY = source.side === 'player' ? PLAYER_Y : ENEMY_Y
          const toX = getUnitX(target.position)
          const toY = target.side === 'player' ? PLAYER_Y : ENEMY_Y
          drawAttackLine(ctx, fromX, fromY, toX, toY)

          // Floating damage/heal text
          if (frame.event.type === BattleEventType.Attack || frame.event.type === BattleEventType.Damage) {
            drawFloatingText(ctx, `-${frame.event.value}`, toX, toY, '#ff6b6b')
          } else if (frame.event.type === BattleEventType.Heal) {
            drawFloatingText(ctx, `+${frame.event.value}`, toX, toY, '#51cf66')
          }
        }
      }
    }

    // Death text
    if (frame.event?.type === BattleEventType.Death) {
      const allUnits = [...frame.playerUnits, ...frame.enemyUnits]
      for (const tid of frame.event.targetIds) {
        const target = allUnits.find(u => u.id === tid)
        if (target) {
          const x = getUnitX(target.position)
          const y = target.side === 'player' ? PLAYER_Y : ENEMY_Y
          drawFloatingText(ctx, '💀 击败', x, y, '#ffd60a')
        }
      }
    }

    // Event message bar
    if (frame.event?.message) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 40)
      ctx.fillStyle = '#fff'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(frame.event.message, CANVAS_W / 2, CANVAS_H - 15)
    }

    // Battle result overlay
    if (frame.isFinished && frame.outcome) {
      drawBattleResult(ctx, frame.outcome)
    }
  }, [frame])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        border: '2px solid #333',
        borderRadius: '8px',
        display: 'block',
        margin: '0 auto',
        background: '#1a1a2e',
      }}
    />
  )
}
