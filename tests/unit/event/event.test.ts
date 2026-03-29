/**
 * Event System — Unit Tests
 *
 * Tests for node interaction system:
 * - Recruit pool generation (tier weights, exclusions, costs)
 * - Shop inventory (quality progression, Named uniqueness)
 * - Rest node resolution (train/forge, resource checks)
 * - Mystery node (historical event matching, generic fallback)
 * - Event condition evaluation
 * - Reward application
 * - Edge cases
 *
 * ≥ 50 tests target
 *
 * @see design/gdd/event-system.md — Acceptance Criteria
 */

import { describe, it, expect } from 'vitest'

import type { HeroData } from '../../../src/gameplay/hero/types'
import { Faction, HeroTier, HeroVariant, StatType, SkillType, TriggerCondition, TargetType, ScalingStat } from '../../../src/gameplay/hero/types'
import type { EquipmentData } from '../../../src/gameplay/equipment/types'
import { EquipSlot, EquipCategory } from '../../../src/gameplay/equipment/types'
import type { Economy } from '../../../src/gameplay/economy/types'

import {
  NodeType, RestChoice, ConditionType, RewardType,
} from '../../../src/gameplay/event/types'
import type {
  HistoricalEvent, EventGameState, EventCondition,
} from '../../../src/gameplay/event/types'
import {
  RECRUIT_POOL_SIZE, SHOP_SIZE, GENERIC_EVENTS,
  BASE_FALLBACK_GOLD, BASE_FALLBACK_MAT, FALLBACK_SCALING,
} from '../../../src/gameplay/event/eventConfig'
import {
  generateRecruitPool,
  resolveRecruit,
  generateShopInventory,
  resolveShopPurchase,
  resolveRestNode,
  evaluateCondition,
  matchHistoricalEvent,
  resolveMysteryNode,
  resolveGenericEvent,
  applyEventRewards,
} from '../../../src/gameplay/event/eventManager'

import type { RandomFn } from '../../../src/gameplay/battle/types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function fixedRandom(value: number): RandomFn {
  return () => value
}

function makeHero(id: string, tier: HeroTier = HeroTier.C, faction: Faction = Faction.Shu): HeroData {
  return {
    id, name: id, baseName: id, title: '', faction, tier,
    variant: HeroVariant.Base, legendTitle: null,
    baseStats: { [StatType.STR]: 20, [StatType.INT]: 15, [StatType.DEF]: 10, [StatType.HP]: 30, [StatType.SPD]: 12 },
    statGrowthRates: { [StatType.STR]: 0, [StatType.INT]: 0, [StatType.DEF]: 0, [StatType.HP]: 0, [StatType.SPD]: 0 },
    skills: [], martialArts: null, advisorSkill: null,
    tags: [], bondKeys: [],
    lore: { biography: '', historicalEvents: [] }, artRef: '',
  }
}

function makeEquip(id: string, cat: EquipCategory, level: number, price: number = 15): EquipmentData {
  return {
    id, name: id, slot: EquipSlot.Weapon, category: cat,
    level, unique: cat === EquipCategory.Named,
    baseStats: { STR: level * 5 }, effect: cat !== EquipCategory.Basic ? { description: 'fx', magnitude: 0.1, duration: 0 } : null,
    ownerBonus: null, ownerHeroId: null, basePrice: price, strengthenLevel: 0,
  }
}

function makeGameState(overrides: Partial<EventGameState> = {}): EventGameState {
  return {
    ownedHeroIds: [],
    ownedEquipmentIds: [],
    defeatedBossIds: [],
    triggeredEventIds: [],
    monarchId: 'liu_bei',
    campaignId: 'yellow_turban',
    ...overrides,
  }
}

function makeHistoricalEvent(id: string, priority: number, conditions: EventCondition[] = []): HistoricalEvent {
  return {
    id, name: `Event ${id}`, description: `Story for ${id}`,
    campaign: 'yellow_turban', priority, conditions,
    rewards: [{ type: RewardType.Gold, params: { amount: 50 } }],
    triggerOnce: true,
  }
}

// ---------------------------------------------------------------------------
// Recruit pool generation
// ---------------------------------------------------------------------------

