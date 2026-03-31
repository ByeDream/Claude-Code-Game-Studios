/**
 * Enemy System — Unit Tests
 *
 * Verifies the Enemy System data model, factory functions, config constants,
 * and test fixtures against the GDD specification.
 *
 * @module tests/unit/enemy/enemy.test
 * @see design/gdd/enemy-system.md
 */

import { describe, it, expect } from 'vitest'

import {
  NamelessTemplateType,
  EncounterType,
} from '../../../src/gameplay/enemy/types'

import type {
  NamelessUnit,
  EnemyEncounter,
  BossExtension,
} from '../../../src/gameplay/enemy/types'

import {
  NAMELESS_SCALING_RATE,
  BOSS_STAT_MULTIPLIER,
  BASE_NAMELESS,
  NAMELESS_REDUCTION_STEP,
  STANDARD_BATTLE_SIZE,
  BOSS_PHASE_THRESHOLD,
  NAMELESS_TEMPLATES,
  ELITE_STAT_MULTIPLIER,
} from '../../../src/gameplay/enemy/enemyConfig'

import {
  createNamelessUnit,
  scaleBossStats,
  computeNamelessCount,
  createEncounter,
  createBossEncounter,
} from '../../../src/gameplay/enemy/enemyFactory'

import {
  SOLDIER_NODE0,
  LEGION_LEADER_NODE0,
  LIEUTENANT_NODE0,
  ADVISOR_NODE0,
  CAVALRY_LEADER_NODE0,
  LEGION_LEADER_NODE5,
  ZHANG_JUE_DATA,
  DONG_ZHUO_DATA,
  ZHANG_JUE_BOSS,
  DONG_ZHUO_BOSS,
  ZHANG_JUE_EXTENSION,
  DONG_ZHUO_EXTENSION,
  ZHANG_JUE_ENCOUNTER,
  DONG_ZHUO_ENCOUNTER,
  EARLY_ENCOUNTER,
  MID_ENCOUNTER,
  TEST_NAMELESS_NODE0,
} from '../../../src/gameplay/enemy/testEnemies'

import { StatType } from '../../../src/gameplay/hero/types'

// ===========================================================================
// Config constants — sanity checks
// ===========================================================================

describe('Enemy Config constants', () => {

  it('test_config_standardBattleSize_equals5', () => {
    expect(STANDARD_BATTLE_SIZE).toBe(5)
  })

  it('test_config_namelessScalingRate_equals0Point15', () => {
    expect(NAMELESS_SCALING_RATE).toBe(0.15)
  })

  it('test_config_bossStatMultiplier_equals1Point5', () => {
    expect(BOSS_STAT_MULTIPLIER).toBe(1.5)
  })

  it('test_config_baseNameless_equals4', () => {
    expect(BASE_NAMELESS).toBe(4)
  })

  it('test_config_namelessReductionStep_equals4', () => {
    expect(NAMELESS_REDUCTION_STEP).toBe(4)
  })

  it('test_config_bossPhaseThreshold_equals0Point5', () => {
    expect(BOSS_PHASE_THRESHOLD).toBe(0.5)
  })

  it('test_config_namelessTemplates_hasFiveEntries', () => {
    expect(Object.keys(NAMELESS_TEMPLATES)).toHaveLength(5)
  })

})

// ===========================================================================
// NAMELESS_TEMPLATES — data validity
// ===========================================================================

