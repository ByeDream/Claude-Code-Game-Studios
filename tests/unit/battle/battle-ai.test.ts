/**
 * Battle AI — Unit Tests
 *
 * Comprehensive tests for the Battle AI covering:
 * - Target selection: all strategies (random, lowest_hp, highest_threat, etc.)
 * - Skill classification (heal / control / damage)
 * - Skill release priority (heal > control > damage)
 * - Cooldown management
 * - Action order generation (SPD sorting, tiebreaking)
 * - AI decision integration
 * - Edge cases: empty teams, single enemy, all same SPD
 *
 * @see design/gdd/battle-ai.md — Acceptance Criteria
 */

import { describe, it, expect } from 'vitest'

import type { HeroData, HeroInstance, Skill } from '../../../src/gameplay/hero/types'
import {
  Faction, StatType, HeroTier, HeroVariant,
  SkillType, TriggerCondition, TargetType, ScalingStat,
} from '../../../src/gameplay/hero/types'
import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'
import { calculateFinalStat } from '../../../src/gameplay/hero/statCalculation'
import { GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU } from '../../../src/gameplay/hero/testHeroes'

import {
  TargetStrategy, SkillCategory, ActionType,
} from '../../../src/gameplay/battle/types'
import type { CooldownMap, RandomFn } from '../../../src/gameplay/battle/types'
import {
  selectTarget,
  mapTargetTypeToStrategy,
  classifySkill,
  decideAction,
  generateActionOrder,
  filterAliveActions,
  isSkillReady,
  putOnCooldown,
  tickCooldowns,
  cooldownKey,
} from '../../../src/gameplay/battle/battleAI'
import { HEAL_THRESHOLD } from '../../../src/gameplay/battle/battleConfig'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Creates a deterministic RNG that returns values from a sequence. */
function makeSeededRandom(values: number[]): RandomFn {
  let i = 0
  return () => {
    const val = values[i % values.length]
    i++
    return val
  }
}

/** Creates a fixed RNG that always returns the same value. */
function fixedRandom(value: number): RandomFn {
  return () => value
}

/** Minimal hero data factory for test-only heroes. */
function makeTestHero(overrides: Partial<HeroData> & { id: string; baseName: string; faction: Faction }): HeroData {
  return {
    name: overrides.id,
    title: '',
    tier: HeroTier.A,
    variant: HeroVariant.Base,
    legendTitle: null,
    baseStats: {
      [StatType.STR]: 20, [StatType.INT]: 20, [StatType.DEF]: 20,
      [StatType.HP]: 20, [StatType.SPD]: 20,
    },
    statGrowthRates: {
      [StatType.STR]: 0.05, [StatType.INT]: 0.05, [StatType.DEF]: 0.05,
      [StatType.HP]: 0.05, [StatType.SPD]: 0.05,
    },
    skills: [{
      name: 'test_passive', type: SkillType.Passive, trigger: TriggerCondition.PassiveAura,
      effects: [{ description: 'test', magnitude: 1, duration: 0 }],
      target: TargetType.Self, scaling: ScalingStat.STR,
    }],
    martialArts: null,
    advisorSkill: null,
    tags: [],
    bondKeys: [],
    lore: { biography: '', historicalEvents: [] },
    artRef: '',
    ...overrides,
  }
}

/** Creates a hero with a specific SPD for action order tests. */
function makeHeroWithSpd(id: string, spd: number): HeroData {
  return makeTestHero({
    id,
    baseName: id,
    faction: Faction.Shu,
    baseStats: {
      [StatType.STR]: 20, [StatType.INT]: 20, [StatType.DEF]: 20,
      [StatType.HP]: 20, [StatType.SPD]: spd,
    },
  })
}

/** Creates a hero with specific skills for AI decision tests. */
function makeHeroWithSkills(id: string, skills: Skill[]): HeroData {
  return makeTestHero({
    id,
    baseName: id,
    faction: Faction.Shu,
    skills,
  })
}

