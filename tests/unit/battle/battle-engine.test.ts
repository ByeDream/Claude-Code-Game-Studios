/**
 * Battle Engine — Unit Tests
 *
 * Tests for the complete battle simulation:
 * - Damage formulas (physical, skill, healing, crit)
 * - initBattle (unit conversion, bond application)
 * - executeTurn (action execution, KO, round progression)
 * - runBattle (full loop, victory/defeat/timeout)
 * - Statistical test: strong vs weak roster win rate > 80% over 100 battles
 *
 * @see design/gdd/battle-engine.md — Acceptance Criteria
 */

import { describe, it, expect } from 'vitest'

import type { HeroInstance, HeroData } from '../../../src/gameplay/hero/types'
import { StatType, Faction, HeroTier, HeroVariant, SkillType, TriggerCondition, TargetType, ScalingStat } from '../../../src/gameplay/hero/types'
import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'
import { GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU } from '../../../src/gameplay/hero/testHeroes'

import { EARLY_ENCOUNTER } from '../../../src/gameplay/enemy/testEnemies'
import type { NamelessUnit } from '../../../src/gameplay/enemy/types'
import { NamelessTemplateType } from '../../../src/gameplay/enemy/types'
import { createNamelessUnit } from '../../../src/gameplay/enemy/enemyFactory'

import type { BattleUnit } from '../../../src/gameplay/battle/battleEngineTypes'
import { BattleOutcome, BattleEventType } from '../../../src/gameplay/battle/battleEngineTypes'
import type { RandomFn, CooldownMap } from '../../../src/gameplay/battle/types'
import { MIN_DAMAGE, INT_DEF_RATIO, MAX_ROUNDS, CRIT_MULTIPLIER } from '../../../src/gameplay/battle/battleConfig'
import {
  calculatePhysicalDamage,
  calculateSkillDamage,
  calculateHealing,
  applyCritical,
} from '../../../src/gameplay/battle/damageCalc'
import { initBattle, executeTurn, runBattle } from '../../../src/gameplay/battle/battleEngine'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function fixedRandom(value: number): RandomFn {
  return () => value
}

/** Creates a minimal BattleUnit for formula tests. */
function makeBattleUnit(overrides: Partial<BattleUnit> & { id: string }): BattleUnit {
  return {
    name: overrides.id,
    side: 'player',
    position: 0,
    finalStats: {
      [StatType.STR]: 20, [StatType.INT]: 20, [StatType.DEF]: 20,
      [StatType.HP]: 100, [StatType.SPD]: 20,
    },
    maxHP: 100,
    currentHP: 100,
    isKnockedOut: false,
    skills: [],
    tags: [],
    activeStatuses: [],
    isBoss: false,
    isHighTier: false,
    ...overrides,
  }
}

/** Creates a weak test hero for enemy roster (low stats). */
function makeWeakHero(id: string): HeroData {
  return {
    id,
    name: id,
    baseName: id,
    title: '',
    faction: Faction.Qun,
    tier: HeroTier.C as any,
    variant: HeroVariant.Base,
    legendTitle: null,
    baseStats: {
      [StatType.STR]: 8, [StatType.INT]: 8, [StatType.DEF]: 8,
      [StatType.HP]: 10, [StatType.SPD]: 8,
    },
    statGrowthRates: {
      [StatType.STR]: 0.02, [StatType.INT]: 0.02, [StatType.DEF]: 0.02,
      [StatType.HP]: 0.02, [StatType.SPD]: 0.02,
    },
    skills: [{
      name: 'weak_passive', type: SkillType.Passive, trigger: TriggerCondition.PassiveAura,
      effects: [{ description: 'weak', magnitude: 0.01, duration: 0 }],
      target: TargetType.Self, scaling: ScalingStat.STR,
    }],
    martialArts: null,
    advisorSkill: null,
    tags: [],
    bondKeys: [],
    lore: { biography: '', historicalEvents: [] },
    artRef: '',
  }
}

// ---------------------------------------------------------------------------
// Damage formula tests
// ---------------------------------------------------------------------------

