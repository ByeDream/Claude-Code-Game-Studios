/**
 * Run Simulation Script
 *
 * Simulates N complete runs to verify stability and gather statistics.
 * Usage: npx tsx scripts/run-simulation.ts [count]
 *
 * Default: 50 runs
 *
 * @see design/gdd/run-map.md
 * @see Sprint 2 acceptance criteria
 */

import type { HeroData } from '../src/gameplay/hero/types'
import { Faction, HeroTier, HeroVariant, StatType } from '../src/gameplay/hero/types'
import { NodeType, RestChoice } from '../src/gameplay/event/types'
import type { RunConfig } from '../src/gameplay/run/types'
import { RunPhase, RunEndReason } from '../src/gameplay/run/types'
import {
  startRun, selectNode, resolveBattleNode,
  resolveRecruitNode, resolveShopNode,
  resolveRestNodeAction, resolveMysteryNodeAction,
  checkRunEnd,
} from '../src/gameplay/run/runManager'
import { getSelectableNodes, getAllNodes } from '../src/gameplay/run-map/mapGenerator'
import { DEFAULT_STARTING_HONOR } from '../src/gameplay/run/runConfig'

// ---------------------------------------------------------------------------
// Test hero/enemy factories
// ---------------------------------------------------------------------------

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

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------------------------------------------------------------------------
// Run simulation
// ---------------------------------------------------------------------------

function simulateRun(seed: number): {
  completed: boolean
  endReason?: string
  steps: number
  nodesVisited: number
  error?: string
} {
  try {
    const rand = seededRandom(seed)
    const config: RunConfig = {
      campaignId: 'sim',
      startingHeroes: [makeHero('hero_1'), makeHero('hero_2'), makeHero('hero_3')],
      startingHonor: DEFAULT_STARTING_HONOR,
      equipmentPool: [],
      heroPool: Array.from({ length: 10 }, (_, i) => makeHero(`recruit_${i}`)),
    }

    let state = startRun(config, undefined, rand)
    let steps = 0
    const maxSteps = 200

    while (state.phase !== RunPhase.Ended && steps < maxSteps) {
      if (state.phase === RunPhase.MapView) {
        const selectable = getSelectableNodes(state.map, state.currentNodeId)
        if (selectable.length === 0) {
          return {
            completed: true,
            endReason: 'no_more_nodes',
            steps,
            nodesVisited: state.completedNodeIds.length,
          }
        }

        // Random node selection
        const idx = Math.floor(rand() * selectable.length)
        state = selectNode(state, selectable[idx].id)
      } else if (state.phase === RunPhase.NodeInteraction) {
        const node = getAllNodes(state.map).find(n => n.id === state.currentNodeId)
        if (!node) break

        switch (node.type) {
          case NodeType.Battle:
          case NodeType.Elite:
          case NodeType.Boss: {
            const enemyCount = node.type === NodeType.Boss ? 3 : node.type === NodeType.Elite ? 2 : 1
            const enemies = Array.from({ length: enemyCount }, (_, i) =>
              makeWeakEnemy(`e_${steps}_${i}`, state.nodeIndex)
            )
            state = resolveBattleNode(state, enemies, [1], rand)
            break
          }
          case NodeType.Recruit:
            state = resolveRecruitNode(state, config.heroPool, rand() < 0.5 ? 0 : null, rand)
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

    return {
      completed: state.phase === RunPhase.Ended || steps >= maxSteps,
      endReason: state.endReason ?? (steps >= maxSteps ? 'timeout' : 'unknown'),
      steps,
      nodesVisited: state.completedNodeIds.length,
    }
  } catch (error) {
    return {
      completed: false,
      error: error instanceof Error ? error.message : String(error),
      steps: 0,
      nodesVisited: 0,
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const runCount = parseInt(process.argv[2] ?? '50', 10)
console.log(`\n=== Run Simulation: ${runCount} runs ===\n`)

const results = []
let crashes = 0
let completions = 0
let victories = 0
let defeats = 0
let timeouts = 0
const startTime = performance.now()

for (let i = 1; i <= runCount; i++) {
  const result = simulateRun(i)
  results.push(result)

  if (result.error) {
    crashes++
    console.log(`  Run ${i}: CRASH — ${result.error}`)
  } else if (result.completed) {
    completions++
    if (result.endReason === RunEndReason.Victory) victories++
    else if (result.endReason === RunEndReason.HonorDepleted) defeats++
    else timeouts++
  }
}

const elapsed = performance.now() - startTime
const avgNodes = results.reduce((sum, r) => sum + r.nodesVisited, 0) / runCount

console.log(`\n--- Results ---`)
console.log(`  Total runs:      ${runCount}`)
console.log(`  Completed:       ${completions} (${(completions / runCount * 100).toFixed(1)}%)`)
console.log(`  Crashes:         ${crashes}`)
console.log(`  Victories:       ${victories}`)
console.log(`  Honor depleted:  ${defeats}`)
console.log(`  Timeouts:        ${timeouts}`)
console.log(`  Avg nodes:       ${avgNodes.toFixed(1)}`)
console.log(`  Total time:      ${elapsed.toFixed(0)}ms`)
console.log(`  Time per run:    ${(elapsed / runCount).toFixed(1)}ms`)
console.log()

// Exit with error code if any crashes
if (crashes > 0) {
  console.log(`❌ ${crashes} runs crashed!`)
  process.exit(1)
} else {
  console.log(`✅ All ${runCount} runs completed without crashes.`)
  const completionRate = completions / runCount * 100
  if (completionRate < 90) {
    console.log(`⚠️  Completion rate ${completionRate.toFixed(1)}% is below 90% target`)
  }
}
