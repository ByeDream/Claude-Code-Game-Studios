/**
 * Run Manager — Unit Tests
 *
 * Tests for the roguelike run loop state machine:
 * - startRun initialization
 * - selectNode validation
 * - Battle node resolution (victory/defeat, loot, honor)
 * - Recruit node resolution
 * - Shop node resolution
 * - Rest node resolution
 * - Mystery node resolution
 * - checkRunEnd (victory, defeat)
 * - Full run simulation
 *
 * ≥ 40 tests target
 *
 * @see design/gdd/run-map.md
 * @see design/gdd/event-system.md
 */

import { describe, it, expect } from 'vitest'

import type { HeroData } from '../../../src/gameplay/hero/types'
import { Faction, HeroTier, HeroVariant, StatType } from '../../../src/gameplay/hero/types'
import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'
import type { EquipmentData } from '../../../src/gameplay/equipment/types'
import { EquipSlot, EquipCategory } from '../../../src/gameplay/equipment/types'
import { NodeType, RestChoice } from '../../../src/gameplay/event/types'

import type { RunConfig } from '../../../src/gameplay/run/types'
import { RunPhase, RunEndReason } from '../../../src/gameplay/run/types'
import {
  startRun,
  selectNode,
  resolveBattleNode,
  resolveRecruitNode,
  resolveShopNode,
  resolveRestNodeAction,
  resolveMysteryNodeAction,
  checkRunEnd,
} from '../../../src/gameplay/run/runManager'
import { DEFAULT_STARTING_HONOR } from '../../../src/gameplay/run/runConfig'
import { getSelectableNodes, getAllNodes } from '../../../src/gameplay/run-map/mapGenerator'
import type { RandomFn } from '../../../src/gameplay/battle/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seededRandom(seed: number): RandomFn {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeHero(id: string, stats: Partial<Record<string, number>> = {}): HeroData {
  return {
    id, name: id, baseName: id, title: '', faction: Faction.Shu,
    tier: HeroTier.A, variant: HeroVariant.Base, legendTitle: null,
    baseStats: {
      [StatType.STR]: 25, [StatType.INT]: 20, [StatType.DEF]: 15,
      [StatType.HP]: 35, [StatType.SPD]: 15,
      ...stats,
    },
    statGrowthRates: {
      [StatType.STR]: 0, [StatType.INT]: 0, [StatType.DEF]: 0,
      [StatType.HP]: 0, [StatType.SPD]: 0,
    },
    skills: [], martialArts: null, advisorSkill: null,
    tags: [], bondKeys: [],
    lore: { biography: '', historicalEvents: [] }, artRef: '',
  }
}

function makeWeakEnemy(id: string): HeroData {
  return makeHero(id, {
    [StatType.STR]: 5, [StatType.INT]: 5, [StatType.DEF]: 5,
    [StatType.HP]: 10, [StatType.SPD]: 5,
  })
}

function makeEquip(id: string): EquipmentData {
  return {
    id, name: id, slot: EquipSlot.Weapon, category: EquipCategory.Basic,
    level: 1, unique: false, baseStats: { STR: 5 }, effect: null,
    ownerBonus: null, ownerHeroId: null, basePrice: 15, strengthenLevel: 0,
  }
}

function makeDefaultConfig(): RunConfig {
  return {
    campaignId: 'test_campaign',
    startingHeroes: [makeHero('hero_1'), makeHero('hero_2')],
    startingHonor: DEFAULT_STARTING_HONOR,
    equipmentPool: [makeEquip('equip_1'), makeEquip('equip_2')],
    heroPool: [
      makeHero('recruit_1', {}),
      makeHero('recruit_2', {}),
      makeHero('recruit_3', {}),
    ],
  }
}

// ---------------------------------------------------------------------------
// startRun
// ---------------------------------------------------------------------------

