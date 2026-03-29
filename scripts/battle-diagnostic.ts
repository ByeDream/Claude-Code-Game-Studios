/**
 * Battle diagnostic script — run from CLI to inspect actual battle behavior.
 * Usage: npx tsx scripts/battle-diagnostic.ts
 */

import { createHeroInstance } from '../src/gameplay/hero/heroFactory'
import { GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU } from '../src/gameplay/hero/testHeroes'
import { NamelessTemplateType } from '../src/gameplay/enemy/types'
import { createNamelessUnit } from '../src/gameplay/enemy/enemyFactory'
import { runBattle } from '../src/gameplay/battle/battleEngine'
import { BattleEventType, BattleOutcome } from '../src/gameplay/battle/battleEngineTypes'

function runDiagnostic(label: string, playerData: Parameters<typeof runBattle>[0], enemyData: Parameters<typeof runBattle>[1]) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${label}`)
  console.log('='.repeat(60))

  const result = runBattle(playerData, enemyData)

  // Print round-by-round summary
  let currentRound = 0
  for (const event of result.log) {
    if (event.type === BattleEventType.RoundStart) {
      currentRound = event.round
      console.log(`\n--- 第 ${currentRound} 回合 ---`)
    } else if (event.type === BattleEventType.Attack) {
      console.log(`  [普攻] ${event.message}`)
    } else if (event.type === BattleEventType.SkillUse) {
      console.log(`  [技能] ${event.message}`)
    } else if (event.type === BattleEventType.Damage && event.skillName) {
      console.log(`  [伤害] ${event.message}`)
    } else if (event.type === BattleEventType.Heal) {
      console.log(`  [治疗] ${event.message}`)
    } else if (event.type === BattleEventType.Death) {
      console.log(`  [击败] ${event.message}`)
    } else if (event.type === BattleEventType.BattleEnd) {
      console.log(`\n>>> ${event.message}`)
    }
  }

  console.log(`\n结果: ${result.outcome} | 回合数: ${result.totalRounds} | 我方存活: ${result.playerSurvivors} | 敌方存活: ${result.enemySurvivors}`)

  return result
}

// ---- Scenario 1: Normal battle (node 10 mixed enemies) ----
console.log('\n\n########## SCENARIO 1: 普通战斗 (node 10 混合敌军) ##########')
runDiagnostic(
  '5 A级英雄 vs 5 node10 混合敌军',
  [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h)),
  [
    createNamelessUnit(NamelessTemplateType.LegionLeader, 10, 0),
    createNamelessUnit(NamelessTemplateType.Lieutenant, 10, 1),
    createNamelessUnit(NamelessTemplateType.CavalryLeader, 10, 2),
    createNamelessUnit(NamelessTemplateType.Advisor, 10, 3),
    createNamelessUnit(NamelessTemplateType.LegionLeader, 10, 4),
  ]
)

// ---- Scenario 2: Hard battle (node 20) ----
console.log('\n\n########## SCENARIO 2: 强敌战斗 (node 22 军团长) ##########')
runDiagnostic(
  '5 A级英雄 vs 5 node22 军团长',
  [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h)),
  Array.from({ length: 5 }, (_, i) => createNamelessUnit(NamelessTemplateType.LegionLeader, 22, i))
)

// ---- Scenario 3: Run 20 normal battles, check outcome distribution ----
console.log('\n\n########## SCENARIO 3: 20场普通战斗统计 ##########')
let wins = 0, losses = 0, timeouts = 0
const roundCounts: number[] = []
const survivorCounts: number[] = []
for (let i = 0; i < 20; i++) {
  const r = runBattle(
    [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h)),
    [
      createNamelessUnit(NamelessTemplateType.LegionLeader, 10, 0),
      createNamelessUnit(NamelessTemplateType.Lieutenant, 10, 1),
      createNamelessUnit(NamelessTemplateType.CavalryLeader, 10, 2),
      createNamelessUnit(NamelessTemplateType.Advisor, 10, 3),
      createNamelessUnit(NamelessTemplateType.LegionLeader, 10, 4),
    ]
  )
  roundCounts.push(r.totalRounds)
  survivorCounts.push(r.playerSurvivors)
  if (r.outcome === BattleOutcome.PlayerWin) wins++
  else if (r.outcome === BattleOutcome.EnemyWin) losses++
  else timeouts++
}
console.log(`胜: ${wins} | 负: ${losses} | 超时: ${timeouts}`)
console.log(`回合数: min=${Math.min(...roundCounts)} max=${Math.max(...roundCounts)} avg=${(roundCounts.reduce((a,b)=>a+b,0)/roundCounts.length).toFixed(1)}`)
console.log(`存活: min=${Math.min(...survivorCounts)} max=${Math.max(...survivorCounts)} avg=${(survivorCounts.reduce((a,b)=>a+b,0)/survivorCounts.length).toFixed(1)}`)

// ---- Scenario 4: Run 20 hard battles ----
console.log('\n\n########## SCENARIO 4: 20场强敌战斗统计 ##########')
wins = 0; losses = 0; timeouts = 0
const hardRounds: number[] = []
const hardSurvivors: number[] = []
for (let i = 0; i < 20; i++) {
  const r = runBattle(
    [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h)),
    Array.from({ length: 5 }, (_, j) => createNamelessUnit(NamelessTemplateType.LegionLeader, 22, j))
  )
  hardRounds.push(r.totalRounds)
  hardSurvivors.push(r.playerSurvivors)
  if (r.outcome === BattleOutcome.PlayerWin) wins++
  else if (r.outcome === BattleOutcome.EnemyWin) losses++
  else timeouts++
}
console.log(`胜: ${wins} | 负: ${losses} | 超时: ${timeouts}`)
console.log(`回合数: min=${Math.min(...hardRounds)} max=${Math.max(...hardRounds)} avg=${(hardRounds.reduce((a,b)=>a+b,0)/hardRounds.length).toFixed(1)}`)
console.log(`存活: min=${Math.min(...hardSurvivors)} max=${Math.max(...hardSurvivors)} avg=${(hardSurvivors.reduce((a,b)=>a+b,0)/hardSurvivors.length).toFixed(1)}`)
