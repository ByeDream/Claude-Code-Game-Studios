/**
 * Status System — Configuration Constants
 *
 * All tuning knobs for the Status system live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/status/statusConfig
 * @see design/gdd/status-system.md — Tuning Knobs, Formulas
 */

import { StatType } from '../hero/types'
import type { StatusEffect } from './types'
import { StatusEffectType } from './types'

// ---------------------------------------------------------------------------
// Global limits
// ---------------------------------------------------------------------------

/**
 * Minimum value for statusModifier per stat.
 * Prevents any single stat from being debuffed below -50%.
 * Safe range: -0.7 to -0.3.
 *
 * @see design/gdd/status-system.md — Edge Cases: statusModifier clamp
 */
export const STATUS_MODIFIER_MIN = -0.5

/**
 * Maximum value for statusModifier per stat.
 * Prevents any single stat from being buffed above +100%.
 * Safe range: 0.5 to 1.5.
 *
 * @see design/gdd/status-system.md — Edge Cases: statusModifier clamp
 */
export const STATUS_MODIFIER_MAX = 1.0

// ---------------------------------------------------------------------------
// Boss resistance
// ---------------------------------------------------------------------------

/**
 * Fraction by which numerical debuff values are reduced on boss targets.
 * 0.5 = boss receives half the debuff effect.
 * Safe range: 0.3–0.7.
 *
 * @see design/gdd/status-system.md — Formulas: Boss Stat Modifier
 */
export const BOSS_DEBUFF_REDUCTION = 0.5

/**
 * Fraction by which control effect duration is reduced on boss targets.
 * 0.5 = control lasts half as long on bosses. Minimum 1 round.
 * Safe range: 0.3–0.7.
 *
 * @see design/gdd/status-system.md — Boss Resistance
 */
export const BOSS_CONTROL_REDUCTION = 0.5

// ---------------------------------------------------------------------------
// Burn interaction
// ---------------------------------------------------------------------------

/**
 * Multiplier applied to healing received by a burning unit.
 * 0.5 = healing halved while burning.
 * Safe range: 0.3–0.7.
 *
 * @see design/gdd/status-system.md — Formulas: HoT Healing
 */
export const BURN_HEAL_REDUCTION = 0.5

// ---------------------------------------------------------------------------
// High-tier tenacity
// ---------------------------------------------------------------------------

/**
 * Fraction applied to control duration for S+ tier heroes.
 * 0.5 = control lasts half as long. Minimum 1 round.
 * Safe range: 0.3–0.7.
 *
 * @see design/gdd/status-system.md — Formulas: Control Duration
 */
export const TENACITY_REDUCTION = 0.5

// ---------------------------------------------------------------------------
// MVP Status Effect Definitions
// ---------------------------------------------------------------------------

/**
 * Pre-defined status effects for MVP.
 * 9 base types as specified in the GDD.
 *
 * Note: `value` and `duration` here are defaults/templates.
 * Actual skill-applied values may override these when creating an AppliedStatus.
 *
 * @see design/gdd/status-system.md — Status Effect Categories
 */
export const STATUS_EFFECTS: Record<string, StatusEffect> = {
  atk_up: {
    id: 'atk_up',
    name: '增攻',
    category: 'buff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.STR,
    value: 0.15,
    duration: 3,
  },
  atk_down: {
    id: 'atk_down',
    name: '减攻',
    category: 'debuff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.STR,
    value: 0.15,
    duration: 3,
  },
  def_up: {
    id: 'def_up',
    name: '增防',
    category: 'buff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.DEF,
    value: 0.15,
    duration: 3,
  },
  def_down: {
    id: 'def_down',
    name: '减防',
    category: 'debuff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.DEF,
    value: 0.15,
    duration: 3,
  },
  spd_up: {
    id: 'spd_up',
    name: '加速',
    category: 'buff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.SPD,
    value: 0.15,
    duration: 3,
  },
  spd_down: {
    id: 'spd_down',
    name: '减速',
    category: 'debuff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.SPD,
    value: 0.15,
    duration: 3,
  },
  poison: {
    id: 'poison',
    name: '中毒',
    category: 'debuff',
    effectType: StatusEffectType.Dot,
    value: 5,
    duration: 3,
  },
  burn: {
    id: 'burn',
    name: '燃烧',
    category: 'debuff',
    effectType: StatusEffectType.Burn,
    value: 5,
    duration: 3,
  },
  regen: {
    id: 'regen',
    name: '回复',
    category: 'buff',
    effectType: StatusEffectType.Hot,
    value: 8,
    duration: 3,
  },
}
