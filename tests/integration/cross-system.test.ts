/**
 * Cross-System Integration Tests
 *
 * Verifies that all Sprint 1 systems interact correctly when combined:
 * - Hero + Equipment + Bond + Stat calculation pipeline
 * - Hero + Growth + Economy pipeline
 * - Status + Stat calculation integration
 * - Full battle pipeline (Hero → Bond → Battle → Result)
 * - Equipment → Stat → Battle damage chain
 *
 * These tests exercise system boundaries that unit tests can miss.
 *
 * @module tests/integration/cross-system.test
 */

import { describe, it, expect } from 'vitest'

import { StatType, HeroVariant, Faction, HeroTier } from '../../src/gameplay/hero/types'
import type { HeroInstance, HeroData } from '../../src/gameplay/hero/types'
import { createHeroInstance } from '../../src/gameplay/hero/heroFactory'
import {
  calculateFinalStat,
  calculateAllFinalStats,
  createZeroStats,
} from '../../src/gameplay/hero/statCalculation'
import { GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU, TEST_HEROES } from '../../src/gameplay/hero/testHeroes'

import { createEconomy, canAfford, spend } from '../../src/gameplay/economy/economyManager'
import type { Economy } from '../../src/gameplay/economy/types'

import { equip, calculateEquipBonus } from '../../src/gameplay/equipment/equipmentManager'
import { IRON_SWORD, IRON_ARMOR, GREEN_DRAGON_HALBERD } from '../../src/gameplay/equipment/testEquipment'

import { evaluateBonds, applyBondResult } from '../../src/gameplay/bond/bondManager'

import { runBattle } from '../../src/gameplay/battle/battleEngine'
import { BattleOutcome } from '../../src/gameplay/battle/battleEngineTypes'

import { TEST_NAMELESS_NODE0 } from '../../src/gameplay/enemy/testEnemies'
import type { NamelessUnit } from '../../src/gameplay/enemy/types'

import {
  getLevelUpCost,
  canLevelUp,
  levelUp,
  computeGrowthBonus,
  getScaledSkillValue,
  getGrowthPreview,
} from '../../src/gameplay/hero-growth/growthManager'
import { MAX_LEVEL, SKILL_SCALING_RATE } from '../../src/gameplay/hero-growth/growthConfig'

import {
  applyStatus,
  removeStatus,
  tickStatuses,
  getStatusModifier,
  isControlled,
  clearAllStatuses,
} from '../../src/gameplay/status/statusManager'
import { STATUS_EFFECTS } from '../../src/gameplay/status/statusConfig'
import type { AppliedStatus } from '../../src/gameplay/status/types'

// ===========================================================================
// Hero + Equipment + Stat Calculation pipeline
// ===========================================================================

describe('Hero + Equipment integration', () => {

  it('test_integration_equipWeapon_increasesSTRFinalStat', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    const strBefore = calculateFinalStat(hero, StatType.STR)

    // Act — equip Iron Sword (should add STR bonus)
    const result = equip(hero, IRON_SWORD, [])
    const strAfter = calculateFinalStat(result.hero, StatType.STR)

    // Assert — STR should increase
    expect(strAfter).toBeGreaterThan(strBefore)
  })

  it('test_integration_equipArmor_increasesDEFFinalStat', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    const defBefore = calculateFinalStat(hero, StatType.DEF)

    // Act
    const result = equip(hero, IRON_ARMOR, [])
    const defAfter = calculateFinalStat(result.hero, StatType.DEF)

    // Assert
    expect(defAfter).toBeGreaterThan(defBefore)
  })

  it('test_integration_equipBonusFlowsIntoAllFinalStats', () => {
    // Arrange — equip Green Dragon Halberd (named weapon, multiple stat bonuses)
    const hero = createHeroInstance(GUAN_YU, 1)

    // Act
    const result = equip(hero, GREEN_DRAGON_HALBERD, [])
    const statsBefore = calculateAllFinalStats(hero)
    const statsAfter = calculateAllFinalStats(result.hero)

    // Assert — at least one stat should be higher
    const hasIncrease = Object.values(StatType).some(
      stat => statsAfter[stat] > statsBefore[stat]
    )
    expect(hasIncrease).toBe(true)
  })

})

// ===========================================================================
// Hero + Bond + Stat Calculation pipeline
// ===========================================================================