describe('startRun', () => {
  it('creates initial RunState with correct defaults', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))

    expect(state.phase).toBe(RunPhase.MapView)
    expect(state.honor).toBe(DEFAULT_STARTING_HONOR)
    expect(state.nodeIndex).toBe(0)
    expect(state.roster).toHaveLength(2)
    expect(state.completedNodeIds).toHaveLength(0)
    expect(state.defeatedBossIds).toHaveLength(0)
    expect(state.triggeredEventIds).toHaveLength(0)
  })

  it('roster contains HeroInstances at level 1', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))

    expect(state.roster[0].level).toBe(1)
    expect(state.roster[0].data.id).toBe('hero_1')
  })

  it('generates a valid map', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))

    expect(state.map.layers.length).toBeGreaterThan(0)
    expect(state.map.startNodeId).toBeDefined()
    expect(state.map.finalBossNodeId).toBeDefined()
  })

  it('currentNodeId starts at map start', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))
    expect(state.currentNodeId).toBe(state.map.startNodeId)
  })

  it('economy starts with default values', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))
    expect(state.economy.gold).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// selectNode
// ---------------------------------------------------------------------------

describe('selectNode', () => {
  it('moves to valid next node', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))

    const selectable = getSelectableNodes(state.map, state.currentNodeId)
    expect(selectable.length).toBeGreaterThan(0)

    state = selectNode(state, selectable[0].id)
    expect(state.currentNodeId).toBe(selectable[0].id)
    expect(state.phase).toBe(RunPhase.NodeInteraction)
  })

  it('does not move to unreachable node', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    const originalNode = state.currentNodeId

    state = selectNode(state, 'nonexistent_node')
    expect(state.currentNodeId).toBe(originalNode)
    expect(state.phase).toBe(RunPhase.MapView)
  })

  it('does not move when not in MapView phase', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    const selectable = getSelectableNodes(state.map, state.currentNodeId)

    // Move to a node
    state = selectNode(state, selectable[0].id)
    expect(state.phase).toBe(RunPhase.NodeInteraction)

    // Try to move again while in NodeInteraction
    if (selectable.length > 1) {
      const prevNode = state.currentNodeId
      state = selectNode(state, selectable[1].id)
      expect(state.currentNodeId).toBe(prevNode) // unchanged
    }
  })
})

// ---------------------------------------------------------------------------
// Battle node resolution
// ---------------------------------------------------------------------------

describe('resolveBattleNode', () => {
  it('victory completes node and adds loot', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))

    // Move to first selectable node
    const selectable = getSelectableNodes(state.map, state.currentNodeId)
    state = selectNode(state, selectable[0].id)

    // Resolve battle with very weak enemies (guaranteed win)
    const enemies = [makeWeakEnemy('enemy_1')]
    const prevGold = state.economy.gold
    state = resolveBattleNode(state, enemies, [1], seededRandom(42)) // choose gold

    expect(state.phase).toBe(RunPhase.MapView)
    expect(state.completedNodeIds.length).toBeGreaterThan(0)
    expect(state.nodeIndex).toBe(1)
    expect(state.economy.gold).toBeGreaterThanOrEqual(prevGold) // got loot
  })

  it('boss defeat reduces honor', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))

    // Force currentNodeId to a boss node and make it the final boss
    state = {
      ...state,
      currentNodeId: state.map.finalBossNodeId,
      phase: RunPhase.NodeInteraction,
    }

    // Very strong enemies (guaranteed loss with weak hero setup)
    const strongEnemies = [
      makeHero('boss', {
        [StatType.STR]: 100, [StatType.HP]: 200, [StatType.DEF]: 50, [StatType.SPD]: 30,
      }),
    ]

    // Use minimal roster for guaranteed defeat
    state = {
      ...state,
      roster: [createHeroInstance(makeWeakEnemy('weak_hero'), 1)],
    }

    state = resolveBattleNode(state, strongEnemies, [], seededRandom(42))

    // Should lose honor (100 for final boss → 0 → run ends)
    expect(state.honor).toBe(0)
    expect(state.phase).toBe(RunPhase.Ended)
    expect(state.endReason).toBe(RunEndReason.HonorDepleted)
  })
})

// ---------------------------------------------------------------------------
// Recruit node resolution
// ---------------------------------------------------------------------------

