/**
 * Economy System — Unit Tests
 *
 * Verifies the Economy data model, manager functions, config constants, and
 * derived formula helpers against the GDD specification.
 *
 * @module tests/unit/economy/economy.test
 * @see design/gdd/economy.md
 */

import { describe, it, expect } from 'vitest'

import { ResourceType } from '../../../src/gameplay/economy/types'
import type { Economy } from '../../../src/gameplay/economy/types'

import {
  STARTING_GOLD,
  STARTING_MATERIAL,
  RECRUIT_BASE_COST,
  SELL_RATIO,
  DISASSEMBLE_RATIO,
  TIER_RECRUIT_MULTIPLIER,
  BASE_GOLD,
  BASE_MATERIAL,
  GOLD_SCALING,
  MATERIAL_SCALING,
  DIFFICULTY_BONUS_NORMAL,
  DIFFICULTY_BONUS_ELITE,
  DIFFICULTY_BONUS_BOSS,
} from '../../../src/gameplay/economy/economyConfig'

import {
  createEconomy,
  getGold,
  getMaterial,
  canAfford,
  earn,
  spend,
  reset,
  calcSellGold,
  calcDisassembleMaterial,
  calcRecruitCost,
  calcBattleReward,
} from '../../../src/gameplay/economy/economyManager'

import { HeroTier } from '../../../src/gameplay/hero/types'

// ===========================================================================
// Config constants — sanity checks
// ===========================================================================

describe('Economy Config constants', () => {

  it('test_config_startingGold_equals20', () => {
    expect(STARTING_GOLD).toBe(20)
  })

  it('test_config_startingMaterial_equals0', () => {
    expect(STARTING_MATERIAL).toBe(0)
  })

  it('test_config_recruitBaseCost_equals30', () => {
    expect(RECRUIT_BASE_COST).toBe(30)
  })

  it('test_config_sellRatio_equals0Point5', () => {
    expect(SELL_RATIO).toBe(0.5)
  })

  it('test_config_disassembleRatio_equals3', () => {
    expect(DISASSEMBLE_RATIO).toBe(3)
  })

  it('test_config_tierRecruitMultiplier_cTier_is1Point0', () => {
    expect(TIER_RECRUIT_MULTIPLIER[HeroTier.C]).toBe(1.0)
  })

  it('test_config_tierRecruitMultiplier_bTier_is1Point5', () => {
    expect(TIER_RECRUIT_MULTIPLIER[HeroTier.B]).toBe(1.5)
  })

  it('test_config_tierRecruitMultiplier_aTier_is2Point5', () => {
    expect(TIER_RECRUIT_MULTIPLIER[HeroTier.A]).toBe(2.5)
  })

})

// ===========================================================================
// ResourceType enum
// ===========================================================================

describe('ResourceType enum', () => {

  it('test_resourceType_hasGoldAndMaterial', () => {
    expect(ResourceType.Gold).toBe('Gold')
    expect(ResourceType.Material).toBe('Material')
  })

})

// ===========================================================================
// createEconomy — factory
// ===========================================================================

describe('createEconomy', () => {

  it('test_createEconomy_defaultArgs_goldEqualsStartingGold', () => {
    // Arrange & Act
    const economy = createEconomy()

    // Assert
    expect(economy.gold).toBe(STARTING_GOLD)
  })

  it('test_createEconomy_defaultArgs_materialEqualsStartingMaterial', () => {
    // Arrange & Act
    const economy = createEconomy()

    // Assert
    expect(economy.material).toBe(STARTING_MATERIAL)
  })

  it('test_createEconomy_customArgs_setsCorrectValues', () => {
    // Arrange & Act
    const economy = createEconomy(50, 10)

    // Assert
    expect(economy.gold).toBe(50)
    expect(economy.material).toBe(10)
  })

  it('test_createEconomy_zeroArgs_bothResourcesAreZero', () => {
    // Arrange & Act
    const economy = createEconomy(0, 0)

    // Assert
    expect(economy.gold).toBe(0)
    expect(economy.material).toBe(0)
  })

  it('test_createEconomy_returnsDifferentObjectsEachCall', () => {
    // Two calls must return distinct objects (immutable value semantics)
    const a = createEconomy()
    const b = createEconomy()
    expect(a).not.toBe(b)
  })

})

// ===========================================================================
// getGold / getMaterial — accessors
// ===========================================================================