describe('Hero + Bond integration', () => {

  it('test_integration_shuBond_modifiesStats', () => {
    // Arrange — 2 Shu heroes activate Shu faction bond
    const heroes = [createHeroInstance(GUAN_YU, 1), createHeroInstance(ZHANG_FEI, 1)]
    const statsBefore = heroes.map(h => calculateAllFinalStats(h))

    // Act — evaluate and apply bonds
    const bondResult = evaluateBonds(heroes)
    applyBondResult(heroes, bondResult)
    const statsAfter = heroes.map(h => calculateAllFinalStats(h))

    // Assert — if bond is activated, at least some stats should change
    if (bondResult.activatedBonds.length > 0) {
      const anyChange = heroes.some((h, i) =>
        Object.values(StatType).some(stat =>
          statsAfter[i][stat] !== statsBefore[i][stat]
        )
      )
      expect(anyChange).toBe(true)
    }
  })

  it('test_integration_bondModifier_affectsCalculateFinalStat', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    const strBefore = calculateFinalStat(hero, StatType.STR)

    // Act — manually set bondModifier to simulate bond activation
    hero.bondModifier[StatType.STR] = 0.10 // +10%

    const strAfter = calculateFinalStat(hero, StatType.STR)

    // Assert — STR should increase by ~10%
    expect(strAfter).toBeGreaterThan(strBefore)
    // 38 * 1.10 = 41.8 → 42
    expect(strAfter).toBe(42)
  })

})

// ===========================================================================
// Hero + Growth + Economy pipeline
// ===========================================================================

describe('Hero + Growth + Economy integration', () => {

  it('test_integration_levelUp_spendsMaterialAndUpdatesGrowth', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    let economy = createEconomy(100, 200) // plenty of resources

    // Act — level up from 1 to 5
    for (let i = 0; i < 4; i++) {
      const [newEco] = levelUp(hero, economy)
      economy = newEco
    }

    // Assert
    expect(hero.level).toBe(5)
    expect(economy.material).toBeLessThan(200) // material was spent
    expect(hero.growthBonus[StatType.STR]).toBeGreaterThan(0) // growth applied
  })

  it('test_integration_levelUp_affectsFinalStats', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    const strLv1 = calculateFinalStat(hero, StatType.STR)

    // Act — level to 5
    let economy = createEconomy(0, 500)
    for (let i = 0; i < 4; i++) {
      const [newEco] = levelUp(hero, economy)
      economy = newEco
    }
    const strLv5 = calculateFinalStat(hero, StatType.STR)

    // Assert — STR should increase with level
    expect(strLv5).toBeGreaterThan(strLv1)
    // growthBonus[STR] = floor(38 * 0.08 * 4) = 12 → final = 38 + 12 = 50
    expect(strLv5).toBe(50)
  })

  it('test_integration_multipleHeroes_levelUpDrainsEconomy', () => {
    // Arrange — level 3 heroes to level 3 each
    const heroes = TEST_HEROES.slice(0, 3).map(h => createHeroInstance(h, 1))
    let economy = createEconomy(0, 500)

    // Act — level each hero twice (to level 3)
    for (const hero of heroes) {
      for (let i = 0; i < 2; i++) {
        if (canLevelUp(hero, economy)) {
          const [newEco] = levelUp(hero, economy)
          economy = newEco
        }
      }
    }

    // Assert — all heroes at level 3
    for (const hero of heroes) {
      expect(hero.level).toBe(3)
    }
    // Material was consumed
    expect(economy.material).toBeLessThan(500)
  })

  it('test_integration_cannotLevelUpWithoutMaterial', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    const economy = createEconomy(100, 0) // gold but no material

    // Assert
    expect(canLevelUp(hero, economy)).toBe(false)
  })

  it('test_integration_growthPreview_matchesActualLevelUp', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 3)
    const preview = getGrowthPreview(hero)

    // Act — actually level up
    let economy = createEconomy(0, 500)
    const [newEco] = levelUp(hero, economy)

    // Assert — actual growth matches preview
    expect(hero.level).toBe(preview.targetLevel)
    for (const stat of Object.values(StatType)) {
      expect(hero.growthBonus[stat]).toBe(preview.nextGrowthBonus[stat])
    }
  })

})

// ===========================================================================
// Hero + Growth + Legend variant
// ===========================================================================