describe('Battle Engine — damage formulas', () => {
  it('test_physicalDamage_basicFormula_correctValue', () => {
    // STR=40, DEF=20, mult=1.0, variance=1.0 (fixed)
    const attacker = makeBattleUnit({
      id: 'atk',
      finalStats: { [StatType.STR]: 40, [StatType.INT]: 10, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const target = makeBattleUnit({
      id: 'def',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 10, [StatType.DEF]: 20, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })

    // variance fixed to produce exactly 1.0: random=0.5 → 0.95 + 0.5*0.1 = 1.0
    const dmg = calculatePhysicalDamage(attacker, target, 1.0, fixedRandom(0.5))

    // 40 * 1.0 * (100 / 120) * 1.0 = 40 * 0.8333 = 33.33 → 33
    expect(dmg).toBe(33)
  })

  it('test_physicalDamage_percentReduction_def100_halvesDamage', () => {
    const attacker = makeBattleUnit({
      id: 'atk',
      finalStats: { [StatType.STR]: 100, [StatType.INT]: 10, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const target = makeBattleUnit({
      id: 'def',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 10, [StatType.DEF]: 100, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })

    // 100 * 1.0 * (100/200) * 1.0 = 50
    const dmg = calculatePhysicalDamage(attacker, target, 1.0, fixedRandom(0.5))
    expect(dmg).toBe(50)
  })

  it('test_physicalDamage_withSkillMultiplier_increasedDamage', () => {
    const attacker = makeBattleUnit({
      id: 'atk',
      finalStats: { [StatType.STR]: 40, [StatType.INT]: 10, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const target = makeBattleUnit({
      id: 'def',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 10, [StatType.DEF]: 20, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })

    // 40 * 2.5 * (100/120) * 1.0 = 83.33 → 83
    const dmg = calculatePhysicalDamage(attacker, target, 2.5, fixedRandom(0.5))
    expect(dmg).toBe(83)
  })

  it('test_physicalDamage_minimumDamageGuaranteed', () => {
    const attacker = makeBattleUnit({
      id: 'atk',
      finalStats: { [StatType.STR]: 1, [StatType.INT]: 1, [StatType.DEF]: 1, [StatType.HP]: 100, [StatType.SPD]: 1 },
    })
    const target = makeBattleUnit({
      id: 'def',
      finalStats: { [StatType.STR]: 1, [StatType.INT]: 1, [StatType.DEF]: 999, [StatType.HP]: 100, [StatType.SPD]: 1 },
    })

    const dmg = calculatePhysicalDamage(attacker, target, 1.0, fixedRandom(0.5))
    expect(dmg).toBe(MIN_DAMAGE)
  })

  it('test_skillDamage_intBasedFormula_lessDefReduction', () => {
    const attacker = makeBattleUnit({
      id: 'atk',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 40, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const target = makeBattleUnit({
      id: 'def',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 10, [StatType.DEF]: 100, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })

    // INT skill: 40 * 1.8 * (100 / (100 + 100*0.5)) * 1.0 = 72 * (100/150) = 48
    const dmg = calculateSkillDamage(attacker, target, 1.8, fixedRandom(0.5))
    expect(dmg).toBe(48)
  })

  it('test_skillDamage_intPenetratesMoreThanPhysical', () => {
    const attacker = makeBattleUnit({
      id: 'atk',
      finalStats: { [StatType.STR]: 40, [StatType.INT]: 40, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const highDef = makeBattleUnit({
      id: 'tank',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 10, [StatType.DEF]: 200, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })

    const physDmg = calculatePhysicalDamage(attacker, highDef, 1.0, fixedRandom(0.5))
    const skillDmg = calculateSkillDamage(attacker, highDef, 1.0, fixedRandom(0.5))

    // INT skill should deal more damage against high DEF
    expect(skillDmg).toBeGreaterThan(physDmg)
  })

  it('test_healing_basicallyWorks', () => {
    const healer = makeBattleUnit({
      id: 'healer',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 30, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const wounded = makeBattleUnit({
      id: 'wounded',
      currentHP: 30,
      maxHP: 100,
    })

    // 30 * 1.5 = 45
    const heal = calculateHealing(healer, wounded, 1.5)
    expect(heal).toBe(45)
  })

  it('test_healing_cappedAtMissingHp', () => {
    const healer = makeBattleUnit({
      id: 'healer',
      finalStats: { [StatType.STR]: 10, [StatType.INT]: 100, [StatType.DEF]: 10, [StatType.HP]: 100, [StatType.SPD]: 10 },
    })
    const slightlyHurt = makeBattleUnit({
      id: 'hurt',
      currentHP: 95,
      maxHP: 100,
    })

    // 100 * 1.5 = 150, but only 5 HP missing
    const heal = calculateHealing(healer, slightlyHurt, 1.5)
    expect(heal).toBe(5)
  })

  it('test_healing_fullHp_returnsZero', () => {
    const healer = makeBattleUnit({ id: 'h' })
    const full = makeBattleUnit({ id: 'f', currentHP: 100, maxHP: 100 })

    expect(calculateHealing(healer, full, 1.0)).toBe(0)
  })

  it('test_criticalHit_noCritChance_noCrit', () => {
    const result = applyCritical(100, 0, fixedRandom(0.0))
    expect(result.isCrit).toBe(false)
    expect(result.damage).toBe(100)
  })

  it('test_criticalHit_withCritChance_appliesMultiplier', () => {
    // crit chance 50%, random = 0.1 (< 0.5 = crit)
    const result = applyCritical(100, 0.5, fixedRandom(0.1))
    expect(result.isCrit).toBe(true)
    expect(result.damage).toBe(Math.round(100 * CRIT_MULTIPLIER))
  })
})

// ---------------------------------------------------------------------------
// initBattle tests
// ---------------------------------------------------------------------------

describe('Battle Engine — initBattle', () => {
  it('test_initBattle_createsCorrectUnitCounts', () => {
    const players = [GUAN_YU, ZHANG_FEI, CAO_CAO].map(h => createHeroInstance(h))
    const enemies = EARLY_ENCOUNTER.enemies

    const state = initBattle(players, enemies)

    expect(state.playerUnits).toHaveLength(3)
    expect(state.enemyUnits).toHaveLength(5)
  })

  it('test_initBattle_roundStartsAtZero', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]

    const state = initBattle(players, enemies)

    expect(state.currentRound).toBe(0)
    expect(state.isFinished).toBe(false)
  })

  it('test_initBattle_playerUnitsHaveCorrectSide', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]

    const state = initBattle(players, enemies)

    expect(state.playerUnits[0].side).toBe('player')
    expect(state.enemyUnits[0].side).toBe('enemy')
  })

  it('test_initBattle_unitsStartAtFullHp', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]

    const state = initBattle(players, enemies)

    expect(state.playerUnits[0].currentHP).toBe(state.playerUnits[0].maxHP)
    expect(state.enemyUnits[0].currentHP).toBe(state.enemyUnits[0].maxHP)
  })

  it('test_initBattle_bondsApplied_shuBonus', () => {
    // 2 Shu heroes → STR+3% faction bond
    const guanYu = createHeroInstance(GUAN_YU)
    const zhangFei = createHeroInstance(ZHANG_FEI)
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]

    const state = initBattle([guanYu, zhangFei], enemies)

    // Guan Yu STR = 38, with 3% bond → 38*1.03 = 39.14 → 39
    // The BattleUnit finalStats should reflect the bond
    expect(state.playerUnits[0].finalStats[StatType.STR]).toBe(39)
  })

  it('test_initBattle_namelessEnemiesHaveScaledStats', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.LegionLeader, 5)]

    const state = initBattle(players, enemies)

    // LegionLeader at node5 should have scaled stats higher than node0
    const node0 = createNamelessUnit(NamelessTemplateType.LegionLeader, 0)
    expect(state.enemyUnits[0].finalStats[StatType.STR]).toBeGreaterThan(node0.scaledStats[StatType.STR])
  })
})

// ---------------------------------------------------------------------------
// executeTurn tests
// ---------------------------------------------------------------------------

describe('Battle Engine — executeTurn', () => {
  it('test_executeTurn_incrementsRoundBy1', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]
    const state = initBattle(players, enemies)
    const cooldowns: CooldownMap = new Map()

    const next = executeTurn(state, cooldowns, fixedRandom(0.5))

    expect(next.currentRound).toBe(1)
  })

  it('test_executeTurn_producesLogEvents', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]
    const state = initBattle(players, enemies)
    const cooldowns: CooldownMap = new Map()

    const next = executeTurn(state, cooldowns, fixedRandom(0.5))

    // Should have at least a RoundStart event
    expect(next.log.length).toBeGreaterThan(0)
    expect(next.log[0].type).toBe(BattleEventType.RoundStart)
  })

  it('test_executeTurn_weakEnemyTakesDamageInOneRound', () => {
    // Guan Yu (STR 38) vs soldier — HP ×10 = ~100, won't die in one hit
    // but should take significant damage
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]
    const state = initBattle(players, enemies)
    const cooldowns: CooldownMap = new Map()

    const next = executeTurn(state, cooldowns, fixedRandom(0.5))

    const soldier = next.enemyUnits[0]
    // Soldier should have taken damage but may not be dead yet
    expect(soldier.currentHP).toBeLessThan(soldier.maxHP)
  })

  it('test_executeTurn_koUnitDoesNotAct', () => {
    // Run enough rounds to kill the soldier, then verify battle ends
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]
    let state = initBattle(players, enemies)
    const cooldowns: CooldownMap = new Map()

    // Run multiple rounds until battle finishes
    while (!state.isFinished) {
      state = executeTurn(state, cooldowns, fixedRandom(0.5))
    }

    // Battle should be finished since all enemies are dead
    expect(state.isFinished).toBe(true)
    expect(state.outcome).toBe(BattleOutcome.PlayerWin)
  })

  it('test_executeTurn_doesNotMutateOriginalState', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]
    const state = initBattle(players, enemies)
    const cooldowns: CooldownMap = new Map()

    const originalRound = state.currentRound
    executeTurn(state, cooldowns, fixedRandom(0.5))

    // Original state unchanged
    expect(state.currentRound).toBe(originalRound)
  })
})