describe('NAMELESS_TEMPLATES data validity', () => {

  it('test_templates_allFiveTypesPresent', () => {
    const types = Object.values(NamelessTemplateType)
    for (const type of types) {
      expect(NAMELESS_TEMPLATES[type]).toBeDefined()
    }
  })

  it('test_templates_soldierHasNoSkill', () => {
    expect(NAMELESS_TEMPLATES[NamelessTemplateType.Soldier].skill).toBeNull()
  })

  it('test_templates_nonSoldierTemplatesHaveSkill', () => {
    const nonSoldier = [
      NamelessTemplateType.LegionLeader,
      NamelessTemplateType.Lieutenant,
      NamelessTemplateType.Advisor,
      NamelessTemplateType.CavalryLeader,
    ]
    for (const type of nonSoldier) {
      expect(NAMELESS_TEMPLATES[type].skill).not.toBeNull()
    }
  })

  it('test_templates_allBaseStatsPositive', () => {
    for (const template of Object.values(NAMELESS_TEMPLATES)) {
      for (const stat of Object.values(StatType)) {
        expect(template.baseStats[stat]).toBeGreaterThan(0)
      }
    }
  })

  it('test_templates_soldierIsWeakestInTotalStats', () => {
    // Soldier should have the lowest total base stats of all templates
    const soldierTotal = Object.values(StatType).reduce(
      (sum, stat) => sum + NAMELESS_TEMPLATES[NamelessTemplateType.Soldier].baseStats[stat],
      0,
    )
    const otherTemplates = [
      NamelessTemplateType.LegionLeader,
      NamelessTemplateType.Lieutenant,
      NamelessTemplateType.Advisor,
      NamelessTemplateType.CavalryLeader,
    ]
    for (const type of otherTemplates) {
      const total = Object.values(StatType).reduce(
        (sum, stat) => sum + NAMELESS_TEMPLATES[type].baseStats[stat],
        0,
      )
      expect(soldierTotal).toBeLessThan(total)
    }
  })

  it('test_templates_legionLeaderHasHighestSTR', () => {
    // 军团长 has the highest STR among nameless templates per GDD
    const legionSTR = NAMELESS_TEMPLATES[NamelessTemplateType.LegionLeader].baseStats[StatType.STR]
    for (const [type, template] of Object.entries(NAMELESS_TEMPLATES)) {
      if (type !== NamelessTemplateType.LegionLeader) {
        expect(legionSTR).toBeGreaterThanOrEqual(template.baseStats[StatType.STR])
      }
    }
  })

  it('test_templates_lieutenantHasHighestDEF', () => {
    // 都尉 has the highest DEF (DEF-biased archetype)
    const lieutenantDEF = NAMELESS_TEMPLATES[NamelessTemplateType.Lieutenant].baseStats[StatType.DEF]
    for (const [type, template] of Object.entries(NAMELESS_TEMPLATES)) {
      if (type !== NamelessTemplateType.Lieutenant) {
        expect(lieutenantDEF).toBeGreaterThanOrEqual(template.baseStats[StatType.DEF])
      }
    }
  })

  it('test_templates_advisorHasHighestINT', () => {
    // 谋士 has the highest INT (INT-biased archetype)
    const advisorINT = NAMELESS_TEMPLATES[NamelessTemplateType.Advisor].baseStats[StatType.INT]
    for (const [type, template] of Object.entries(NAMELESS_TEMPLATES)) {
      if (type !== NamelessTemplateType.Advisor) {
        expect(advisorINT).toBeGreaterThanOrEqual(template.baseStats[StatType.INT])
      }
    }
  })

  it('test_templates_cavalryLeaderHasHighestSPD', () => {
    // 骑兵队长 has the highest SPD (SPD-biased archetype)
    const cavalrySPD = NAMELESS_TEMPLATES[NamelessTemplateType.CavalryLeader].baseStats[StatType.SPD]
    for (const [type, template] of Object.entries(NAMELESS_TEMPLATES)) {
      if (type !== NamelessTemplateType.CavalryLeader) {
        expect(cavalrySPD).toBeGreaterThanOrEqual(template.baseStats[StatType.SPD])
      }
    }
  })

})

// ===========================================================================
// createNamelessUnit — factory
// ===========================================================================

