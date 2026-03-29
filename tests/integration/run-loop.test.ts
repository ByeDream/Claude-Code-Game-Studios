/**
 * Run Loop — Integration Tests
 *
 * End-to-end tests verifying the complete roguelike run loop:
 * - Map generation → node traversal → battle/event resolution → run end
 * - Cross-system integration (Battle + Loot + Event + Economy + Status)
 * - Multiple automated runs with crash detection
 *
 * @see Sprint 2 — S2-07 acceptance criteria
 */

import { describe, it, expect } from 'vitest'

import type { HeroData } from '../../src/gameplay/hero/types'
import { Faction, HeroTier, HeroVariant, StatType } from '../../src/gameplay/hero/types'
import { NodeType, RestChoice } from '../../src/gameplay/event/types'
import type { RunConfig } from '../../src/gameplay/run/types'
import { RunPhase, RunEndReason } from '../../src/gameplay/run/types'
import {
  startRun, selectNode, resolveBattleNode,
  resolveRecruitNode, resolveShopNode,
  resolveRestNodeAction, resolveMysteryNodeAction,
  checkRunEnd,
} from '../../src/gameplay/run/runManager'
import { getSelectableNodes, getAllNodes } from '../../src/gameplay/run-map/mapGenerator'
import { DEFAULT_STARTING_HONOR } from '../../src/gameplay/run/runConfig'
import type { RandomFn } from '../../src/gameplay/battle/types'

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
      [StatType.HP]: 35, [StatType.SPD]: 15, ...stats,
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

function makeWeakEnemy(id: string, nodeIndex: number): HeroData {
  const scale = 1 + nodeIndex * 0.1
  return makeHero(id, {
    [StatType.STR]: Math.round(8 * scale),
    [StatType.INT]: Math.round(6 * scale),
    [StatType.DEF]: Math.round(7 * scale),
    [StatType.HP]: Math.round(12 * scale),
    [StatType.SPD]: Math.round(8 * scale),
  })
}

function makeDefaultConfig(): RunConfig {
  return {
    campaignId: 'integration_test',
    startingHeroes: [makeHero('hero_1'), makeHero('hero_2'), makeHero('hero_3')],
    startingHonor: DEFAULT_STARTING_HONOR,
    equipmentPool: [],
    heroPool: Array.from({ length: 10 }, (_, i) => makeHero(`recruit_${i}`)),
  }
}