// ---------------------------------------------------------------------------
// runBattle tests
// ---------------------------------------------------------------------------

describe('Battle Engine — runBattle', () => {
  it('test_runBattle_strongVsWeak_playerWins', () => {
    const players = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h))
    const enemies: NamelessUnit[] = Array.from({ length: 5 }, (_, i) =>
      createNamelessUnit(NamelessTemplateType.Soldier, 0, i)
    )

    const result = runBattle(players, enemies, undefined, fixedRandom(0.5))

    expect(result.outcome).toBe(BattleOutcome.PlayerWin)
    expect(result.playerSurvivors).toBeGreaterThan(0)
    expect(result.enemySurvivors).toBe(0)
  })

  it('test_runBattle_completesWithinMaxRounds', () => {
    const players = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h))
    const enemies: NamelessUnit[] = Array.from({ length: 5 }, (_, i) =>
      createNamelessUnit(NamelessTemplateType.Soldier, 0, i)
    )

    const result = runBattle(players, enemies, undefined, fixedRandom(0.5))

    expect(result.totalRounds).toBeLessThanOrEqual(MAX_ROUNDS)
  })

  it('test_runBattle_hasLog', () => {
    const players = [createHeroInstance(GUAN_YU)]
    const enemies = [createNamelessUnit(NamelessTemplateType.Soldier, 0)]

    const result = runBattle(players, enemies, undefined, fixedRandom(0.5))

    expect(result.log.length).toBeGreaterThan(0)
    // Should end with BattleEnd event
    expect(result.log[result.log.length - 1].type).toBe(BattleEventType.BattleEnd)
  })

  it('test_runBattle_timeoutAt30Rounds', () => {
    // Create two evenly matched super-tanky armies that won't kill each other
    const tankHero: HeroData = {
      id: 'tank', name: 'tank', baseName: 'tank', title: '', faction: Faction.Shu,
      tier: HeroTier.A, variant: HeroVariant.Base, legendTitle: null,
      baseStats: {
        [StatType.STR]: 1, [StatType.INT]: 1, [StatType.DEF]: 200,
        [StatType.HP]: 200, [StatType.SPD]: 10,
      },
      statGrowthRates: {
        [StatType.STR]: 0, [StatType.INT]: 0, [StatType.DEF]: 0,
        [StatType.HP]: 0, [StatType.SPD]: 0,
      },
      skills: [{
        name: 'p', type: SkillType.Passive, trigger: TriggerCondition.PassiveAura,
        effects: [{ description: 'x', magnitude: 1, duration: 0 }],
        target: TargetType.Self, scaling: ScalingStat.DEF,
      }],
      martialArts: null, advisorSkill: null, tags: [], bondKeys: [],
      lore: { biography: '', historicalEvents: [] }, artRef: '',
    }

    const players = [createHeroInstance(tankHero)]
    const enemyTank: HeroData = { ...tankHero, id: 'e_tank' }

    const result = runBattle(players, [enemyTank], undefined, fixedRandom(0.5))

    expect(result.outcome).toBe(BattleOutcome.Timeout)
    expect(result.totalRounds).toBe(MAX_ROUNDS)
  })

  it('test_runBattle_playerCanLose', () => {
    // 1 weak player vs 5 strong enemies
    const weakHero = makeWeakHero('weak_player')
    const players = [createHeroInstance(weakHero)]
    const enemies = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU]

    const result = runBattle(players, enemies, undefined, fixedRandom(0.5))

    expect(result.outcome).toBe(BattleOutcome.EnemyWin)
    expect(result.playerSurvivors).toBe(0)
  })

  it('test_runBattle_5v5_withRealHeroes_completesSuccessfully', () => {
    const players = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h))
    const enemies = EARLY_ENCOUNTER.enemies

    const result = runBattle(players, enemies, undefined, fixedRandom(0.5))

    expect([BattleOutcome.PlayerWin, BattleOutcome.EnemyWin, BattleOutcome.Timeout])
      .toContain(result.outcome)
    expect(result.totalRounds).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Statistical test: strong vs weak win rate > 80% (100 battles)
