/**
 * Equipment System — Unit Tests
 *
 * Verifies the Equipment data model, manager functions, config constants, and
 * test data against the GDD specification.
 *
 * @module tests/unit/equipment/equipment.test
 * @see design/gdd/equipment-system.md
 */

import { describe, it, expect } from 'vitest'

import { EquipSlot, EquipCategory } from '../../../src/gameplay/equipment/types'
import type { EquipmentData } from '../../../src/gameplay/equipment/types'
import { StatType } from '../../../src/gameplay/hero/types'

import {
  EQUIP_SLOTS,
  MAX_STRENGTHEN_LEVEL,
  STRENGTHEN_BONUS_RATE,
  NAMED_OWNER_BONUS_MULT,
  STRENGTHEN_GOLD_PER_LEVEL,
  STRENGTHEN_MATERIAL_PER_LEVEL,
  STAT_RANGE_BY_LEVEL,
} from '../../../src/gameplay/equipment/equipmentConfig'

import {
  equip,
  unequip,
  calculateEquipBonus,
  strengthen,
  getSellGold,
  getDisassembleMaterial,
  getStrengthenGoldCost,
  getStrengthenMaterialCost,
} from '../../../src/gameplay/equipment/equipmentManager'

import {
  IRON_SWORD,
  STEEL_SPEAR,
  REFINED_STEEL_SPEAR,
  IRON_ARMOR,
  GOOD_HORSE,
  GREEN_DRAGON_HALBERD,
  TEST_EQUIPMENT,
} from '../../../src/gameplay/equipment/testEquipment'

import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'
import { GUAN_YU, ZHANG_FEI } from '../../../src/gameplay/hero/testHeroes'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Fresh hero with no equipment, reused across multiple test suites. */
function makeGuanYu() {
  return createHeroInstance(GUAN_YU, 1)
}

function makeZhangFei() {
  return createHeroInstance(ZHANG_FEI, 1)
}

// ===========================================================================
// Config constants — sanity checks
// ===========================================================================

describe('Equipment Config constants', () => {

  it('test_config_equipSlots_equals3', () => {
    expect(EQUIP_SLOTS).toBe(3)
  })

  it('test_config_maxStrengthenLevel_equals3', () => {
    expect(MAX_STRENGTHEN_LEVEL).toBe(3)
  })

  it('test_config_strengthenBonusRate_equals0Point2', () => {
    expect(STRENGTHEN_BONUS_RATE).toBe(0.2)
  })

  it('test_config_namedOwnerBonusMult_equals2Point0', () => {
    expect(NAMED_OWNER_BONUS_MULT).toBe(2.0)
  })

  it('test_config_strengthenGoldPerLevel_equals10', () => {
    expect(STRENGTHEN_GOLD_PER_LEVEL).toBe(10)
  })

  it('test_config_strengthenMaterialPerLevel_equals5', () => {
    expect(STRENGTHEN_MATERIAL_PER_LEVEL).toBe(5)
  })

  it('test_config_statRangeByLevel_lv1_min3_max5', () => {
    expect(STAT_RANGE_BY_LEVEL[1]).toEqual({ min: 3, max: 5 })
  })

  it('test_config_statRangeByLevel_lv2_min6_max10', () => {
    expect(STAT_RANGE_BY_LEVEL[2]).toEqual({ min: 6, max: 10 })
  })

  it('test_config_statRangeByLevel_lv3_min11_max16', () => {
    expect(STAT_RANGE_BY_LEVEL[3]).toEqual({ min: 11, max: 16 })
  })

})

// ===========================================================================
// EquipSlot enum
// ===========================================================================

describe('EquipSlot enum', () => {

  it('test_equipSlot_hasThreeValues', () => {
    expect(EquipSlot.Weapon).toBe('Weapon')
    expect(EquipSlot.Armor).toBe('Armor')
    expect(EquipSlot.Mount).toBe('Mount')
  })

})

// ===========================================================================
// EquipCategory enum
// ===========================================================================

describe('EquipCategory enum', () => {

  it('test_equipCategory_hasThreeValues', () => {
    expect(EquipCategory.Basic).toBe('Basic')
    expect(EquipCategory.Advanced).toBe('Advanced')
    expect(EquipCategory.Named).toBe('Named')
  })

})

// ===========================================================================
// equip — equip item to hero
// ===========================================================================