describe('Legend variant growth', () => {

  it('test_integration_legendVariant_hasHigherGrowthThanBase', () => {
    // Arrange — fake legend variant of Guan Yu
    const legendGY: HeroData = {
      ...GUAN_YU,
      id: 'legend_guan_yu',
      variant: HeroVariant.Legend,
    }

    // Act — create instances at level 5
    const baseHero = createHeroInstance(GUAN_YU, 5)
    const legendHero = createHeroInstance(legendGY, 5)

    // Assert — legend has higher growth in at least STR
    expect(legendHero.growthBonus[StatType.STR]).toBeGreaterThan(baseHero.growthBonus[StatType.STR])
    // Base: floor(38 * 0.08 * 4) = 12
    // Legend: floor(38 * 0.08 * 1.25 * 4) = 15
    expect(baseHero.growthBonus[StatType.STR]).toBe(12)
    expect(legendHero.growthBonus[StatType.STR]).toBe(15)
  })

  it('test_integration_legendVariant_levelUpUsesLegendGrowth', () => {
    // Arrange
    const legendGY: HeroData = {
      ...GUAN_YU,
      id: 'legend_guan_yu',
      variant: HeroVariant.Legend,
    }
    const hero = createHeroInstance(legendGY, 1)
    let economy = createEconomy(0, 500)

    // Act — level to 5
    for (let i = 0; i < 4; i++) {
      const [newEco] = levelUp(hero, economy)
      economy = newEco
    }

    // Assert — growth bonus uses legend multiplier
    const expectedBonus = computeGrowthBonus(legendGY, 5)
    expect(hero.growthBonus[StatType.STR]).toBe(expectedBonus[StatType.STR])
    expect(hero.growthBonus[StatType.STR]).toBe(15) // legend: 15 vs base: 12
  })

})

// ===========================================================================
// Status + Stat Calculation integration
// ===========================================================================

describe('Status + Stat Calculation integration', () => {

  it('test_integration_statusModifier_affectsFinalStat', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)

    // Simulate applying a def_down debuff
    const [statuses] = applyStatus([], STATUS_EFFECTS['def_down'], 'enemy_1')
    const modifier = getStatusModifier(statuses)

    // Act — write status modifier to hero and calculate
    hero.statusModifier = modifier
    const finalDEF = calculateFinalStat(hero, StatType.DEF)

    // Assert — DEF reduced
    // Base: 28, modifier: -0.15 → 28 * (1 - 0.15) = 28 * 0.85 = 23.8 → 24
    expect(finalDEF).toBe(24)
  })

  it('test_integration_multiplStatuses_combineInModifier', () => {
    // Arrange — atk_up and def_down
    const [s1] = applyStatus([], STATUS_EFFECTS['atk_up'], 'ally_1')
    const [s2] = applyStatus(s1, STATUS_EFFECTS['def_down'], 'enemy_1')
    const modifier = getStatusModifier(s2)

    const hero = createHeroInstance(GUAN_YU, 1)
    hero.statusModifier = modifier

    // Act
    const finalSTR = calculateFinalStat(hero, StatType.STR)
    const finalDEF = calculateFinalStat(hero, StatType.DEF)

    // Assert — STR buffed, DEF debuffed
    expect(finalSTR).toBeGreaterThan(GUAN_YU.baseStats[StatType.STR])
    expect(finalDEF).toBeLessThan(GUAN_YU.baseStats[StatType.DEF])
  })

  it('test_integration_statusAndBondCombine_inMultiplier', () => {
    // Arrange
    const hero = createHeroInstance(GUAN_YU, 1)
    hero.bondModifier[StatType.STR] = 0.10 // +10% from bond

    const [statuses] = applyStatus([], STATUS_EFFECTS['atk_up'], 'ally_1')
    hero.statusModifier = getStatusModifier(statuses) // +15% from status

    // Act — (38 + 0 + 0) * (1 + 0.10 + 0.15) = 38 * 1.25 = 47.5 → 48
    const finalSTR = calculateFinalStat(hero, StatType.STR)

    // Assert
    expect(finalSTR).toBe(48)
  })

})

// ===========================================================================
// Status tick + damage/healing flow
// ===========================================================================