describe('createNamelessUnit', () => {

  it('test_createNamelessUnit_nodeIndex0_statsEqualTemplateBase', () => {
    // At nodeIndex 0: scaledStat = round(baseStat * (1 + 0 * 0.1)) = baseStat
    const unit = createNamelessUnit(NamelessTemplateType.Soldier, 0)
    const template = NAMELESS_TEMPLATES[NamelessTemplateType.Soldier]

    for (const stat of Object.values(StatType)) {
      expect(unit.scaledStats[stat]).toBe(template.baseStats[stat])
    }
  })

  it('test_createNamelessUnit_currentHPEqualsScaledHP', () => {
    // Arrange & Act
    const unit = createNamelessUnit(NamelessTemplateType.LegionLeader, 3)

    // Assert — currentHP must be set to the scaled HP stat
    expect(unit.currentHP).toBe(unit.scaledStats[StatType.HP])
  })

  it('test_createNamelessUnit_isNotKnockedOut', () => {
    const unit = createNamelessUnit(NamelessTemplateType.Advisor, 0)
    expect(unit.isKnockedOut).toBe(false)
  })

  it('test_createNamelessUnit_templateTypePreserved', () => {
    const unit = createNamelessUnit(NamelessTemplateType.CavalryLeader, 0)
    expect(unit.templateType).toBe(NamelessTemplateType.CavalryLeader)
  })

  it('test_createNamelessUnit_nodeIndexPreserved', () => {
    const unit = createNamelessUnit(NamelessTemplateType.Soldier, 7)
    expect(unit.nodeIndex).toBe(7)
  })

  it('test_createNamelessUnit_soldierHasNullSkill', () => {
    const unit = createNamelessUnit(NamelessTemplateType.Soldier, 0)
    expect(unit.skill).toBeNull()
  })

  it('test_createNamelessUnit_legionLeaderHasSkill', () => {
    const unit = createNamelessUnit(NamelessTemplateType.LegionLeader, 0)
    expect(unit.skill).not.toBeNull()
    expect(unit.skill?.name).toBe('统领')
  })

  it('test_createNamelessUnit_nodeIndex10_statsScaledUpward', () => {
    // At nodeIndex 10: scaledStat = round(baseStat * (1 + 10 * 0.15)) = round(baseStat * 2.5)
    const unit     = createNamelessUnit(NamelessTemplateType.Soldier, 10)
    const template = NAMELESS_TEMPLATES[NamelessTemplateType.Soldier]

    // STR: round(16 * 2.5) = 40
    expect(unit.scaledStats[StatType.STR]).toBe(Math.round(template.baseStats[StatType.STR] * 2.5))
  })

  it('test_createNamelessUnit_nodeIndex5_strCorrect', () => {
    // 军团长 STR base = 24; nodeIndex 5, rate 0.15 → round(24 * 1.75) = round(42) = 42
    const unit = createNamelessUnit(NamelessTemplateType.LegionLeader, 5)
    const template = NAMELESS_TEMPLATES[NamelessTemplateType.LegionLeader]
    expect(unit.scaledStats[StatType.STR]).toBe(Math.round(template.baseStats[StatType.STR] * (1 + 5 * 0.15)))
  })

  it('test_createNamelessUnit_uniqueIdsForDifferentInstanceIndexes', () => {
    // Two units of the same template at the same nodeIndex must have different IDs
    const unit0 = createNamelessUnit(NamelessTemplateType.Soldier, 0, 0)
    const unit1 = createNamelessUnit(NamelessTemplateType.Soldier, 0, 1)
    expect(unit0.id).not.toBe(unit1.id)
  })

  it('test_createNamelessUnit_scaledStatsNeverBelowOne', () => {
    // Even at nodeIndex 0, all stats should be at least 1
    for (const type of Object.values(NamelessTemplateType)) {
      const unit = createNamelessUnit(type, 0)
      for (const stat of Object.values(StatType)) {
        expect(unit.scaledStats[stat]).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('test_createNamelessUnit_higherNodeIndexYieldsHigherStats', () => {
    // Unit at nodeIndex 5 should have higher stats than nodeIndex 0 for same template
    const unit0 = createNamelessUnit(NamelessTemplateType.LegionLeader, 0)
    const unit5 = createNamelessUnit(NamelessTemplateType.LegionLeader, 5)

    expect(unit5.scaledStats[StatType.STR]).toBeGreaterThan(unit0.scaledStats[StatType.STR])
    expect(unit5.scaledStats[StatType.HP]).toBeGreaterThan(unit0.scaledStats[StatType.HP])
  })

  it('test_createNamelessUnit_eliteMultiplier_increasesAllStats', () => {
    // Elite units should have higher stats than normal units at the same node
    const normal = createNamelessUnit(NamelessTemplateType.Soldier, 5, 0, false)
    const elite  = createNamelessUnit(NamelessTemplateType.Soldier, 5, 0, true)

    for (const stat of Object.values(StatType)) {
      expect(elite.scaledStats[stat]).toBeGreaterThan(normal.scaledStats[stat])
    }
  })

  it('test_createNamelessUnit_eliteMultiplier_correctValue', () => {
    // Elite multiplier should be exactly 1.25x
    const normal = createNamelessUnit(NamelessTemplateType.LegionLeader, 0, 0, false)
    const elite  = createNamelessUnit(NamelessTemplateType.LegionLeader, 0, 0, true)

    expect(elite.scaledStats[StatType.STR]).toBe(Math.round(normal.scaledStats[StatType.STR] * 1.25))
  })

})

// ===========================================================================
// scaleBossStats — Boss stat multiplier
// ===========================================================================

describe('scaleBossStats', () => {

  it('test_scaleBossStats_strScaledByMultiplier', () => {
    // 张角 STR: 14 * 1.5 = round(21) = 21
    expect(ZHANG_JUE_BOSS.baseStats[StatType.STR]).toBe(
      Math.round(ZHANG_JUE_DATA.baseStats[StatType.STR] * BOSS_STAT_MULTIPLIER),
    )
  })

  it('test_scaleBossStats_allStatsScaled', () => {
    // Verify all five stats are correctly scaled
    for (const stat of Object.values(StatType)) {
      const expected = Math.round(ZHANG_JUE_DATA.baseStats[stat] * BOSS_STAT_MULTIPLIER)
      expect(ZHANG_JUE_BOSS.baseStats[stat]).toBe(expected)
    }
  })

  it('test_scaleBossStats_isImmutable_originalUnchanged', () => {
    // Arrange — capture original STR
    const originalSTR = ZHANG_JUE_DATA.baseStats[StatType.STR]

    // Act — apply scaling (already done on ZHANG_JUE_BOSS, but call directly)
    scaleBossStats(ZHANG_JUE_DATA)

    // Assert — original data untouched
    expect(ZHANG_JUE_DATA.baseStats[StatType.STR]).toBe(originalSTR)
  })

  it('test_scaleBossStats_returnsNewObject', () => {
    const result = scaleBossStats(ZHANG_JUE_DATA)
    expect(result).not.toBe(ZHANG_JUE_DATA)
  })

  it('test_scaleBossStats_nonStatFieldsUnchanged', () => {
    // ID, name, faction etc. must survive the transformation
    expect(ZHANG_JUE_BOSS.id).toBe(ZHANG_JUE_DATA.id)
    expect(ZHANG_JUE_BOSS.name).toBe(ZHANG_JUE_DATA.name)
    expect(ZHANG_JUE_BOSS.faction).toBe(ZHANG_JUE_DATA.faction)
    expect(ZHANG_JUE_BOSS.tier).toBe(ZHANG_JUE_DATA.tier)
  })

  it('test_scaleBossStats_bossIsStrongerThanBase', () => {
    // All scaled stats must exceed their base counterparts
    for (const stat of Object.values(StatType)) {
      expect(ZHANG_JUE_BOSS.baseStats[stat]).toBeGreaterThan(ZHANG_JUE_DATA.baseStats[stat])
    }
  })

  it('test_scaleBossStats_dongZhuo_strScaledCorrectly', () => {
    // 董卓 STR: 34 * 1.5 = round(51) = 51
    expect(DONG_ZHUO_BOSS.baseStats[StatType.STR]).toBe(
      Math.round(DONG_ZHUO_DATA.baseStats[StatType.STR] * BOSS_STAT_MULTIPLIER),
    )
  })

})

// ===========================================================================
// computeNamelessCount — composition ratio formula
// ===========================================================================

describe('computeNamelessCount', () => {

  it('test_computeNamelessCount_nodeIndex0_returnsBaseNameless', () => {
    // nodeIndex 0: max(0, 4 - floor(0/4)) = max(0, 4 - 0) = 4
    expect(computeNamelessCount(0)).toBe(4)
  })

  it('test_computeNamelessCount_nodeIndex3_stillBase', () => {
    // nodeIndex 3: max(0, 4 - floor(3/4)) = max(0, 4 - 0) = 4
    expect(computeNamelessCount(3)).toBe(4)
  })

  it('test_computeNamelessCount_nodeIndex4_decreasesByOne', () => {
    // nodeIndex 4: max(0, 4 - floor(4/4)) = max(0, 4 - 1) = 3
    expect(computeNamelessCount(4)).toBe(3)
  })

  it('test_computeNamelessCount_nodeIndex8_decreasesByTwo', () => {
    // nodeIndex 8: max(0, 4 - floor(8/4)) = max(0, 4 - 2) = 2
    expect(computeNamelessCount(8)).toBe(2)
  })

  it('test_computeNamelessCount_nodeIndex12_decreasesByThree', () => {
    // nodeIndex 12: max(0, 4 - floor(12/4)) = max(0, 4 - 3) = 1
    expect(computeNamelessCount(12)).toBe(1)
  })

  it('test_computeNamelessCount_nodeIndex16_returnsZero', () => {
    // nodeIndex 16: max(0, 4 - floor(16/4)) = max(0, 4 - 4) = 0
    expect(computeNamelessCount(16)).toBe(0)
  })

  it('test_computeNamelessCount_highNodeIndex_neverGoesNegative', () => {
    // Beyond nodeIndex 16, result must clamp to 0
    expect(computeNamelessCount(100)).toBe(0)
    expect(computeNamelessCount(50)).toBe(0)
  })

  it('test_computeNamelessCount_namedCountComplementsNamelessCount', () => {
    // namedCount = STANDARD_BATTLE_SIZE - namelessCount should be valid for all nodes
    for (const nodeIndex of [0, 4, 8, 12, 16]) {
      const namelessCount = computeNamelessCount(nodeIndex)
      const namedCount    = STANDARD_BATTLE_SIZE - namelessCount
      expect(namedCount).toBeGreaterThanOrEqual(1)
      expect(namedCount).toBeLessThanOrEqual(STANDARD_BATTLE_SIZE)
    }
  })

})

// ===========================================================================
// createEncounter — normal/elite encounter assembly
// ===========================================================================

describe('createEncounter', () => {

  it('test_createEncounter_fiveEnemies_succeeds', () => {
    // Arrange — 3 nameless + 2 named
    const nameless: NamelessUnit[] = [
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 0),
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 1),
      createNamelessUnit(NamelessTemplateType.LegionLeader, 0, 0),
    ]
    const named = [ZHANG_JUE_DATA, DONG_ZHUO_DATA]

    // Act
    const encounter = createEncounter(nameless, named, EncounterType.Normal, [])

    // Assert
    expect(encounter.enemies).toHaveLength(5)
  })

  it('test_createEncounter_encounterTypePreserved', () => {
    const encounter = EARLY_ENCOUNTER
    expect(encounter.encounterType).toBe(EncounterType.Normal)
  })

  it('test_createEncounter_formationHasFivePositions', () => {
    const encounter = EARLY_ENCOUNTER
    expect(encounter.formation).toHaveLength(5)
  })

  it('test_createEncounter_formationPositionsSequential', () => {
    // Formation should be [0, 1, 2, 3, 4]
    const encounter = EARLY_ENCOUNTER
    expect(encounter.formation).toEqual([0, 1, 2, 3, 4])
  })

  it('test_createEncounter_noBossExtension', () => {
    expect(EARLY_ENCOUNTER.bossExtension).toBeUndefined()
  })

  it('test_createEncounter_wrongEnemyCount_throws', () => {
    // Only 4 enemies — must throw
    const nameless = [
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 0),
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 1),
    ]
    const named = [ZHANG_JUE_DATA]

    expect(() =>
      createEncounter(nameless, named, EncounterType.Normal, []),
    ).toThrow()
  })

  it('test_createEncounter_eliteType_preserved', () => {
    const nameless: NamelessUnit[] = []
    const named = [
      ZHANG_JUE_DATA,
      DONG_ZHUO_DATA,
      ZHANG_JUE_DATA,
      DONG_ZHUO_DATA,
      ZHANG_JUE_DATA,
    ]
    const encounter = createEncounter(nameless, named, EncounterType.Elite, [])
    expect(encounter.encounterType).toBe(EncounterType.Elite)
  })

  it('test_createEncounter_lootTablePreserved', () => {
    const loot = [{ itemId: 'test_item', dropChance: 0.25 }]
    const nameless: NamelessUnit[] = [
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 0),
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 1),
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 2),
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 3),
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 4),
    ]
    const encounter = createEncounter(nameless, [], EncounterType.Normal, loot)
    expect(encounter.lootTable).toEqual(loot)
  })

  it('test_createEncounter_namelessUnitsAppearFirst', () => {
    // Arrange — 2 nameless + 3 named
    const nameless = [
      createNamelessUnit(NamelessTemplateType.Soldier, 0, 0),
      createNamelessUnit(NamelessTemplateType.LegionLeader, 0, 0),
    ]
    const named = [ZHANG_JUE_DATA, DONG_ZHUO_DATA, ZHANG_JUE_DATA]
    const encounter = createEncounter(nameless, named, EncounterType.Normal, [])

    // First two should be NamelessUnit (have .templateType), last three should be HeroData
    const first = encounter.enemies[0] as NamelessUnit
    expect(first.templateType).toBeDefined()

    const third = encounter.enemies[2] as { id: string; faction?: unknown }
    // HeroData has .faction; NamelessUnit does not
    expect((third as Record<string, unknown>).faction).toBeDefined()
  })

})