describe('equip', () => {

  it('test_equip_emptySlot_addsItemIdToHero', () => {
    // Arrange
    const hero = makeGuanYu()

    // Act
    const { hero: after } = equip(hero, IRON_SWORD, [], [IRON_SWORD])

    // Assert
    expect(after.equippedItemIds).toContain(IRON_SWORD.id)
  })

  it('test_equip_emptySlot_replacedIsNull', () => {
    // Arrange
    const hero = makeGuanYu()

    // Act
    const { replaced } = equip(hero, IRON_SWORD, [], [IRON_SWORD])

    // Assert
    expect(replaced).toBeNull()
  })

  it('test_equip_emptySlot_equipBonusUpdated', () => {
    // Arrange
    const hero = makeGuanYu()

    // Act
    const { hero: after } = equip(hero, IRON_SWORD, [], [IRON_SWORD])

    // Assert — equipBonus.STR should reflect the iron sword's +4
    expect(after.equipBonus[StatType.STR]).toBe(4)
  })

  it('test_equip_occupiedSlot_returnsReplacedItem', () => {
    // Arrange — hero already wearing iron sword
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Act — equip a better weapon (steel spear)
    const { replaced } = equip(hero1, STEEL_SPEAR, [IRON_SWORD], [IRON_SWORD, STEEL_SPEAR])

    // Assert
    expect(replaced).toBe(IRON_SWORD)
  })

  it('test_equip_occupiedSlot_newItemIsInEquippedIds', () => {
    // Arrange
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Act
    const { hero: after } = equip(hero1, STEEL_SPEAR, [IRON_SWORD], [IRON_SWORD, STEEL_SPEAR])

    // Assert — new item in, old item out
    expect(after.equippedItemIds).toContain(STEEL_SPEAR.id)
    expect(after.equippedItemIds).not.toContain(IRON_SWORD.id)
  })

  it('test_equip_occupiedSlot_equipBonusReflectsNewItem', () => {
    // Arrange
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Act
    const { hero: after } = equip(hero1, STEEL_SPEAR, [IRON_SWORD], [IRON_SWORD, STEEL_SPEAR])

    // Assert — steel spear gives STR+8, not iron sword's STR+4
    expect(after.equipBonus[StatType.STR]).toBe(8)
  })

  it('test_equip_isImmutable_originalHeroUnchanged', () => {
    // Arrange
    const hero = makeGuanYu()
    const originalIds = [...hero.equippedItemIds]

    // Act
    equip(hero, IRON_SWORD, [], [IRON_SWORD])

    // Assert — original is untouched
    expect(hero.equippedItemIds).toEqual(originalIds)
  })

  it('test_equip_multipleSlots_allItemsTracked', () => {
    // Arrange — equip weapon + armor + mount one by one
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])
    const { hero: hero2 } = equip(hero1, IRON_ARMOR, [IRON_SWORD], [IRON_SWORD, IRON_ARMOR])
    const { hero: hero3 } = equip(
      hero2,
      GOOD_HORSE,
      [IRON_SWORD, IRON_ARMOR],
      [IRON_SWORD, IRON_ARMOR, GOOD_HORSE],
    )

    // Assert — all three items are tracked
    expect(hero3.equippedItemIds).toContain(IRON_SWORD.id)
    expect(hero3.equippedItemIds).toContain(IRON_ARMOR.id)
    expect(hero3.equippedItemIds).toContain(GOOD_HORSE.id)
  })

  it('test_equip_namedItem_equipBonusReflectsNamedStats', () => {
    // Named items can be equipped like any other item
    const hero = makeGuanYu()
    const { hero: after } = equip(hero, GREEN_DRAGON_HALBERD, [], [GREEN_DRAGON_HALBERD])

    expect(after.equipBonus[StatType.STR]).toBe(20)
  })

})

// ===========================================================================
// unequip — remove item from slot
// ===========================================================================

