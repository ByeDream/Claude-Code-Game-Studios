/**
 * Status System — Type Definitions
 *
 * Defines all data types for buff/debuff status effects in battle.
 * Status effects modify hero stats, deal periodic damage/healing,
 * or apply control effects (stun/silence).
 *
 * @module src/gameplay/status/types
 * @see design/gdd/status-system.md
 */

import type { StatType } from '../hero/types'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Functional category of a status effect.
 * Determines how the effect is resolved each tick.
 */
export enum StatusEffectType {
  /** Modifies a specific stat by a percentage. */
  StatModify = 'stat_modify',
  /** Damage over time (e.g., poison). Flat HP loss per tick. */
  Dot = 'dot',
  /** Healing over time (e.g., regen). Flat HP restore per tick. */
  Hot = 'hot',
  /** Control effect (stun/silence). Prevents or limits actions. */
  Control = 'control',
  /** Burning — DoT + halves incoming healing. */
  Burn = 'burn',
}

/**
 * Buff or debuff classification.
 * Determines visual treatment and boss resistance application.
 */
export type StatusCategory = 'buff' | 'debuff'

/**
 * Control sub-types for control-type status effects.
 */
export type ControlType = 'stun' | 'silence'

/**
 * The current control state of a unit.
 * 'none' = can act freely, 'stunned' = skip turn, 'silenced' = basic attack only.
 */
export type ControlState = 'none' | 'stunned' | 'silenced'

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

/**
 * Static definition of a status effect.
 * Loaded from config — never mutated at runtime.
 *
 * @see design/gdd/status-system.md — Status Effect Data Model
 */
export interface StatusEffect {
  /** Unique identifier (e.g., "atk_up", "poison"). */
  id: string
  /** Display name for UI. */
  name: string
  /** Buff or debuff. */
  category: StatusCategory
  /** Functional type determining tick resolution logic. */
  effectType: StatusEffectType
  /**
   * Which stat is affected (stat_modify type only).
   * Undefined for dot/hot/control/burn.
   */
  stat?: StatType
  /** Effect magnitude (percentage as decimal for stat_modify, flat value for dot/hot/burn). */
  value: number
  /** Default duration in rounds. */
  duration: number
  /**
   * Control sub-type (control type only).
   * Undefined for non-control effects.
   */
  controlType?: ControlType
}

/**
 * A status effect actively applied to a unit in battle.
 * Created when a StatusEffect is applied to a target.
 */
export interface AppliedStatus {
  /** The status effect definition. */
  effect: StatusEffect
  /** Remaining rounds before expiry. Decremented each tick. */
  remainingDuration: number
  /** ID of the hero/unit that applied this status. */
  sourceHeroId: string
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Result of attempting to apply a status effect.
 *
 * - 'applied': New status added to target.
 * - 'replaced_weaker': Existing same-ID status was weaker; replaced.
 * - 'ignored_stronger_exists': Existing same-ID status is stronger; new one discarded.
 * - 'reduced_by_boss': Applied but with reduced effectiveness (boss resistance).
 */
export type ApplyResult =
  | 'applied'
  | 'replaced_weaker'
  | 'ignored_stronger_exists'
  | 'reduced_by_boss'

/**
 * Result of a single tick of status effects on a unit.
 * Returned by `tickStatuses()`.
 */
export interface TickResult {
  /** Total DoT/burn damage dealt this tick (0 if none). */
  damage: number
  /** Total HoT healing received this tick (0 if none). */
  healing: number
  /** IDs of status effects that expired and were removed this tick. */
  expired: string[]
}
