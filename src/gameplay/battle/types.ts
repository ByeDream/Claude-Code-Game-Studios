/**
 * Battle System — Type Definitions
 *
 * Defines all types used by the Battle AI and Battle Engine.
 * These types describe AI decisions, target selection strategies,
 * action ordering, and battle state interfaces.
 *
 * @module src/gameplay/battle/types
 * @see design/gdd/battle-ai.md
 * @see design/gdd/battle-engine.md
 */

import type { HeroInstance, Skill } from '../hero/types'

// ---------------------------------------------------------------------------
// Target selection strategies
// ---------------------------------------------------------------------------

/**
 * All valid target selection strategies.
 *
 * 'random' is the default for normal attacks.
 * Skills can override with a deterministic strategy.
 *
 * @see design/gdd/battle-ai.md — Target Selection
 */
export enum TargetStrategy {
  /** Default: random alive enemy. */
  Random = 'random',
  /** Lowest absolute HP enemy. */
  LowestHp = 'target_lowest_hp',
  /** Highest ATK or INT enemy (threat). */
  HighestThreat = 'target_highest_threat',
  /** Self-targeting (self-buff). */
  Self = 'target_self',
  /** Lowest HP ally (healing). */
  LowestHpAlly = 'target_lowest_hp_ally',
  /** All enemies (AOE). */
  AllEnemies = 'target_all_enemies',
  /** All allies (group buff). */
  AllAllies = 'target_all_allies',
}

// ---------------------------------------------------------------------------
// Skill classification for AI priority
// ---------------------------------------------------------------------------

/**
 * Classification of a skill for AI decision priority.
 * AI prioritizes: heal > control > damage.
 *
 * @see design/gdd/battle-ai.md — Skill Release Logic
 */
export enum SkillCategory {
  Heal = 'heal',
  Control = 'control',
  Damage = 'damage',
}

// ---------------------------------------------------------------------------
// AI decision
// ---------------------------------------------------------------------------

/** The action type chosen by the AI. */
export enum ActionType {
  Attack = 'attack',
  Skill = 'skill',
}

/**
 * A single AI decision for one hero's action.
 *
 * @see design/gdd/battle-ai.md — BattleAI.decideAction
 */
export interface AIDecision {
  /** Whether to normal-attack or use a skill. */
  action: ActionType
  /** Index of the skill in the hero's skills array (only when action = Skill). */
  skillIndex?: number
  /** The skill being used (only when action = Skill). */
  skill?: Skill
  /**
   * Target hero IDs.
   * Single-target: array of 1 ID.
   * AOE: array of all affected IDs.
   */
  targetIds: string[]
}

// ---------------------------------------------------------------------------
// Action order entry
// ---------------------------------------------------------------------------

/**
 * An entry in the per-round action order.
 * Sorted by SPD descending, ties broken randomly.
 */
export interface ActionOrderEntry {
  /** The hero instance that will act. */
  hero: HeroInstance
  /** Which side this hero belongs to. */
  side: 'player' | 'enemy'
  /** Effective SPD used for sorting (final stat value). */
  effectiveSPD: number
  /** Random tiebreaker for same-SPD units (0-1). */
  tiebreaker: number
}

// ---------------------------------------------------------------------------
// Cooldown tracker
// ---------------------------------------------------------------------------

/**
 * Tracks cooldown state for all skills of all heroes in a battle.
 * Key: `${heroId}_${skillIndex}`, Value: remaining cooldown turns.
 */
export type CooldownMap = Map<string, number>

// ---------------------------------------------------------------------------
// Random number generator interface
// ---------------------------------------------------------------------------

/**
 * Interface for a random number generator.
 * Allows injection of deterministic RNG for testing.
 */
export interface RandomFn {
  /** Returns a random number in [0, 1). */
  (): number
}