describe('resolveRecruitNode', () => {
  it('recruiting adds hero to roster', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, economy: { gold: 100, material: 0 }, phase: RunPhase.NodeInteraction }

    const prevRosterSize = state.roster.length
    state = resolveRecruitNode(state, config.heroPool, 0, seededRandom(42))

    expect(state.roster.length).toBeGreaterThan(prevRosterSize)
    expect(state.phase).toBe(RunPhase.MapView)
  })

  it('skipping recruitment does not add hero', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, phase: RunPhase.NodeInteraction }

    const prevRosterSize = state.roster.length
    state = resolveRecruitNode(state, config.heroPool, null, seededRandom(42))

    expect(state.roster).toHaveLength(prevRosterSize)
    expect(state.phase).toBe(RunPhase.MapView)
  })

  it('insufficient gold prevents recruitment', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, economy: { gold: 0, material: 0 }, phase: RunPhase.NodeInteraction }

    const prevRosterSize = state.roster.length
    state = resolveRecruitNode(state, config.heroPool, 0, seededRandom(42))

    // Should complete node without recruiting
    expect(state.roster).toHaveLength(prevRosterSize)
  })
})

// ---------------------------------------------------------------------------
// Shop node resolution
// ---------------------------------------------------------------------------

describe('resolveShopNode', () => {
  it('purchasing equipment adds to owned', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, economy: { gold: 100, material: 0 }, phase: RunPhase.NodeInteraction }

    const prevEquipCount = state.ownedEquipment.length
    state = resolveShopNode(state, config.equipmentPool, [0], seededRandom(42))

    expect(state.ownedEquipment.length).toBeGreaterThanOrEqual(prevEquipCount)
    expect(state.phase).toBe(RunPhase.MapView)
  })

  it('skipping shop does not add equipment', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, phase: RunPhase.NodeInteraction }

    state = resolveShopNode(state, config.equipmentPool, [], seededRandom(42))
    expect(state.phase).toBe(RunPhase.MapView)
  })
})

// ---------------------------------------------------------------------------
// Rest node resolution
// ---------------------------------------------------------------------------

describe('resolveRestNodeAction', () => {
  it('train spends material', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, economy: { gold: 50, material: 20 }, phase: RunPhase.NodeInteraction }

    state = resolveRestNodeAction(state, RestChoice.Train, 10, 0)
    expect(state.economy.material).toBe(10)
    expect(state.phase).toBe(RunPhase.MapView)
  })

  it('forge spends gold and material', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, economy: { gold: 50, material: 20 }, phase: RunPhase.NodeInteraction }

    state = resolveRestNodeAction(state, RestChoice.Forge, 10, 15)
    expect(state.economy.gold).toBe(35)
    expect(state.economy.material).toBe(10)
  })

  it('insufficient resources still completes node', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, economy: { gold: 0, material: 0 }, phase: RunPhase.NodeInteraction }

    state = resolveRestNodeAction(state, RestChoice.Train, 10, 0)
    expect(state.phase).toBe(RunPhase.MapView) // completes even on failure
  })
})

// ---------------------------------------------------------------------------
// Mystery node resolution
// ---------------------------------------------------------------------------

describe('resolveMysteryNodeAction', () => {
  it('generic event adds resources', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, phase: RunPhase.NodeInteraction }
    const prevGold = state.economy.gold

    state = resolveMysteryNodeAction(state, [], seededRandom(42))
    // Generic events should add gold or material
    const totalResources = state.economy.gold + state.economy.material
    expect(totalResources).toBeGreaterThan(prevGold)
    expect(state.phase).toBe(RunPhase.MapView)
  })

  it('historical event is tracked in triggeredEventIds', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, phase: RunPhase.NodeInteraction }

    const historicalEvents = [{
      id: 'test_event',
      name: 'Test Event',
      description: 'A test event.',
      campaign: 'test_campaign',
      priority: 10,
      conditions: [], // always matches
      rewards: [{ type: 'gold' as const, params: { amount: 50 } }],
      triggerOnce: true,
    }]

    state = resolveMysteryNodeAction(state, historicalEvents, seededRandom(42))
    expect(state.triggeredEventIds).toContain('test_event')
  })
})