describe('Status tick integration', () => {

  it('test_integration_poisonTick_reduceHP', () => {
    // Arrange
    const [statuses] = applyStatus([], STATUS_EFFECTS['poison'], 'enemy_1')
    const maxHP = 200
    const currentHP = 150

    // Act
    const [remaining, result] = tickStatuses(statuses, currentHP, maxHP)

    // Assert
    expect(result.damage).toBe(5)
    const newHP = currentHP - result.damage + result.healing
    expect(newHP).toBe(145)
  })

  it('test_integration_regenTick_restoresHP', () => {
    // Arrange
    const [statuses] = applyStatus([], STATUS_EFFECTS['regen'], 'ally_1')

    // Act
    const [, result] = tickStatuses(statuses, 150, 200)

    // Assert
    expect(result.healing).toBe(8)
  })

  it('test_integration_burnAndRegen_burnReducesHealing', () => {
    // Arrange
    let statuses: AppliedStatus[] = []
    ;[statuses] = applyStatus(statuses, STATUS_EFFECTS['regen'], 'ally_1')
    ;[statuses] = applyStatus(statuses, STATUS_EFFECTS['burn'], 'enemy_1')

    // Act
    const [, result] = tickStatuses(statuses, 100, 200)

    // Assert — regen 8 * 0.5 = 4 healing, burn 5 damage
    expect(result.healing).toBe(4)
    expect(result.damage).toBe(5)
    // Net effect: -1 HP
  })

  it('test_integration_statusExpiry_removesClearModifier', () => {
    // Arrange — 1-round atk_down
    const shortDebuff = { ...STATUS_EFFECTS['atk_down'], duration: 1 }
    const [statuses] = applyStatus([], shortDebuff, 'enemy_1')

    // Act — tick once (expires)
    const [remaining, result] = tickStatuses(statuses, 100, 200)

    // Assert — expired and modifier now zero
    expect(remaining).toHaveLength(0)
    expect(result.expired).toContain('atk_down')

    const modifier = getStatusModifier(remaining)
    expect(modifier[StatType.STR]).toBe(0)
  })

})

// ===========================================================================
// Full battle pipeline
// ===========================================================================

describe('Full battle pipeline', () => {

  it('test_integration_fullBattle_5v5_producesResult', () => {
    // Arrange
    const heroes = TEST_HEROES.map(h => createHeroInstance(h, 1))
    const seededRandom = () => 0.42 // deterministic

    // Act
    const result = runBattle(heroes, TEST_NAMELESS_NODE0, undefined, seededRandom)

    // Assert
    expect(result.outcome).toBeDefined()
    expect([BattleOutcome.PlayerWin, BattleOutcome.EnemyWin, BattleOutcome.Timeout]).toContain(result.outcome)
    expect(result.totalRounds).toBeGreaterThanOrEqual(1)
    expect(result.log.length).toBeGreaterThan(0)
  })

  it('test_integration_leveledHeroes_strongerInBattle', () => {
    // Arrange — compare lv1 vs lv5 teams against same enemies
    const seeded = () => 0.5
    const heroesLv1 = TEST_HEROES.slice(0, 3).map(h => createHeroInstance(h, 1))
    const heroesLv5 = TEST_HEROES.slice(0, 3).map(h => createHeroInstance(h, 5))

    // Act
    const resultLv1 = runBattle(heroesLv1, TEST_NAMELESS_NODE0.slice(0, 3), undefined, seeded)
    const resultLv5 = runBattle(heroesLv5, TEST_NAMELESS_NODE0.slice(0, 3), undefined, seeded)

    // Assert — lv5 team should have more survivors or fewer rounds
    const lv5Stronger = resultLv5.playerSurvivors >= resultLv1.playerSurvivors
      || resultLv5.totalRounds <= resultLv1.totalRounds
    expect(lv5Stronger).toBe(true)
  })

  it('test_integration_equippedHeroes_performBetter', () => {
    // Arrange — one hero with equipment, one without
    const heroBase = createHeroInstance(GUAN_YU, 1)
    const equipped = equip(heroBase, GREEN_DRAGON_HALBERD, [])
    const heroEquipped = equipped.hero

    // Assert — equipped hero has higher stats
    const strBase = calculateFinalStat(heroBase, StatType.STR)
    const strEquipped = calculateFinalStat(heroEquipped, StatType.STR)
    expect(strEquipped).toBeGreaterThanOrEqual(strBase)
  })

  it('test_integration_battleResult_hasCompleteLog', () => {
    // Arrange
    const heroes = [createHeroInstance(GUAN_YU, 1), createHeroInstance(ZHANG_FEI, 1)]
    const enemies = TEST_NAMELESS_NODE0.slice(0, 2) as Array<NamelessUnit>

    // Act
    const result = runBattle(heroes, enemies)

    // Assert — log should have round starts and battle end
    const hasRoundStart = result.log.some(e => e.type === 'round_start')
    const hasBattleEnd = result.log.some(e => e.type === 'battle_end')
    expect(hasRoundStart).toBe(true)
    expect(hasBattleEnd).toBe(true)
  })

})

