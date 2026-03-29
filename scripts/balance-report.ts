/**
 * Balance Report — Battle Simulation & Analysis
 *
 * Runs large-scale battle simulations to verify game balance:
 * - Win rates across different compositions
 * - Bond-active vs no-bond comparison
 * - Average rounds and survivor counts
 * - Per-hero damage contribution
 *
 * Usage: npx tsx scripts/balance-report.ts
 *
 * @module scripts/balance-report
 * @see design/gdd/battle-engine.md
 */

import { createHeroInstance } from '../src/gameplay/hero/heroFactory'
import { runBattle } from '../src/gameplay/battle/battleEngine'
import { BattleOutcome, BattleEventType } from '../src/gameplay/battle/battleEngineTypes'
import type { BattleResult } from '../src/gameplay/battle/battleEngineTypes'
import { StatType } from '../src/gameplay/hero/types'
import type { HeroInstance, HeroData } from '../src/gameplay/hero/types'
import type { NamelessUnit } from '../src/gameplay/enemy/types'
import {
  GUAN_YU,
  ZHANG_FEI,
  CAO_CAO,
  ZHOU_YU,
  LV_BU,
  TEST_HEROES,
} from '../src/gameplay/hero/testHeroes'
import {
  TEST_NAMELESS_NODE0,
  EARLY_ENCOUNTER,
  MID_ENCOUNTER,
} from '../src/gameplay/enemy/testEnemies'
import { createNamelessUnit } from '../src/gameplay/enemy/enemyFactory'
import { NamelessTemplateType } from '../src/gameplay/enemy/types'

// ---------------------------------------------------------------------------
// Seeded PRNG (simple LCG for reproducibility)
// ---------------------------------------------------------------------------

function createSeededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff
    return state / 0x7fffffff
  }
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

interface SimConfig {
  name: string
  playerHeroes: HeroData[]
  playerLevel: number
  enemies: Array<HeroData | NamelessUnit>
  trials: number
}

interface SimResult {
  name: string
  trials: number
  wins: number
  losses: number
  timeouts: number
  winRate: number
  avgRounds: number
  avgPlayerSurvivors: number
  avgEnemySurvivors: number
  perHeroDamage: Map<string, number>
}