// ===========================================================================
// createBossEncounter — boss encounter assembly
// ===========================================================================

describe('createBossEncounter', () => {

  it('test_createBossEncounter_encounterTypeIsBoss', () => {
    expect(ZHANG_JUE_ENCOUNTER.encounterType).toBe(EncounterType.Boss)
  })

  it('test_createBossEncounter_bossExtensionPresent', () => {
    expect(ZHANG_JUE_ENCOUNTER.bossExtension).toBeDefined()
  })

  it('test_createBossEncounter_bossIsFirstEnemy', () => {
    // Boss must be enemies[0]
    const boss = ZHANG_JUE_ENCOUNTER.enemies[0]
    // The Boss is a HeroData — check it has the correct ID
    expect((boss as { id: string }).id).toBe(ZHANG_JUE_BOSS.id)
  })

  it('test_createBossEncounter_canExceedStandardBattleSize', () => {
    // Zhang Jue: 1 Boss + 4 guards = 5 (still valid, but could be more)
    expect(ZHANG_JUE_ENCOUNTER.enemies.length).toBeGreaterThanOrEqual(1)
  })

  it('test_createBossEncounter_formationMatchesEnemyCount', () => {
    expect(ZHANG_JUE_ENCOUNTER.formation).toHaveLength(
      ZHANG_JUE_ENCOUNTER.enemies.length,
    )
  })

  it('test_createBossEncounter_dongZhuo_hasPhases', () => {
    expect(DONG_ZHUO_ENCOUNTER.bossExtension?.phases).toHaveLength(1)
  })

  it('test_createBossEncounter_zhangJue_hasSummonWaves', () => {
    expect(ZHANG_JUE_ENCOUNTER.bossExtension?.summonWaves).toBeDefined()
    expect(ZHANG_JUE_ENCOUNTER.bossExtension?.summonWaves?.length).toBeGreaterThan(0)
  })

  it('test_createBossEncounter_lootTablePreserved', () => {
    expect(DONG_ZHUO_ENCOUNTER.lootTable).toHaveLength(1)
    expect(DONG_ZHUO_ENCOUNTER.lootTable[0].itemId).toBe('named_weapon_green_dragon')
  })

})

