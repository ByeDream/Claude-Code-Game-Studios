/**
 * Battle Visualization — useBattleSimulation hook
 *
 * Runs a full battle simulation and provides frame-by-frame playback state
 * for the Canvas renderer. Handles auto-play timing and manual controls.
 *
 * @module src/ui/battle/useBattleSimulation
 */

import { useState, useCallback, useRef, useEffect } from 'react'

import type { HeroInstance, HeroData } from '../../gameplay/hero/types'
import type { NamelessUnit } from '../../gameplay/enemy/types'
import type { BattleEvent } from '../../gameplay/battle/battleEngineTypes'
import { BattleEventType, BattleOutcome } from '../../gameplay/battle/battleEngineTypes'
import { initBattle, runBattle } from '../../gameplay/battle/battleEngine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Snapshot of a single unit for rendering. */
export interface UnitSnapshot {
  id: string
  name: string
  side: 'player' | 'enemy'
  position: number
  currentHP: number
  maxHP: number
  isKnockedOut: boolean
}

/** A single frame in the battle playback. */
export interface BattleFrame {
  round: number
  playerUnits: UnitSnapshot[]
  enemyUnits: UnitSnapshot[]
  event: BattleEvent | null
  isFinished: boolean
  outcome?: BattleOutcome
}

/** Hook return value. */
export interface BattleSimulationState {
  frames: BattleFrame[]
  currentFrameIndex: number
  currentFrame: BattleFrame | null
  isPlaying: boolean
  isFinished: boolean
  outcome?: BattleOutcome
  play: () => void
  pause: () => void
  reset: () => void
  nextFrame: () => void
  startBattle: (
    playerHeroes: HeroInstance[],
    enemyData: Array<HeroData | NamelessUnit>,
  ) => void
}

// ---------------------------------------------------------------------------
// Frame extraction
// ---------------------------------------------------------------------------

function cloneSnap(u: UnitSnapshot): UnitSnapshot {
  return { ...u }
}

function makeFrame(
  round: number,
  unitMap: Map<string, UnitSnapshot>,
  event: BattleEvent | null,
  isFinished: boolean,
  outcome?: BattleOutcome,
): BattleFrame {
  const playerUnits: UnitSnapshot[] = []
  const enemyUnits: UnitSnapshot[] = []
  for (const u of unitMap.values()) {
    if (u.side === 'player') playerUnits.push(cloneSnap(u))
    else enemyUnits.push(cloneSnap(u))
  }
  playerUnits.sort((a, b) => a.position - b.position)
  enemyUnits.sort((a, b) => a.position - b.position)
  return { round, playerUnits, enemyUnits, event, isFinished, outcome }
}

/**
 * Runs a battle and reconstructs renderable frames from the event log.
 */
function extractFrames(
  playerHeroes: HeroInstance[],
  enemyData: Array<HeroData | NamelessUnit>,
): BattleFrame[] {
  // Clone heroes so the simulation doesn't mutate the caller's data
  const clonedHeroes = playerHeroes.map(h => ({
    ...h,
    data: { ...h.data },
    growthBonus: { ...h.growthBonus },
    equipBonus: { ...h.equipBonus },
    bondModifier: { ...h.bondModifier },
    equippedItemIds: [...h.equippedItemIds],
    activeStatusIds: [...h.activeStatusIds],
  }))

  // Get initial state for unit names/positions/maxHP
  const initState = initBattle(
    clonedHeroes,
    enemyData,
  )

  // Run the actual battle (with fresh clones)
  const freshHeroes = playerHeroes.map(h => ({
    ...h,
    data: { ...h.data },
    growthBonus: { ...h.growthBonus },
    equipBonus: { ...h.equipBonus },
    bondModifier: { ...h.bondModifier },
    equippedItemIds: [...h.equippedItemIds],
    activeStatusIds: [...h.activeStatusIds],
  }))
  const result = runBattle(freshHeroes, enemyData)

  // Build unit map from init state
  const unitMap = new Map<string, UnitSnapshot>()
  for (const u of initState.playerUnits) {
    unitMap.set(u.id, {
      id: u.id, name: u.name, side: 'player',
      position: u.position, currentHP: u.maxHP, maxHP: u.maxHP,
      isKnockedOut: false,
    })
  }
  for (const u of initState.enemyUnits) {
    unitMap.set(u.id, {
      id: u.id, name: u.name, side: 'enemy',
      position: u.position, currentHP: u.maxHP, maxHP: u.maxHP,
      isKnockedOut: false,
    })
  }

  const frames: BattleFrame[] = []

  // Initial frame
  frames.push(makeFrame(0, unitMap, null, false))

  // Process log events
  for (const event of result.log) {
    switch (event.type) {
      case BattleEventType.Attack:
      case BattleEventType.Damage:
        for (const tid of event.targetIds) {
          const unit = unitMap.get(tid)
          if (unit && event.value) {
            unit.currentHP = Math.max(0, unit.currentHP - event.value)
          }
        }
        frames.push(makeFrame(event.round, unitMap, event, false))
        break

      case BattleEventType.Heal:
        for (const tid of event.targetIds) {
          const unit = unitMap.get(tid)
          if (unit && event.value) {
            unit.currentHP = Math.min(unit.maxHP, unit.currentHP + event.value)
          }
        }
        frames.push(makeFrame(event.round, unitMap, event, false))
        break

      case BattleEventType.Death:
        for (const tid of event.targetIds) {
          const unit = unitMap.get(tid)
          if (unit) {
            unit.isKnockedOut = true
            unit.currentHP = 0
          }
        }
        frames.push(makeFrame(event.round, unitMap, event, false))
        break

      case BattleEventType.BattleEnd:
        frames.push(makeFrame(event.round, unitMap, event, true, result.outcome))
        break

      case BattleEventType.RoundStart:
        frames.push(makeFrame(event.round, unitMap, event, false))
        break

      default:
        break
    }
  }

  return frames
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Playback speed: ms per frame. */
const FRAME_INTERVAL = 500

export function useBattleSimulation(): BattleSimulationState {
  const [frames, setFrames] = useState<BattleFrame[]>([])
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentFrame = frames[currentFrameIndex] ?? null
  const isFinished = currentFrame?.isFinished ?? false

  // Auto-advance timer
  useEffect(() => {
    if (isPlaying && !isFinished && frames.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentFrameIndex(prev => {
          const next = prev + 1
          if (next >= frames.length) {
            setIsPlaying(false)
            return prev
          }
          return next
        })
      }, FRAME_INTERVAL)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, isFinished, frames.length])

  useEffect(() => {
    if (isFinished) setIsPlaying(false)
  }, [isFinished])

  const play = useCallback(() => setIsPlaying(true), [])
  const pause = useCallback(() => setIsPlaying(false), [])
  const reset = useCallback(() => { setIsPlaying(false); setCurrentFrameIndex(0) }, [])
  const nextFrame = useCallback(() => {
    setCurrentFrameIndex(prev => Math.min(prev + 1, frames.length - 1))
  }, [frames.length])

  const startBattle = useCallback((
    playerHeroes: HeroInstance[],
    enemyData: Array<HeroData | NamelessUnit>,
  ) => {
    const newFrames = extractFrames(playerHeroes, enemyData)
    setFrames(newFrames)
    setCurrentFrameIndex(0)
    setIsPlaying(true)
  }, [])

  return {
    frames, currentFrameIndex, currentFrame,
    isPlaying, isFinished, outcome: currentFrame?.outcome,
    play, pause, reset, nextFrame, startBattle,
  }
}
