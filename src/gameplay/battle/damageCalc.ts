/**
 * Battle Engine — Damage Calculation
 *
 * Implements the GDD damage formulas:
 *   Physical: attackerSTR * mult * (100 / (100 + targetDEF)) * variance
 *   Skill:    attackerINT * mult * (100 / (100 + targetDEF * INT_DEF_RATIO)) * variance
 *   Healing:  healerINT * mult (capped at target missing HP)
 *
 * All functions are pure.
 *
 * @module src/gameplay/battle/damageCalc
 * @see design/gdd/battle-engine.md — Formulas
 */

import type { BattleUnit } from './battleEngineTypes'
import type { RandomFn } from './types'
import { StatType } from '../hero/types'
import {
  MIN_DAMAGE,
  INT_DEF_RATIO,
  RANDOM_VARIANCE_MIN,
  RANDOM_VARIANCE_MAX,
  CRIT_MULTIPLIER,
} from './battleConfig'

// ---------------------------------------------------------------------------
// Damage variance
// ---------------------------------------------------------------------------

/**
 * Generates a random damage variance multiplier in [RANDOM_VARIANCE_MIN, RANDOM_VARIANCE_MAX].
 *
 * @param random - Injectable RNG.
 * @returns A multiplier, e.g., 0.95–1.05.
 */
export function rollVariance(random: RandomFn): number {
  return RANDOM_VARIANCE_MIN + random() * (RANDOM_VARIANCE_MAX - RANDOM_VARIANCE_MIN)
}

// ---------------------------------------------------------------------------
// Physical damage
// ---------------------------------------------------------------------------

/**
 * Calculates physical damage (STR-based).
 *
 * Formula: max(MIN_DAMAGE, attackerSTR * skillMultiplier * (100 / (100 + targetDEF)) * variance)
 *
 * @param attacker - The attacking unit.
 * @param target - The defending unit.
 * @param skillMultiplier - Skill damage multiplier (1.0 for normal attack).
 * @param random - Injectable RNG for variance.
 * @returns Damage dealt (integer, minimum MIN_DAMAGE).
 */
export function calculatePhysicalDamage(
  attacker: BattleUnit,
  target: BattleUnit,
  skillMultiplier: number = 1.0,
  random: RandomFn = Math.random
): number {
  const atk = attacker.finalStats[StatType.STR]
  const def = target.finalStats[StatType.DEF]
  const variance = rollVariance(random)

  const raw = atk * skillMultiplier * (100 / (100 + def)) * variance
  return Math.max(MIN_DAMAGE, Math.round(raw))
}

// ---------------------------------------------------------------------------
// Skill damage (INT-based)
// ---------------------------------------------------------------------------

/**
 * Calculates skill damage (INT-based).
 *
 * Formula: max(MIN_DAMAGE, attackerINT * skillMultiplier * (100 / (100 + targetDEF * INT_DEF_RATIO)) * variance)
 *
 * INT skills are less affected by DEF (INT_DEF_RATIO = 0.5).
 *
 * @param attacker - The casting unit.
 * @param target - The defending unit.
 * @param skillMultiplier - Skill damage multiplier.
 * @param random - Injectable RNG for variance.
 * @returns Damage dealt (integer, minimum MIN_DAMAGE).
 */
export function calculateSkillDamage(
  attacker: BattleUnit,
  target: BattleUnit,
  skillMultiplier: number,
  random: RandomFn = Math.random
): number {
  const intel = attacker.finalStats[StatType.INT]
  const def = target.finalStats[StatType.DEF]
  const variance = rollVariance(random)

  const raw = intel * skillMultiplier * (100 / (100 + def * INT_DEF_RATIO)) * variance
  return Math.max(MIN_DAMAGE, Math.round(raw))
}

// ---------------------------------------------------------------------------
// Healing
// ---------------------------------------------------------------------------

/**
 * Calculates healing amount.
 *
 * Formula: min(healerINT * healMultiplier, target.maxHP - target.currentHP)
 *
 * @param healer - The healing unit.
 * @param target - The unit being healed.
 * @param healMultiplier - Healing skill multiplier.
 * @returns HP restored (integer, 0 if target is at full HP).
 */
export function calculateHealing(
  healer: BattleUnit,
  target: BattleUnit,
  healMultiplier: number
): number {
  const intel = healer.finalStats[StatType.INT]
  const raw = intel * healMultiplier
  const missingHP = target.maxHP - target.currentHP
  return Math.min(Math.round(raw), Math.max(0, missingHP))
}

// ---------------------------------------------------------------------------
// Critical hit
// ---------------------------------------------------------------------------

/**
 * Applies critical hit modifier if applicable.
 *
 * Base crit chance is 0 — only equipment/skill bonuses provide crit.
 * For MVP, critChance is always 0 unless explicitly provided.
 *
 * @param damage - Pre-crit damage.
 * @param critChance - Probability of critical hit (0.0–1.0).
 * @param random - Injectable RNG.
 * @returns Object with final damage and whether it was a crit.
 */
export function applyCritical(
  damage: number,
  critChance: number = 0,
  random: RandomFn = Math.random
): { damage: number; isCrit: boolean } {
  if (critChance > 0 && random() < critChance) {
    return { damage: Math.round(damage * CRIT_MULTIPLIER), isCrit: true }
  }
  return { damage, isCrit: false }
}