// Common skill fixtures
const DAMAGE_SKILL: Skill = {
  name: '烈焰斩', type: SkillType.Active, trigger: TriggerCondition.OnNthAttack,
  effects: [{ description: 'damage', magnitude: 2.5, duration: 0 }],
  target: TargetType.SingleEnemy, scaling: ScalingStat.STR, cooldown: 3,
}

const HEAL_SKILL: Skill = {
  name: '治愈术', type: SkillType.Active, trigger: TriggerCondition.OnTurnStart,
  effects: [{ description: 'heal', magnitude: 1.5, duration: 0 }],
  target: TargetType.SingleAlly, scaling: ScalingStat.INT, cooldown: 3,
}

const CONTROL_SKILL: Skill = {
  name: '眩晕', type: SkillType.Active, trigger: TriggerCondition.OnAttack,
  effects: [{ description: 'stun', magnitude: 1.0, duration: 2 }],
  target: TargetType.SingleEnemy, scaling: ScalingStat.INT, cooldown: 4,
}

const AOE_DAMAGE_SKILL: Skill = {
  name: '火烧连营', type: SkillType.Active, trigger: TriggerCondition.OnTurnEnd,
  effects: [{ description: 'aoe damage', magnitude: 1.8, duration: 0 }],
  target: TargetType.AllEnemies, scaling: ScalingStat.INT, cooldown: 4,
}

const PASSIVE_SKILL: Skill = {
  name: '光环', type: SkillType.Passive, trigger: TriggerCondition.PassiveAura,
  effects: [{ description: 'aura', magnitude: 0.05, duration: 0 }],
  target: TargetType.AllAllies, scaling: ScalingStat.INT,
}

// ---------------------------------------------------------------------------
// Target selection tests
// ---------------------------------------------------------------------------

describe('Battle AI — target selection', () => {
  it('test_selectTarget_random_returnsOneEnemyId', () => {
    const self = createHeroInstance(GUAN_YU)
    const enemies = [createHeroInstance(CAO_CAO), createHeroInstance(ZHOU_YU)]

    const result = selectTarget(TargetStrategy.Random, self, [self], enemies, fixedRandom(0.0))
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('cao_cao')  // index 0
  })

  it('test_selectTarget_random_differentRandomPicksDifferentTargets', () => {
    const self = createHeroInstance(GUAN_YU)
    const enemies = [createHeroInstance(CAO_CAO), createHeroInstance(ZHOU_YU)]

    const r1 = selectTarget(TargetStrategy.Random, self, [self], enemies, fixedRandom(0.0))
    const r2 = selectTarget(TargetStrategy.Random, self, [self], enemies, fixedRandom(0.9))

    expect(r1[0]).toBe('cao_cao')
    expect(r2[0]).toBe('zhou_yu')
  })

  it('test_selectTarget_lowestHp_picksLowestCurrentHp', () => {
    const self = createHeroInstance(GUAN_YU)
    const enemy1 = createHeroInstance(CAO_CAO)
    const enemy2 = createHeroInstance(ZHOU_YU)
    enemy1.currentHP = 100
    enemy2.currentHP = 10  // lowest

    const result = selectTarget(TargetStrategy.LowestHp, self, [self], [enemy1, enemy2])
    expect(result[0]).toBe('zhou_yu')
  })

  it('test_selectTarget_lowestHp_tieBreaksStably', () => {
    const self = createHeroInstance(GUAN_YU)
    const enemy1 = createHeroInstance(CAO_CAO)
    const enemy2 = createHeroInstance(ZHOU_YU)
    enemy1.currentHP = 10
    enemy2.currentHP = 10

    // Should pick first occurrence
    const result = selectTarget(TargetStrategy.LowestHp, self, [self], [enemy1, enemy2])
    expect(result[0]).toBe('cao_cao')
  })

  it('test_selectTarget_highestThreat_picksHighestStrOrInt', () => {
    const self = createHeroInstance(GUAN_YU)
    // LV_BU has STR=40 (highest), ZHOU_YU has INT=38
    const enemies = [createHeroInstance(CAO_CAO), createHeroInstance(LV_BU), createHeroInstance(ZHOU_YU)]

    const result = selectTarget(TargetStrategy.HighestThreat, self, [self], enemies)
    expect(result[0]).toBe('lv_bu')  // STR 40 > ZHOU_YU INT 38
  })

  it('test_selectTarget_self_returnsSelfId', () => {
    const self = createHeroInstance(GUAN_YU)
    const enemies = [createHeroInstance(CAO_CAO)]

    const result = selectTarget(TargetStrategy.Self, self, [self], enemies)
    expect(result).toEqual(['guan_yu'])
  })

  it('test_selectTarget_lowestHpAlly_picksLowestAlly', () => {
    const ally1 = createHeroInstance(GUAN_YU)
    const ally2 = createHeroInstance(ZHANG_FEI)
    ally1.currentHP = 50
    ally2.currentHP = 10  // lowest

    const result = selectTarget(TargetStrategy.LowestHpAlly, ally1, [ally1, ally2], [])
    expect(result[0]).toBe('zhang_fei')
  })

  it('test_selectTarget_allEnemies_returnsAllIds', () => {
    const self = createHeroInstance(GUAN_YU)
    const enemies = [createHeroInstance(CAO_CAO), createHeroInstance(ZHOU_YU), createHeroInstance(LV_BU)]

    const result = selectTarget(TargetStrategy.AllEnemies, self, [self], enemies)
    expect(result).toEqual(['cao_cao', 'zhou_yu', 'lv_bu'])
  })

  it('test_selectTarget_allAllies_returnsAllAllyIds', () => {
    const ally1 = createHeroInstance(GUAN_YU)
    const ally2 = createHeroInstance(ZHANG_FEI)

    const result = selectTarget(TargetStrategy.AllAllies, ally1, [ally1, ally2], [])
    expect(result).toEqual(['guan_yu', 'zhang_fei'])
  })
})

