/**
 * Hero System — Hero Instance Factory
 *
 * Creates runtime `HeroInstance` objects from static `HeroData` config records.
 * Delegates growth-bonus calculation to the Hero Growth system so all downstream
 * systems receive a fully initialised instance with correct starting state.
 *
 * @module src/gameplay/hero/heroFactory
 * @see design/gdd/hero-system.md — Hero Data Model, Formulas
 */

import type { HeroData, HeroInstance } from './types'
import { StatType } from './types'
import { createZeroStats, calculateFinalStat } from './statCalculation'
import { computeGrowthBonus } from '../hero-growth/growthManager'

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates a fully-initialised `HeroInstance` from a static `HeroData` record.
 *
 * Initialisation contract:
 * - `level`           set to the provided level (default 1)
 * - `growthBonus`     calculated from `data.statGrowthRates` and `level`
 *                     (includes LEGEND_GROWTH_MULTIPLIER for Legend variants)
 * - `equipBonus`      zeroed — no items equipped yet
 * - `bondModifier`    zeroed — bond system will write this during roster evaluation
 * - `statusModifier`  zeroed — status system will write this during battle
 * - `currentHP`       set to the hero's max HP (final HP stat at creation)
 * - `equippedItemIds` empty array
 * - `activeStatusIds` empty array
 * - `isKnockedOut`    false
 *
 * @param data  - The static hero data record (loaded from config).
 * @param level - Starting level for this instance. Defaults to 1.
 * @returns A mutable `HeroInstance` ready for use in roster / battle systems.
 */
export function createHeroInstance(data: HeroData, level: number = 1): HeroInstance {
  const growthBonus = computeGrowthBonus(data, level)
  const equipBonus  = createZeroStats()

  // Partially assemble the instance to pass to calculateFinalStat for initial HP.
  // bondModifier and statusModifier are 0 at creation.
  const partialInstance: HeroInstance = {
    data,
    level,
    currentHP:       0, // placeholder; overwritten below
    growthBonus,
    equipBonus,
    bondModifier:    createZeroStats(),
    statusModifier:  createZeroStats(),
    equippedItemIds: [],
    activeStatusIds: [],
    isKnockedOut:    false,
  }

  // Set currentHP to the hero's full max HP using the canonical stat formula.
  partialInstance.currentHP = calculateFinalStat(partialInstance, StatType.HP)

  return partialInstance
}