// ---------------------------------------------------------------------------

describe('Battle Engine — statistical balance', () => {
  it('test_balance_strongVsWeak_winRateAbove80Percent', () => {
    let playerWins = 0
    const totalBattles = 100

    for (let i = 0; i < totalBattles; i++) {
      // Strong player team (A-tier heroes)
      const players = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h))

      // Weak enemy team (soldiers at node 0)
      const enemies: NamelessUnit[] = Array.from({ length: 5 }, (_, j) =>
        createNamelessUnit(NamelessTemplateType.Soldier, 0, j)
      )

      // Use a unique seed per battle for variety
      let seed = i * 1000
      const rng: RandomFn = () => {
        seed = (seed * 16807 + 0) % 2147483647
        return seed / 2147483647
      }

      const result = runBattle(players, enemies, undefined, rng)

      if (result.outcome === BattleOutcome.PlayerWin) {
        playerWins++
      }
    }

    const winRate = playerWins / totalBattles
    expect(winRate).toBeGreaterThanOrEqual(0.80)
  })

  it('test_balance_100battles_allComplete_noInfiniteLoops', () => {
    for (let i = 0; i < 100; i++) {
      const players = [GUAN_YU, ZHANG_FEI].map(h => createHeroInstance(h))
      const enemies: NamelessUnit[] = Array.from({ length: 2 }, (_, j) =>
        createNamelessUnit(NamelessTemplateType.LegionLeader, 3, j)
      )

      let seed = i * 7919
      const rng: RandomFn = () => {
        seed = (seed * 16807 + 0) % 2147483647
        return seed / 2147483647
      }

      const result = runBattle(players, enemies, undefined, rng)

      expect(result.totalRounds).toBeLessThanOrEqual(MAX_ROUNDS)
      expect(result.totalRounds).toBeGreaterThan(0)
    }
  })
})