// ---------------------------------------------------------------------------
// TargetType → TargetStrategy mapping
// ---------------------------------------------------------------------------

describe('Battle AI — mapTargetTypeToStrategy', () => {
  it('test_map_self_toSelfStrategy', () => {
    expect(mapTargetTypeToStrategy(TargetType.Self)).toBe(TargetStrategy.Self)
  })

  it('test_map_singleEnemy_toRandom', () => {
    expect(mapTargetTypeToStrategy(TargetType.SingleEnemy)).toBe(TargetStrategy.Random)
  })

  it('test_map_allEnemies_toAllEnemies', () => {
    expect(mapTargetTypeToStrategy(TargetType.AllEnemies)).toBe(TargetStrategy.AllEnemies)
  })

  it('test_map_singleAlly_toLowestHpAlly', () => {
    expect(mapTargetTypeToStrategy(TargetType.SingleAlly)).toBe(TargetStrategy.LowestHpAlly)
  })

  it('test_map_allAllies_toAllAllies', () => {
    expect(mapTargetTypeToStrategy(TargetType.AllAllies)).toBe(TargetStrategy.AllAllies)
  })

  it('test_map_aoeArea_toRandom', () => {
    expect(mapTargetTypeToStrategy(TargetType.AoeArea)).toBe(TargetStrategy.Random)
  })
})

// ---------------------------------------------------------------------------
// Skill classification
// ---------------------------------------------------------------------------

describe('Battle AI — skill classification', () => {
  it('test_classifySkill_healSkill_returnsHeal', () => {
    expect(classifySkill(HEAL_SKILL)).toBe(SkillCategory.Heal)
  })

  it('test_classifySkill_controlSkill_returnsControl', () => {
    expect(classifySkill(CONTROL_SKILL)).toBe(SkillCategory.Control)
  })

  it('test_classifySkill_damageSkill_returnsDamage', () => {
    expect(classifySkill(DAMAGE_SKILL)).toBe(SkillCategory.Damage)
  })

  it('test_classifySkill_aoeDamage_returnsDamage', () => {
    expect(classifySkill(AOE_DAMAGE_SKILL)).toBe(SkillCategory.Damage)
  })

  it('test_classifySkill_groupBuff_returnsHeal', () => {
    const groupBuff: Skill = {
      ...HEAL_SKILL,
      name: '群体buff',
      target: TargetType.AllAllies,
    }
    expect(classifySkill(groupBuff)).toBe(SkillCategory.Heal)
  })
})