describe('unequip', () => {

  it('test_unequip_occupiedSlot_removesItemIdFromHero', () => {
    // Arrange — equip iron sword first
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Act
    const { hero: after } = unequip(hero1, EquipSlot.Weapon, [IRON_SWORD])

    // Assert
    expect(after.equippedItemIds).not.toContain(IRON_SWORD.id)
  })

  it('test_unequip_occupiedSlot_returnsRemovedItem', () => {
    // Arrange
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Act
    const { removed } = unequip(hero1, EquipSlot.Weapon, [IRON_SWORD])

    // Assert
    expect(removed).toBe(IRON_SWORD)
  })

  it('test_unequip_occupiedSlot_equipBonusDropsToZero', () => {
    // Arrange
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Act
    const { hero: after } = unequip(hero1, EquipSlot.Weapon, [IRON_SWORD])

    // Assert — weapon bonus should be gone
    expect(after.equipBonus[StatType.STR]).toBe(0)
  })

  it('test_unequip_emptySlot_returnsNull', () => {
    // Arrange — hero has no weapon
    const hero = makeGuanYu()

    // Act
    const { removed } = unequip(hero, EquipSlot.Weapon, [])

    // Assert
    expect(removed).toBeNull()
  })

  it('test_unequip_emptySlot_heroUnchanged', () => {
    // Arrange
    const hero = makeGuanYu()

    // Act
    const { hero: after } = unequip(hero, EquipSlot.Weapon, [])

    // Assert — same reference since nothing changed
    expect(after).toBe(hero)
  })

  it('test_unequip_isImmutable_originalHeroUnchanged', () => {
    // Arrange
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])
    const originalIds = [...hero1.equippedItemIds]

    // Act
    unequip(hero1, EquipSlot.Weapon, [IRON_SWORD])

    // Assert — original hero1 is untouched
    expect(hero1.equippedItemIds).toEqual(originalIds)
  })

  it('test_unequip_oneOfThreeItems_otherTwoRetainBonuses', () => {
    // Arrange — equip weapon + armor
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])
    const { hero: hero2 } = equip(hero1, IRON_ARMOR, [IRON_SWORD], [IRON_SWORD, IRON_ARMOR])

    // Act — remove weapon only
    const { hero: after } = unequip(hero2, EquipSlot.Weapon, [IRON_SWORD, IRON_ARMOR])

    // Assert — armor bonuses remain; weapon bonus gone
    expect(after.equipBonus[StatType.STR]).toBe(0)
    expect(after.equipBonus[StatType.DEF]).toBe(4)
    expect(after.equipBonus[StatType.HP]).toBe(2)
  })

})

// ===========================================================================
// calculateEquipBonus — stat summing
// ===========================================================================

