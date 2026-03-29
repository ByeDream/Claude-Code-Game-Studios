/**
 * Hero Growth System — Type Definitions
 *
 * Defines types for the hero level-up and growth system.
 * Heroes gain stats per level and skills auto-scale.
 *
 * @module src/gameplay/hero-growth/types
 * @see design/gdd/hero-growth.md
 */

import type { BaseStats } from '../hero/types'

/**
 * Result of a successful level-up operation.
 */
export interface LevelUpResult {
  /** The new level after leveling up. */
  newLevel: number
  /** Material cost that was spent. */
  materialSpent: number
  /** New growth bonus for all stats after level-up. */
  newGrowthBonus: BaseStats
}

/**
 * Preview of stat changes for the next level-up.
 * Used by UI to show "before → after" comparison.
 */
export interface StatPreview {
  /** Current hero level. */
  currentLevel: number
  /** Target level after upgrade. */
  targetLevel: number
  /** Material cost for this level-up. */
  cost: number
  /** Current growth bonus per stat. */
  currentGrowthBonus: BaseStats
  /** Growth bonus per stat after level-up. */
  nextGrowthBonus: BaseStats
  /** Delta (increase) per stat for this single level-up. */
  statDelta: BaseStats
}