describe('getGold / getMaterial accessors', () => {

  it('test_getGold_returnsCurrentGoldBalance', () => {
    // Arrange
    const economy = createEconomy(42, 0)

    // Act & Assert
    expect(getGold(economy)).toBe(42)
  })

  it('test_getMaterial_returnsCurrentMaterialBalance', () => {
    // Arrange
    const economy = createEconomy(0, 7)

    // Act & Assert
    expect(getMaterial(economy)).toBe(7)
  })

})

// ===========================================================================
// canAfford — affordability check
// ===========================================================================

describe('canAfford', () => {

  it('test_canAfford_sufficientGoldOnly_returnsTrue', () => {
    // Arrange
    const economy = createEconomy(30, 0)

    // Act & Assert
    expect(canAfford(economy, 30, 0)).toBe(true)
  })

  it('test_canAfford_sufficientMaterialOnly_returnsTrue', () => {
    // Arrange
    const economy = createEconomy(0, 15)

    // Act & Assert
    expect(canAfford(economy, 0, 15)).toBe(true)
  })

  it('test_canAfford_sufficientBothResources_returnsTrue', () => {
    // Arrange
    const economy = createEconomy(50, 20)

    // Act & Assert
    expect(canAfford(economy, 30, 10)).toBe(true)
  })

  it('test_canAfford_exactBalance_returnsTrue', () => {
    // Arrange — exactly enough, no leftover
    const economy = createEconomy(30, 10)

    // Act & Assert
    expect(canAfford(economy, 30, 10)).toBe(true)
  })

  it('test_canAfford_insufficientGold_returnsFalse', () => {
    // Arrange
    const economy = createEconomy(10, 100)

    // Act & Assert
    expect(canAfford(economy, 30, 0)).toBe(false)
  })

  it('test_canAfford_insufficientMaterial_returnsFalse', () => {
    // Arrange
    const economy = createEconomy(100, 5)

    // Act & Assert
    expect(canAfford(economy, 0, 10)).toBe(false)
  })

  it('test_canAfford_insufficientBothResources_returnsFalse', () => {
    // Arrange
    const economy = createEconomy(5, 5)

    // Act & Assert
    expect(canAfford(economy, 30, 10)).toBe(false)
  })

  it('test_canAfford_zeroCost_alwaysTrue', () => {
    // A zero-cost operation (e.g. free recruit event) should always be affordable
    const economy = createEconomy(0, 0)

    expect(canAfford(economy, 0, 0)).toBe(true)
  })

})

// ===========================================================================
// earn — resource income
// ===========================================================================

describe('earn', () => {

  it('test_earn_goldOnly_correctlyAddsGold', () => {
    // Arrange
    const economy = createEconomy(20, 0)

    // Act
    const after = earn(economy, 10, 0)

    // Assert
    expect(after.gold).toBe(30)
    expect(after.material).toBe(0)
  })

  it('test_earn_materialOnly_correctlyAddsMaterial', () => {
    // Arrange
    const economy = createEconomy(0, 5)

    // Act
    const after = earn(economy, 0, 5)

    // Assert
    expect(after.gold).toBe(0)
    expect(after.material).toBe(10)
  })

  it('test_earn_bothResources_correctlyAddsBoth', () => {
    // Arrange
    const economy = createEconomy(20, 0)

    // Act
    const after = earn(economy, 10, 5)

    // Assert
    expect(after.gold).toBe(30)
    expect(after.material).toBe(5)
  })

  it('test_earn_isImmutable_originalUnchanged', () => {
    // Arrange
    const economy = createEconomy(20, 0)

    // Act — earn should not mutate the original
    earn(economy, 100, 100)

    // Assert
    expect(economy.gold).toBe(20)
    expect(economy.material).toBe(0)
  })

  it('test_earn_returnsNewObject', () => {
    // Arrange
    const economy = createEconomy(20, 0)

    // Act
    const after = earn(economy, 1, 0)

    // Assert — must be a different object reference
    expect(after).not.toBe(economy)
  })

  it('test_earn_zeroAmount_balanceUnchanged', () => {
    // Arrange
    const economy = createEconomy(20, 5)

    // Act
    const after = earn(economy, 0, 0)

    // Assert
    expect(after.gold).toBe(20)
    expect(after.material).toBe(5)
  })

  it('test_earn_multipleSequentialCalls_accumulatesCorrectly', () => {
    // Arrange — simulate 3 battle rewards
    let economy = createEconomy(0, 0)

    // Act
    economy = earn(economy, 10, 5)
    economy = earn(economy, 12, 5)
    economy = earn(economy, 15, 8)

    // Assert — 0+10+12+15=37 gold, 0+5+5+8=18 material
    expect(economy.gold).toBe(37)
    expect(economy.material).toBe(18)
  })

})