describe('calculateEquipBonus', () => {

  it('test_calculateEquipBonus_noItems_allZero', () => {
    // Arrange & Act
    const bonus = calculateEquipBonus([])

    // Assert
    for (const stat of Object.values(StatType)) {
      expect(bonus[stat]).toBe(0)
    }
  })

  it('test_calculateEquipBonus_singleWeapon_strBonusCorrect', () => {
    // Arrange & Act — iron sword: STR+4, strengthen=0 → multiplier 1.0
    const bonus = calculateEquipBonus([IRON_SWORD])

    // Assert
    expect(bonus[StatType.STR]).toBe(4)
    expect(bonus[StatType.INT]).toBe(0)
    expect(bonus[StatType.DEF]).toBe(0)
    expect(bonus[StatType.HP]).toBe(0)
    expect(bonus[StatType.SPD]).toBe(0)
  })

  it('test_calculateEquipBonus_armorWithTwoStats_bothSummed', () => {
    // Iron armor: DEF+4 HP+2
    const bonus = calculateEquipBonus([IRON_ARMOR])

    expect(bonus[StatType.DEF]).toBe(4)
    expect(bonus[StatType.HP]).toBe(2)
  })

  it('test_calculateEquipBonus_multipleItems_allStatsSummedCorrectly', () => {
    // Arrange: iron sword (STR+4) + iron armor (DEF+4, HP+2) + good horse (SPD+7)
    const items = [IRON_SWORD, IRON_ARMOR, GOOD_HORSE]
    const bonus = calculateEquipBonus(items)

    expect(bonus[StatType.STR]).toBe(4)
    expect(bonus[StatType.INT]).toBe(0)
    expect(bonus[StatType.DEF]).toBe(4)
    expect(bonus[StatType.HP]).toBe(2)
    expect(bonus[StatType.SPD]).toBe(7)
  })

  it('test_calculateEquipBonus_strengthenLevel1_increases20Percent', () => {
    // Arrange: iron sword STR+4, strengthened to +1 → 4 * 1.2 = 4.8 → floor = 4
    const strengthened: EquipmentData = { ...IRON_SWORD, strengthenLevel: 1 }
    const bonus = calculateEquipBonus([strengthened])

    // formula: floor(4 * (1 + 1 * 0.2)) = floor(4 * 1.2) = floor(4.8) = 4
    expect(bonus[StatType.STR]).toBe(4)
  })

  it('test_calculateEquipBonus_steelSpearStrengthenLevel1_str9', () => {
    // Steel spear STR+8, +1 strengthen → floor(8 * 1.2) = floor(9.6) = 9
    const strengthened: EquipmentData = { ...STEEL_SPEAR, strengthenLevel: 1 }
    const bonus = calculateEquipBonus([strengthened])

    expect(bonus[StatType.STR]).toBe(9)
  })

  it('test_calculateEquipBonus_refinedSpearStrengthenLevel2_str14', () => {
    // Refined steel spear STR+12, +2 strengthen → floor(12 * 1.4) = floor(16.8) = 16
    const strengthened: EquipmentData = { ...REFINED_STEEL_SPEAR, strengthenLevel: 2 }
    const bonus = calculateEquipBonus([strengthened])

    expect(bonus[StatType.STR]).toBe(16)
  })

  it('test_calculateEquipBonus_maxStrengthen_level3_multiplier1Point6', () => {
    // Iron armor DEF+4 HP+2, +3 strengthen → multiplier 1.6
    // DEF: floor(4 * 1.6) = floor(6.4) = 6
    // HP:  floor(2 * 1.6) = floor(3.2) = 3
    const maxStrengthened: EquipmentData = { ...IRON_ARMOR, strengthenLevel: 3 }
    const bonus = calculateEquipBonus([maxStrengthened])

    expect(bonus[StatType.DEF]).toBe(6)
    expect(bonus[StatType.HP]).toBe(3)
  })

  it('test_calculateEquipBonus_isImmutable_doesNotMutateInput', () => {
    // Arrange
    const items = [IRON_SWORD, IRON_ARMOR]

    // Act — call twice, verify consistent results
    const bonus1 = calculateEquipBonus(items)
    const bonus2 = calculateEquipBonus(items)

    // Assert — pure function, same input → same output
    expect(bonus1).toEqual(bonus2)
  })

})

// ===========================================================================
// strengthen — increment strengthen level
// ===========================================================================

describe('strengthen', () => {

  it('test_strengthen_basicItem_level0_incrementsToLevel1', () => {
    // Arrange
    const item = IRON_SWORD // strengthenLevel: 0

    // Act
    const result = strengthen(item)

    // Assert
    expect(result.strengthenLevel).toBe(1)
  })

  it('test_strengthen_basicItem_level2_incrementsToLevel3', () => {
    // Arrange
    const item: EquipmentData = { ...IRON_SWORD, strengthenLevel: 2 }

    // Act
    const result = strengthen(item)

    // Assert
    expect(result.strengthenLevel).toBe(3)
  })

  it('test_strengthen_isImmutable_originalUnchanged', () => {
    // Arrange
    const item = IRON_SWORD // strengthenLevel: 0

    // Act
    strengthen(item)

    // Assert — original is unmodified
    expect(item.strengthenLevel).toBe(0)
  })

  it('test_strengthen_returnsNewObject', () => {
    // Arrange
    const item = IRON_SWORD

    // Act
    const result = strengthen(item)

    // Assert
    expect(result).not.toBe(item)
  })

  it('test_strengthen_atMaxLevel_returnsSameObject', () => {
    // Arrange — already at MAX_STRENGTHEN_LEVEL = 3
    const item: EquipmentData = { ...IRON_SWORD, strengthenLevel: MAX_STRENGTHEN_LEVEL }

    // Act
    const result = strengthen(item)

    // Assert — capped: returns original reference unchanged
    expect(result).toBe(item)
    expect(result.strengthenLevel).toBe(MAX_STRENGTHEN_LEVEL)
  })

  it('test_strengthen_atMaxLevel_canNotExceedMaxLevel', () => {
    // Apply strengthen multiple times past the cap
    let item: EquipmentData = { ...STEEL_SPEAR, strengthenLevel: 0 }
    item = strengthen(item)
    item = strengthen(item)
    item = strengthen(item)
    // One more call at cap
    item = strengthen(item)

    expect(item.strengthenLevel).toBe(MAX_STRENGTHEN_LEVEL)
  })

  it('test_strengthen_namedEquipment_returnsSameObject', () => {
    // Arrange — Named items can never be strengthened
    const item = GREEN_DRAGON_HALBERD // category: Named, strengthenLevel: 0

    // Act
    const result = strengthen(item)

    // Assert — returns original unchanged
    expect(result).toBe(item)
    expect(result.strengthenLevel).toBe(0)
  })

  it('test_strengthen_advancedItem_levelIncrements', () => {
    // Arrange
    const item = REFINED_STEEL_SPEAR // Advanced, strengthenLevel: 0

    // Act
    const result = strengthen(item)

    // Assert
    expect(result.strengthenLevel).toBe(1)
  })

  it('test_strengthen_preservesAllOtherFields', () => {
    // Strengthen should not modify any field except strengthenLevel
    const item = IRON_SWORD
    const result = strengthen(item)

    expect(result.id).toBe(item.id)
    expect(result.name).toBe(item.name)
    expect(result.slot).toBe(item.slot)
    expect(result.category).toBe(item.category)
    expect(result.baseStats).toEqual(item.baseStats)
    expect(result.effect).toEqual(item.effect)
    expect(result.basePrice).toBe(item.basePrice)
  })

})

