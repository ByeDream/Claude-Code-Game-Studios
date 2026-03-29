/**
 * Loot/Rewards System — Unit Tests
 *
 * Tests for the chest-based loot system:
 * - Chest tier determination (nodeIndex + difficulty)
 * - Chest count (base + bonus threshold)
 * - Gold/Material reward calculation (tier + scaling + variance)
 * - Equipment selection (tier pool, Named uniqueness, fallbacks)
 * - generateChests (full pipeline)
 * - openChest / claimOption
 * - Edge cases (empty pools, all Named owned, boundary nodes)
 *
 * ≥ 40 tests target
 *
 * @see design/gdd/loot-rewards.md — Acceptance Criteria
 */

import { describe, it, expect } from 'vitest'

import type { EquipmentData } from '../../../src/gameplay/equipment/types'
import { EquipSlot, EquipCategory } from '../../../src/gameplay/equipment/types'

import type { Economy } from '../../../src/gameplay/economy/types'

import {
  ChestTier, Difficulty, LootOptionType,
} from '../../../src/gameplay/loot/types'
import {
  TIER_GOLD_BASE, TIER_MAT_BASE,
  GOLD_NODE_SCALING, MAT_NODE_SCALING,
  TIER_UPGRADE_INTERVAL, TIER_ORDER,
  BONUS_CHEST_THRESHOLD,
  NAMED_DROP_RATE_GOLD, NAMED_DROP_RATE_DIAMOND,
} from '../../../src/gameplay/loot/lootConfig'
import {
  determineChestTier,
  determineChestCount,
  calculateChestGold,
  calculateChestMaterial,
  selectEquipment,
  generateChests,
  openChest,
  claimOption,
  getChestPreview,
} from '../../../src/gameplay/loot/lootManager'

import type { RandomFn } from '../../../src/gameplay/battle/types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function fixedRandom(value: number): RandomFn {
  return () => value
}

/** Creates a sequential random that returns values from an array. */
function sequentialRandom(values: number[]): RandomFn {
  let index = 0
  return () => {
    const val = values[index % values.length]
    index++
    return val
  }
}

/** Creates a Basic Lv.1 equipment. */
function makeBasicLv1(id: string): EquipmentData {
  return {
    id, name: id, slot: EquipSlot.Weapon, category: EquipCategory.Basic,
    level: 1, unique: false, baseStats: { STR: 5 }, effect: null,
    ownerBonus: null, ownerHeroId: null, basePrice: 15, strengthenLevel: 0,
  }
}

/** Creates a Basic Lv.2 equipment. */
function makeBasicLv2(id: string): EquipmentData {
  return {
    id, name: id, slot: EquipSlot.Weapon, category: EquipCategory.Basic,
    level: 2, unique: false, baseStats: { STR: 10 }, effect: null,
    ownerBonus: null, ownerHeroId: null, basePrice: 30, strengthenLevel: 0,
  }
}

/** Creates an Advanced Lv.3 equipment. */
function makeAdvancedLv3(id: string): EquipmentData {
  return {
    id, name: id, slot: EquipSlot.Weapon, category: EquipCategory.Advanced,
    level: 3, unique: false, baseStats: { STR: 15 }, effect: { description: 'test', magnitude: 0.1, duration: 0 },
    ownerBonus: null, ownerHeroId: null, basePrice: 50, strengthenLevel: 0,
  }
}

/** Creates a Named equipment. */
function makeNamed(id: string): EquipmentData {
  return {
    id, name: id, slot: EquipSlot.Weapon, category: EquipCategory.Named,
    level: 4, unique: true, baseStats: { STR: 25 }, effect: { description: 'legendary', magnitude: 0.5, duration: 0 },
    ownerBonus: null, ownerHeroId: null, basePrice: 0, strengthenLevel: 0,
  }
}

/** Standard equipment pool for testing. */
function makeStandardPool(): EquipmentData[] {
  return [
    makeBasicLv1('basic1_lv1'),
    makeBasicLv1('basic2_lv1'),
    makeBasicLv2('basic1_lv2'),
    makeBasicLv2('basic2_lv2'),
    makeAdvancedLv3('adv1_lv3'),
    makeAdvancedLv3('adv2_lv3'),
    makeNamed('named_green_dragon'),
    makeNamed('named_red_hare'),
  ]
}

// ---------------------------------------------------------------------------
// determineChestTier
// ---------------------------------------------------------------------------