// ===========================================================================
// spend — resource deduction
// ===========================================================================

describe('spend', () => {

  it('test_spend_goldOnly_correctlyDeductsGold', () => {
    // Arrange
    const economy = createEconomy(50, 0)

    // Act — recruit a C-tier hero: 30 gold
    const after = spend(economy, 30, 0)

    // Assert
    expect(after.gold).toBe(20)
    expect(after.material).toBe(0)
  })

  it('test_spend_materialOnly_correctlyDeductsMaterial', () => {
    // Arrange
    const economy = createEconomy(0, 20)

    // Act — level up a hero: 10 material
    const after = spend(economy, 0, 10)

    // Assert
    expect(after.gold).toBe(0)
    expect(after.material).toBe(10)
  })

  it('test_spend_bothResources_correctlyDeductsBoth', () => {
    // Arrange
    const economy = createEconomy(50, 20)

    // Act — forge upgrade: 5 gold + 15 material
    const after = spend(economy, 5, 15)

    // Assert
    expect(after.gold).toBe(45)
    expect(after.material).toBe(5)
  })

  it('test_spend_exactBalance_leavesZero', () => {
    // Arrange
    const economy = createEconomy(30, 10)

    // Act
    const after = spend(economy, 30, 10)

    // Assert — resources reach zero, not negative
    expect(after.gold).toBe(0)
    expect(after.material).toBe(0)
  })

  it('test_spend_isImmutable_originalUnchanged', () => {
    // Arrange
    const economy = createEconomy(50, 20)

    // Act
    spend(economy, 10, 5)

    // Assert — original economy must be untouched
    expect(economy.gold).toBe(50)
    expect(economy.material).toBe(20)
  })

  it('test_spend_returnsNewObject', () => {
    // Arrange
    const economy = createEconomy(50, 20)

    // Act
    const after = spend(economy, 1, 0)

    // Assert
    expect(after).not.toBe(economy)
  })

  it('test_spend_insufficientGold_throwsRangeError', () => {
    // Arrange
    const economy = createEconomy(10, 100)

    // Act & Assert — attempting to spend more gold than available must throw
    expect(() => spend(economy, 30, 0)).toThrow(RangeError)
  })

  it('test_spend_insufficientMaterial_throwsRangeError', () => {
    // Arrange
    const economy = createEconomy(100, 3)

    // Act & Assert
    expect(() => spend(economy, 0, 10)).toThrow(RangeError)
  })

  it('test_spend_insufficientBothResources_throwsRangeError', () => {
    // Arrange
    const economy = createEconomy(5, 2)

    // Act & Assert
    expect(() => spend(economy, 30, 10)).toThrow(RangeError)
  })

  it('test_spend_throwErrorMessage_includesShortfallInfo', () => {
    // Arrange
    const economy = createEconomy(10, 0)

    // Act & Assert — error message should mention the specific shortfall
    expect(() => spend(economy, 30, 0)).toThrow(/short 20/)
  })

  it('test_spend_resourcesNeverGoNegative_afterThrow', () => {
    // Arrange
    const economy = createEconomy(10, 0)

    // Act — attempt a failing spend, then verify original is untouched
    try {
      spend(economy, 30, 0)
    } catch {
      // expected
    }

    // Assert — original economy is still intact (not mutated)
    expect(economy.gold).toBeGreaterThanOrEqual(0)
    expect(economy.material).toBeGreaterThanOrEqual(0)
  })

  it('test_spend_zeroCost_leavesBalanceUnchanged', () => {
    // Arrange — free event (e.g., 三顾茅庐 gives Zhuge Liang for free)
    const economy = createEconomy(20, 5)

    // Act
    const after = spend(economy, 0, 0)

    // Assert
    expect(after.gold).toBe(20)
    expect(after.material).toBe(5)
  })

  it('test_spend_canAffordThenSpend_sequenceIsConsistent', () => {
    // Arrange
    const economy = createEconomy(30, 0)
    const goldCost = 30

    // Act — use the canAfford gate pattern before spending
    expect(canAfford(economy, goldCost, 0)).toBe(true)
    const after = spend(economy, goldCost, 0)

    // Assert
    expect(after.gold).toBe(0)
  })

})

