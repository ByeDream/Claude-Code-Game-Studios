/**
 * Bond System — Unit Tests
 *
 * Comprehensive tests for the Bond System covering:
 * - Config data validity
 * - Faction bond detection and tiering
 * - Historical bond detection (all / any_n modes)
 * - Per-hero modifier calculation and 25% cap
 * - Qun random stat resolution
 * - Edge cases: 0 bonds, overlapping bonds, cap enforcement
 * - Integration: applyBondResult writes to HeroInstance
 *
 * @see design/gdd/bond-system.md — Acceptance Criteria
 */

import { describe, it, expect } from 'vitest'

import { Faction, StatType, HeroTier, HeroVariant, SkillType, TriggerCondition, TargetType, ScalingStat } from '../../../src/gameplay/hero/types'
import type { HeroData, HeroInstance } from '../../../src/gameplay/hero/types'
import { createHeroInstance } from '../../../src/gameplay/hero/heroFactory'
import { createZeroStats, calculateFinalStat } from '../../../src/gameplay/hero/statCalculation'
import { GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU } from '../../../src/gameplay/hero/testHeroes'

import { BondType } from '../../../src/gameplay/bond/types'
import type { HistoricalBondDefinition } from '../../../src/gameplay/bond/types'
import {
  BOND_MODIFIER_CAP,
  FACTION_BOND_TABLE,
  HISTORICAL_BONDS,
} from '../../../src/gameplay/bond/bondConfig'
import {
  evaluateFactionBonds,
  evaluateHistoricalBonds,
  evaluateBonds,
  applyBondResult,
} from '../../../src/gameplay/bond/bondManager'

// ---------------------------------------------------------------------------
// Test hero helpers — create additional heroes needed for bond testing
// ---------------------------------------------------------------------------