// ===========================================================================
// getSellGold — sell formula
// ===========================================================================

describe('getSellGold', () => {

  it('test_getSellGold_basicLv1Item_returnsHalfBasePrice', () => {
    // Basic Lv.1: basePrice=15, sellRatio=0.5 → floor(15*0.5)=floor(7.5)=7
    expect(getSellGold(IRON_SWORD)).toBe(7)
  })

  it('test_getSellGold_basicLv2Item_returns15', () => {
    // Basic Lv.2: basePrice=30 → floor(30*0.5) = 15
    expect(getSellGold(STEEL_SPEAR)).toBe(15)
  })

  it('test_getSellGold_advancedLv3Item_returns25', () => {
    // Advanced Lv.3: basePrice=50 → floor(50*0.5) = 25
    expect(getSellGold(REFINED_STEEL_SPEAR)).toBe(25)
  })

  it('test_getSellGold_namedItem_returnsZero', () => {
    // Named items are unsellable — always returns 0
    expect(getSellGold(GREEN_DRAGON_HALBERD)).toBe(0)
  })

  it('test_getSellGold_namedItemWithZeroBasePrice_returnsZero', () => {
    // Named items return 0 regardless of sell-ratio minimum-1 rule
    const item: EquipmentData = { ...GREEN_DRAGON_HALBERD, basePrice: 0 }
    expect(getSellGold(item)).toBe(0)
  })

  it('test_getSellGold_higherTierSellsForMore', () => {
    // Lv.2 should sell for more than Lv.1
    expect(getSellGold(STEEL_SPEAR)).toBeGreaterThan(getSellGold(IRON_SWORD))
  })

  it('test_getSellGold_matchesGddFormula', () => {
    // Explicit formula: max(1, floor(basePrice * SELL_RATIO))
    // Using economy SELL_RATIO = 0.5
    const SELL_RATIO = 0.5
    const expected = Math.max(1, Math.floor(IRON_ARMOR.basePrice * SELL_RATIO))
    expect(getSellGold(IRON_ARMOR)).toBe(expected)
  })

})

// ===========================================================================
// getDisassembleMaterial — disassemble formula
// ===========================================================================

describe('getDisassembleMaterial', () => {

  it('test_getDisassembleMaterial_basicLv1Item_returns3', () => {
    // level=1, DISASSEMBLE_RATIO=3 → 1*3 = 3
    expect(getDisassembleMaterial(IRON_SWORD)).toBe(3)
  })

  it('test_getDisassembleMaterial_basicLv2Item_returns6', () => {
    // level=2 → 2*3 = 6
    expect(getDisassembleMaterial(STEEL_SPEAR)).toBe(6)
  })

  it('test_getDisassembleMaterial_advancedLv3Item_returns9', () => {
    // level=3 → 3*3 = 9
    expect(getDisassembleMaterial(REFINED_STEEL_SPEAR)).toBe(9)
  })

  it('test_getDisassembleMaterial_namedItem_returnsZero', () => {
    // Named items cannot be disassembled
    expect(getDisassembleMaterial(GREEN_DRAGON_HALBERD)).toBe(0)
  })

  it('test_getDisassembleMaterial_higherLevelYieldsMoreMaterial', () => {
    expect(getDisassembleMaterial(STEEL_SPEAR)).toBeGreaterThan(getDisassembleMaterial(IRON_SWORD))
    expect(getDisassembleMaterial(REFINED_STEEL_SPEAR)).toBeGreaterThan(getDisassembleMaterial(STEEL_SPEAR))
  })

  it('test_getDisassembleMaterial_matchesGddFormula', () => {
    // Formula: equipLevel * DISASSEMBLE_RATIO (3)
    const DISASSEMBLE_RATIO = 3
    expect(getDisassembleMaterial(REFINED_STEEL_SPEAR)).toBe(REFINED_STEEL_SPEAR.level * DISASSEMBLE_RATIO)
  })

})

