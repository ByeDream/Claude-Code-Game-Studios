/**
 * Hero System — Stat Calculation
 *
 * Implements the canonical final-stat formula from the GDD:
 *
 *   finalStat = (baseStat + growthBonus + equipBonus) * (1 + bondModifier + statusModifier)
 *
 * Result is clamped to a minimum of MIN_STAT_VALUE (1).
 *
 * @module src/gameplay/hero/statCalculation
 * @see design/gdd/hero-system.md — Formulas: Final Stat Calculation
 */

import type { BaseStats, HeroInstance } from './types'
import { StatType } from './types'
import { MIN_STAT_VALUE } from './heroConfig'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a BaseStats record with every stat initialised to zero.
 *
 * @returns A zeroed BaseStats record.
 */
export function createZeroStats(): BaseStats {
  return {
    [StatType.STR]: 0,
    [StatType.INT]: 0,
    [StatType.DEF]: 0,
    [StatType.HP]:  0,
    [StatType.SPD]: 0,
  }
}

/**
 * Returns the sum of all five base-stat values for the provided BaseStats record.
 * Useful for tier-range validation and balance tooling.
 *
 * @param stats - The stat record to sum.
 * @returns Total of STR + INT + DEF + HP + SPD.
 */
export function sumBaseStats(stats: BaseStats): number {
  return (
    stats[StatType.STR] +
    stats[StatType.INT] +
    stats[StatType.DEF] +
    stats[StatType.HP]  +
    stats[StatType.SPD]
  )
}

// ---------------------------------------------------------------------------
// Core formula
// ---------------------------------------------------------------------------

/**
 * Calculates the final effective value for a single stat on a hero instance.
 *
 * Formula (from GDD):
 *   finalStat = (baseStat + growthBonus + equipBonus) * (1 + bondModifier + statusModifier)
 *
 * Result is clamped to MIN_STAT_VALUE (1) — a stat can never be 0 or negative.
 *
 * Variable ranges:
 * - baseStat:       1–200  (from hero data file)
 * - growthBonus:    0–100  (from Hero Growth System)
 * - equipBonus:     0–80   (from Equipment System)
 * - bondModifier:   0.0–0.25  (from Bond System, additive %)
 * - statusModifier: −0.5–1.0  (from Status System, additive %)
 *
 * @param hero - The hero instance providing all modifier values.
 * @param stat - Which of the five stats to calculate.
 * @returns The final effective stat value, minimum MIN_STAT_VALUE.
 */
export function calculateFinalStat(hero: HeroInstance, stat: StatType): number {
  const baseStat    = hero.data.baseStats[stat]
  const growthBonus = hero.growthBonus[stat]
  const equipBonus  = hero.equipBonus[stat]

  const additive    = baseStat + growthBonus + equipBonus
  const multiplier  = 1 + hero.bondModifier + hero.statusModifier

  const rawFinal    = additive * multiplier

  return Math.max(MIN_STAT_VALUE, Math.round(rawFinal))
}

/**
 * Calculates all five final stat values for a hero instance at once.
 *
 * This is a convenience wrapper around `calculateFinalStat` for all StatType values.
 * Each stat is independently clamped to MIN_STAT_VALUE.
 *
 * @param hero - The hero instance to evaluate.
 * @returns A BaseStats record containing the final effective value for each stat.
 */
export function calculateAllFinalStats(hero: HeroInstance): BaseStats {
  return {
    [StatType.STR]: calculateFinalStat(hero, StatType.STR),
    [StatType.INT]: calculateFinalStat(hero, StatType.INT),
    [StatType.DEF]: calculateFinalStat(hero, StatType.DEF),
    [StatType.HP]:  calculateFinalStat(hero, StatType.HP),
    [StatType.SPD]: calculateFinalStat(hero, StatType.SPD),
  }
}