// ===========================================================================
// reset — run lifecycle
// ===========================================================================

describe('reset', () => {

  it('test_reset_goldReturnsToStartingGold', () => {
    // Arrange — economy after spending lots of resources
    const economy = earn(createEconomy(), 300, 150)

    // Act — simulate Run end + restart
    const fresh = reset()

    // Assert
    expect(fresh.gold).toBe(STARTING_GOLD)
  })

  it('test_reset_materialReturnsToStartingMaterial', () => {
    // Arrange
    const economy = earn(createEconomy(), 0, 200)

    // Act
    const fresh = reset()

    // Assert
    expect(fresh.material).toBe(STARTING_MATERIAL)
  })

  it('test_reset_returnsNewObject', () => {
    // Arrange
    const economy = createEconomy()

    // Act
    const fresh = reset()

    // Assert — reset must create a new instance, not reuse the old one
    expect(fresh).not.toBe(economy)
  })

  it('test_reset_doesNotMutateExistingEconomy', () => {
    // Arrange — a run-in-progress economy
    const economy = earn(createEconomy(), 100, 50)
    const goldBefore = economy.gold

    // Act
    reset()

    // Assert — the existing run economy is unaffected
    expect(economy.gold).toBe(goldBefore)
  })

})

// ===========================================================================
// calcSellGold — Equipment Sell formula
// ===========================================================================

describe('calcSellGold', () => {

  it('test_calcSellGold_standardItem_returnsHalfBasePrice', () => {
    // Arrange — equip base price = 60, sell ratio = 0.5
    // Act & Assert
    // formula: floor(60 * 0.5) = 30
    expect(calcSellGold(60, SELL_RATIO)).toBe(30)
  })

  it('test_calcSellGold_oddBasePrice_floorsResult', () => {
    // Arrange — equip base price = 15, sell ratio = 0.5
    // formula: floor(15 * 0.5) = floor(7.5) = 7
    expect(calcSellGold(15, SELL_RATIO)).toBe(7)
  })

  it('test_calcSellGold_zeroPricedItem_returnsMinimumOf1', () => {
    // GDD edge case: "卖出价格为 0 的装备 → 给 1 金币保底"
    expect(calcSellGold(0, SELL_RATIO)).toBe(1)
  })

  it('test_calcSellGold_veryLowPricedItem_returnsMinimumOf1', () => {
    // price = 1, ratio = 0.5 → floor(0.5) = 0 → clamped to 1
    expect(calcSellGold(1, SELL_RATIO)).toBe(1)
  })

  it('test_calcSellGold_matchesGddFormula', () => {
    // Explicit formula check: sellGold = max(1, floor(equipBasePrice * SELL_RATIO))
    const price = 100
    const expected = Math.max(1, Math.floor(price * SELL_RATIO))
    expect(calcSellGold(price, SELL_RATIO)).toBe(expected)
  })

})

// ===========================================================================
// calcDisassembleMaterial — Equipment Disassemble formula
// ===========================================================================

describe('calcDisassembleMaterial', () => {

  it('test_calcDisassembleMaterial_level1_returnsDisassembleRatio', () => {
    // formula: 1 * DISASSEMBLE_RATIO = 3
    expect(calcDisassembleMaterial(1, DISASSEMBLE_RATIO)).toBe(3)
  })

  it('test_calcDisassembleMaterial_level3_returns9', () => {
    // formula: 3 * 3 = 9
    expect(calcDisassembleMaterial(3, DISASSEMBLE_RATIO)).toBe(9)
  })

  it('test_calcDisassembleMaterial_level5_returns15', () => {
    // formula: 5 * 3 = 15
    expect(calcDisassembleMaterial(5, DISASSEMBLE_RATIO)).toBe(15)
  })

  it('test_calcDisassembleMaterial_matchesGddFormula', () => {
    // Explicit formula check: disassembleMaterial = equipLevel * DISASSEMBLE_RATIO
    const level = 4
    const expected = level * DISASSEMBLE_RATIO
    expect(calcDisassembleMaterial(level, DISASSEMBLE_RATIO)).toBe(expected)
  })

  it('test_calcDisassembleMaterial_higherLevelYieldsMoreMaterial', () => {
    // Scaling: level 5 should yield more than level 1
    const low  = calcDisassembleMaterial(1, DISASSEMBLE_RATIO)
    const high = calcDisassembleMaterial(5, DISASSEMBLE_RATIO)
    expect(high).toBeGreaterThan(low)
  })

})

