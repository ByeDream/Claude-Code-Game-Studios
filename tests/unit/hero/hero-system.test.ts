/**
 * Hero System — Unit Tests
 *
 * Verifies the Hero System data model, factory function, and stat calculation
 * formula against the GDD specification.
 *
 * @module tests/unit/hero/hero-system.test
 * @see design/gdd/hero-system.md
 */

import { describe, it, expect } from 'vitest'

import {
  StatType,
  HeroTier,
  HeroVariant,
  Faction,
  SkillType,
  HeroInstance,
} from '../../../src/gameplay/hero/types'

import {
  createZeroStats,
  sumBaseStats,
  calculateFinalStat,
  calculateAllFinalStats,
} from '../../../src/gameplay/hero/statCalculation'

import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'

import {
  MIN_STAT_VALUE,
  TIER_STAT_RANGES,
} from '../../../src/gameplay/hero/heroConfig'

import {
  GUAN_YU,
  ZHANG_FEI,
  CAO_CAO,
  ZHOU_YU,
  LV_BU,
  TEST_HEROES,
} from '../../../src/gameplay/hero/testHeroes'

// ===========================================================================
// createHeroInstance — factory
// ===========================================================================

describe('createHeroInstance', () => {

  it('test_heroFactory_createAtLevelOne_hasZeroGrowthBonus', () => {
    // Arrange
    const data = GUAN_YU

    // Act
    const instance = createHeroInstance(data, 1)

    // Assert — no growth at level 1
    for (const stat of Object.values(StatType)) {
      expect(instance.growthBonus[stat]).toBe(0)
    }
  })

  it('test_heroFactory_createAtLevelOne_equipBonusIsAllZero', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)

    // Assert
    for (const stat of Object.values(StatType)) {
      expect(instance.equipBonus[stat]).toBe(0)
    }
  })

  it('test_heroFactory_createAtLevelOne_modifiersAreZero', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)

    // Assert
    expect(instance.bondModifier).toBe(0)
    expect(instance.statusModifier).toBe(0)
  })

  it('test_heroFactory_createInstance_equippedAndStatusSlotsEmpty', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)

    // Assert
    expect(instance.equippedItemIds).toEqual([])
    expect(instance.activeStatusIds).toEqual([])
  })

  it('test_heroFactory_createInstance_isNotKnockedOut', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)

    // Assert
    expect(instance.isKnockedOut).toBe(false)
  })

  it('test_heroFactory_createInstance_currentHPEqualsMaxHP', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)

    // Assert — at level 1, no bonuses, currentHP = baseStat[HP]
    const expectedHP = GUAN_YU.baseStats[StatType.HP]
    expect(instance.currentHP).toBe(expectedHP)
  })

  it('test_heroFactory_createInstance_referencesOriginalData', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)

    // Assert — should hold a reference to the static data, not a copy
    expect(instance.data).toBe(GUAN_YU)
  })

  it('test_heroFactory_createAtLevel5_growthBonusIsPositive', () => {
    // Arrange
    const data = GUAN_YU
    const level = 5

    // Act
    const instance = createHeroInstance(data, level)

    // Assert — STR should grow because statGrowthRates.STR = 0.08
    // growthBonus[STR] = floor(38 * 0.08 * 4) = floor(12.16) = 12
    expect(instance.growthBonus[StatType.STR]).toBe(12)
  })

  it('test_heroFactory_createAtLevel5_HPReflectsGrowth', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 5)

    // growthBonus[HP] = floor(34 * 0.07 * 4) = floor(9.52) = 9
    // finalHP = (34 + 9 + 0) * (1 + 0 + 0) = 43
    expect(instance.currentHP).toBe(43)
  })

})

// ===========================================================================
// calculateFinalStat — formula verification
// ===========================================================================