// ===========================================================================
// Strengthen cost helpers
// ===========================================================================

describe('getStrengthenGoldCost', () => {

  it('test_getStrengthenGoldCost_level1_returns10', () => {
    expect(getStrengthenGoldCost(1)).toBe(10)
  })

  it('test_getStrengthenGoldCost_level2_returns20', () => {
    expect(getStrengthenGoldCost(2)).toBe(20)
  })

  it('test_getStrengthenGoldCost_level3_returns30', () => {
    expect(getStrengthenGoldCost(3)).toBe(30)
  })

})

describe('getStrengthenMaterialCost', () => {

  it('test_getStrengthenMaterialCost_level1_returns5', () => {
    expect(getStrengthenMaterialCost(1)).toBe(5)
  })

  it('test_getStrengthenMaterialCost_level2_returns10', () => {
    expect(getStrengthenMaterialCost(2)).toBe(10)
  })

  it('test_getStrengthenMaterialCost_level3_returns15', () => {
    expect(getStrengthenMaterialCost(3)).toBe(15)
  })

})

// ===========================================================================
// Test equipment data validity
// ===========================================================================

describe('Test equipment data — data validity', () => {

  it('test_testEquipment_allSixItemsDefined', () => {
    expect(TEST_EQUIPMENT).toHaveLength(6)
  })

  it('test_testEquipment_allItemsHaveUniqueIds', () => {
    const ids = TEST_EQUIPMENT.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(TEST_EQUIPMENT.length)
  })

  it('test_testEquipment_allItemsHaveValidSlot', () => {
    const validSlots = Object.values(EquipSlot)
    for (const item of TEST_EQUIPMENT) {
      expect(validSlots).toContain(item.slot)
    }
  })

  it('test_testEquipment_allItemsHaveValidCategory', () => {
    const validCategories = Object.values(EquipCategory)
    for (const item of TEST_EQUIPMENT) {
      expect(validCategories).toContain(item.category)
    }
  })

  it('test_testEquipment_basicItemsHaveNoEffect', () => {
    const basicItems = TEST_EQUIPMENT.filter((e) => e.category === EquipCategory.Basic)
    for (const item of basicItems) {
      expect(item.effect).toBeNull()
    }
  })

  it('test_testEquipment_advancedItemsHaveEffect', () => {
    const advancedItems = TEST_EQUIPMENT.filter((e) => e.category === EquipCategory.Advanced)
    for (const item of advancedItems) {
      expect(item.effect).not.toBeNull()
    }
  })

  it('test_testEquipment_namedItemsAreUnique', () => {
    const namedItems = TEST_EQUIPMENT.filter((e) => e.category === EquipCategory.Named)
    for (const item of namedItems) {
      expect(item.unique).toBe(true)
    }
  })

  it('test_testEquipment_namedItemsHaveZeroBasePrice', () => {
    const namedItems = TEST_EQUIPMENT.filter((e) => e.category === EquipCategory.Named)
    for (const item of namedItems) {
      expect(item.basePrice).toBe(0)
    }
  })

  it('test_testEquipment_namedItemsHaveZeroStrengthenLevel', () => {
    const namedItems = TEST_EQUIPMENT.filter((e) => e.category === EquipCategory.Named)
    for (const item of namedItems) {
      expect(item.strengthenLevel).toBe(0)
    }
  })

  it('test_testEquipment_basicAndAdvancedItemsAreNotUnique', () => {
    const commonItems = TEST_EQUIPMENT.filter(
      (e) => e.category === EquipCategory.Basic || e.category === EquipCategory.Advanced,
    )
    for (const item of commonItems) {
      expect(item.unique).toBe(false)
    }
  })

  it('test_testEquipment_allStrengthenLevelsAreZeroInitially', () => {
    for (const item of TEST_EQUIPMENT) {
      expect(item.strengthenLevel).toBe(0)
    }
  })

  it('test_testEquipment_ironSword_basicWeaponLv1_str4', () => {
    expect(IRON_SWORD.slot).toBe(EquipSlot.Weapon)
    expect(IRON_SWORD.category).toBe(EquipCategory.Basic)
    expect(IRON_SWORD.level).toBe(1)
    expect(IRON_SWORD.baseStats[StatType.STR]).toBe(4)
  })

  it('test_testEquipment_steelSpear_basicWeaponLv2_str8', () => {
    expect(STEEL_SPEAR.slot).toBe(EquipSlot.Weapon)
    expect(STEEL_SPEAR.category).toBe(EquipCategory.Basic)
    expect(STEEL_SPEAR.level).toBe(2)
    expect(STEEL_SPEAR.baseStats[StatType.STR]).toBe(8)
  })

  it('test_testEquipment_refinedSteelSpear_advancedWeaponLv3_str12', () => {
    expect(REFINED_STEEL_SPEAR.slot).toBe(EquipSlot.Weapon)
    expect(REFINED_STEEL_SPEAR.category).toBe(EquipCategory.Advanced)
    expect(REFINED_STEEL_SPEAR.level).toBe(3)
    expect(REFINED_STEEL_SPEAR.baseStats[StatType.STR]).toBe(12)
  })

  it('test_testEquipment_ironArmor_basicArmorLv1_def4Hp2', () => {
    expect(IRON_ARMOR.slot).toBe(EquipSlot.Armor)
    expect(IRON_ARMOR.category).toBe(EquipCategory.Basic)
    expect(IRON_ARMOR.level).toBe(1)
    expect(IRON_ARMOR.baseStats[StatType.DEF]).toBe(4)
    expect(IRON_ARMOR.baseStats[StatType.HP]).toBe(2)
  })

  it('test_testEquipment_goodHorse_basicMountLv2_spd7', () => {
    expect(GOOD_HORSE.slot).toBe(EquipSlot.Mount)
    expect(GOOD_HORSE.category).toBe(EquipCategory.Basic)
    expect(GOOD_HORSE.level).toBe(2)
    expect(GOOD_HORSE.baseStats[StatType.SPD]).toBe(7)
  })

  it('test_testEquipment_greenDragonHalberd_namedWeaponLv4_str20', () => {
    expect(GREEN_DRAGON_HALBERD.slot).toBe(EquipSlot.Weapon)
    expect(GREEN_DRAGON_HALBERD.category).toBe(EquipCategory.Named)
    expect(GREEN_DRAGON_HALBERD.level).toBe(4)
    expect(GREEN_DRAGON_HALBERD.baseStats[StatType.STR]).toBe(20)
    expect(GREEN_DRAGON_HALBERD.ownerHeroId).toBe('guan_yu')
    expect(GREEN_DRAGON_HALBERD.ownerBonus).not.toBeNull()
  })

  it('test_testEquipment_mainStatValuesWithinGddRanges', () => {
    // Verify each item's primary stat is within the expected GDD range for its level
    for (const item of TEST_EQUIPMENT) {
      const range = STAT_RANGE_BY_LEVEL[item.level]
      if (!range) continue // Named items at level 4 have a wider range

      // Find the highest single stat value (primary stat)
      const statValues = Object.values(item.baseStats as Record<string, number>)
      const maxStat = Math.max(...statValues)

      expect(maxStat).toBeGreaterThanOrEqual(range.min)
      expect(maxStat).toBeLessThanOrEqual(range.max)
    }
  })

})