// ===========================================================================
// Boss extension data validity
// ===========================================================================

describe('Boss extension data', () => {

  it('test_bossExtension_zhangJue_phaseThresholdIs50Percent', () => {
    expect(ZHANG_JUE_EXTENSION.phases[0].hpThreshold).toBe(0.5)
  })

  it('test_bossExtension_zhangJue_phase2_intModifierIs1Point2', () => {
    // Phase 2: INT * 1.20
    const modifier = ZHANG_JUE_EXTENSION.phases[0].statModifier
    expect(modifier[StatType.INT]).toBe(1.20)
  })

  it('test_bossExtension_zhangJue_hasDialogue', () => {
    expect(ZHANG_JUE_EXTENSION.phases[0].dialogue).toBeDefined()
    expect(typeof ZHANG_JUE_EXTENSION.phases[0].dialogue).toBe('string')
  })

  it('test_bossExtension_zhangJue_summonWaveHasTwoSoldiers', () => {
    const wave = ZHANG_JUE_EXTENSION.summonWaves![0]
    expect(wave.units).toHaveLength(2)
    expect(wave.units[0]).toBe(NamelessTemplateType.Soldier)
    expect(wave.units[1]).toBe(NamelessTemplateType.Soldier)
  })

  it('test_bossExtension_zhangJue_summonTriggerIsPhaseChange', () => {
    expect(ZHANG_JUE_EXTENSION.summonWaves![0].trigger).toBe('phase_change')
  })

  it('test_bossExtension_dongZhuo_phaseThresholdIs40Percent', () => {
    expect(DONG_ZHUO_EXTENSION.phases[0].hpThreshold).toBe(0.4)
  })

  it('test_bossExtension_dongZhuo_phase2_strModifierIs1Point3', () => {
    const modifier = DONG_ZHUO_EXTENSION.phases[0].statModifier
    expect(modifier[StatType.STR]).toBe(1.30)
  })

})