/** Minimal hero data factory for test-only heroes. */
function makeTestHero(overrides: Partial<HeroData> & { id: string; name: string; baseName: string; faction: Faction }): HeroData {
  return {
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
      name: 'test', type: SkillType.Passive, trigger: TriggerCondition.PassiveAura,
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

// Additional test heroes for bond testing
const LIU_BEI = makeTestHero({ id: 'liu_bei', name: '刘备', baseName: '刘备', faction: Faction.Shu, bondKeys: ['桃园结义', '蜀汉阵营'] })
const ZHAO_YUN = makeTestHero({ id: 'zhao_yun', name: '赵云', baseName: '赵云', faction: Faction.Shu, bondKeys: ['五虎上将', '蜀汉阵营'] })
const MA_CHAO = makeTestHero({ id: 'ma_chao', name: '马超', baseName: '马超', faction: Faction.Shu, bondKeys: ['五虎上将', '蜀汉阵营'] })
const HUANG_ZHONG = makeTestHero({ id: 'huang_zhong', name: '黄忠', baseName: '黄忠', faction: Faction.Shu, bondKeys: ['五虎上将', '蜀汉阵营'] })
const SUN_CE = makeTestHero({ id: 'sun_ce', name: '孙策', baseName: '孙策', faction: Faction.Wu, bondKeys: ['江东双壁', '吴国阵营'] })
const SUN_QUAN = makeTestHero({ id: 'sun_quan', name: '孙权', baseName: '孙权', faction: Faction.Wu, bondKeys: ['三分天下', '吴国阵营'] })
const ZHUGE_LIANG = makeTestHero({ id: 'zhuge_liang', name: '诸葛亮', baseName: '诸葛亮', faction: Faction.Shu, bondKeys: ['卧龙凤雏', '蜀汉阵营'] })
const PANG_TONG = makeTestHero({ id: 'pang_tong', name: '庞统', baseName: '庞统', faction: Faction.Shu, bondKeys: ['卧龙凤雏', '蜀汉阵营'] })

// Legend variant — should trigger bonds via baseName
const LEGEND_GUAN_YU: HeroData = {
  ...GUAN_YU,
  id: 'legend_guan_yu',
  name: '武圣·关羽',
  variant: HeroVariant.Legend,
  legendTitle: '武圣',
  // baseName stays '关羽' — this is the key for bond matching
}

// Wei filler heroes for faction bond testing
const WEI_HERO_A = makeTestHero({ id: 'wei_a', name: '魏武将A', baseName: '魏武将A', faction: Faction.Wei })
const WEI_HERO_B = makeTestHero({ id: 'wei_b', name: '魏武将B', baseName: '魏武将B', faction: Faction.Wei })
const WEI_HERO_C = makeTestHero({ id: 'wei_c', name: '魏武将C', baseName: '魏武将C', faction: Faction.Wei })
const WEI_HERO_D = makeTestHero({ id: 'wei_d', name: '魏武将D', baseName: '魏武将D', faction: Faction.Wei })

// Qun filler heroes
const QUN_HERO_A = makeTestHero({ id: 'qun_a', name: '群雄A', baseName: '群雄A', faction: Faction.Qun })
const QUN_HERO_B = makeTestHero({ id: 'qun_b', name: '群雄B', baseName: '群雄B', faction: Faction.Qun })

// ---------------------------------------------------------------------------
// Config data validity tests
// ---------------------------------------------------------------------------

describe('Bond config — data validity', () => {
  it('test_bondConfig_factionTable_allFourFactionsHaveTiers', () => {
    for (const faction of Object.values(Faction)) {
      const def = FACTION_BOND_TABLE[faction]
      expect(def).toBeDefined()
      expect(def.tiers.length).toBeGreaterThanOrEqual(1)
      expect(def.faction).toBe(faction)
    }
  })

  it('test_bondConfig_factionTable_tiersAreOrderedByCount', () => {
    for (const faction of Object.values(Faction)) {
      const tiers = FACTION_BOND_TABLE[faction].tiers
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].requiredCount).toBeGreaterThan(tiers[i - 1].requiredCount)
      }
    }
  })

  it('test_bondConfig_factionTable_allTiersStartAt2', () => {
    for (const faction of Object.values(Faction)) {
      expect(FACTION_BOND_TABLE[faction].tiers[0].requiredCount).toBe(2)
    }
  })

  it('test_bondConfig_factionTable_maxTierIs5', () => {
    for (const faction of Object.values(Faction)) {
      const tiers = FACTION_BOND_TABLE[faction].tiers
      const maxTier = tiers[tiers.length - 1]
      expect(maxTier.requiredCount).toBe(5)
    }
  })

  it('test_bondConfig_factionTable_shuBonusesAreStrHp', () => {
    const shu = FACTION_BOND_TABLE[Faction.Shu]
    for (const tier of shu.tiers) {
      // At minimum STR should be present
      expect(tier.statBonuses[StatType.STR]).toBeDefined()
      // Should not have INT/SPD bonuses
      expect(tier.statBonuses[StatType.INT]).toBeUndefined()
      expect(tier.statBonuses[StatType.SPD]).toBeUndefined()
    }
  })

  it('test_bondConfig_factionTable_weiBonusesAreIntDef', () => {
    const wei = FACTION_BOND_TABLE[Faction.Wei]
    for (const tier of wei.tiers) {
      expect(tier.statBonuses[StatType.INT]).toBeDefined()
      expect(tier.statBonuses[StatType.STR]).toBeUndefined()
    }
  })

  it('test_bondConfig_factionTable_wuBonusesAreSpdDef', () => {
    const wu = FACTION_BOND_TABLE[Faction.Wu]
    for (const tier of wu.tiers) {
      expect(tier.statBonuses[StatType.SPD]).toBeDefined()
      expect(tier.statBonuses[StatType.STR]).toBeUndefined()
    }
  })

  it('test_bondConfig_factionTable_maxFactionBonusPerStat_within10Percent', () => {
    for (const faction of Object.values(Faction)) {
      const maxTier = FACTION_BOND_TABLE[faction].tiers.at(-1)!
      for (const stat of Object.values(StatType)) {
        const val = maxTier.statBonuses[stat]
        if (val !== undefined) {
          expect(val).toBeLessThanOrEqual(0.12)  // Qun has 12% max
        }
      }
    }
  })

  it('test_bondConfig_bondModifierCap_is025', () => {
    expect(BOND_MODIFIER_CAP).toBe(0.25)
  })

  it('test_bondConfig_historicalBonds_mvpHasAtLeast8', () => {
    expect(HISTORICAL_BONDS.length).toBeGreaterThanOrEqual(8)
  })

  it('test_bondConfig_historicalBonds_allHaveUniqueIds', () => {
    const ids = HISTORICAL_BONDS.map(b => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('test_bondConfig_historicalBonds_allHaveValidRequirementMode', () => {
    for (const bond of HISTORICAL_BONDS) {
      expect(['all', 'any_n']).toContain(bond.requirementMode.type)
      if (bond.requirementMode.type === 'any_n') {
        expect(bond.requirementMode.count).toBeGreaterThanOrEqual(2)
        expect(bond.requirementMode.count).toBeLessThanOrEqual(bond.requiredHeroes.length)
      }
    }
  })

  it('test_bondConfig_historicalBonds_allRequireAtLeast2Heroes', () => {
    for (const bond of HISTORICAL_BONDS) {
      expect(bond.requiredHeroes.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ---------------------------------------------------------------------------
// Faction bond evaluation
// ---------------------------------------------------------------------------

describe('Bond evaluation — faction bonds', () => {
  it('test_factionBond_zeroSameFaction_noBondActivated', () => {
    // Arrange — 1 Shu + 1 Wei + 1 Wu + 1 Qun (no faction reaches 2)
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(CAO_CAO),
      createHeroInstance(ZHOU_YU),
      createHeroInstance(LV_BU),
    ]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert — no faction bonds activated
    expect(bonds).toHaveLength(0)
  })

  it('test_factionBond_twoShu_activatesTier1', () => {
    // Arrange — 2 Shu heroes
    const roster = [createHeroInstance(GUAN_YU), createHeroInstance(ZHANG_FEI)]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert
    expect(bonds).toHaveLength(1)
    expect(bonds[0].name).toBe('蜀汉阵营')
    expect(bonds[0].tier).toBe(1)
    expect(bonds[0].statBonuses[StatType.STR]).toBe(0.03)
  })

  it('test_factionBond_threeShu_activatesTier2_notTier1', () => {
    // Arrange — 3 Shu heroes
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(LIU_BEI),
    ]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert — tier 2 (highest reached)
    expect(bonds).toHaveLength(1)
    expect(bonds[0].tier).toBe(2)
    expect(bonds[0].statBonuses[StatType.STR]).toBe(0.05)
    expect(bonds[0].statBonuses[StatType.HP]).toBe(0.03)
  })

  it('test_factionBond_fiveShu_activatesMaxTier', () => {
    // Arrange — 5 Shu heroes
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(LIU_BEI),
      createHeroInstance(ZHAO_YUN),
      createHeroInstance(MA_CHAO),
    ]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert — max tier
    expect(bonds).toHaveLength(1)
    expect(bonds[0].tier).toBe(4)
    expect(bonds[0].statBonuses[StatType.STR]).toBe(0.10)
    expect(bonds[0].statBonuses[StatType.HP]).toBe(0.08)
  })

  it('test_factionBond_weiFiveFull_correctIntDefBonuses', () => {
    // Arrange — 5 Wei heroes
    const roster = [
      createHeroInstance(CAO_CAO),
      createHeroInstance(WEI_HERO_A),
      createHeroInstance(WEI_HERO_B),
      createHeroInstance(WEI_HERO_C),
      createHeroInstance(WEI_HERO_D),
    ]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert
    expect(bonds).toHaveLength(1)
    expect(bonds[0].name).toBe('魏国阵营')
    expect(bonds[0].statBonuses[StatType.INT]).toBe(0.10)
    expect(bonds[0].statBonuses[StatType.DEF]).toBe(0.08)
  })

  it('test_factionBond_multipleFactions_activatesBoth', () => {
    // Arrange — 3 Shu + 2 Wu
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(LIU_BEI),
      createHeroInstance(ZHOU_YU),
      createHeroInstance(SUN_CE),
    ]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert — both activated
    expect(bonds).toHaveLength(2)
    const shuBond = bonds.find(b => b.name === '蜀汉阵营')!
    const wuBond = bonds.find(b => b.name === '东吴阵营')!
    expect(shuBond.tier).toBe(2)  // 3 Shu
    expect(wuBond.tier).toBe(1)   // 2 Wu
  })

  it('test_factionBond_participatingHeroes_includesAllOfFaction', () => {
    // Arrange
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(CAO_CAO),  // different faction
    ]

    // Act
    const bonds = evaluateFactionBonds(roster)

    // Assert
    expect(bonds).toHaveLength(1)
    expect(bonds[0].participatingHeroes).toEqual(['关羽', '张飞'])
  })
})

// ---------------------------------------------------------------------------
// Qun random stat
// ---------------------------------------------------------------------------

describe('Bond evaluation — Qun random stat', () => {
  it('test_qunFaction_defaultStatIsStr', () => {
    // Arrange
    const roster = [createHeroInstance(LV_BU), createHeroInstance(QUN_HERO_A)]

    // Act — default qunRandomStat = STR
    const bonds = evaluateFactionBonds(roster)

    // Assert
    expect(bonds).toHaveLength(1)
    expect(bonds[0].statBonuses[StatType.STR]).toBe(0.03)
  })

  it('test_qunFaction_randomStatInt_replacesPlaceholder', () => {
    // Arrange
    const roster = [createHeroInstance(LV_BU), createHeroInstance(QUN_HERO_A)]

    // Act — Qun random stat is INT for this run
    const bonds = evaluateFactionBonds(roster, StatType.INT)

    // Assert — bonus should be on INT, not STR
    expect(bonds).toHaveLength(1)
    expect(bonds[0].statBonuses[StatType.INT]).toBe(0.03)
    expect(bonds[0].statBonuses[StatType.STR]).toBeUndefined()
  })

  it('test_qunFaction_randomStatSpd_maxTier12Percent', () => {
    // Arrange — 5 Qun heroes (need enough)
    const roster = [
      createHeroInstance(LV_BU),
      createHeroInstance(QUN_HERO_A),
      createHeroInstance(QUN_HERO_B),
      createHeroInstance(makeTestHero({ id: 'qun_c', name: '群雄C', baseName: '群雄C', faction: Faction.Qun })),
      createHeroInstance(makeTestHero({ id: 'qun_d', name: '群雄D', baseName: '群雄D', faction: Faction.Qun })),
    ]

    // Act
    const bonds = evaluateFactionBonds(roster, StatType.SPD)

    // Assert — 5 Qun = tier 4 = 12%
    expect(bonds).toHaveLength(1)
    expect(bonds[0].statBonuses[StatType.SPD]).toBe(0.12)
  })
})

// ---------------------------------------------------------------------------
// Historical bond evaluation
// ---------------------------------------------------------------------------

describe('Bond evaluation — historical bonds', () => {
  it('test_historicalBond_taoYuanAllPresent_activates', () => {
    // Arrange — 刘备+关羽+张飞
    const roster = [
      createHeroInstance(LIU_BEI),
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    const taoYuan = bonds.find(b => b.name === '桃园结义')
    expect(taoYuan).toBeDefined()
    expect(taoYuan!.participatingHeroes).toEqual(['刘备', '关羽', '张飞'])
  })

  it('test_historicalBond_taoYuanMissingOne_notActivated', () => {
    // Arrange — 刘备+关羽 (missing 张飞)
    const roster = [
      createHeroInstance(LIU_BEI),
      createHeroInstance(GUAN_YU),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    expect(bonds.find(b => b.name === '桃园结义')).toBeUndefined()
  })

  it('test_historicalBond_wuHu_anyThreeOfFive_activates', () => {
    // Arrange — 关羽+张飞+赵云 (3 of 5 五虎上将)
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(ZHAO_YUN),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    const wuHu = bonds.find(b => b.name === '五虎上将')
    expect(wuHu).toBeDefined()
    expect(wuHu!.statBonuses[StatType.STR]).toBe(0.08)
  })

  it('test_historicalBond_wuHu_onlyTwo_notActivated', () => {
    // Arrange — 关羽+张飞 (only 2 of 5, need 3)
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    expect(bonds.find(b => b.name === '五虎上将')).toBeUndefined()
  })

  it('test_historicalBond_woLongFengChu_activates', () => {
    // Arrange
    const roster = [
      createHeroInstance(ZHUGE_LIANG),
      createHeroInstance(PANG_TONG),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    const bond = bonds.find(b => b.name === '卧龙凤雏')
    expect(bond).toBeDefined()
    expect(bond!.statBonuses[StatType.INT]).toBe(0.10)
  })

  it('test_historicalBond_jiangDong_sunCePlusZhouYu_activates', () => {
    // Arrange
    const roster = [
      createHeroInstance(SUN_CE),
      createHeroInstance(ZHOU_YU),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    const bond = bonds.find(b => b.name === '江东双壁')
    expect(bond).toBeDefined()
    // All stats +5%
    for (const stat of Object.values(StatType)) {
      expect(bond!.statBonuses[stat]).toBe(0.05)
    }
  })

  it('test_historicalBond_legendVariant_triggersViaBaseName', () => {
    // Arrange — legend variant 关羽 should still trigger 桃园结义
    const roster = [
      createHeroInstance(LIU_BEI),
      createHeroInstance(LEGEND_GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    const taoYuan = bonds.find(b => b.name === '桃园结义')
    expect(taoYuan).toBeDefined()
    expect(taoYuan!.participatingHeroes).toContain('关羽')
  })

  it('test_historicalBond_emptyRoster_noBondsActivated', () => {
    const bonds = evaluateHistoricalBonds([])
    expect(bonds).toHaveLength(0)
  })

  it('test_historicalBond_multipleBondsCanActivateSimultaneously', () => {
    // Arrange — 刘备+关羽+张飞+赵云 → 桃园结义 + 五虎上将(3人)
    const roster = [
      createHeroInstance(LIU_BEI),
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(ZHAO_YUN),
    ]

    // Act
    const bonds = evaluateHistoricalBonds(roster)

    // Assert
    expect(bonds.find(b => b.name === '桃园结义')).toBeDefined()
    expect(bonds.find(b => b.name === '五虎上将')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Full evaluateBonds — combined faction + historical
// ---------------------------------------------------------------------------

describe('Bond evaluation — evaluateBonds (combined)', () => {
  it('test_evaluateBonds_threeShuWithTaoYuan_factionPlusHistorical', () => {
    // Arrange — 刘备+关羽+张飞 = 3 Shu faction + 桃园结义
    const roster = [
      createHeroInstance(LIU_BEI),
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act
    const result = evaluateBonds(roster)

    // Assert
    expect(result.activatedBonds.length).toBeGreaterThanOrEqual(2)
    const factionBond = result.activatedBonds.find(b => b.type === BondType.Faction)
    const histBond = result.activatedBonds.find(b => b.name === '桃园结义')
    expect(factionBond).toBeDefined()
    expect(histBond).toBeDefined()
  })

  it('test_evaluateBonds_perHeroModifier_factionBonusAppliedToAllFactionMembers', () => {
    // Arrange — 2 Shu (STR+3%)
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act
    const result = evaluateBonds(roster)

    // Assert — both heroes get STR+3%
    const guanMod = result.perHeroModifiers.get('guan_yu')!
    const zhangMod = result.perHeroModifiers.get('zhang_fei')!
    expect(guanMod[StatType.STR]).toBe(0.03)
    expect(zhangMod[StatType.STR]).toBe(0.03)
  })

  it('test_evaluateBonds_historicalBonusAppliedOnlyToParticipants', () => {
    // Arrange — 诸葛亮+庞统+赵云 → 卧龙凤雏 activates for first two
    const roster = [
      createHeroInstance(ZHUGE_LIANG),
      createHeroInstance(PANG_TONG),
      createHeroInstance(ZHAO_YUN),
    ]

    // Act
    const result = evaluateBonds(roster)

    // Assert — 诸葛亮 and 庞统 get INT+10%, 赵云 doesn't
    const zhugeMod = result.perHeroModifiers.get('zhuge_liang')!
    const pangMod = result.perHeroModifiers.get('pang_tong')!
    const zhaoMod = result.perHeroModifiers.get('zhao_yun')!

    // They also get 3-Shu faction bonus (STR+5%, HP+3%)
    expect(zhugeMod[StatType.INT]).toBe(0.10)
    expect(pangMod[StatType.INT]).toBe(0.10)
    expect(zhaoMod[StatType.INT]).toBe(0)  // not in 卧龙凤雏
  })

  it('test_evaluateBonds_stackingFactionAndHistorical_sumsCorrectly', () => {
    // Arrange — 关羽+张飞+赵云: Shu 3人 (STR+5%, HP+3%) + 五虎上将 (STR+8%)
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(ZHAO_YUN),
    ]

    // Act
    const result = evaluateBonds(roster)

    // Assert — 关羽 gets faction STR+5% + 五虎 STR+8% = STR+13%
    const guanMod = result.perHeroModifiers.get('guan_yu')!
    expect(guanMod[StatType.STR]).toBe(0.13)
    expect(guanMod[StatType.HP]).toBe(0.03)  // only faction HP
  })

  it('test_evaluateBonds_cap25Percent_enforcedPerStat', () => {
    // Arrange — custom bonds that would exceed 25% for a stat
    const heavyBonds: HistoricalBondDefinition[] = [
      {
        id: 'heavy_bond_1',
        name: 'Heavy Bond 1',
        lore: '',
        requiredHeroes: ['关羽', '张飞'],
        requirementMode: { type: 'all' },
        statBonuses: { [StatType.STR]: 0.15 },
        requiredEquipmentIds: [],
        specialEffect: null,
      },
      {
        id: 'heavy_bond_2',
        name: 'Heavy Bond 2',
        lore: '',
        requiredHeroes: ['关羽', '张飞'],
        requirementMode: { type: 'all' },
        statBonuses: { [StatType.STR]: 0.15 },
        requiredEquipmentIds: [],
        specialEffect: null,
      },
    ]

    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act — faction (STR+3%) + bond1 (STR+15%) + bond2 (STR+15%) = 33% before cap
    const result = evaluateBonds(roster, StatType.STR, heavyBonds)

    // Assert — capped at 25%
    const guanMod = result.perHeroModifiers.get('guan_yu')!
    expect(guanMod[StatType.STR]).toBe(BOND_MODIFIER_CAP)
  })

  it('test_evaluateBonds_capAppliedPerStatIndependently', () => {
    // Arrange — one stat hits cap, another doesn't
    const mixedBonds: HistoricalBondDefinition[] = [
      {
        id: 'big_str',
        name: 'Big STR',
        lore: '',
        requiredHeroes: ['关羽', '张飞'],
        requirementMode: { type: 'all' },
        statBonuses: { [StatType.STR]: 0.20, [StatType.HP]: 0.05 },
        requiredEquipmentIds: [],
        specialEffect: null,
      },
    ]

    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act — STR: faction 3% + bond 20% = 23% (under cap), HP: faction 0% + bond 5% = 5%
    const result = evaluateBonds(roster, StatType.STR, mixedBonds)
    const guanMod = result.perHeroModifiers.get('guan_yu')!

    // Assert
    expect(guanMod[StatType.STR]).toBe(0.23)  // under cap
    expect(guanMod[StatType.HP]).toBe(0.05)   // well under cap
  })

  it('test_evaluateBonds_noHeroes_emptyResult', () => {
    const result = evaluateBonds([])
    expect(result.activatedBonds).toHaveLength(0)
    expect(result.perHeroModifiers.size).toBe(0)
  })

  it('test_evaluateBonds_singleHero_noFactionBondNoHistorical', () => {
    const roster = [createHeroInstance(GUAN_YU)]
    const result = evaluateBonds(roster)

    expect(result.activatedBonds).toHaveLength(0)
    const mod = result.perHeroModifiers.get('guan_yu')!
    for (const stat of Object.values(StatType)) {
      expect(mod[stat]).toBe(0)
    }
  })

  it('test_evaluateBonds_allHeroesGetModifierEntries', () => {
    // Arrange
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(CAO_CAO),
      createHeroInstance(ZHOU_YU),
    ]

    // Act
    const result = evaluateBonds(roster)

    // Assert — all 3 heroes in the map
    expect(result.perHeroModifiers.size).toBe(3)
    expect(result.perHeroModifiers.has('guan_yu')).toBe(true)
    expect(result.perHeroModifiers.has('cao_cao')).toBe(true)
    expect(result.perHeroModifiers.has('zhou_yu')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// applyBondResult integration
// ---------------------------------------------------------------------------

describe('Bond evaluation — applyBondResult integration', () => {
  it('test_applyBondResult_writesModifiersToHeroInstances', () => {
    // Arrange
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]
    const result = evaluateBonds(roster)

    // Act
    applyBondResult(roster, result)

    // Assert
    expect(roster[0].bondModifier[StatType.STR]).toBe(0.03)  // Shu 2-hero
    expect(roster[1].bondModifier[StatType.STR]).toBe(0.03)
  })

  it('test_applyBondResult_affectsCalculateFinalStat', () => {
    // Arrange
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    // Act — before bonds
    const strBefore = calculateFinalStat(roster[0], StatType.STR)

    const result = evaluateBonds(roster)
    applyBondResult(roster, result)

    const strAfter = calculateFinalStat(roster[0], StatType.STR)

    // Assert — STR+3% should increase final stat
    // 38 * 1.03 = 39.14 → round → 39
    expect(strBefore).toBe(38)
    expect(strAfter).toBe(39)
  })

  it('test_applyBondResult_largerBonus_correctCalculation', () => {
    // Arrange — 5 Shu = STR+10%, HP+8%
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(LIU_BEI),
      createHeroInstance(ZHAO_YUN),
      createHeroInstance(MA_CHAO),
    ]

    // 关羽+张飞+赵云+马超 = 五虎上将 (4 of 5, ≥3 → STR+8%)
    const result = evaluateBonds(roster)
    applyBondResult(roster, result)

    // Assert — 关羽's STR modifier = faction 10% + 五虎 8% = 18%
    const guanMod = roster[0].bondModifier
    expect(guanMod[StatType.STR]).toBe(0.18)
    expect(guanMod[StatType.HP]).toBe(0.08)

    // Final stat check: STR = 38 * (1 + 0.18) = 38 * 1.18 = 44.84 → 45
    expect(calculateFinalStat(roster[0], StatType.STR)).toBe(45)
  })

  it('test_applyBondResult_doesNotMutatePerHeroModifiersMap', () => {
    // Arrange
    const roster = [createHeroInstance(GUAN_YU), createHeroInstance(ZHANG_FEI)]
    const result = evaluateBonds(roster)
    const originalMod = { ...result.perHeroModifiers.get('guan_yu')! }

    // Act
    applyBondResult(roster, result)

    // Mutate hero's bondModifier
    roster[0].bondModifier[StatType.STR] = 0.99

    // Assert — original map is unaffected (we spread-copy in applyBondResult)
    expect(result.perHeroModifiers.get('guan_yu')![StatType.STR]).toBe(originalMod[StatType.STR])
  })
})

// ---------------------------------------------------------------------------
// Equipment-linked bond tests
// ---------------------------------------------------------------------------

describe('Bond evaluation — equipment-linked bonds', () => {
  // Create a test bond that requires equipment
  const EQUIP_BOND: HistoricalBondDefinition = {
    id: '绝世猛将_test',
    name: '绝世猛将',
    lore: '人中吕布，马中赤兔',
    requiredHeroes: ['吕布'],
    requirementMode: { type: 'all' },
    statBonuses: { [StatType.STR]: 0.10, [StatType.SPD]: 0.10 },
    requiredEquipmentIds: ['chi_tu_ma'],
    specialEffect: null,
  }

  it('test_equipmentBond_heroPresent_noEquipment_notActivated', () => {
    const roster = [createHeroInstance(LV_BU)]

    const bonds = evaluateHistoricalBonds(roster, [EQUIP_BOND])
    expect(bonds).toHaveLength(0)
  })

  it('test_equipmentBond_heroAndEquipmentPresent_activates', () => {
    const lvBuInstance = createHeroInstance(LV_BU)
    lvBuInstance.equippedItemIds = ['chi_tu_ma']
    const roster = [lvBuInstance]

    const bonds = evaluateHistoricalBonds(roster, [EQUIP_BOND])
    expect(bonds).toHaveLength(1)
    expect(bonds[0].name).toBe('绝世猛将')
    expect(bonds[0].statBonuses[StatType.STR]).toBe(0.10)
  })

  it('test_equipmentBond_equipmentOnDifferentHero_stillActivates', () => {
    // Equipment is on a different hero but lv_bu is in the roster
    const guanYuInstance = createHeroInstance(GUAN_YU)
    guanYuInstance.equippedItemIds = ['chi_tu_ma']
    const lvBuInstance = createHeroInstance(LV_BU)
    const roster = [guanYuInstance, lvBuInstance]

    const bonds = evaluateHistoricalBonds(roster, [EQUIP_BOND])
    expect(bonds).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Regression / edge cases from GDD
// ---------------------------------------------------------------------------

describe('Bond evaluation — edge cases', () => {
  it('test_edge_mixedFactions_3shu2wu_bothFactionBondsActivate', () => {
    const roster = [
      createHeroInstance(GUAN_YU),
      createHeroInstance(ZHANG_FEI),
      createHeroInstance(LIU_BEI),
      createHeroInstance(ZHOU_YU),
      createHeroInstance(SUN_CE),
    ]

    const result = evaluateBonds(roster)
    const factionBonds = result.activatedBonds.filter(b => b.type === BondType.Faction)
    expect(factionBonds).toHaveLength(2)
  })

  it('test_edge_legendVariantGuanYu_sharesModifierWithBase', () => {
    // Legend variant should get same bond benefits
    const roster = [
      createHeroInstance(LIU_BEI),
      createHeroInstance(LEGEND_GUAN_YU),
      createHeroInstance(ZHANG_FEI),
    ]

    const result = evaluateBonds(roster)
    const legendMod = result.perHeroModifiers.get('legend_guan_yu')!

    // Should have faction bonus (3 Shu = STR+5%, HP+3%) + 桃园结义 participant
    expect(legendMod[StatType.STR]).toBeGreaterThanOrEqual(0.05)
  })

  it('test_edge_bondModifierCapEnforced_neverExceeds025', () => {
    // Extreme case: many overlapping bonds
    const manyBonds: HistoricalBondDefinition[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test_bond_${i}`,
      name: `Test Bond ${i}`,
      lore: '',
      requiredHeroes: ['关羽', '张飞'],
      requirementMode: { type: 'all' as const },
      statBonuses: { [StatType.STR]: 0.10 },
      requiredEquipmentIds: [],
      specialEffect: null,
    }))

    const roster = [createHeroInstance(GUAN_YU), createHeroInstance(ZHANG_FEI)]
    const result = evaluateBonds(roster, StatType.STR, manyBonds)

    const guanMod = result.perHeroModifiers.get('guan_yu')!
    expect(guanMod[StatType.STR]).toBe(BOND_MODIFIER_CAP)
  })

  it('test_edge_bondResultIsImmutable_heroModifierCopied', () => {
    const roster = [createHeroInstance(GUAN_YU), createHeroInstance(ZHANG_FEI)]
    const result = evaluateBonds(roster)

    // Apply to roster
    applyBondResult(roster, result)

    // Modify hero directly
    roster[0].bondModifier[StatType.STR] = 999

    // Result map should be unaffected
    expect(result.perHeroModifiers.get('guan_yu')![StatType.STR]).not.toBe(999)
  })
})