// ===========================================================================
// calcRecruitCost — Recruit Cost formula
// ===========================================================================

describe('calcRecruitCost', () => {

  it('test_calcRecruitCost_cTier_equalsBaseCost', () => {
    // C-tier multiplier = 1.0 → 30 * 1.0 = 30
    const multiplier = TIER_RECRUIT_MULTIPLIER[HeroTier.C]!
    expect(calcRecruitCost(RECRUIT_BASE_COST, multiplier)).toBe(30)
  })

  it('test_calcRecruitCost_bTier_equals45', () => {
    // B-tier multiplier = 1.5 → 30 * 1.5 = 45
    const multiplier = TIER_RECRUIT_MULTIPLIER[HeroTier.B]!
    expect(calcRecruitCost(RECRUIT_BASE_COST, multiplier)).toBe(45)
  })

  it('test_calcRecruitCost_aTier_equals75', () => {
    // A-tier multiplier = 2.5 → 30 * 2.5 = 75
    const multiplier = TIER_RECRUIT_MULTIPLIER[HeroTier.A]!
    expect(calcRecruitCost(RECRUIT_BASE_COST, multiplier)).toBe(75)
  })

  it('test_calcRecruitCost_higherTierCostsMore', () => {
    // Tier cost ordering: C < B < A
    const costC = calcRecruitCost(RECRUIT_BASE_COST, TIER_RECRUIT_MULTIPLIER[HeroTier.C]!)
    const costB = calcRecruitCost(RECRUIT_BASE_COST, TIER_RECRUIT_MULTIPLIER[HeroTier.B]!)
    const costA = calcRecruitCost(RECRUIT_BASE_COST, TIER_RECRUIT_MULTIPLIER[HeroTier.A]!)

    expect(costC).toBeLessThan(costB)
    expect(costB).toBeLessThan(costA)
  })

})

// ===========================================================================
// calcBattleReward — Battle Reward formula
// ===========================================================================

describe('calcBattleReward', () => {

  it('test_calcBattleReward_nodeZero_normalDifficulty_equalsBaseValues', () => {
    // Arrange — nodeIndex=0, difficultyBonus=1.0
    // formula: floor(BASE_GOLD * (1 + 0 * GOLD_SCALING) * 1.0) = floor(10 * 1.0) = 10
    const result = calcBattleReward(0, DIFFICULTY_BONUS_NORMAL, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)

    // Assert
    expect(result.gold).toBe(10)
    expect(result.material).toBe(5)
  })

  it('test_calcBattleReward_laterNode_yieldsMoreThanEarlyNode', () => {
    // Gold should scale up with nodeIndex
    const early = calcBattleReward(0, DIFFICULTY_BONUS_NORMAL, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)
    const late  = calcBattleReward(10, DIFFICULTY_BONUS_NORMAL, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)

    expect(late.gold).toBeGreaterThan(early.gold)
    expect(late.material).toBeGreaterThan(early.material)
  })

  it('test_calcBattleReward_eliteDifficulty_higherThanNormal', () => {
    // Arrange
    const normal = calcBattleReward(5, DIFFICULTY_BONUS_NORMAL, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)
    const elite  = calcBattleReward(5, DIFFICULTY_BONUS_ELITE,  BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)

    // Assert
    expect(elite.gold).toBeGreaterThan(normal.gold)
    expect(elite.material).toBeGreaterThan(normal.material)
  })

  it('test_calcBattleReward_bossDifficulty_higherThanElite', () => {
    const elite = calcBattleReward(5, DIFFICULTY_BONUS_ELITE, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)
    const boss  = calcBattleReward(5, DIFFICULTY_BONUS_BOSS,  BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)

    expect(boss.gold).toBeGreaterThan(elite.gold)
    expect(boss.material).toBeGreaterThan(elite.material)
  })

  it('test_calcBattleReward_resultsAreIntegers', () => {
    // All rewards must be whole numbers (floored)
    const result = calcBattleReward(3, DIFFICULTY_BONUS_ELITE, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)

    expect(Number.isInteger(result.gold)).toBe(true)
    expect(Number.isInteger(result.material)).toBe(true)
  })

  it('test_calcBattleReward_18NodeRun_totalGoldInExpectedRange', () => {
    // GDD acceptance criterion: 18-node run total gold "approximately 300-400" (normal difficulty).
    // The GDD explicitly flags this as "初始估算" (initial estimate) requiring playtest calibration.
    // With the current defaults (BASE_GOLD=10, GOLD_SCALING=0.15) the floor-sum of all 18 nodes
    // (indices 0-17) works out to exactly 405 — within the "approximately 300-400" intent.
    // We test a slightly wider window (300-500) to allow tuning within the GDD's safe range
    // without breaking CI on every balance pass.
    let totalGold = 0
    for (let i = 0; i < 18; i++) {
      totalGold += calcBattleReward(i, DIFFICULTY_BONUS_NORMAL, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING).gold
    }

    // Assert — GDD expected economy curve: ~300-400; tested with calibration headroom
    expect(totalGold).toBeGreaterThanOrEqual(300)
    expect(totalGold).toBeLessThanOrEqual(500)
    // Verify current config produces the expected precise value (405 at defaults)
    expect(totalGold).toBe(405)
  })

  it('test_calcBattleReward_matchesGddFormula_node5_normalDifficulty', () => {
    // Explicit formula check for a concrete node
    // formula: floor(10 * (1 + 5 * 0.15) * 1.0) = floor(10 * 1.75) = floor(17.5) = 17
    // material: floor(5 * (1 + 5 * 0.15) * 1.0) = floor(5 * 1.75) = floor(8.75) = 8
    const result = calcBattleReward(5, DIFFICULTY_BONUS_NORMAL, BASE_GOLD, BASE_MATERIAL, GOLD_SCALING, MATERIAL_SCALING)

    expect(result.gold).toBe(17)
    expect(result.material).toBe(8)
  })

})