describe('determineChestTier', () => {
  it('normal difficulty starts at Iron tier', () => {
    expect(determineChestTier(0, Difficulty.Normal)).toBe(ChestTier.Iron)
  })

  it('elite difficulty starts at Bronze tier', () => {
    expect(determineChestTier(0, Difficulty.Elite)).toBe(ChestTier.Bronze)
  })

  it('boss difficulty starts at Silver tier', () => {
    expect(determineChestTier(0, Difficulty.Boss)).toBe(ChestTier.Silver)
  })

  it('tier upgrades every TIER_UPGRADE_INTERVAL nodes', () => {
    // Normal: node 0 = Iron (idx 0), node 6 = Bronze (idx 1), node 12 = Silver (idx 2)
    expect(determineChestTier(0, Difficulty.Normal)).toBe(ChestTier.Iron)
    expect(determineChestTier(6, Difficulty.Normal)).toBe(ChestTier.Bronze)
    expect(determineChestTier(12, Difficulty.Normal)).toBe(ChestTier.Silver)
  })

  it('tier does not exceed max for difficulty', () => {
    // Normal max = Silver (idx 2), even at node 18
    expect(determineChestTier(18, Difficulty.Normal)).toBe(ChestTier.Silver)
    // Elite max = Gold (idx 3)
    expect(determineChestTier(18, Difficulty.Elite)).toBe(ChestTier.Gold)
    // Boss max = Diamond (idx 4)
    expect(determineChestTier(18, Difficulty.Boss)).toBe(ChestTier.Diamond)
  })

  it('node 5 stays at base tier (not yet upgraded)', () => {
    expect(determineChestTier(5, Difficulty.Normal)).toBe(ChestTier.Iron)
  })

  it('progressive tiers for elite difficulty', () => {
    expect(determineChestTier(0, Difficulty.Elite)).toBe(ChestTier.Bronze)
    expect(determineChestTier(6, Difficulty.Elite)).toBe(ChestTier.Silver)
    expect(determineChestTier(12, Difficulty.Elite)).toBe(ChestTier.Gold)
  })

  it('progressive tiers for boss difficulty', () => {
    expect(determineChestTier(0, Difficulty.Boss)).toBe(ChestTier.Silver)
    expect(determineChestTier(6, Difficulty.Boss)).toBe(ChestTier.Gold)
    expect(determineChestTier(12, Difficulty.Boss)).toBe(ChestTier.Diamond)
  })
})

// ---------------------------------------------------------------------------
// determineChestCount
// ---------------------------------------------------------------------------