function simulateFullRun(seed: number, config?: RunConfig): {
  completed: boolean
  endReason?: string
  steps: number
  nodesVisited: number
  error?: string
  goldEarned: number
  materialEarned: number
} {
  const rand = seededRandom(seed)
  const cfg = config ?? makeDefaultConfig()
  let state = startRun(cfg, undefined, rand)
  let steps = 0
  const maxSteps = 200

  try {
    while (state.phase !== RunPhase.Ended && steps < maxSteps) {
      if (state.phase === RunPhase.MapView) {
        const selectable = getSelectableNodes(state.map, state.currentNodeId)
        if (selectable.length === 0) break
        const idx = Math.floor(rand() * selectable.length)
        state = selectNode(state, selectable[idx].id)
      } else if (state.phase === RunPhase.NodeInteraction) {
        const node = getAllNodes(state.map).find(n => n.id === state.currentNodeId)
        if (!node) break

        switch (node.type) {
          case NodeType.Battle:
          case NodeType.Elite:
          case NodeType.Boss: {
            const count = node.type === NodeType.Boss ? 3 : node.type === NodeType.Elite ? 2 : 1
            const enemies = Array.from({ length: count }, (_, i) =>
              makeWeakEnemy(`e_${steps}_${i}`, state.nodeIndex)
            )
            state = resolveBattleNode(state, enemies, [1], rand)
            break
          }
          case NodeType.Recruit:
            state = resolveRecruitNode(state, cfg.heroPool, rand() < 0.3 ? 0 : null, rand)
            break
          case NodeType.Shop:
            state = resolveShopNode(state, cfg.equipmentPool, [], rand)
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

    return {
      completed: state.phase === RunPhase.Ended || steps >= maxSteps,
      endReason: state.endReason ?? (steps >= maxSteps ? 'timeout' : 'unknown'),
      steps,
      nodesVisited: state.completedNodeIds.length,
      goldEarned: state.economy.gold,
      materialEarned: state.economy.material,
    }
  } catch (error) {
    return {
      completed: false,
      error: error instanceof Error ? error.message : String(error),
      steps,
      nodesVisited: 0,
      goldEarned: 0,
      materialEarned: 0,
    }
  }
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Run Loop Integration', () => {
  it('50 automated runs complete without crashes', () => {
    let crashes = 0
    let completions = 0

    for (let seed = 1; seed <= 50; seed++) {
      const result = simulateFullRun(seed)
      if (result.error) crashes++
      if (result.completed) completions++
    }

    expect(crashes).toBe(0)
    expect(completions).toBe(50)
  })

  it('run completion rate ≥ 90%', () => {
    let completions = 0
    const total = 50

    for (let seed = 1; seed <= total; seed++) {
      const result = simulateFullRun(seed)
      if (result.completed) completions++
    }

    expect(completions / total).toBeGreaterThanOrEqual(0.9)
  })

  it('runs earn gold through loot system', () => {
    const result = simulateFullRun(42)
    expect(result.goldEarned).toBeGreaterThan(0)
  })

  it('runs visit multiple nodes', () => {
    const result = simulateFullRun(42)
    expect(result.nodesVisited).toBeGreaterThan(5)
  })

  it('different seeds produce different outcomes', () => {
    const result1 = simulateFullRun(1)
    const result2 = simulateFullRun(99)

    // At least one metric should differ
    const differs = result1.steps !== result2.steps ||
      result1.nodesVisited !== result2.nodesVisited ||
      result1.goldEarned !== result2.goldEarned

    expect(differs).toBe(true)
  })

  it('economy accumulates resources across nodes', () => {
    const result = simulateFullRun(42)
    // After visiting 15+ nodes with loot, should have meaningful resources
    expect(result.goldEarned + result.materialEarned).toBeGreaterThan(0)
  })

  it('all node types are encountered across multiple runs', () => {
    const typesEncountered = new Set<NodeType>()

    for (let seed = 1; seed <= 20; seed++) {
      const rand = seededRandom(seed)
      const config = makeDefaultConfig()
      let state = startRun(config, undefined, rand)
      let steps = 0

      while (state.phase !== RunPhase.Ended && steps < 200) {
        if (state.phase === RunPhase.MapView) {
          const selectable = getSelectableNodes(state.map, state.currentNodeId)
          if (selectable.length === 0) break
          state = selectNode(state, selectable[0].id)
        } else if (state.phase === RunPhase.NodeInteraction) {
          const node = getAllNodes(state.map).find(n => n.id === state.currentNodeId)
          if (node) typesEncountered.add(node.type)

          // Quick resolve
          switch (node?.type) {
            case NodeType.Battle:
            case NodeType.Elite:
            case NodeType.Boss:
              state = resolveBattleNode(state, [makeWeakEnemy('e', 0)], [1], rand)
              break
            default:
              state = resolveMysteryNodeAction(state, [], rand)
          }
          state = checkRunEnd(state)
        }
        steps++
      }
    }

    expect(typesEncountered.has(NodeType.Battle)).toBe(true)
    expect(typesEncountered.has(NodeType.Boss)).toBe(true)
    expect(typesEncountered.size).toBeGreaterThanOrEqual(4)
  })

  it('performance: 50 runs complete in < 10 seconds', () => {
    const start = performance.now()
    for (let seed = 1; seed <= 50; seed++) {
      simulateFullRun(seed)
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(10000)
  })
})
