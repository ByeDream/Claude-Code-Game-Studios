/**
 * Hero Growth System — Unit Tests
 *
 * Verifies level-up cost formula, growth bonus computation, skill scaling,
 * economy integration, and edge cases.
 *
 * @module tests/unit/hero-growth/hero-growth.test
 * @see design/gdd/hero-growth.md
 */

import { describe, it, expect } from 'vitest'

import { StatType, HeroVariant } from '../../../src/gameplay/hero/types'
import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'
import { createEconomy } from '../../../src/gameplay/economy/economyManager'
import {
  GUAN_YU,
  ZHANG_FEI,
  TEST_HEROES,
} from '../../../src/gameplay/hero/testHeroes'

import {
  MAX_LEVEL,
  BASE_LEVEL_COST,
  COST_INCREMENT,
  COST_ACCELERATION,
  SKILL_SCALING_RATE,
  LEGEND_GROWTH_MULTIPLIER,
} from '../../../src/gameplay/hero-growth/growthConfig'

import {
  getLevelUpCost,
  getTotalCostToLevel,
  canLevelUp,
  computeGrowthBonus,
  levelUp,
  getGrowthPreview,
  getScaledSkillValue,
} from '../../../src/gameplay/hero-growth/growthManager'

// ===========================================================================
// getLevelUpCost — formula verification
// ===========================================================================

describe('getLevelUpCost', () => {

  it('test_growth_costLv2_equalsBaseLevelCost', () => {
    // Formula: BASE_LEVEL_COST + (2-2)*COST_INCREMENT + (2-2)^2*COST_ACCELERATION = 5
    expect(getLevelUpCost(2)).toBe(BASE_LEVEL_COST)
  })

  it('test_growth_costLv3_hasLinearIncrement', () => {
    // Formula: 5 + 1*2 + 1*1 = 8
    expect(getLevelUpCost(3)).toBe(BASE_LEVEL_COST + COST_INCREMENT + COST_ACCELERATION)
  })

  it('test_growth_costLv10_followsFullFormula', () => {
    // Formula: 5 + 8*2 + 64*1 = 5 + 16 + 64 = 85
    const n = 10 - 2
    const expected = Math.floor(BASE_LEVEL_COST + n * COST_INCREMENT + n * n * COST_ACCELERATION)
    expect(getLevelUpCost(10)).toBe(expected)
    expect(getLevelUpCost(10)).toBe(85)
  })

  it('test_growth_costLv1_returnsZero', () => {
    // Can't level up to level 1 (already there)
    expect(getLevelUpCost(1)).toBe(0)
  })

  it('test_growth_costAboveMax_returnsZero', () => {
    expect(getLevelUpCost(MAX_LEVEL + 1)).toBe(0)
  })

  it('test_growth_costIsStrictlyIncreasing', () => {
    for (let lv = 3; lv <= MAX_LEVEL; lv++) {
      expect(getLevelUpCost(lv)).toBeGreaterThan(getLevelUpCost(lv - 1))
    }
  })

})

// ===========================================================================
// getTotalCostToLevel
// ===========================================================================

describe('getTotalCostToLevel', () => {

  it('test_growth_totalCostToLv1_isZero', () => {
    expect(getTotalCostToLevel(1)).toBe(0)
  })

  it('test_growth_totalCostToLv2_equalsBaseCost', () => {
    expect(getTotalCostToLevel(2)).toBe(BASE_LEVEL_COST)
  })

  it('test_growth_totalCostToMax_isSumOfAllLevels', () => {
    let sum = 0
    for (let lv = 2; lv <= MAX_LEVEL; lv++) {
      sum += getLevelUpCost(lv)
    }
    expect(getTotalCostToLevel(MAX_LEVEL)).toBe(sum)
  })

  it('test_growth_totalCost5HeroesToLv8_reasonableForEconomy', () => {
    // 5 heroes to Lv.8 should be affordable in a run
    const costPerHero = getTotalCostToLevel(8)
    const totalFor5 = costPerHero * 5
    // This is just a sanity check — should be a positive number
    expect(totalFor5).toBeGreaterThan(0)
  })

})

// ===========================================================================
// canLevelUp
// ===========================================================================