describe('calculateFinalStat', () => {

  it('test_statCalc_noModifiers_finalStatEqualsBaseStat', () => {
    // Arrange — level 1 instance, all modifiers at default zero
    const instance = createHeroInstance(GUAN_YU, 1)

    // Act
    const finalSTR = calculateFinalStat(instance, StatType.STR)

    // Assert — formula: (38 + 0 + 0) * (1 + 0 + 0) = 38
    expect(finalSTR).toBe(GUAN_YU.baseStats[StatType.STR])
  })

  it('test_statCalc_withGrowthBonus_addsToBase', () => {
    // Arrange
    const instance = createHeroInstance(GUAN_YU, 5)
    // growthBonus[STR] = floor(38 * 0.08 * 4) = 12

    // Act
    const finalSTR = calculateFinalStat(instance, StatType.STR)

    // Assert — (38 + 12 + 0) * (1 + 0 + 0) = 50
    expect(finalSTR).toBe(50)
  })

  it('test_statCalc_withEquipBonus_addsToBase', () => {
    // Arrange
    const instance = createHeroInstance(GUAN_YU, 1)
    instance.equipBonus[StatType.STR] = 10

    // Act
    const finalSTR = calculateFinalStat(instance, StatType.STR)

    // Assert — (38 + 0 + 10) * (1 + 0 + 0) = 48
    expect(finalSTR).toBe(48)
  })

  it('test_statCalc_withBondModifier_multipliesTotalAdditive', () => {
    // Arrange
    const instance = createHeroInstance(GUAN_YU, 1)
    instance.bondModifier = 0.10  // +10% from bond system

    // Act
    const finalSTR = calculateFinalStat(instance, StatType.STR)

    // Assert — (38 + 0 + 0) * (1 + 0.10 + 0) = 38 * 1.1 = 41.8 → round → 42
    expect(finalSTR).toBe(42)
  })

  it('test_statCalc_withStatusDebuff_reducesStatBelowBase', () => {
    // Arrange
    const instance = createHeroInstance(GUAN_YU, 1)
    instance.statusModifier = -0.30  // −30% debuff

    // Act
    const finalSTR = calculateFinalStat(instance, StatType.STR)

    // Assert — (38 + 0 + 0) * (1 + 0 + (-0.30)) = 38 * 0.70 = 26.6 → round → 27
    expect(finalSTR).toBe(27)
  })

  it('test_statCalc_allModifiersApplied_usesFullFormula', () => {
    // Arrange — verifies every term in the GDD formula
    const instance = createHeroInstance(GUAN_YU, 5)
    instance.equipBonus[StatType.DEF]  = 15
    instance.bondModifier              = 0.15
    instance.statusModifier            = 0.05

    // growthBonus[DEF] = floor(28 * 0.06 * 4) = floor(6.72) = 6
    // finalDEF = (28 + 6 + 15) * (1 + 0.15 + 0.05)
    //          = 49 * 1.20 = 58.8 → round → 59
    const finalDEF = calculateFinalStat(instance, StatType.DEF)
    expect(finalDEF).toBe(59)
  })

  it('test_statCalc_extremeDebuff_clampedToMinStatValue', () => {
    // Arrange — statusModifier of −1.0 to simulate extreme debuff scenario
    const instance = createHeroInstance(GUAN_YU, 1)
    instance.statusModifier = -1.0  // would reduce to 0 without clamp

    // Act
    const finalINT = calculateFinalStat(instance, StatType.INT)

    // Assert — (12 + 0 + 0) * (1 + 0 + (-1.0)) = 12 * 0 = 0 → clamped to 1
    expect(finalINT).toBe(MIN_STAT_VALUE)
    expect(finalINT).toBeGreaterThanOrEqual(1)
  })

  it('test_statCalc_veryLargeDebuff_clampedToMinStatValue', () => {
    // Arrange — statusModifier below −1.0 (negative final value)
    const instance = createHeroInstance(GUAN_YU, 1)
    instance.statusModifier = -2.0

    // Act
    const finalSPD = calculateFinalStat(instance, StatType.SPD)

    // Assert — result would be negative → clamped to 1
    expect(finalSPD).toBe(MIN_STAT_VALUE)
  })

})

// ===========================================================================
// calculateAllFinalStats — batch calculation
// ===========================================================================

describe('calculateAllFinalStats', () => {

  it('test_calcAllStats_atLevelOne_matchesBaseStats', () => {
    // Arrange
    const instance = createHeroInstance(GUAN_YU, 1)

    // Act
    const all = calculateAllFinalStats(instance)

    // Assert — no modifiers, so each final stat = base stat
    for (const stat of Object.values(StatType)) {
      expect(all[stat]).toBe(GUAN_YU.baseStats[stat])
    }
  })

  it('test_calcAllStats_returnsAllFiveStatTypes', () => {
    // Arrange & Act
    const instance = createHeroInstance(GUAN_YU, 1)
    const all = calculateAllFinalStats(instance)

    // Assert — all five keys must be present
    expect(all).toHaveProperty(StatType.STR)
    expect(all).toHaveProperty(StatType.INT)
    expect(all).toHaveProperty(StatType.DEF)
    expect(all).toHaveProperty(StatType.HP)
    expect(all).toHaveProperty(StatType.SPD)
  })

})