function runSimulation(config: SimConfig): SimResult {
  let wins = 0
  let losses = 0
  let timeouts = 0
  let totalRounds = 0
  let totalPlayerSurvivors = 0
  let totalEnemySurvivors = 0
  const heroDamageTotal = new Map<string, number>()

  for (let i = 0; i < config.trials; i++) {
    const random = createSeededRandom(42 + i * 7919)
    const heroes: HeroInstance[] = config.playerHeroes.map(h =>
      createHeroInstance(h, config.playerLevel),
    )

    const result: BattleResult = runBattle(
      heroes,
      config.enemies,
      config.enemies.map((_, idx) => idx),
      random,
    )

    if (result.outcome === BattleOutcome.PlayerWin) wins++
    else if (result.outcome === BattleOutcome.EnemyWin) losses++
    else timeouts++

    totalRounds += result.totalRounds
    totalPlayerSurvivors += result.playerSurvivors
    totalEnemySurvivors += result.enemySurvivors

    // Track per-hero damage
    for (const event of result.log) {
      if (
        (event.type === BattleEventType.Damage || event.type === BattleEventType.Attack) &&
        event.value
      ) {
        const prev = heroDamageTotal.get(event.sourceId) ?? 0
        heroDamageTotal.set(event.sourceId, prev + event.value)
      }
    }
  }

  return {
    name: config.name,
    trials: config.trials,
    wins,
    losses,
    timeouts,
    winRate: wins / config.trials,
    avgRounds: totalRounds / config.trials,
    avgPlayerSurvivors: totalPlayerSurvivors / config.trials,
    avgEnemySurvivors: totalEnemySurvivors / config.trials,
    perHeroDamage: heroDamageTotal,
  }
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function printResult(r: SimResult): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${r.name}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Trials:              ${r.trials}`)
  console.log(`  Win / Loss / Timeout: ${r.wins} / ${r.losses} / ${r.timeouts}`)
  console.log(`  Win Rate:            ${formatPercent(r.winRate)}`)
  console.log(`  Avg Rounds:          ${r.avgRounds.toFixed(1)}`)
  console.log(`  Avg Player Survivors: ${r.avgPlayerSurvivors.toFixed(2)}`)
  console.log(`  Avg Enemy Survivors:  ${r.avgEnemySurvivors.toFixed(2)}`)

  if (r.perHeroDamage.size > 0) {
    console.log(`  --- Damage Distribution (total across all trials) ---`)
    const sorted = [...r.perHeroDamage.entries()].sort((a, b) => b[1] - a[1])
    const totalDmg = sorted.reduce((s, [, v]) => s + v, 0)
    for (const [id, dmg] of sorted.slice(0, 10)) {
      console.log(`    ${id.padEnd(20)} ${dmg.toFixed(0).padStart(8)}  (${formatPercent(dmg / totalDmg)})`)
    }
  }
}

// ---------------------------------------------------------------------------
// Define scenarios
// ---------------------------------------------------------------------------

const TRIALS = 200

// Scenario 1: Full Shu roster (Guan Yu + Zhang Fei) vs early enemies
const scenario1: SimConfig = {
  name: 'Shu Duo (Lv1) vs Early Encounter',
  playerHeroes: [GUAN_YU, ZHANG_FEI],
  playerLevel: 1,
  enemies: TEST_NAMELESS_NODE0,
  trials: TRIALS,
}

// Scenario 2: Full 5-hero roster vs early encounter
const scenario2: SimConfig = {
  name: 'Full Roster (Lv1) vs Early Encounter',
  playerHeroes: TEST_HEROES,
  playerLevel: 1,
  enemies: TEST_NAMELESS_NODE0,
  trials: TRIALS,
}

// Scenario 3: Full roster at level 5 vs early encounter
const scenario3: SimConfig = {
  name: 'Full Roster (Lv5) vs Early Encounter',
  playerHeroes: TEST_HEROES,
  playerLevel: 5,
  enemies: TEST_NAMELESS_NODE0,
  trials: TRIALS,
}

// Scenario 4: Full roster vs mid-game encounter (scaled enemies)
const midEnemies: Array<HeroData | NamelessUnit> = [
  createNamelessUnit(NamelessTemplateType.Soldier, 5, 0),
  createNamelessUnit(NamelessTemplateType.Soldier, 5, 1),
  createNamelessUnit(NamelessTemplateType.LegionLeader, 5, 0),
  createNamelessUnit(NamelessTemplateType.Lieutenant, 5, 0),
  createNamelessUnit(NamelessTemplateType.CavalryLeader, 5, 0),
]

const scenario4: SimConfig = {
  name: 'Full Roster (Lv1) vs Mid Encounter (node 5)',
  playerHeroes: TEST_HEROES,
  playerLevel: 1,
  enemies: midEnemies,
  trials: TRIALS,
}

// Scenario 5: Bond-active team (3 Shu: GY, ZF, CC) vs non-bond mixed team (no faction pair)
const bondTeam = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU] // 2 Shu = Shu bond
const noBondTeam = [CAO_CAO, ZHOU_YU, LV_BU] // 3 heroes from 3 factions = no faction bond

const scenario5a: SimConfig = {
  name: 'Bond Test: With Shu Bond (5 heroes) vs Early',
  playerHeroes: bondTeam,
  playerLevel: 1,
  enemies: TEST_NAMELESS_NODE0,
  trials: TRIALS,
}

const scenario5b: SimConfig = {
  name: 'Bond Test: No Bond (3 heroes) vs Early',
  playerHeroes: noBondTeam,
  playerLevel: 1,
  enemies: TEST_NAMELESS_NODE0,
  trials: TRIALS,
}

// Scenario 6: Level scaling comparison
const scenario6a: SimConfig = {
  name: 'Level Scaling: Lv1 vs Early',
  playerHeroes: [GUAN_YU, ZHANG_FEI, CAO_CAO],
  playerLevel: 1,
  enemies: TEST_NAMELESS_NODE0.slice(0, 3),
  trials: TRIALS,
}

const scenario6b: SimConfig = {
  name: 'Level Scaling: Lv5 vs Early',
  playerHeroes: [GUAN_YU, ZHANG_FEI, CAO_CAO],
  playerLevel: 5,
  enemies: TEST_NAMELESS_NODE0.slice(0, 3),
  trials: TRIALS,
}

const scenario6c: SimConfig = {
  name: 'Level Scaling: Lv10 vs Early',
  playerHeroes: [GUAN_YU, ZHANG_FEI, CAO_CAO],
  playerLevel: 10,
  enemies: TEST_NAMELESS_NODE0.slice(0, 3),
  trials: TRIALS,
}

// ---------------------------------------------------------------------------
// Run all scenarios
// ---------------------------------------------------------------------------

console.log('\n╔══════════════════════════════════════════════════════════════╗')
console.log('║            BALANCE REPORT — Battle Simulation               ║')
console.log('║            200 trials per scenario (seeded RNG)             ║')
console.log('╚══════════════════════════════════════════════════════════════╝')

const allResults: SimResult[] = []

const scenarios = [
  scenario1, scenario2, scenario3, scenario4,
  scenario5a, scenario5b,
  scenario6a, scenario6b, scenario6c,
]

for (const s of scenarios) {
  const result = runSimulation(s)
  allResults.push(result)
  printResult(result)
}

// ---------------------------------------------------------------------------
// Bond comparison summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60))
console.log('  BOND COMPARISON')
console.log('='.repeat(60))
const bondA = allResults.find(r => r.name.includes('With Shu Bond'))!
const bondB = allResults.find(r => r.name.includes('No Bond'))!
console.log(`  With Shu Bond win rate: ${formatPercent(bondA.winRate)}  (${bondA.wins}/${bondA.trials})`)
console.log(`  No Bond win rate:      ${formatPercent(bondB.winRate)}  (${bondB.wins}/${bondB.trials})`)
console.log(`  Delta:                 ${formatPercent(bondA.winRate - bondB.winRate)}`)

// ---------------------------------------------------------------------------
// Level scaling summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60))
console.log('  LEVEL SCALING COMPARISON')
console.log('='.repeat(60))
const lv1 = allResults.find(r => r.name.includes('Lv1') && r.name.includes('Level Scaling'))!
const lv5 = allResults.find(r => r.name.includes('Lv5') && r.name.includes('Level Scaling'))!
const lv10 = allResults.find(r => r.name.includes('Lv10'))!
console.log(`  Lv1  win rate:  ${formatPercent(lv1.winRate)}   avg rounds: ${lv1.avgRounds.toFixed(1)}   avg survivors: ${lv1.avgPlayerSurvivors.toFixed(2)}`)
console.log(`  Lv5  win rate:  ${formatPercent(lv5.winRate)}   avg rounds: ${lv5.avgRounds.toFixed(1)}   avg survivors: ${lv5.avgPlayerSurvivors.toFixed(2)}`)
console.log(`  Lv10 win rate:  ${formatPercent(lv10.winRate)}   avg rounds: ${lv10.avgRounds.toFixed(1)}   avg survivors: ${lv10.avgPlayerSurvivors.toFixed(2)}`)

// ---------------------------------------------------------------------------
// Overall health check
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60))
console.log('  BALANCE HEALTH CHECK')
console.log('='.repeat(60))

const checks: Array<[string, boolean, string]> = [
  [
    'Full roster vs early: win rate > 50%',
    allResults.find(r => r.name.includes('Full Roster (Lv1)'))!.winRate > 0.5,
    `${formatPercent(allResults.find(r => r.name.includes('Full Roster (Lv1)'))!.winRate)}`,
  ],
  [
    'Lv5 team beats early more than Lv1',
    lv5.winRate >= lv1.winRate,
    `Lv1=${formatPercent(lv1.winRate)}, Lv5=${formatPercent(lv5.winRate)}`,
  ],
  [
    'Lv10 team beats early more than Lv5',
    lv10.winRate >= lv5.winRate,
    `Lv5=${formatPercent(lv5.winRate)}, Lv10=${formatPercent(lv10.winRate)}`,
  ],
  [
    'No scenario has 100% timeout rate',
    allResults.every(r => r.timeouts < r.trials),
    allResults.map(r => `${r.name.slice(0, 20)}: ${r.timeouts} timeouts`).join('; '),
  ],
  [
    'Average rounds > 1 (battles have substance)',
    allResults.every(r => r.avgRounds > 1),
    allResults.map(r => r.avgRounds.toFixed(1)).join(', '),
  ],
]

let allPass = true
for (const [check, passed, detail] of checks) {
  const icon = passed ? '✅' : '❌'
  console.log(`  ${icon} ${check}`)
  console.log(`     → ${detail}`)
  if (!passed) allPass = false
}

console.log(`\n  ${allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`)
console.log('')