describe('canLevelUp', () => {

  it('test_growth_canLevelUp_withSufficientMaterial_true', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(0, 100) // plenty of material

    expect(canLevelUp(hero, economy)).toBe(true)
  })

  it('test_growth_canLevelUp_withInsufficientMaterial_false', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(0, 0)

    expect(canLevelUp(hero, economy)).toBe(false)
  })

  it('test_growth_canLevelUp_atMaxLevel_false', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    hero.level = MAX_LEVEL
    const economy = createEconomy(0, 9999)

    expect(canLevelUp(hero, economy)).toBe(false)
  })

  it('test_growth_canLevelUp_exactCost_true', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const cost = getLevelUpCost(2)
    const economy = createEconomy(0, cost)

    expect(canLevelUp(hero, economy)).toBe(true)
  })

})

// ===========================================================================
// computeGrowthBonus
// ===========================================================================

describe('computeGrowthBonus', () => {

  it('test_growth_bonus_lv1_allZero', () => {
    const bonus = computeGrowthBonus(GUAN_YU, 1)
    for (const stat of Object.values(StatType)) {
      expect(bonus[stat]).toBe(0)
    }
  })

  it('test_growth_bonus_lv5_matchesPercentageFormula', () => {
    // growthBonus[STR] = floor(38 * 0.08 * 4) = floor(12.16) = 12
    const bonus = computeGrowthBonus(GUAN_YU, 5)
    expect(bonus[StatType.STR]).toBe(12)
  })

  it('test_growth_bonus_lv5_HP_matchesFormula', () => {
    // growthBonus[HP] = floor(34 * 0.07 * 4) = floor(9.52) = 9
    const bonus = computeGrowthBonus(GUAN_YU, 5)
    expect(bonus[StatType.HP]).toBe(9)
  })

  it('test_growth_bonus_lv10_allStatsPositive', () => {
    const bonus = computeGrowthBonus(GUAN_YU, 10)
    // GUAN_YU has non-zero growth rates for all stats
    for (const stat of Object.values(StatType)) {
      expect(bonus[stat]).toBeGreaterThan(0)
    }
  })

  it('test_growth_bonus_legend_variant_hasMultiplier', () => {
    // Create a legend version of Guan Yu
    const legendGY = {
      ...GUAN_YU,
      variant: HeroVariant.Legend,
    }

    const baseBonus = computeGrowthBonus(GUAN_YU, 5)
    const legendBonus = computeGrowthBonus(legendGY, 5)

    // Legend growth should be >= base growth for each stat
    for (const stat of Object.values(StatType)) {
      expect(legendBonus[stat]).toBeGreaterThanOrEqual(baseBonus[stat])
    }

    // STR specifically: floor(38 * 0.08 * 1.25 * 4) = floor(15.2) = 15
    expect(legendBonus[StatType.STR]).toBe(15)
  })

})

// ===========================================================================
// levelUp
// ===========================================================================

describe('levelUp', () => {

  it('test_growth_levelUp_incrementsLevel', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(0, 100)

    const [, result] = levelUp(hero, economy)

    expect(hero.level).toBe(2)
    expect(result.newLevel).toBe(2)
  })

  it('test_growth_levelUp_spendsMaterial', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const cost = getLevelUpCost(2)
    const economy = createEconomy(0, cost + 10)

    const [newEconomy, result] = levelUp(hero, economy)

    expect(result.materialSpent).toBe(cost)
    expect(newEconomy.material).toBe(10)
  })

  it('test_growth_levelUp_updatesGrowthBonus', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(0, 100)

    // Before: all zero
    for (const stat of Object.values(StatType)) {
      expect(hero.growthBonus[stat]).toBe(0)
    }

    levelUp(hero, economy)

    // After: should have some growth (level 2)
    const expected = computeGrowthBonus(GUAN_YU, 2)
    for (const stat of Object.values(StatType)) {
      expect(hero.growthBonus[stat]).toBe(expected[stat])
    }
  })

  it('test_growth_levelUp_throwsAtMaxLevel', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    hero.level = MAX_LEVEL
    const economy = createEconomy(0, 9999)

    expect(() => levelUp(hero, economy)).toThrow(/max level/)
  })

  it('test_growth_levelUp_throwsInsufficientMaterial', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(0, 0)

    expect(() => levelUp(hero, economy)).toThrow()
  })

  it('test_growth_levelUp_goldUnchanged', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(50, 100)

    const [newEconomy] = levelUp(hero, economy)

    expect(newEconomy.gold).toBe(50)
  })

  it('test_growth_levelUp_multipleTimes_toLevel5', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    let economy = createEconomy(0, 500)

    for (let i = 0; i < 4; i++) {
      const [newEco] = levelUp(hero, economy)
      economy = newEco
    }

    expect(hero.level).toBe(5)
    const expectedBonus = computeGrowthBonus(GUAN_YU, 5)
    expect(hero.growthBonus[StatType.STR]).toBe(expectedBonus[StatType.STR])
  })

})