// ---------------------------------------------------------------------------
// Cooldown management
// ---------------------------------------------------------------------------

describe('Battle AI — cooldown management', () => {
  it('test_cooldown_initiallyReady', () => {
    const cooldowns: CooldownMap = new Map()
    expect(isSkillReady(cooldowns, 'hero_a', 0)).toBe(true)
  })

  it('test_cooldown_afterPutOnCooldown_notReady', () => {
    const cooldowns: CooldownMap = new Map()
    putOnCooldown(cooldowns, 'hero_a', 0, 3)
    expect(isSkillReady(cooldowns, 'hero_a', 0)).toBe(false)
  })

  it('test_cooldown_tickReducesByOne', () => {
    const cooldowns: CooldownMap = new Map()
    putOnCooldown(cooldowns, 'hero_a', 0, 3)

    tickCooldowns(cooldowns)
    expect(cooldowns.get(cooldownKey('hero_a', 0))).toBe(2)

    tickCooldowns(cooldowns)
    expect(cooldowns.get(cooldownKey('hero_a', 0))).toBe(1)

    tickCooldowns(cooldowns)
    expect(cooldowns.get(cooldownKey('hero_a', 0))).toBe(0)
    expect(isSkillReady(cooldowns, 'hero_a', 0)).toBe(true)
  })

  it('test_cooldown_multipleHeroesIndependent', () => {
    const cooldowns: CooldownMap = new Map()
    putOnCooldown(cooldowns, 'hero_a', 0, 2)
    putOnCooldown(cooldowns, 'hero_b', 1, 5)

    tickCooldowns(cooldowns)
    expect(cooldowns.get(cooldownKey('hero_a', 0))).toBe(1)
    expect(cooldowns.get(cooldownKey('hero_b', 1))).toBe(4)
  })

  it('test_cooldown_doesNotGoNegative', () => {
    const cooldowns: CooldownMap = new Map()
    putOnCooldown(cooldowns, 'hero_a', 0, 1)
    tickCooldowns(cooldowns)
    tickCooldowns(cooldowns)  // already 0
    expect(cooldowns.get(cooldownKey('hero_a', 0))).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Action order generation
// ---------------------------------------------------------------------------

describe('Battle AI — action order', () => {
  it('test_actionOrder_sortedBySpd_highestFirst', () => {
    const fast = createHeroInstance(makeHeroWithSpd('fast', 30))
    const medium = createHeroInstance(makeHeroWithSpd('medium', 20))
    const slow = createHeroInstance(makeHeroWithSpd('slow', 10))

    const order = generateActionOrder([fast, slow], [medium], fixedRandom(0.5))

    expect(order[0].hero.data.id).toBe('fast')
    expect(order[1].hero.data.id).toBe('medium')
    expect(order[2].hero.data.id).toBe('slow')
  })

  it('test_actionOrder_mixesPlayerAndEnemy', () => {
    const playerFast = createHeroInstance(makeHeroWithSpd('p_fast', 30))
    const enemyMedium = createHeroInstance(makeHeroWithSpd('e_medium', 20))
    const playerSlow = createHeroInstance(makeHeroWithSpd('p_slow', 10))

    const order = generateActionOrder([playerFast, playerSlow], [enemyMedium], fixedRandom(0.5))

    expect(order[0].side).toBe('player')
    expect(order[1].side).toBe('enemy')
    expect(order[2].side).toBe('player')
  })

  it('test_actionOrder_sameSpdUsesRandomTiebreaker', () => {
    const hero1 = createHeroInstance(makeHeroWithSpd('hero1', 20))
    const hero2 = createHeroInstance(makeHeroWithSpd('hero2', 20))

    // First random call: hero1 gets 0.3, second: hero2 gets 0.7
    const rng = makeSeededRandom([0.3, 0.7])
    const order = generateActionOrder([hero1], [hero2], rng)

    // hero2 has higher tiebreaker (0.7 > 0.3) → goes first
    expect(order[0].hero.data.id).toBe('hero2')
    expect(order[1].hero.data.id).toBe('hero1')
  })

  it('test_actionOrder_allSameSpd_allRandom', () => {
    const heroes = Array.from({ length: 5 }, (_, i) =>
      createHeroInstance(makeHeroWithSpd(`hero_${i}`, 20))
    )

    // All have same SPD, order depends on tiebreaker values
    const rng = makeSeededRandom([0.1, 0.9, 0.3, 0.7, 0.5])
    const order = generateActionOrder(heroes, [], rng)

    // Should be sorted by tiebreaker descending: 0.9, 0.7, 0.5, 0.3, 0.1
    expect(order[0].hero.data.id).toBe('hero_1')  // tiebreaker 0.9
    expect(order[1].hero.data.id).toBe('hero_3')  // tiebreaker 0.7
    expect(order[2].hero.data.id).toBe('hero_4')  // tiebreaker 0.5
    expect(order[3].hero.data.id).toBe('hero_2')  // tiebreaker 0.3
    expect(order[4].hero.data.id).toBe('hero_0')  // tiebreaker 0.1
  })

  it('test_actionOrder_emptyTeams_returnsEmpty', () => {
    const order = generateActionOrder([], [])
    expect(order).toHaveLength(0)
  })

  it('test_actionOrder_correctSideLabeling', () => {
    const player = createHeroInstance(makeHeroWithSpd('p1', 20))
    const enemy = createHeroInstance(makeHeroWithSpd('e1', 20))

    const order = generateActionOrder([player], [enemy], makeSeededRandom([0.5, 0.3]))
    const playerEntry = order.find(e => e.hero.data.id === 'p1')
    const enemyEntry = order.find(e => e.hero.data.id === 'e1')

    expect(playerEntry?.side).toBe('player')
    expect(enemyEntry?.side).toBe('enemy')
  })

  it('test_actionOrder_usesRealHeroes_spdFromFinalStat', () => {
    // ZHOU_YU has SPD=25, GUAN_YU has SPD=18
    const order = generateActionOrder(
      [createHeroInstance(GUAN_YU)],
      [createHeroInstance(ZHOU_YU)],
      fixedRandom(0.5)
    )

    expect(order[0].hero.data.id).toBe('zhou_yu')  // SPD 25
    expect(order[1].hero.data.id).toBe('guan_yu')  // SPD 18
  })
})

// ---------------------------------------------------------------------------
// Filter alive actions
// ---------------------------------------------------------------------------

describe('Battle AI — filterAliveActions', () => {
  it('test_filterAlive_removesKnockedOutHeroes', () => {
    const alive = createHeroInstance(makeHeroWithSpd('alive', 20))
    const dead = createHeroInstance(makeHeroWithSpd('dead', 30))
    dead.isKnockedOut = true

    const order = generateActionOrder([alive], [dead], fixedRandom(0.5))
    const filtered = filterAliveActions(order)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].hero.data.id).toBe('alive')
  })

  it('test_filterAlive_allAlive_noneRemoved', () => {
    const h1 = createHeroInstance(makeHeroWithSpd('h1', 20))
    const h2 = createHeroInstance(makeHeroWithSpd('h2', 30))

    const order = generateActionOrder([h1], [h2], fixedRandom(0.5))
    const filtered = filterAliveActions(order)

    expect(filtered).toHaveLength(2)
  })

  it('test_filterAlive_allDead_returnsEmpty', () => {
    const h1 = createHeroInstance(makeHeroWithSpd('h1', 20))
    const h2 = createHeroInstance(makeHeroWithSpd('h2', 30))
    h1.isKnockedOut = true
    h2.isKnockedOut = true

    const order = generateActionOrder([h1], [h2], fixedRandom(0.5))
    const filtered = filterAliveActions(order)

    expect(filtered).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// AI decision — integration
// ---------------------------------------------------------------------------

describe('Battle AI — decideAction', () => {
  it('test_decideAction_noSkills_normalAttack', () => {
    // Hero with only passive skill (not active)
    const hero = createHeroInstance(makeHeroWithSkills('warrior', [PASSIVE_SKILL]))
    const enemies = [createHeroInstance(CAO_CAO)]
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(hero, [hero], enemies, cooldowns, fixedRandom(0.0))

    expect(decision.action).toBe(ActionType.Attack)
    expect(decision.targetIds).toHaveLength(1)
  })

  it('test_decideAction_damageSkillReady_usesSkill', () => {
    const hero = createHeroInstance(makeHeroWithSkills('warrior', [PASSIVE_SKILL, DAMAGE_SKILL]))
    const enemies = [createHeroInstance(CAO_CAO)]
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(hero, [hero], enemies, cooldowns, fixedRandom(0.0))

    expect(decision.action).toBe(ActionType.Skill)
    expect(decision.skillIndex).toBe(1)
    expect(decision.skill?.name).toBe('烈焰斩')
  })

  it('test_decideAction_skillOnCooldown_normalAttack', () => {
    const hero = createHeroInstance(makeHeroWithSkills('warrior', [PASSIVE_SKILL, DAMAGE_SKILL]))
    const enemies = [createHeroInstance(CAO_CAO)]
    const cooldowns: CooldownMap = new Map()
    putOnCooldown(cooldowns, 'warrior', 1, 3)

    const decision = decideAction(hero, [hero], enemies, cooldowns, fixedRandom(0.0))

    expect(decision.action).toBe(ActionType.Attack)
  })

  it('test_decideAction_healSkillReady_allyHurt_usesHeal', () => {
    const healer = createHeroInstance(makeHeroWithSkills('healer', [PASSIVE_SKILL, HEAL_SKILL]))
    const wounded = createHeroInstance(GUAN_YU)
    wounded.currentHP = 1  // well below 50%
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(healer, [healer, wounded], [createHeroInstance(CAO_CAO)], cooldowns, fixedRandom(0.0))

    expect(decision.action).toBe(ActionType.Skill)
    expect(decision.skill?.name).toBe('治愈术')
  })

  it('test_decideAction_healSkillReady_noOneHurt_skipsHeal', () => {
    const healer = createHeroInstance(makeHeroWithSkills('healer', [PASSIVE_SKILL, HEAL_SKILL]))
    const healthy = createHeroInstance(GUAN_YU)  // full HP
    const enemies = [createHeroInstance(CAO_CAO)]
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(healer, [healer, healthy], enemies, cooldowns, fixedRandom(0.0))

    // Heal skipped because no one hurt → normal attack
    expect(decision.action).toBe(ActionType.Attack)
  })

  it('test_decideAction_healPriorityOverDamage_whenAllyHurt', () => {
    // Hero has both heal and damage skills
    const hero = createHeroInstance(makeHeroWithSkills('hybrid', [PASSIVE_SKILL, DAMAGE_SKILL, HEAL_SKILL]))
    const wounded = createHeroInstance(GUAN_YU)
    wounded.currentHP = 1
    const enemies = [createHeroInstance(CAO_CAO)]
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(hero, [hero, wounded], enemies, cooldowns, fixedRandom(0.0))

    // Heal has higher priority than damage
    expect(decision.action).toBe(ActionType.Skill)
    expect(decision.skill?.name).toBe('治愈术')
  })

  it('test_decideAction_controlPriorityOverDamage', () => {
    // Hero has both control and damage skills
    const hero = createHeroInstance(makeHeroWithSkills('controller', [PASSIVE_SKILL, DAMAGE_SKILL, CONTROL_SKILL]))
    const enemies = [createHeroInstance(CAO_CAO)]
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(hero, [hero], enemies, cooldowns, fixedRandom(0.0))

    expect(decision.action).toBe(ActionType.Skill)
    expect(decision.skill?.name).toBe('眩晕')
  })

  it('test_decideAction_aoeSkill_targetsAllEnemies', () => {
    const hero = createHeroInstance(makeHeroWithSkills('mage', [PASSIVE_SKILL, AOE_DAMAGE_SKILL]))
    const enemies = [createHeroInstance(CAO_CAO), createHeroInstance(ZHOU_YU)]
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(hero, [hero], enemies, cooldowns, fixedRandom(0.0))

    expect(decision.action).toBe(ActionType.Skill)
    expect(decision.targetIds).toEqual(['cao_cao', 'zhou_yu'])
  })

  it('test_decideAction_noEnemies_returnsEmptyTargets', () => {
    const hero = createHeroInstance(GUAN_YU)
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(hero, [hero], [], cooldowns)

    expect(decision.action).toBe(ActionType.Attack)
    expect(decision.targetIds).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Symmetry test (same AI for player and enemy)
// ---------------------------------------------------------------------------

describe('Battle AI — symmetry', () => {
  it('test_symmetry_sameHeroData_sameDecision', () => {
    // Same hero on both sides should make the same kind of decision
    const playerHero = createHeroInstance(makeHeroWithSkills('p1', [PASSIVE_SKILL, DAMAGE_SKILL]))
    const enemyHero = createHeroInstance(makeHeroWithSkills('e1', [PASSIVE_SKILL, DAMAGE_SKILL]))
    const target = createHeroInstance(CAO_CAO)
    const cooldowns: CooldownMap = new Map()
    const rng = fixedRandom(0.0)

    const playerDecision = decideAction(playerHero, [playerHero], [target], cooldowns, rng)
    const enemyDecision = decideAction(enemyHero, [enemyHero], [target], cooldowns, rng)

    // Same action type
    expect(playerDecision.action).toBe(enemyDecision.action)
  })
})

// ---------------------------------------------------------------------------
// Real hero integration
// ---------------------------------------------------------------------------

describe('Battle AI — real hero integration', () => {
  it('test_realHeroes_guanYuVsCaoCao_producesValidDecision', () => {
    const guanYu = createHeroInstance(GUAN_YU)
    const caoCao = createHeroInstance(CAO_CAO)
    const cooldowns: CooldownMap = new Map()

    const decision = decideAction(guanYu, [guanYu], [caoCao], cooldowns)

    expect([ActionType.Attack, ActionType.Skill]).toContain(decision.action)
    expect(decision.targetIds.length).toBeGreaterThanOrEqual(1)
  })

  it('test_realHeroes_actionOrder_zhouYuBeforeGuanYu', () => {
    // ZHOU_YU SPD=25, GUAN_YU SPD=18
    const order = generateActionOrder(
      [createHeroInstance(GUAN_YU)],
      [createHeroInstance(ZHOU_YU)],
      fixedRandom(0.5)
    )

    expect(order[0].hero.data.id).toBe('zhou_yu')
    expect(order[0].effectiveSPD).toBe(25)
    expect(order[1].hero.data.id).toBe('guan_yu')
    expect(order[1].effectiveSPD).toBe(18)
  })

  it('test_realHeroes_fiveVsFive_allGetActions', () => {
    const playerTeam = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => createHeroInstance(h))
    const enemyTeam = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU].map(h => {
      const inst = createHeroInstance(h)
      // Give enemy instances unique IDs to avoid collision
      return { ...inst, data: { ...inst.data, id: `e_${inst.data.id}` } } as HeroInstance
    })

    const order = generateActionOrder(playerTeam, enemyTeam, fixedRandom(0.5))

    expect(order).toHaveLength(10)  // 5 + 5
  })

  it('test_realHeroes_randomTargetDistribution_roughly_uniform', () => {
    // Run 1000 random target selections, verify each enemy gets ~33% hits
    const self = createHeroInstance(GUAN_YU)
    const enemies = [
      createHeroInstance(CAO_CAO),
      createHeroInstance(ZHOU_YU),
      createHeroInstance(LV_BU),
    ]

    const counts: Record<string, number> = { cao_cao: 0, zhou_yu: 0, lv_bu: 0 }
    let i = 0
    const rng: RandomFn = () => {
      // Use a simple LCG-like sequence for deterministic distribution
      i++
      return (i * 7919) % 1000 / 1000
    }

    for (let j = 0; j < 1000; j++) {
      const [targetId] = selectTarget(TargetStrategy.Random, self, [self], enemies, rng)
      counts[targetId]++
    }

    // Each should get roughly 333 ± 100
    for (const id of Object.keys(counts)) {
      expect(counts[id]).toBeGreaterThan(200)
      expect(counts[id]).toBeLessThan(500)
    }
  })
})
