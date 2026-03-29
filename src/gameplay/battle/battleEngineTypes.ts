/**
 * Battle Engine — Type Definitions
 *
 * Core types for the battle simulation loop.
 * BattleUnit abstracts both HeroInstance and NamelessUnit into a unified
 * combatant interface that the engine can process uniformly.
 *
 * @module src/gameplay/battle/battleEngineTypes
 * @see design/gdd/battle-engine.md
 */

import type { BaseStats, Skill } from '../hero/types'

// ---------------------------------------------------------------------------
// BattleUnit — unified combatant abstraction
// ---------------------------------------------------------------------------

/**
 * A unified combatant in battle.
 * Wraps both HeroInstance and NamelessUnit so the battle loop can treat
 * all units identically.
 *
 * Created by initBattle() from the input rosters.
 */
export interface BattleUnit {
  /** Unique ID for this unit in this battle. */
  id: string
  /** Display name. */
  name: string
  /** Which side this unit fights for. */
  side: 'player' | 'enemy'
  /** Position on the battlefield (0-4). */
  position: number

  /** Effective final stats (pre-computed at battle start). */
  finalStats: BaseStats
  /** Maximum HP (= finalStats.HP at battle start). */
  maxHP: number
  /** Current HP (mutable during battle). */
  currentHP: number
  /** Whether this unit has been knocked out. */
  isKnockedOut: boolean

  /** Skills this unit can use. */
  skills: Skill[]
  /** Tags for AI behavior hints (e.g., '武力型', '谋略型'). */
  tags: string[]
}

// ---------------------------------------------------------------------------
// Battle events — action log
// ---------------------------------------------------------------------------

/**
 * Types of events that occur during battle.
 * Pushed to the battle log for UI rendering and replay.
 */
export enum BattleEventType {
  RoundStart = 'round_start',
  Attack = 'attack',
  SkillUse = 'skill_use',
  Damage = 'damage',
  Heal = 'heal',
  Death = 'death',
  RoundEnd = 'round_end',
  BattleEnd = 'battle_end',
}

/**
 * A single event in the battle log.
 */
export interface BattleEvent {
  /** What kind of event. */
  type: BattleEventType
  /** Round number (1-based). */
  round: number
  /** Source unit ID (attacker / caster). Empty for system events. */
  sourceId: string
  /** Target unit ID(s). */
  targetIds: string[]
  /** Numeric value (damage dealt, HP healed, etc.). */
  value?: number
  /** Whether this was a critical hit. */
  isCrit?: boolean
  /** Skill name if a skill was used. */
  skillName?: string
  /** Additional info text. */
  message?: string
}

// ---------------------------------------------------------------------------
// Battle outcome
// ---------------------------------------------------------------------------

/** The final result of a battle. */
export enum BattleOutcome {
  PlayerWin = 'player_win',
  EnemyWin = 'enemy_win',
  Timeout = 'timeout',
}

// ---------------------------------------------------------------------------
// Battle state
// ---------------------------------------------------------------------------

/**
 * Complete state of an ongoing or completed battle.
 * Immutable design: each executeTurn returns a new BattleState.
 */
export interface BattleState {
  /** All player-side units. */
  playerUnits: BattleUnit[]
  /** All enemy-side units. */
  enemyUnits: BattleUnit[]
  /** Current round number (starts at 0, incremented at round start). */
  currentRound: number
  /** Whether the battle has ended. */
  isFinished: boolean
  /** Battle outcome (only set when isFinished = true). */
  outcome?: BattleOutcome
  /** Chronological event log. */
  log: BattleEvent[]
}

/**
 * Summary result returned by runBattle().
 */
export interface BattleResult {
  /** Win / lose / timeout. */
  outcome: BattleOutcome
  /** Total rounds played. */
  totalRounds: number
  /** Number of surviving player units. */
  playerSurvivors: number
  /** Number of surviving enemy units. */
  enemySurvivors: number
  /** Full battle event log. */
  log: BattleEvent[]
}