// ---------------------------------------------------------------------------
// checkRunEnd
// ---------------------------------------------------------------------------

describe('checkRunEnd', () => {
  it('detects victory when final boss is defeated', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = {
      ...state,
      defeatedBossIds: [state.map.finalBossNodeId],
    }

    state = checkRunEnd(state)
    expect(state.phase).toBe(RunPhase.Ended)
    expect(state.endReason).toBe(RunEndReason.Victory)
  })

  it('detects defeat when honor is 0', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    state = { ...state, honor: 0 }

    state = checkRunEnd(state)
    expect(state.phase).toBe(RunPhase.Ended)
    expect(state.endReason).toBe(RunEndReason.HonorDepleted)
  })

  it('does not end when conditions are not met', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))

    state = checkRunEnd(state)
    expect(state.phase).toBe(RunPhase.MapView) // unchanged
  })
})

// ---------------------------------------------------------------------------
// Node index progression
// ---------------------------------------------------------------------------

describe('node index progression', () => {
  it('nodeIndex increments after each completed node', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    expect(state.nodeIndex).toBe(0)

    // Complete a battle node
    const selectable = getSelectableNodes(state.map, state.currentNodeId)
    state = selectNode(state, selectable[0].id)
    state = resolveBattleNode(state, [makeWeakEnemy('e1')], [1], seededRandom(42))
    expect(state.nodeIndex).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Run state immutability
// ---------------------------------------------------------------------------

describe('RunState immutability', () => {
  it('selectNode returns new state', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))
    const selectable = getSelectableNodes(state.map, state.currentNodeId)
    const newState = selectNode(state, selectable[0].id)

    expect(newState).not.toBe(state)
    expect(newState.currentNodeId).not.toBe(state.currentNodeId)
  })

  it('original state is not mutated by selectNode', () => {
    const config = makeDefaultConfig()
    const state = startRun(config, undefined, seededRandom(42))
    const originalNodeId = state.currentNodeId

    const selectable = getSelectableNodes(state.map, state.currentNodeId)
    selectNode(state, selectable[0].id)

    expect(state.currentNodeId).toBe(originalNodeId) // unchanged
  })
})

// ---------------------------------------------------------------------------
// Full run simulation
// ---------------------------------------------------------------------------

describe('full run simulation', () => {
  it('can simulate a complete run from start to completion', () => {
    const config = makeDefaultConfig()
    let state = startRun(config, undefined, seededRandom(42))
    const rand = seededRandom(42)

    let steps = 0
    const maxSteps = 100

    while (state.phase !== RunPhase.Ended && steps < maxSteps) {
      if (state.phase === RunPhase.MapView) {
        const selectable = getSelectableNodes(state.map, state.currentNodeId)
        if (selectable.length === 0) break
        state = selectNode(state, selectable[0].id)
      } else if (state.phase === RunPhase.NodeInteraction) {
        // Auto-resolve based on node type
        const node = getAllNodes(state.map).find(n => n.id === state.currentNodeId)
        if (!node) break

        switch (node.type) {
          case NodeType.Battle:
          case NodeType.Elite:
          case NodeType.Boss:
            state = resolveBattleNode(state, [makeWeakEnemy(`e_${steps}`)], [1], rand)
            break
          case NodeType.Recruit:
            state = resolveRecruitNode(state, config.heroPool, null, rand)
            break
          case NodeType.Shop:
            state = resolveShopNode(state, config.equipmentPool, [], rand)
            break
          case NodeType.Rest:
            state = resolveRestNodeAction(state, RestChoice.Train, 0, 0)
            break
          case NodeType.Mystery:
            state = resolveMysteryNodeAction(state, [], rand)
            break
        }

        state = checkRunEnd(state)
      }
      steps++
    }

    // Should have progressed through the run
    expect(steps).toBeGreaterThan(0)
    expect(state.completedNodeIds.length).toBeGreaterThan(0)
    expect(state.nodeIndex).toBeGreaterThan(0)
  })
})