describe('determineChestCount', () => {
  it('normal battle gives 1 chest at early nodes', () => {
    expect(determineChestCount(0, Difficulty.Normal)).toBe(1)
    expect(determineChestCount(11, Difficulty.Normal)).toBe(1)
  })

  it('elite battle gives 1 chest at early nodes', () => {
    expect(determineChestCount(0, Difficulty.Elite)).toBe(1)
  })

  it('boss battle gives 2 chests at early nodes', () => {
    expect(determineChestCount(0, Difficulty.Boss)).toBe(2)
  })

  it('bonus chest at node >= BONUS_CHEST_THRESHOLD', () => {
    expect(determineChestCount(12, Difficulty.Normal)).toBe(2)
    expect(determineChestCount(12, Difficulty.Elite)).toBe(2)
    expect(determineChestCount(12, Difficulty.Boss)).toBe(3)
  })

  it('node just below threshold gives no bonus', () => {
    expect(determineChestCount(11, Difficulty.Normal)).toBe(1)
  })

  it('node well above threshold still gives +1 bonus', () => {
    expect(determineChestCount(17, Difficulty.Normal)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// calculateChestGold
// ---------------------------------------------------------------------------

describe('calculateChestGold', () => {
  it('returns base gold for Iron at node 0 with no variance', () => {
    // fixedRandom(0) → variance = LOOT_VARIANCE_MIN = 0.9
    const gold = calculateChestGold(ChestTier.Iron, 0, fixedRandom(0))
    expect(gold).toBe(Math.floor(12 * 0.9))
  })

  it('gold scales with node index', () => {
    const gold0 = calculateChestGold(ChestTier.Iron, 0, fixedRandom(0.5))
    const gold10 = calculateChestGold(ChestTier.Iron, 10, fixedRandom(0.5))
    expect(gold10).toBeGreaterThan(gold0)
  })

  it('higher tiers give more gold', () => {
    const ironGold = calculateChestGold(ChestTier.Iron, 0, fixedRandom(0.5))
    const goldGold = calculateChestGold(ChestTier.Gold, 0, fixedRandom(0.5))
    expect(goldGold).toBeGreaterThan(ironGold)
  })

  it('gold is always at least 1', () => {
    const gold = calculateChestGold(ChestTier.Iron, 0, fixedRandom(0))
    expect(gold).toBeGreaterThanOrEqual(1)
  })

  it('gold variance works correctly', () => {
    const lowVariance = calculateChestGold(ChestTier.Silver, 5, fixedRandom(0))   // min variance
    const highVariance = calculateChestGold(ChestTier.Silver, 5, fixedRandom(0.999)) // max variance
    expect(highVariance).toBeGreaterThanOrEqual(lowVariance)
  })
})

// ---------------------------------------------------------------------------
// calculateChestMaterial
// ---------------------------------------------------------------------------

describe('calculateChestMaterial', () => {
  it('returns base material for Iron at node 0', () => {
    const mat = calculateChestMaterial(ChestTier.Iron, 0, fixedRandom(0))
    expect(mat).toBe(Math.floor(6 * 0.9))
  })

  it('material scales with node index', () => {
    const mat0 = calculateChestMaterial(ChestTier.Iron, 0, fixedRandom(0.5))
    const mat10 = calculateChestMaterial(ChestTier.Iron, 10, fixedRandom(0.5))
    expect(mat10).toBeGreaterThan(mat0)
  })

  it('higher tiers give more material', () => {
    const ironMat = calculateChestMaterial(ChestTier.Iron, 0, fixedRandom(0.5))
    const diamondMat = calculateChestMaterial(ChestTier.Diamond, 0, fixedRandom(0.5))
    expect(diamondMat).toBeGreaterThan(ironMat)
  })

  it('material is always at least 1', () => {
    expect(calculateChestMaterial(ChestTier.Iron, 0, fixedRandom(0))).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// selectEquipment
// ---------------------------------------------------------------------------

describe('selectEquipment', () => {
  it('Iron tier selects from Basic Lv.1 only', () => {
    const pool = makeStandardPool()
    const equip = selectEquipment(ChestTier.Iron, pool, new Set(), fixedRandom(0.5))
    expect(equip).not.toBeNull()
    expect(equip!.category).toBe(EquipCategory.Basic)
    expect(equip!.level).toBe(1)
  })

  it('Bronze tier selects Basic Lv.1 or Lv.2', () => {
    const pool = makeStandardPool()
    // roll < 0.4 = Lv.1, roll >= 0.4 = Lv.2
    const equip1 = selectEquipment(ChestTier.Bronze, pool, new Set(), fixedRandom(0.3))
    expect(equip1!.level).toBe(1)

    const equip2 = selectEquipment(ChestTier.Bronze, pool, new Set(), fixedRandom(0.5))
    expect(equip2!.level).toBe(2)
  })

  it('Gold tier can select Named equipment', () => {
    const pool = makeStandardPool()
    // roll < NAMED_DROP_RATE_GOLD (0.3) → Named
    const equip = selectEquipment(ChestTier.Gold, pool, new Set(), fixedRandom(0.1))
    expect(equip).not.toBeNull()
    expect(equip!.category).toBe(EquipCategory.Named)
  })

  it('Gold tier selects Advanced when roll >= Named rate', () => {
    const pool = makeStandardPool()
    const equip = selectEquipment(ChestTier.Gold, pool, new Set(), fixedRandom(0.5))
    expect(equip!.category).toBe(EquipCategory.Advanced)
  })

  it('Diamond tier has higher Named rate', () => {
    const pool = makeStandardPool()
    // roll < NAMED_DROP_RATE_DIAMOND (0.65) → Named
    const equip = selectEquipment(ChestTier.Diamond, pool, new Set(), fixedRandom(0.5))
    expect(equip!.category).toBe(EquipCategory.Named)
  })

  it('excludes already-owned Named equipment', () => {
    const pool = makeStandardPool()
    const owned = new Set(['named_green_dragon', 'named_red_hare'])
    // Even with roll < Named rate, should fallback to Advanced
    const equip = selectEquipment(ChestTier.Gold, pool, owned, fixedRandom(0.1))
    expect(equip!.category).toBe(EquipCategory.Advanced)
  })

  it('returns null when pool is completely empty', () => {
    const equip = selectEquipment(ChestTier.Iron, [], new Set(), fixedRandom(0.5))
    expect(equip).toBeNull()
  })

  it('fallback to lower tier when preferred tier pool is empty', () => {
    // Only have BasicLv1, no BasicLv2 — Bronze with roll >= 0.4 should fallback
    const pool = [makeBasicLv1('only_lv1')]
    const equip = selectEquipment(ChestTier.Bronze, pool, new Set(), fixedRandom(0.5))
    expect(equip).not.toBeNull()
    expect(equip!.level).toBe(1) // fell back to Lv.1
  })
})

// ---------------------------------------------------------------------------
// generateChests
// ---------------------------------------------------------------------------

describe('generateChests', () => {
  it('generates correct number of chests for normal battle', () => {
    const chests = generateChests(0, Difficulty.Normal, [], new Set(), fixedRandom(0.5))
    expect(chests).toHaveLength(1)
  })

  it('generates correct number of chests for boss battle', () => {
    const chests = generateChests(0, Difficulty.Boss, [], new Set(), fixedRandom(0.5))
    expect(chests).toHaveLength(2)
  })

  it('each chest has exactly 3 options', () => {
    const pool = makeStandardPool()
    const chests = generateChests(0, Difficulty.Normal, pool, new Set(), fixedRandom(0.5))
    expect(chests[0].options).toHaveLength(3)
  })

  it('options are mutually exclusive types (equipment, gold, material)', () => {
    const pool = makeStandardPool()
    const chests = generateChests(0, Difficulty.Normal, pool, new Set(), fixedRandom(0.5))
    const types = chests[0].options.map(o => o.type)
    expect(types).toContain(LootOptionType.Equipment)
    expect(types).toContain(LootOptionType.Gold)
    expect(types).toContain(LootOptionType.Material)
  })

  it('chest has correct tier', () => {
    const chests = generateChests(0, Difficulty.Normal, [], new Set(), fixedRandom(0.5))
    expect(chests[0].tier).toBe(ChestTier.Iron)
  })

  it('chest has unique ID', () => {
    const chests = generateChests(0, Difficulty.Boss, [], new Set(), fixedRandom(0.5))
    expect(chests[0].id).not.toBe(chests[1].id)
  })

  it('Named equipment not duplicated across multi-chest in same batch', () => {
    // Only one Named in pool — second chest should not get it
    const pool = [makeAdvancedLv3('adv1'), makeNamed('unique_named')]
    // Use sequential random: first chest picks Named, second should fallback
    const rand = sequentialRandom([0.1, 0.1, 0.5, 0.5, 0.1, 0.1, 0.5, 0.5])
    const chests = generateChests(6, Difficulty.Boss, pool, new Set(), rand)

    // Check that unique_named appears at most once across all chests
    const namedCount = chests.flatMap(c => c.options)
      .filter(o => o.equipment?.id === 'unique_named')
      .length
    expect(namedCount).toBeLessThanOrEqual(1)
  })

  it('gold option has positive gold value', () => {
    const chests = generateChests(5, Difficulty.Normal, [], new Set(), fixedRandom(0.5))
    const goldOption = chests[0].options.find(o => o.type === LootOptionType.Gold)
    expect(goldOption!.gold).toBeGreaterThan(0)
  })

  it('material option has positive material value', () => {
    const chests = generateChests(5, Difficulty.Normal, [], new Set(), fixedRandom(0.5))
    const matOption = chests[0].options.find(o => o.type === LootOptionType.Material)
    expect(matOption!.material).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// openChest
// ---------------------------------------------------------------------------

describe('openChest', () => {
  it('returns the chest options unchanged', () => {
    const pool = makeStandardPool()
    const chests = generateChests(0, Difficulty.Normal, pool, new Set(), fixedRandom(0.5))
    const options = openChest(chests[0])
    expect(options).toEqual(chests[0].options)
    expect(options).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// claimOption
// ---------------------------------------------------------------------------

describe('claimOption', () => {
  const baseEconomy: Economy = { gold: 50, material: 20 }

  it('claiming gold option adds gold to economy', () => {
    const option = { type: LootOptionType.Gold as const, gold: 25 }
    const newEconomy = claimOption(option, baseEconomy)
    expect(newEconomy.gold).toBe(75)
    expect(newEconomy.material).toBe(20) // unchanged
  })

  it('claiming material option adds material to economy', () => {
    const option = { type: LootOptionType.Material as const, material: 15 }
    const newEconomy = claimOption(option, baseEconomy)
    expect(newEconomy.gold).toBe(50) // unchanged
    expect(newEconomy.material).toBe(35)
  })

  it('claiming equipment option does not change economy', () => {
    const option = { type: LootOptionType.Equipment as const, equipment: makeBasicLv1('test') }
    const newEconomy = claimOption(option, baseEconomy)
    expect(newEconomy.gold).toBe(50)
    expect(newEconomy.material).toBe(20)
  })

  it('claiming gold with 0 amount is safe', () => {
    const option = { type: LootOptionType.Gold as const, gold: 0 }
    const newEconomy = claimOption(option, baseEconomy)
    expect(newEconomy.gold).toBe(50)
  })

  it('claiming gold option with undefined gold defaults to 0', () => {
    const option = { type: LootOptionType.Gold as const }
    const newEconomy = claimOption(option, baseEconomy)
    expect(newEconomy.gold).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// getChestPreview
// ---------------------------------------------------------------------------

describe('getChestPreview', () => {
  it('returns correct tier and count for normal early node', () => {
    const preview = getChestPreview(0, Difficulty.Normal)
    expect(preview).toHaveLength(1)
    expect(preview[0].tier).toBe(ChestTier.Iron)
    expect(preview[0].count).toBe(1)
  })

  it('returns correct preview for boss late node', () => {
    const preview = getChestPreview(14, Difficulty.Boss)
    expect(preview[0].tier).toBe(ChestTier.Diamond)
    expect(preview[0].count).toBe(3) // 2 base + 1 bonus
  })
})

// ---------------------------------------------------------------------------
// GDD compliance: 18-node run example
// ---------------------------------------------------------------------------

describe('GDD 18-node run chest tier table', () => {
  it('normal battles follow Iron → Bronze → Silver progression', () => {
    expect(determineChestTier(0, Difficulty.Normal)).toBe(ChestTier.Iron)
    expect(determineChestTier(3, Difficulty.Normal)).toBe(ChestTier.Iron)
    expect(determineChestTier(6, Difficulty.Normal)).toBe(ChestTier.Bronze)
    expect(determineChestTier(9, Difficulty.Normal)).toBe(ChestTier.Bronze)
    expect(determineChestTier(12, Difficulty.Normal)).toBe(ChestTier.Silver)
    expect(determineChestTier(17, Difficulty.Normal)).toBe(ChestTier.Silver)
  })

  it('elite battles follow Bronze → Silver → Gold progression', () => {
    expect(determineChestTier(0, Difficulty.Elite)).toBe(ChestTier.Bronze)
    expect(determineChestTier(6, Difficulty.Elite)).toBe(ChestTier.Silver)
    expect(determineChestTier(12, Difficulty.Elite)).toBe(ChestTier.Gold)
  })

  it('boss battles follow Silver → Gold → Diamond progression', () => {
    expect(determineChestTier(0, Difficulty.Boss)).toBe(ChestTier.Silver)
    expect(determineChestTier(6, Difficulty.Boss)).toBe(ChestTier.Gold)
    expect(determineChestTier(12, Difficulty.Boss)).toBe(ChestTier.Diamond)
  })
})

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('loot system performance', () => {
  it('generates chests in < 5ms', () => {
    const pool = makeStandardPool()
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      generateChests(i % 18, Difficulty.Normal, pool, new Set(), Math.random)
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(500) // 100 iterations in < 500ms = < 5ms each
  })
})

// ---------------------------------------------------------------------------
// Edge cases from GDD
// ---------------------------------------------------------------------------

describe('loot edge cases', () => {
  it('nodeIndex overflow clamps to max tier', () => {
    // Node 100 should still respect max tier
    expect(determineChestTier(100, Difficulty.Normal)).toBe(ChestTier.Silver)
  })

  it('equipment option is undefined when pool is empty', () => {
    const chests = generateChests(0, Difficulty.Normal, [], new Set(), fixedRandom(0.5))
    const equipOption = chests[0].options.find(o => o.type === LootOptionType.Equipment)
    expect(equipOption!.equipment).toBeUndefined()
  })

  it('all values are integers (no decimals)', () => {
    const pool = makeStandardPool()
    for (let node = 0; node < 18; node++) {
      const chests = generateChests(node, Difficulty.Normal, pool, new Set(), Math.random)
      for (const chest of chests) {
        const goldOpt = chest.options.find(o => o.type === LootOptionType.Gold)
        const matOpt = chest.options.find(o => o.type === LootOptionType.Material)
        expect(Number.isInteger(goldOpt!.gold)).toBe(true)
        expect(Number.isInteger(matOpt!.material)).toBe(true)
      }
    }
  })
})