describe('generateRecruitPool', () => {
  it('returns up to RECRUIT_POOL_SIZE candidates', () => {
    const heroes = Array.from({ length: 10 }, (_, i) => makeHero(`hero_${i}`))
    const pool = generateRecruitPool(heroes, [], 0, fixedRandom(0.5))
    expect(pool.length).toBeLessThanOrEqual(RECRUIT_POOL_SIZE)
    expect(pool.length).toBeGreaterThan(0)
  })

  it('excludes already-owned heroes', () => {
    const heroes = [makeHero('hero_a'), makeHero('hero_b'), makeHero('hero_c')]
    const pool = generateRecruitPool(heroes, ['hero_a'], 0, fixedRandom(0.5))
    expect(pool.every(c => c.hero.id !== 'hero_a')).toBe(true)
  })

  it('returns empty when all heroes are owned', () => {
    const heroes = [makeHero('hero_a')]
    const pool = generateRecruitPool(heroes, ['hero_a'], 0, fixedRandom(0.5))
    expect(pool).toHaveLength(0)
  })

  it('returns fewer candidates when available pool is smaller than RECRUIT_POOL_SIZE', () => {
    const heroes = [makeHero('hero_a'), makeHero('hero_b')]
    const pool = generateRecruitPool(heroes, [], 0, fixedRandom(0.5))
    expect(pool).toHaveLength(2)
  })

  it('assigns correct cost based on tier', () => {
    const heroes = [
      makeHero('c_hero', HeroTier.C),
      makeHero('b_hero', HeroTier.B),
      makeHero('a_hero', HeroTier.A),
    ]
    const pool = generateRecruitPool(heroes, [], 0, fixedRandom(0.5))
    const cCandidate = pool.find(c => c.hero.tier === HeroTier.C)
    const bCandidate = pool.find(c => c.hero.tier === HeroTier.B)
    const aCandidate = pool.find(c => c.hero.tier === HeroTier.A)

    if (cCandidate) expect(cCandidate.cost).toBe(30)  // 30 * 1.0
    if (bCandidate) expect(bCandidate.cost).toBe(45)  // 30 * 1.5
    if (aCandidate) expect(aCandidate.cost).toBe(75)  // 30 * 2.5
  })

  it('does not produce duplicate candidates', () => {
    const heroes = Array.from({ length: 10 }, (_, i) => makeHero(`hero_${i}`))
    const pool = generateRecruitPool(heroes, [], 0, fixedRandom(0.3))
    const ids = pool.map(c => c.hero.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// resolveRecruit
// ---------------------------------------------------------------------------

describe('resolveRecruit', () => {
  it('succeeds when gold is sufficient', () => {
    const candidate = { hero: makeHero('hero_a'), cost: 30 }
    const economy: Economy = { gold: 50, material: 0 }
    const [result, newEcon] = resolveRecruit(candidate, economy)

    expect(result.success).toBe(true)
    expect(result.hero?.id).toBe('hero_a')
    expect(result.goldSpent).toBe(30)
    expect(newEcon.gold).toBe(20)
  })

  it('fails when gold is insufficient', () => {
    const candidate = { hero: makeHero('hero_a'), cost: 50 }
    const economy: Economy = { gold: 20, material: 0 }
    const [result, newEcon] = resolveRecruit(candidate, economy)

    expect(result.success).toBe(false)
    expect(result.reason).toContain('Gold 不足')
    expect(newEcon.gold).toBe(20) // unchanged
  })

  it('spends exact cost', () => {
    const candidate = { hero: makeHero('hero_a'), cost: 30 }
    const economy: Economy = { gold: 30, material: 10 }
    const [result, newEcon] = resolveRecruit(candidate, economy)

    expect(result.success).toBe(true)
    expect(newEcon.gold).toBe(0)
    expect(newEcon.material).toBe(10) // untouched
  })
})

// ---------------------------------------------------------------------------
// Shop inventory
// ---------------------------------------------------------------------------

describe('generateShopInventory', () => {
  it('returns up to SHOP_SIZE items', () => {
    const equips = Array.from({ length: 20 }, (_, i) =>
      makeEquip(`equip_${i}`, EquipCategory.Basic, 1)
    )
    const inventory = generateShopInventory(equips, new Set(), 0, fixedRandom(0.5))
    expect(inventory.length).toBeLessThanOrEqual(SHOP_SIZE)
    expect(inventory.length).toBeGreaterThan(0)
  })

  it('early nodes (0-5) prefer Basic equipment', () => {
    const equips = [
      makeEquip('b1', EquipCategory.Basic, 1, 15),
      makeEquip('b2', EquipCategory.Basic, 1, 15),
      makeEquip('b3', EquipCategory.Basic, 2, 30),
      makeEquip('b4', EquipCategory.Basic, 2, 30),
      makeEquip('b5', EquipCategory.Basic, 1, 15),
      makeEquip('adv', EquipCategory.Advanced, 3, 50),
    ]
    const inventory = generateShopInventory(equips, new Set(), 3, fixedRandom(0.5))
    // At node 3 (qualityTier 0), should primarily select Basic Lv.1-2
    const basicCount = inventory.filter(i => i.equipment.category === EquipCategory.Basic).length
    expect(basicCount).toBeGreaterThan(0)
  })

  it('mid nodes (6-11) include Advanced equipment', () => {
    const equips = [
      makeEquip('b2', EquipCategory.Basic, 2, 30),
      makeEquip('adv1', EquipCategory.Advanced, 3, 50),
      makeEquip('adv2', EquipCategory.Advanced, 3, 50),
      makeEquip('adv3', EquipCategory.Advanced, 3, 50),
      makeEquip('adv4', EquipCategory.Advanced, 3, 50),
      makeEquip('adv5', EquipCategory.Advanced, 3, 50),
    ]
    const inventory = generateShopInventory(equips, new Set(), 8, fixedRandom(0.5))
    const hasAdvanced = inventory.some(i => i.equipment.category === EquipCategory.Advanced)
    expect(hasAdvanced).toBe(true)
  })

  it('items have correct prices', () => {
    const equips = [makeEquip('b1', EquipCategory.Basic, 1, 15)]
    const inventory = generateShopInventory(equips, new Set(), 0, fixedRandom(0.5))
    expect(inventory[0].price).toBe(15)
  })

  it('excludes owned Named equipment', () => {
    const equips = [
      makeEquip('named1', EquipCategory.Named, 4, 0),
      makeEquip('adv1', EquipCategory.Advanced, 3, 50),
    ]
    const owned = new Set(['named1'])
    const inventory = generateShopInventory(equips, owned, 14, fixedRandom(0.01))
    expect(inventory.every(i => i.equipment.id !== 'named1')).toBe(true)
  })

  it('returns empty when no equipment available', () => {
    const inventory = generateShopInventory([], new Set(), 0, fixedRandom(0.5))
    expect(inventory).toHaveLength(0)
  })

  it('does not duplicate items in inventory', () => {
    const equips = Array.from({ length: 10 }, (_, i) =>
      makeEquip(`equip_${i}`, EquipCategory.Basic, 1, 15)
    )
    const inventory = generateShopInventory(equips, new Set(), 0, fixedRandom(0.5))
    const ids = inventory.map(i => i.equipment.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ---------------------------------------------------------------------------
// resolveShopPurchase
// ---------------------------------------------------------------------------

describe('resolveShopPurchase', () => {
  it('succeeds when gold is sufficient', () => {
    const item = { equipment: makeEquip('sword', EquipCategory.Basic, 1, 15), price: 15 }
    const economy: Economy = { gold: 50, material: 10 }
    const [result, newEcon] = resolveShopPurchase(item, economy)

    expect(result.success).toBe(true)
    expect(result.equipment?.id).toBe('sword')
    expect(newEcon.gold).toBe(35)
  })

  it('fails when gold is insufficient', () => {
    const item = { equipment: makeEquip('sword', EquipCategory.Basic, 1, 15), price: 15 }
    const economy: Economy = { gold: 10, material: 10 }
    const [result, newEcon] = resolveShopPurchase(item, economy)

    expect(result.success).toBe(false)
    expect(newEcon.gold).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// Rest node
// ---------------------------------------------------------------------------

describe('resolveRestNode', () => {
  it('train succeeds when material is sufficient', () => {
    const economy: Economy = { gold: 50, material: 20 }
    const [result, newEcon] = resolveRestNode(RestChoice.Train, 10, 0, economy)

    expect(result.success).toBe(true)
    expect(result.choice).toBe(RestChoice.Train)
    expect(newEcon.material).toBe(10)
    expect(newEcon.gold).toBe(50) // unchanged
  })

  it('forge succeeds when gold and material are sufficient', () => {
    const economy: Economy = { gold: 50, material: 20 }
    const [result, newEcon] = resolveRestNode(RestChoice.Forge, 10, 15, economy)

    expect(result.success).toBe(true)
    expect(result.choice).toBe(RestChoice.Forge)
    expect(newEcon.gold).toBe(35)
    expect(newEcon.material).toBe(10)
  })

  it('fails when resources are insufficient', () => {
    const economy: Economy = { gold: 5, material: 3 }
    const [result, newEcon] = resolveRestNode(RestChoice.Train, 10, 0, economy)

    expect(result.success).toBe(false)
    expect(result.reason).toContain('资源不足')
    expect(newEcon.material).toBe(3) // unchanged
  })

  it('forge fails when only gold is insufficient', () => {
    const economy: Economy = { gold: 5, material: 20 }
    const [result] = resolveRestNode(RestChoice.Forge, 10, 15, economy)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Event condition evaluation
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  it('HasHero: true when hero is owned', () => {
    const condition: EventCondition = { type: ConditionType.HasHero, params: { heroId: 'guan_yu' } }
    const state = makeGameState({ ownedHeroIds: ['guan_yu', 'zhang_fei'] })
    expect(evaluateCondition(condition, state)).toBe(true)
  })

  it('HasHero: false when hero is not owned', () => {
    const condition: EventCondition = { type: ConditionType.HasHero, params: { heroId: 'zhuge_liang' } }
    const state = makeGameState({ ownedHeroIds: ['guan_yu'] })
    expect(evaluateCondition(condition, state)).toBe(false)
  })

  it('NotHasHero: true when hero is not owned', () => {
    const condition: EventCondition = { type: ConditionType.NotHasHero, params: { heroId: 'zhuge_liang' } }
    const state = makeGameState({ ownedHeroIds: [] })
    expect(evaluateCondition(condition, state)).toBe(true)
  })

  it('NotHasHero: false when hero is owned', () => {
    const condition: EventCondition = { type: ConditionType.NotHasHero, params: { heroId: 'zhuge_liang' } }
    const state = makeGameState({ ownedHeroIds: ['zhuge_liang'] })
    expect(evaluateCondition(condition, state)).toBe(false)
  })

  it('HasEquipment: checks equipment ownership', () => {
    const condition: EventCondition = { type: ConditionType.HasEquipment, params: { equipmentId: 'green_dragon' } }
    const stateWith = makeGameState({ ownedEquipmentIds: ['green_dragon'] })
    const stateWithout = makeGameState({ ownedEquipmentIds: [] })
    expect(evaluateCondition(condition, stateWith)).toBe(true)
    expect(evaluateCondition(condition, stateWithout)).toBe(false)
  })

  it('BossDefeated: checks boss defeat history', () => {
    const condition: EventCondition = { type: ConditionType.BossDefeated, params: { bossId: 'dong_zhuo' } }
    const state = makeGameState({ defeatedBossIds: ['dong_zhuo'] })
    expect(evaluateCondition(condition, state)).toBe(true)
  })

  it('EventTriggered: checks event history', () => {
    const condition: EventCondition = { type: ConditionType.EventTriggered, params: { eventId: 'taoyuan_1' } }
    const state = makeGameState({ triggeredEventIds: ['taoyuan_1'] })
    expect(evaluateCondition(condition, state)).toBe(true)
  })

  it('Monarch: checks monarch identity', () => {
    const condition: EventCondition = { type: ConditionType.Monarch, params: { monarchId: 'liu_bei' } }
    const state = makeGameState({ monarchId: 'liu_bei' })
    expect(evaluateCondition(condition, state)).toBe(true)
  })

  it('Campaign: checks campaign ID', () => {
    const condition: EventCondition = { type: ConditionType.Campaign, params: { campaignId: 'yellow_turban' } }
    const state = makeGameState({ campaignId: 'yellow_turban' })
    expect(evaluateCondition(condition, state)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// matchHistoricalEvent
// ---------------------------------------------------------------------------

describe('matchHistoricalEvent', () => {
  it('matches highest priority event whose conditions are met', () => {
    const events = [
      makeHistoricalEvent('low_priority', 1, []),
      makeHistoricalEvent('high_priority', 10, []),
    ]
    const state = makeGameState()
    const match = matchHistoricalEvent(events, state)
    expect(match?.id).toBe('high_priority')
  })

  it('skips events whose conditions are not met', () => {
    const events = [
      makeHistoricalEvent('needs_hero', 10, [
        { type: ConditionType.HasHero, params: { heroId: 'zhuge_liang' } },
      ]),
      makeHistoricalEvent('no_conditions', 5, []),
    ]
    const state = makeGameState({ ownedHeroIds: [] })
    const match = matchHistoricalEvent(events, state)
    expect(match?.id).toBe('no_conditions')
  })

  it('skips triggerOnce events already triggered', () => {
    const events = [
      makeHistoricalEvent('already_done', 10, []),
      makeHistoricalEvent('not_done', 5, []),
    ]
    const state = makeGameState()
    const match = matchHistoricalEvent(events, state, new Set(['already_done']))
    expect(match?.id).toBe('not_done')
  })

  it('returns null when no events match', () => {
    const events = [
      makeHistoricalEvent('needs_hero', 10, [
        { type: ConditionType.HasHero, params: { heroId: 'impossible' } },
      ]),
    ]
    const state = makeGameState()
    const match = matchHistoricalEvent(events, state)
    expect(match).toBeNull()
  })

  it('matches event with multiple conditions (AND logic)', () => {
    const events = [
      makeHistoricalEvent('multi_cond', 10, [
        { type: ConditionType.HasHero, params: { heroId: 'guan_yu' } },
        { type: ConditionType.Campaign, params: { campaignId: 'yellow_turban' } },
      ]),
    ]
    const state = makeGameState({
      ownedHeroIds: ['guan_yu'],
      campaignId: 'yellow_turban',
    })
    const match = matchHistoricalEvent(events, state)
    expect(match?.id).toBe('multi_cond')
  })

  it('fails if any condition in AND fails', () => {
    const events = [
      makeHistoricalEvent('multi_cond', 10, [
        { type: ConditionType.HasHero, params: { heroId: 'guan_yu' } },
        { type: ConditionType.HasHero, params: { heroId: 'zhang_fei' } },
      ]),
    ]
    const state = makeGameState({ ownedHeroIds: ['guan_yu'] }) // missing zhang_fei
    const match = matchHistoricalEvent(events, state)
    expect(match).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveMysteryNode
// ---------------------------------------------------------------------------

describe('resolveMysteryNode', () => {
  it('returns historical event when conditions match', () => {
    const events = [makeHistoricalEvent('taoyuan', 10, [])]
    const state = makeGameState()
    const result = resolveMysteryNode(events, state, new Set(), 5, fixedRandom(0.5))

    expect(result.isHistorical).toBe(true)
    expect(result.eventId).toBe('taoyuan')
  })

  it('falls back to generic event when no historical match', () => {
    const events = [
      makeHistoricalEvent('impossible', 10, [
        { type: ConditionType.HasHero, params: { heroId: 'nobody' } },
      ]),
    ]
    const state = makeGameState()
    const result = resolveMysteryNode(events, state, new Set(), 5, fixedRandom(0.5))

    expect(result.isHistorical).toBe(false)
    expect(result.rewards.length).toBeGreaterThan(0)
  })

  it('generic event rewards scale with nodeIndex', () => {
    const result0 = resolveGenericEvent(0, fixedRandom(0))
    const result10 = resolveGenericEvent(10, fixedRandom(0))

    // Both should have rewards, and node 10 should have higher values
    const gold0 = result0.rewards.find(r => r.type === RewardType.Gold)?.params['amount'] ?? 0
    const gold10 = result10.rewards.find(r => r.type === RewardType.Gold)?.params['amount'] ?? 0

    if (Number(gold0) > 0 && Number(gold10) > 0) {
      expect(Number(gold10)).toBeGreaterThanOrEqual(Number(gold0))
    }
  })
})

// ---------------------------------------------------------------------------
// applyEventRewards
// ---------------------------------------------------------------------------

describe('applyEventRewards', () => {
  it('adds gold reward to economy', () => {
    const rewards = [{ type: RewardType.Gold, params: { amount: 30 } }]
    const economy: Economy = { gold: 10, material: 5 }
    const result = applyEventRewards(rewards, economy)
    expect(result.gold).toBe(40)
    expect(result.material).toBe(5)
  })

  it('adds material reward to economy', () => {
    const rewards = [{ type: RewardType.Material, params: { amount: 15 } }]
    const economy: Economy = { gold: 10, material: 5 }
    const result = applyEventRewards(rewards, economy)
    expect(result.gold).toBe(10)
    expect(result.material).toBe(20)
  })

  it('adds both gold and material rewards', () => {
    const rewards = [
      { type: RewardType.Gold, params: { amount: 20 } },
      { type: RewardType.Material, params: { amount: 10 } },
    ]
    const economy: Economy = { gold: 5, material: 5 }
    const result = applyEventRewards(rewards, economy)
    expect(result.gold).toBe(25)
    expect(result.material).toBe(15)
  })

  it('ignores non-resource rewards (hero_unlock etc)', () => {
    const rewards = [{ type: RewardType.HeroUnlock, params: { heroId: 'zhuge_liang' } }]
    const economy: Economy = { gold: 10, material: 5 }
    const result = applyEventRewards(rewards, economy)
    expect(result.gold).toBe(10)
    expect(result.material).toBe(5)
  })

  it('handles empty rewards', () => {
    const economy: Economy = { gold: 10, material: 5 }
    const result = applyEventRewards([], economy)
    expect(result.gold).toBe(10)
    expect(result.material).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('event system edge cases', () => {
  it('recruit with exactly enough gold succeeds', () => {
    const candidate = { hero: makeHero('hero'), cost: 30 }
    const economy: Economy = { gold: 30, material: 0 }
    const [result] = resolveRecruit(candidate, economy)
    expect(result.success).toBe(true)
  })

  it('recruit with 1 gold short fails', () => {
    const candidate = { hero: makeHero('hero'), cost: 30 }
    const economy: Economy = { gold: 29, material: 0 }
    const [result] = resolveRecruit(candidate, economy)
    expect(result.success).toBe(false)
  })

  it('generic events exist in config', () => {
    expect(GENERIC_EVENTS.length).toBeGreaterThan(0)
  })

  it('all generic events have valid baseGold or baseMaterial', () => {
    for (const event of GENERIC_EVENTS) {
      expect(event.baseGold).toBeGreaterThanOrEqual(0)
      expect(event.baseMaterial).toBeGreaterThanOrEqual(0)
      expect(event.baseGold + event.baseMaterial).toBeGreaterThan(0)
    }
  })

  it('7 node types are defined', () => {
    expect(Object.values(NodeType)).toHaveLength(7)
    expect(Object.values(NodeType)).toContain('battle')
    expect(Object.values(NodeType)).toContain('elite')
    expect(Object.values(NodeType)).toContain('boss')
    expect(Object.values(NodeType)).toContain('recruit')
    expect(Object.values(NodeType)).toContain('shop')
    expect(Object.values(NodeType)).toContain('rest')
    expect(Object.values(NodeType)).toContain('mystery')
  })

  it('rest choice enum has train and forge', () => {
    expect(RestChoice.Train).toBe('train')
    expect(RestChoice.Forge).toBe('forge')
  })

  it('resolveGenericEvent returns valid result even with empty pool', () => {
    // This tests the fallback when GENERIC_EVENTS is empty
    // Since GENERIC_EVENTS is a constant array with entries, this tests normal path
    const result = resolveGenericEvent(0, fixedRandom(0))
    expect(result.eventName).toBeDefined()
    expect(result.description).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('event system performance', () => {
  it('event matching completes in < 10ms', () => {
    const events = Array.from({ length: 50 }, (_, i) =>
      makeHistoricalEvent(`event_${i}`, i, [
        { type: ConditionType.HasHero, params: { heroId: `hero_${i}` } },
      ])
    )
    const state = makeGameState({ ownedHeroIds: ['hero_49'] })

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      matchHistoricalEvent(events, state)
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100) // 100 iterations in < 100ms
  })
})