// ===========================================================================
// Integration: earn + spend round trip
// ===========================================================================

describe('Economy — earn/spend integration', () => {

  it('test_integration_earnThenSpend_netChangeIsCorrect', () => {
    // Arrange — simulate a simple battle→shop cycle
    let economy = createEconomy() // { gold: 20, material: 0 }

    // Act — win a battle
    economy = earn(economy, 10, 5)  // { gold: 30, material: 5 }

    // Act — recruit a C-tier hero
    economy = spend(economy, 30, 0) // { gold: 0, material: 5 }

    // Assert
    expect(economy.gold).toBe(0)
    expect(economy.material).toBe(5)
  })

  it('test_integration_multipleEarnAndSpend_resourcesRemainNonNegative', () => {
    // Simulate 5 battle cycles with spending, verify never goes negative
    let economy = createEconomy()

    for (let i = 0; i < 5; i++) {
      economy = earn(economy, 10 + i * 2, 5 + i)
      if (canAfford(economy, 15, 0)) {
        economy = spend(economy, 15, 0)
      }
      if (canAfford(economy, 0, 5)) {
        economy = spend(economy, 0, 5)
      }
    }

    // Assert — resources must never be negative after all operations
    expect(economy.gold).toBeGreaterThanOrEqual(0)
    expect(economy.material).toBeGreaterThanOrEqual(0)
  })

  it('test_integration_resetAfterRun_freshEconomyIgnoresPriorState', () => {
    // Arrange — rich economy after a full run
    let economy = createEconomy()
    economy = earn(economy, 300, 150)

    // Act — new run starts
    const fresh = reset()

    // Assert — run-start values, not accumulated values
    expect(fresh.gold).toBe(STARTING_GOLD)
    expect(fresh.material).toBe(STARTING_MATERIAL)
  })

  it('test_integration_sellAndDisassemble_earnCorrectResourceTypes', () => {
    // Simulate selling an equipment (gold in) and disassembling another (material in)
    let economy = createEconomy(0, 0)

    const sellGold           = calcSellGold(60, SELL_RATIO)           // 30
    const disassembleMat     = calcDisassembleMaterial(3, DISASSEMBLE_RATIO) // 9

    economy = earn(economy, sellGold, 0)        // { gold: 30, material: 0 }
    economy = earn(economy, 0, disassembleMat)  // { gold: 30, material: 9 }

    expect(economy.gold).toBe(30)
    expect(economy.material).toBe(9)
  })

})