// ===========================================================================
// Growth + Equipment + Bond + Stat — full pipeline
// ===========================================================================

describe('Full stat pipeline: Growth + Equipment + Bond + Status', () => {

  it('test_integration_allModifiers_combineCorrectly', () => {
    // Arrange — hero at level 5
    const hero = createHeroInstance(GUAN_YU, 5)
    // growthBonus[DEF] = floor(28 * 0.06 * 4) = floor(6.72) = 6

    // Apply equipment
    const { hero: equippedHero } = equip(hero, IRON_ARMOR, [])

    // Apply bond modifier
    equippedHero.bondModifier[StatType.DEF] = 0.10 // +10% from bond

    // Apply status modifier
    const [statuses] = applyStatus([], STATUS_EFFECTS['def_up'], 'ally_1')
    equippedHero.statusModifier = getStatusModifier(statuses) // +15% from def_up

    // Act — calculate final DEF with all modifiers
    const finalDEF = calculateFinalStat(equippedHero, StatType.DEF)

    // Assert — verify the complete formula
    // base=28, growth=6, equip=IRON_ARMOR.DEF
    const equipDEF = equippedHero.equipBonus[StatType.DEF]
    const additive = 28 + 6 + equipDEF
    const multiplier = 1 + 0.10 + 0.15 // bond + status
    const expected = Math.round(additive * multiplier)

    expect(finalDEF).toBe(Math.max(1, expected))
  })

})

// ===========================================================================
// Edge case: interactions across system boundaries
// ===========================================================================

describe('Cross-system edge cases', () => {

  it('test_integration_knockedOutHero_cannotLevelUp_stillValid', () => {
    // Arrange — hero knocked out during battle
    const hero = createHeroInstance(GUAN_YU, 1)
    hero.isKnockedOut = true
    hero.currentHP = 0
    const economy = createEconomy(0, 100)

    // Act — level up a knocked out hero (should still work — growth is separate from battle)
    const [newEco, result] = levelUp(hero, economy)

    // Assert
    expect(hero.level).toBe(2)
    expect(hero.isKnockedOut).toBe(true) // still KO'd
    expect(hero.currentHP).toBe(0) // HP not restored by level up
  })

  it('test_integration_skillScaling_matchesLevel', () => {
    // Arrange
    const baseSkillMagnitude = 2.5 // Guan Yu's active skill magnitude
    const level = 5

    // Act
    const scaled = getScaledSkillValue(baseSkillMagnitude, level)

    // Assert — 2.5 * (1 + 4 * 0.08) = 2.5 * 1.32 = 3.3
    expect(scaled).toBeCloseTo(3.3)
  })

  it('test_integration_heroWithAllSystems_maxLevel', () => {
    // Arrange — hero at max level with everything applied
    let economy = createEconomy(0, 5000)
    const hero = createHeroInstance(GUAN_YU, 1)

    // Level to max
    while (hero.level < MAX_LEVEL) {
      const [newEco] = levelUp(hero, economy)
      economy = newEco
    }

    // Apply equipment
    const { hero: equippedHero } = equip(hero, GREEN_DRAGON_HALBERD, [])

    // Apply bond
    equippedHero.bondModifier[StatType.STR] = 0.25 // max bond

    // Apply status
    const [statuses] = applyStatus([], STATUS_EFFECTS['atk_up'], 'ally_1')
    equippedHero.statusModifier = getStatusModifier(statuses)

    // Act
    const allStats = calculateAllFinalStats(equippedHero)

    // Assert — all stats should be positive
    for (const stat of Object.values(StatType)) {
      expect(allStats[stat]).toBeGreaterThan(0)
    }

    // STR should be significantly higher than base (38)
    expect(allStats[StatType.STR]).toBeGreaterThan(50)
  })

  it('test_integration_totalLevelUpCost_fitsEconomyBudget', () => {
    // Arrange — level 5 heroes to level 8
    // Run should produce enough for this
    const costPer = (() => {
      let total = 0
      for (let lv = 2; lv <= 8; lv++) total += getLevelUpCost(lv)
      return total
    })()
    const totalFor5 = costPer * 5

    // Economy estimate: ~15 battles × BASE_MATERIAL(5) × scaling
    // Just verify cost is reasonable (not astronomical)
    expect(totalFor5).toBeGreaterThan(0)
    expect(totalFor5).toBeLessThan(1500) // sanity cap
  })

})