// ===========================================================================
// getGrowthPreview
// ===========================================================================

describe('getGrowthPreview', () => {

  it('test_growth_preview_showsCorrectLevels', () => {
    const hero = createHeroInstance(GUAN_YU, 3)

    const preview = getGrowthPreview(hero)

    expect(preview.currentLevel).toBe(3)
    expect(preview.targetLevel).toBe(4)
  })

  it('test_growth_preview_showsCorrectCost', () => {
    const hero = createHeroInstance(GUAN_YU, 3)

    const preview = getGrowthPreview(hero)

    expect(preview.cost).toBe(getLevelUpCost(4))
  })

  it('test_growth_preview_deltaIsPositive', () => {
    const hero = createHeroInstance(GUAN_YU, 3)

    const preview = getGrowthPreview(hero)

    // At least some stats should increase
    const hasPositiveDelta = Object.values(StatType).some(
      stat => preview.statDelta[stat] > 0,
    )
    expect(hasPositiveDelta).toBe(true)
  })

  it('test_growth_preview_atMaxLevel_deltaIsZero', () => {
    const hero = createHeroInstance(GUAN_YU, 1)
    hero.level = MAX_LEVEL
    hero.growthBonus = computeGrowthBonus(GUAN_YU, MAX_LEVEL)

    const preview = getGrowthPreview(hero)

    // Target level is capped at MAX_LEVEL, same growth bonus, so delta = 0
    expect(preview.targetLevel).toBe(MAX_LEVEL)
    for (const stat of Object.values(StatType)) {
      expect(preview.statDelta[stat]).toBe(0)
    }
  })

})

// ===========================================================================
// getScaledSkillValue
// ===========================================================================

describe('getScaledSkillValue', () => {

  it('test_growth_skill_lv1_equalsBaseValue', () => {
    expect(getScaledSkillValue(1.0, 1)).toBe(1.0)
  })

  it('test_growth_skill_lv10_approximately1_72x', () => {
    const scaled = getScaledSkillValue(1.0, 10)
    // 1.0 * (1 + 9 * 0.08) = 1.72
    expect(scaled).toBeCloseTo(1.72)
  })

  it('test_growth_skill_lv5_correctFormula', () => {
    const base = 2.0
    const scaled = getScaledSkillValue(base, 5)
    // 2.0 * (1 + 4 * 0.08) = 2.0 * 1.32 = 2.64
    expect(scaled).toBeCloseTo(2.64)
  })

  it('test_growth_skill_zeroBase_remainsZero', () => {
    expect(getScaledSkillValue(0, 10)).toBe(0)
  })

})

// ===========================================================================
// Config validation
// ===========================================================================

describe('Growth config', () => {

  it('test_growth_config_maxLevelIsPositive', () => {
    expect(MAX_LEVEL).toBeGreaterThanOrEqual(5)
    expect(MAX_LEVEL).toBeLessThanOrEqual(20)
  })

  it('test_growth_config_baseCostIsPositive', () => {
    expect(BASE_LEVEL_COST).toBeGreaterThan(0)
  })

  it('test_growth_config_costIncrementIsPositive', () => {
    expect(COST_INCREMENT).toBeGreaterThan(0)
  })

  it('test_growth_config_costAccelerationIsNonNegative', () => {
    expect(COST_ACCELERATION).toBeGreaterThanOrEqual(0)
  })

  it('test_growth_config_skillScalingRateInRange', () => {
    expect(SKILL_SCALING_RATE).toBeGreaterThanOrEqual(0.05)
    expect(SKILL_SCALING_RATE).toBeLessThanOrEqual(0.12)
  })

  it('test_growth_config_legendMultiplierAboveOne', () => {
    expect(LEGEND_GROWTH_MULTIPLIER).toBeGreaterThan(1.0)
    expect(LEGEND_GROWTH_MULTIPLIER).toBeLessThanOrEqual(1.5)
  })

})