// ===========================================================================
// Integration: equip flow on hero — full round-trip
// ===========================================================================

describe('Equipment — equip/unequip integration', () => {

  it('test_integration_fullEquip_threeSlots_equipBonusSumsAllItems', () => {
    // Arrange — equip all three slots on Guan Yu
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])
    const { hero: hero2 } = equip(
      hero1,
      IRON_ARMOR,
      [IRON_SWORD],
      [IRON_SWORD, IRON_ARMOR],
    )
    const { hero: hero3 } = equip(
      hero2,
      GOOD_HORSE,
      [IRON_SWORD, IRON_ARMOR],
      [IRON_SWORD, IRON_ARMOR, GOOD_HORSE],
    )

    // Assert — combined bonus: STR+4, DEF+4, HP+2, SPD+7
    expect(hero3.equipBonus[StatType.STR]).toBe(4)
    expect(hero3.equipBonus[StatType.INT]).toBe(0)
    expect(hero3.equipBonus[StatType.DEF]).toBe(4)
    expect(hero3.equipBonus[StatType.HP]).toBe(2)
    expect(hero3.equipBonus[StatType.SPD]).toBe(7)
  })

  it('test_integration_equipUpgrade_replacingWeapon_equipBonusUpdatedCorrectly', () => {
    // Simulate upgrading a weapon mid-run: iron sword → steel spear
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])

    // Confirm initial STR bonus
    expect(hero1.equipBonus[StatType.STR]).toBe(4)

    // Upgrade weapon
    const { hero: hero2, replaced } = equip(
      hero1,
      STEEL_SPEAR,
      [IRON_SWORD],
      [IRON_SWORD, STEEL_SPEAR],
    )

    // Assert
    expect(replaced).toBe(IRON_SWORD)
    expect(hero2.equipBonus[StatType.STR]).toBe(8)
  })

  it('test_integration_namedItemEquip_sellReturnsZero', () => {
    // Named items: equip works, but selling yields 0
    const hero0 = makeGuanYu()
    const { hero: after } = equip(hero0, GREEN_DRAGON_HALBERD, [], [GREEN_DRAGON_HALBERD])

    expect(after.equippedItemIds).toContain(GREEN_DRAGON_HALBERD.id)
    expect(getSellGold(GREEN_DRAGON_HALBERD)).toBe(0)
  })

  it('test_integration_strengthenThenEquip_bonusReflectsStrengthenedStats', () => {
    // Strengthen iron sword to +3, then equip and verify bonus
    // STR+4 at +3 = floor(4 * 1.6) = floor(6.4) = 6
    const strengthened = strengthen(strengthen(strengthen(IRON_SWORD)))
    expect(strengthened.strengthenLevel).toBe(3)

    const hero = makeGuanYu()
    const { hero: after } = equip(hero, strengthened, [], [strengthened])

    expect(after.equipBonus[StatType.STR]).toBe(6)
  })

  it('test_integration_equipToDifferentHeroes_independentInstances', () => {
    // Common equipment can appear on multiple heroes simultaneously
    // (each is an independent EquipmentData instance — same id is OK for Basic)
    const guanYu  = makeGuanYu()
    const zhangFei = makeZhangFei()

    const { hero: gy } = equip(guanYu,   IRON_SWORD, [], [IRON_SWORD])
    const { hero: zf } = equip(zhangFei, IRON_SWORD, [], [IRON_SWORD])

    // Both heroes have the iron sword bonus
    expect(gy.equipBonus[StatType.STR]).toBe(4)
    expect(zf.equipBonus[StatType.STR]).toBe(4)
  })

  it('test_integration_unequipAfterThreeSlots_onlyTargetSlotCleared', () => {
    // Full loadout, then unequip armor only
    const hero0 = makeGuanYu()
    const { hero: hero1 } = equip(hero0, IRON_SWORD, [], [IRON_SWORD])
    const { hero: hero2 } = equip(hero1, IRON_ARMOR, [IRON_SWORD], [IRON_SWORD, IRON_ARMOR])
    const { hero: hero3 } = equip(
      hero2,
      GOOD_HORSE,
      [IRON_SWORD, IRON_ARMOR],
      [IRON_SWORD, IRON_ARMOR, GOOD_HORSE],
    )

    // Remove armor
    const { hero: after } = unequip(
      hero3,
      EquipSlot.Armor,
      [IRON_SWORD, IRON_ARMOR, GOOD_HORSE],
    )

    expect(after.equipBonus[StatType.STR]).toBe(4)   // weapon still active
    expect(after.equipBonus[StatType.DEF]).toBe(0)   // armor removed
    expect(after.equipBonus[StatType.HP]).toBe(0)    // armor removed
    expect(after.equipBonus[StatType.SPD]).toBe(7)   // mount still active
  })

})