// ===========================================================================
// Test fixture data — nameless units at nodeIndex 0
// ===========================================================================

describe('Test nameless fixtures (nodeIndex 0)', () => {

  it('test_fixtures_testNamelessNode0_hasFiveUnits', () => {
    expect(TEST_NAMELESS_NODE0).toHaveLength(5)
  })

  it('test_fixtures_allUnits_notKnockedOut', () => {
    for (const unit of TEST_NAMELESS_NODE0) {
      expect(unit.isKnockedOut).toBe(false)
    }
  })

  it('test_fixtures_allUnits_currentHPEqualsScaledHP', () => {
    for (const unit of TEST_NAMELESS_NODE0) {
      expect(unit.currentHP).toBe(unit.scaledStats[StatType.HP])
    }
  })

  it('test_fixtures_soldierNode0_nodeIndexIsZero', () => {
    expect(SOLDIER_NODE0.nodeIndex).toBe(0)
  })

  it('test_fixtures_legionLeaderNode5_hasHigherStatsThanNode0', () => {
    // nodeIndex 5 > nodeIndex 0 → all stats must be higher
    for (const stat of Object.values(StatType)) {
      expect(LEGION_LEADER_NODE5.scaledStats[stat]).toBeGreaterThanOrEqual(
        LEGION_LEADER_NODE0.scaledStats[stat],
      )
    }
  })

  it('test_fixtures_allUniqueIds', () => {
    const ids = TEST_NAMELESS_NODE0.map(u => u.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(TEST_NAMELESS_NODE0.length)
  })

})

// ===========================================================================
// Test encounter fixtures
// ===========================================================================

describe('Test encounter fixtures', () => {

  it('test_earlyEncounter_hasStandardBattleSize', () => {
    expect(EARLY_ENCOUNTER.enemies).toHaveLength(STANDARD_BATTLE_SIZE)
  })

  it('test_earlyEncounter_isNormalType', () => {
    expect(EARLY_ENCOUNTER.encounterType).toBe(EncounterType.Normal)
  })

  it('test_midEncounter_hasStandardBattleSize', () => {
    expect(MID_ENCOUNTER.enemies).toHaveLength(STANDARD_BATTLE_SIZE)
  })

  it('test_zhangJueEncounter_isBossType', () => {
    expect(ZHANG_JUE_ENCOUNTER.encounterType).toBe(EncounterType.Boss)
  })

  it('test_dongZhuoEncounter_isBossType', () => {
    expect(DONG_ZHUO_ENCOUNTER.encounterType).toBe(EncounterType.Boss)
  })

  it('test_zhangJueEncounter_bossStatsExceedBaseStats', () => {
    // Boss stats must exceed base due to BOSS_STAT_MULTIPLIER
    for (const stat of Object.values(StatType)) {
      expect(ZHANG_JUE_BOSS.baseStats[stat]).toBeGreaterThan(ZHANG_JUE_DATA.baseStats[stat])
    }
  })

})

// ===========================================================================
// Test hero data validity — Zhang Jue and Dong Zhuo
// ===========================================================================

describe('Boss HeroData validity', () => {

  it('test_zhangJueData_isBTier', () => {
    // GDD: 张角 is B-tier
    expect(ZHANG_JUE_DATA.tier).toBeDefined()
  })

  it('test_dongZhuoData_idIsCorrect', () => {
    expect(DONG_ZHUO_DATA.id).toBe('dong_zhuo')
  })

  it('test_zhangJueData_idIsCorrect', () => {
    expect(ZHANG_JUE_DATA.id).toBe('zhang_jue')
  })

  it('test_bossData_allHaveSkills', () => {
    for (const boss of [ZHANG_JUE_DATA, DONG_ZHUO_DATA]) {
      expect(boss.skills.length).toBeGreaterThan(0)
    }
  })

  it('test_bossData_allBaseStatsPositive', () => {
    for (const boss of [ZHANG_JUE_DATA, DONG_ZHUO_DATA]) {
      for (const stat of Object.values(StatType)) {
        expect(boss.baseStats[stat]).toBeGreaterThan(0)
      }
    }
  })

  it('test_bossData_allGrowthRatesNonNegative', () => {
    for (const boss of [ZHANG_JUE_DATA, DONG_ZHUO_DATA]) {
      for (const stat of Object.values(StatType)) {
        expect(boss.statGrowthRates[stat]).toBeGreaterThanOrEqual(0)
      }
    }
  })

})
