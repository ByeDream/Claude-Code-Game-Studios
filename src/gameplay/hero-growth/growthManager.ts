/**
 * Hero Growth System — Growth Manager
 *
 * Implements level-up cost calculation, stat growth preview,
 * skill scaling, and the level-up operation.
 *
 * Uses the existing percentage-based growth formula from the Hero System:
 *   growthBonus[stat] = floor(baseStat * growthRate * (level - 1))
 *
 * This module adds: level-up cost curves, skill scaling, and economy integration.
 *
 * @module src/gameplay/hero-growth/growthManager
 * @see design/gdd/hero-growth.md
 */

import type { HeroInstance, BaseStats, HeroData } from '../hero/types'
import { StatType, HeroVariant } from '../hero/types'
import { createZeroStats } from '../hero/statCalculation'
import type { Economy } from '../economy/types'
import { canAfford, spend } from '../economy/economyManager'
import type { LevelUpResult, StatPreview } from './types'
import {
  MAX_LEVEL,
  BASE_LEVEL_COST,
  COST_INCREMENT,
  COST_ACCELERATION,
  SKILL_SCALING_RATE,
  LEGEND_GROWTH_MULTIPLIER,
} from './growthConfig'

// ---------------------------------------------------------------------------
// Level-up cost
// ---------------------------------------------------------------------------

/**
 * Calculates the material cost to level up to the given target level.
 *
 * Formula (from GDD):
 *   levelUpCost = BASE_LEVEL_COST + (targetLevel - 2) * COST_INCREMENT + (targetLevel - 2)^2 * COST_ACCELERATION
 *
 * For targetLevel = 2: cost = BASE_LEVEL_COST + 0 + 0 = 5
 * For targetLevel = 10: cost = 5 + 8*2 + 64*1 = 85
 *
 * @param targetLevel - The level being upgraded TO (2–MAX_LEVEL).
 * @returns Material cost for this level-up.
 */
export function getLevelUpCost(targetLevel: number): number {
  if (targetLevel <= 1 || targetLevel > MAX_LEVEL) {
    return 0
  }
  const n = targetLevel - 2
  return Math.floor(BASE_LEVEL_COST + n * COST_INCREMENT + n * n * COST_ACCELERATION)
}

/**
 * Calculates the total material cost to level a hero from level 1 to a target level.
 *
 * @param targetLevel - The target level (1–MAX_LEVEL).
 * @returns Total material cost.
 */
export function getTotalCostToLevel(targetLevel: number): number {
  let total = 0
  for (let lv = 2; lv <= Math.min(targetLevel, MAX_LEVEL); lv++) {
    total += getLevelUpCost(lv)
  }
  return total
}

// ---------------------------------------------------------------------------
// Can level up
// ---------------------------------------------------------------------------

/**
 * Checks whether a hero can level up given current economy state.
 *
 * @param hero - The hero instance to check.
 * @param economy - Current economy state.
 * @returns True if level < MAX_LEVEL and economy can afford the cost.
 */
export function canLevelUp(hero: HeroInstance, economy: Economy): boolean {
  if (hero.level >= MAX_LEVEL) return false
  const cost = getLevelUpCost(hero.level + 1)
  return canAfford(economy, 0, cost)
}

// ---------------------------------------------------------------------------
// Growth bonus computation
// ---------------------------------------------------------------------------

/**
 * Computes growth bonus for all stats at a given level.
 * Uses the percentage-based formula from the Hero System:
 *   growthBonus[stat] = floor(baseStat * growthRate * (level - 1))
 *
 * Legend variants get a multiplied growth rate.
 *
 * @param data - Hero's static data.
 * @param level - Target level.
 * @returns BaseStats with growth bonus per stat.
 */
export function computeGrowthBonus(data: HeroData, level: number): BaseStats {
  const levelsGained = level - 1
  if (levelsGained <= 0) return createZeroStats()

  const legendMult = data.variant === HeroVariant.Legend ? LEGEND_GROWTH_MULTIPLIER : 1.0
  const bonus = createZeroStats()

  for (const stat of Object.values(StatType)) {
    bonus[stat] = Math.floor(
      data.baseStats[stat] * data.statGrowthRates[stat] * legendMult * levelsGained,
    )
  }

  return bonus
}

// ---------------------------------------------------------------------------
// Level up
// ---------------------------------------------------------------------------

/**
 * Performs a level-up operation on a hero.
 *
 * Mutates the hero's `level` and `growthBonus`.
 * Returns a new Economy with the cost deducted.
 *
 * @param hero - Hero instance to level up (mutated).
 * @param economy - Current economy state (not mutated).
 * @returns Tuple of [newEconomy, LevelUpResult].
 * @throws If hero is already max level or economy can't afford the cost.
 */
export function levelUp(
  hero: HeroInstance,
  economy: Economy,
): [Economy, LevelUpResult] {
  if (hero.level >= MAX_LEVEL) {
    throw new Error(`Hero ${hero.data.id} is already at max level ${MAX_LEVEL}`)
  }

  const targetLevel = hero.level + 1
  const cost = getLevelUpCost(targetLevel)
  const newEconomy = spend(economy, 0, cost)

  hero.level = targetLevel
  hero.growthBonus = computeGrowthBonus(hero.data, targetLevel)

  return [newEconomy, {
    newLevel: targetLevel,
    materialSpent: cost,
    newGrowthBonus: hero.growthBonus,
  }]
}

// ---------------------------------------------------------------------------
// Growth preview
// ---------------------------------------------------------------------------

/**
 * Returns a stat preview showing what changes the next level-up would bring.
 *
 * @param hero - Hero instance to preview.
 * @returns StatPreview with current vs next growth bonus and delta.
 */
export function getGrowthPreview(hero: HeroInstance): StatPreview {
  const targetLevel = Math.min(hero.level + 1, MAX_LEVEL)
  const nextBonus = computeGrowthBonus(hero.data, targetLevel)

  const delta = createZeroStats()
  for (const stat of Object.values(StatType)) {
    delta[stat] = nextBonus[stat] - hero.growthBonus[stat]
  }

  return {
    currentLevel: hero.level,
    targetLevel,
    cost: getLevelUpCost(targetLevel),
    currentGrowthBonus: { ...hero.growthBonus },
    nextGrowthBonus: nextBonus,
    statDelta: delta,
  }
}

// ---------------------------------------------------------------------------
// Skill scaling
// ---------------------------------------------------------------------------

/**
 * Calculates a scaled skill value based on hero level.
 *
 * Formula:
 *   scaledValue = baseValue * (1 + (level - 1) * SKILL_SCALING_RATE)
 *
 * At Lv.10: scaledValue = baseValue * 1.72
 *
 * @param baseValue - The skill's base numeric value (damage/heal/buff magnitude).
 * @param level - Hero's current level.
 * @returns Scaled skill value.
 */
export function getScaledSkillValue(baseValue: number, level: number): number {
  return baseValue * (1 + (level - 1) * SKILL_SCALING_RATE)
}