// ===========================================================================
// Test hero data validation
// ===========================================================================

describe('Test Heroes — data validity', () => {

  it('test_testHeroes_allFiveArePresent', () => {
    // Arrange & Act & Assert
    expect(TEST_HEROES).toHaveLength(5)
  })

  it('test_testHeroes_allAreTierA', () => {
    // Assert — all five test heroes must be A-tier for sprint prototype purposes
    for (const hero of TEST_HEROES) {
      expect(hero.tier).toBe(HeroTier.A)
    }
  })

  it('test_testHeroes_allAreBaseVariant', () => {
    for (const hero of TEST_HEROES) {
      expect(hero.variant).toBe(HeroVariant.Base)
    }
  })

  it('test_testHeroes_allHaveLegendTitleNull', () => {
    for (const hero of TEST_HEROES) {
      expect(hero.legendTitle).toBeNull()
    }
  })

  it('test_testHeroes_uniqueIds', () => {
    const ids = TEST_HEROES.map(h => h.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(TEST_HEROES.length)
  })

  it('test_testHeroes_statTotalInATierRange', () => {
    // Arrange
    const range = TIER_STAT_RANGES[HeroTier.A]

    // Assert — every test hero's base stat total must satisfy 85 ≤ total ≤ 130
    for (const hero of TEST_HEROES) {
      const total = sumBaseStats(hero.baseStats)
      expect(total).toBeGreaterThanOrEqual(range.min)
      expect(total).toBeLessThanOrEqual(range.max)
    }
  })

  it('test_testHeroes_eachStatNotExceedATierMaxSingleStat', () => {
    // GDD: A-tier single stat upper bound is 40.
    // The lower bound of 15 in the tier table is a typical/average guideline —
    // the GDD explicitly notes "单项属性分布差异大" and gives 关羽 INT:12 as an
    // example of a low off-stat on a STR-focused hero. We enforce the max only.
    const SINGLE_STAT_MAX = 40

    for (const hero of TEST_HEROES) {
      for (const stat of Object.values(StatType)) {
        const value = hero.baseStats[stat]
        expect(value).toBeLessThanOrEqual(SINGLE_STAT_MAX)
        // Stats must be at least 1 (MIN_STAT_VALUE) — zero is never valid
        expect(value).toBeGreaterThanOrEqual(MIN_STAT_VALUE)
      }
    }
  })

  it('test_testHeroes_eachHeroHasExactlyTwoSkills', () => {
    // A-tier heroes: 1 passive + 1 active = 2 skills
    for (const hero of TEST_HEROES) {
      expect(hero.skills).toHaveLength(2)
    }
  })

  it('test_testHeroes_eachHeroHasOnePassiveAndOneActiveSkill', () => {
    for (const hero of TEST_HEROES) {
      const passives = hero.skills.filter(s => s.type === SkillType.Passive)
      const actives  = hero.skills.filter(s => s.type === SkillType.Active)
      expect(passives).toHaveLength(1)
      expect(actives).toHaveLength(1)
    }
  })

  it('test_testHeroes_noMartialArtsOrAdvisorSkillsOnATier', () => {
    // A-tier heroes do not have martial arts or advisor skills per GDD
    for (const hero of TEST_HEROES) {
      expect(hero.martialArts).toBeNull()
      expect(hero.advisorSkill).toBeNull()
    }
  })

  it('test_testHeroes_eachHeroHasAtLeastOneTag', () => {
    for (const hero of TEST_HEROES) {
      expect(hero.tags.length).toBeGreaterThan(0)
    }
  })

  it('test_testHeroes_eachHeroHasAtLeastOneBondKey', () => {
    for (const hero of TEST_HEROES) {
      expect(hero.bondKeys.length).toBeGreaterThan(0)
    }
  })

  it('test_testHeroes_factionsMatchExpected', () => {
    // Verify each hero belongs to the correct faction per GDD
    expect(GUAN_YU.faction).toBe(Faction.Shu)
    expect(ZHANG_FEI.faction).toBe(Faction.Shu)
    expect(CAO_CAO.faction).toBe(Faction.Wei)
    expect(ZHOU_YU.faction).toBe(Faction.Wu)
    expect(LV_BU.faction).toBe(Faction.Qun)
  })

  it('test_testHeroes_guanYuHasHighestSTR_among_shu_heroes', () => {
    // GDD: 关羽 STR:38 vs 张飞 STR:32
    expect(GUAN_YU.baseStats[StatType.STR]).toBeGreaterThan(ZHANG_FEI.baseStats[StatType.STR])
  })

  it('test_testHeroes_lvBuHasHighestSTR_overall', () => {
    // GDD: 吕布 is highest STR A-tier hero at 40
    const maxSTR = Math.max(...TEST_HEROES.map(h => h.baseStats[StatType.STR]))
    expect(LV_BU.baseStats[StatType.STR]).toBe(maxSTR)
  })

  it('test_testHeroes_zhouYuHasHighestINT_overall', () => {
    // 周瑜 INT:38 is the highest INT among the five
    const maxINT = Math.max(...TEST_HEROES.map(h => h.baseStats[StatType.INT]))
    expect(ZHOU_YU.baseStats[StatType.INT]).toBe(maxINT)
  })

  it('test_testHeroes_growthRatesAreNonNegative', () => {
    for (const hero of TEST_HEROES) {
      for (const stat of Object.values(StatType)) {
        expect(hero.statGrowthRates[stat]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('test_testHeroes_canCreateInstancesWithoutError', () => {
    // Smoke-test: factory should not throw for any of the five heroes
    for (const hero of TEST_HEROES) {
      expect(() => createHeroInstance(hero)).not.toThrow()
      expect(() => createHeroInstance(hero, 10)).not.toThrow()
    }
  })

})

// ===========================================================================
// createZeroStats helper
// ===========================================================================

describe('createZeroStats', () => {

  it('test_createZeroStats_allStatsAreZero', () => {
    // Arrange & Act
    const stats = createZeroStats()

    // Assert
    for (const stat of Object.values(StatType)) {
      expect(stats[stat]).toBe(0)
    }
  })

  it('test_createZeroStats_hasAllFiveKeys', () => {
    const stats = createZeroStats()
    expect(Object.keys(stats)).toHaveLength(Object.values(StatType).length)
  })

})

// ===========================================================================
// sumBaseStats helper
// ===========================================================================

describe('sumBaseStats', () => {

  it('test_sumBaseStats_guanYu_equals130', () => {
    // GDD explicitly states 关羽: STR:38 INT:12 DEF:28 HP:34 SPD:18 = 130
    expect(sumBaseStats(GUAN_YU.baseStats)).toBe(130)
  })

  it('test_sumBaseStats_zeroStats_equals0', () => {
    expect(sumBaseStats(createZeroStats())).toBe(0)
  })

})

// ===========================================================================
// HeroInstance interface contract
// ===========================================================================

describe('HeroInstance contract', () => {

  it('test_heroInstance_isImmutableReference_mutatingInstanceDoesNotAffectData', () => {
    // Arrange
    const instance: HeroInstance = createHeroInstance(GUAN_YU, 1)
    const originalSTR = GUAN_YU.baseStats[StatType.STR]

    // Act — mutate instance equip bonus (simulating Equipment System)
    instance.equipBonus[StatType.STR] = 99

    // Assert — original static data is unchanged
    expect(GUAN_YU.baseStats[StatType.STR]).toBe(originalSTR)
  })

  it('test_heroInstance_statusModifier_affectsFinalStatIndependently', () => {
    // Arrange
    const instance = createHeroInstance(GUAN_YU, 1)

    // Act — simulate a +25% bond modifier (max bond per GDD)
    instance.bondModifier = 0.25
    const withBond = calculateFinalStat(instance, StatType.STR)

    // Reset bond, apply status buff
    instance.bondModifier   = 0
    instance.statusModifier = 0.25
    const withStatus = calculateFinalStat(instance, StatType.STR)

    // Assert — same magnitude modifier produces same result when base is unchanged
    expect(withBond).toBe(withStatus)
  })

})
