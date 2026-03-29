/**
 * Enemy System — Test Enemy Data
 *
 * Pre-built enemy data fixtures for unit tests, integration tests, and
 * prototype battles. Includes nameless units at various nodeIndexes,
 * test encounter configurations, and the two MVP Bosses (张角, 董卓).
 *
 * These fixtures are NOT production data — production encounters are generated
 * at runtime from campaign configuration.
 *
 * @module src/gameplay/enemy/testEnemies
 * @see design/gdd/enemy-system.md — MVP Boss list, Nameless Units table
 */

import type { EnemyEncounter, BossExtension, NamelessUnit } from './types'
import { NamelessTemplateType, EncounterType } from './types'
import {
  SkillType,
  TriggerCondition,
  TargetType,
  ScalingStat,
  Faction,
  HeroTier,
  HeroVariant,
  StatType,
} from '../hero/types'
import type { HeroData } from '../hero/types'
import {
  createNamelessUnit,
  scaleBossStats,
  createEncounter,
  createBossEncounter,
} from './enemyFactory'

// ---------------------------------------------------------------------------
// Nameless unit fixtures — nodeIndex 0
// ---------------------------------------------------------------------------

/** 小兵 at nodeIndex 0 — weakest unit. */
export const SOLDIER_NODE0: NamelessUnit = createNamelessUnit(NamelessTemplateType.Soldier, 0, 0)

/** 军团长 at nodeIndex 0. */
export const LEGION_LEADER_NODE0: NamelessUnit = createNamelessUnit(NamelessTemplateType.LegionLeader, 0, 0)

/** 都尉 at nodeIndex 0. */
export const LIEUTENANT_NODE0: NamelessUnit = createNamelessUnit(NamelessTemplateType.Lieutenant, 0, 0)

/** 谋士 at nodeIndex 0. */
export const ADVISOR_NODE0: NamelessUnit = createNamelessUnit(NamelessTemplateType.Advisor, 0, 0)

/** 骑兵队长 at nodeIndex 0. */
export const CAVALRY_LEADER_NODE0: NamelessUnit = createNamelessUnit(NamelessTemplateType.CavalryLeader, 0, 0)

// ---------------------------------------------------------------------------
// Nameless unit fixtures — nodeIndex 5 (mid-game scaling)
// ---------------------------------------------------------------------------

/** 军团长 at nodeIndex 5 — demonstrates scaling effect. */
export const LEGION_LEADER_NODE5: NamelessUnit = createNamelessUnit(NamelessTemplateType.LegionLeader, 5, 0)

/** 骑兵队长 at nodeIndex 5. */
export const CAVALRY_LEADER_NODE5: NamelessUnit = createNamelessUnit(NamelessTemplateType.CavalryLeader, 5, 0)

// ---------------------------------------------------------------------------
// Boss HeroData records — 张角 (Zhang Jue) and 董卓 (Dong Zhuo)
// ---------------------------------------------------------------------------

/**
 * 张角 (Zhang Jue) base HeroData — unscaled.
 * B-tier leader of the Yellow Turban Rebellion. INT-focused.
 * Total: STR:14 INT:32 DEF:18 HP:24 SPD:16 = 104 (B-tier range: 55–85 per-stat)
 *
 * As a Boss, scaleBossStats() inflates these by ×1.5.
 */
export const ZHANG_JUE_DATA: HeroData = {
  id:          'zhang_jue',
  name:        '张角',
  baseName:    '张角',
  title:       '天公将军',
  faction:     Faction.Qun,
  tier:        HeroTier.B,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 14,
    [StatType.INT]: 32,
    [StatType.DEF]: 18,
    [StatType.HP]:  24,
    [StatType.SPD]: 16,
  },
  statGrowthRates: {
    [StatType.STR]: 0.02,
    [StatType.INT]: 0.08,
    [StatType.DEF]: 0.04,
    [StatType.HP]:  0.05,
    [StatType.SPD]: 0.03,
  },
  skills: [
    {
      name:    '太平道',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '己方黄巾单位HP回复提升15%', magnitude: 0.15, duration: 0 }],
      target:  TargetType.AllAllies,
      scaling: ScalingStat.INT,
    },
    {
      name:     '符水治病',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnTurnStart,
      effects:  [{ description: '对敌方全体施加虚弱状态，持续2回合', magnitude: 0.15, duration: 2 }],
      target:   TargetType.AllEnemies,
      scaling:  ScalingStat.INT,
      cooldown: 4,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:         ['太平道', '黄巾', '智谋型', '首领'],
  bondKeys:     ['黄巾起义', '群雄阵营'],
  lore: {
    biography:       '张角，巨鹿人，太平道教主，以符水为人治病，深得民心。以"苍天已死，黄天当立"为口号，发动黄巾起义，动摇东汉根基。',
    historicalEvents: ['黄巾起义'],
  },
  artRef: 'enemies/zhang_jue',
}

/**
 * 董卓 (Dong Zhuo) base HeroData — unscaled.
 * A-tier warlord. STR + DEF bruiser with heavy HP pool.
 * Total: STR:34 INT:18 DEF:30 HP:38 SPD:12 = 132 (A-tier range: 85–130)
 */
export const DONG_ZHUO_DATA: HeroData = {
  id:          'dong_zhuo',
  name:        '董卓',
  baseName:    '董卓',
  title:       '相国',
  faction:     Faction.Qun,
  tier:        HeroTier.A,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 34,
    [StatType.INT]: 18,
    [StatType.DEF]: 30,
    [StatType.HP]:  38,
    [StatType.SPD]: 12,
  },
  statGrowthRates: {
    [StatType.STR]: 0.07,
    [StatType.INT]: 0.03,
    [StatType.DEF]: 0.07,
    [StatType.HP]:  0.09,
    [StatType.SPD]: 0.02,
  },
  skills: [
    {
      name:    '残暴统治',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '自身DEF+8%，敌方受到心理震慑，SPD-5%', magnitude: 0.08, duration: 0 }],
      target:  TargetType.Self,
      scaling: ScalingStat.DEF,
    },
    {
      name:     '暴怒',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnTakeDamage,
      effects:  [{ description: '受到攻击时有概率暴怒，自身STR+25%持续2回合', magnitude: 0.25, duration: 2 }],
      target:   TargetType.Self,
      scaling:  ScalingStat.STR,
      cooldown: 4,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:         ['骑兵', '武力型', '暴君', '首领'],
  bondKeys:     ['群雄阵营', '讨董联军'],
  lore: {
    biography:       '董卓，陇西人，东汉末年权臣，废少帝、立献帝，把持朝政。暴虐无道，激起诸侯讨伐，后为吕布所杀。',
    historicalEvents: ['废立皇帝', '讨董之战', '王允连环计'],
  },
  artRef: 'enemies/dong_zhuo',
}

// ---------------------------------------------------------------------------
// Boss HeroData — scaled versions (×1.5 multiplier applied)
// ---------------------------------------------------------------------------

/** 张角 with Boss stat multiplier applied (×1.5). */
export const ZHANG_JUE_BOSS: HeroData = scaleBossStats(ZHANG_JUE_DATA)

/** 董卓 with Boss stat multiplier applied (×1.5). */
export const DONG_ZHUO_BOSS: HeroData = scaleBossStats(DONG_ZHUO_DATA)

// ---------------------------------------------------------------------------
// Boss extensions — 张角 (2-phase, summon reinforcements)
// ---------------------------------------------------------------------------

/**
 * Boss extension for 张角 (Zhang Jue).
 * Phase 2: HP < 50% → summons 2×黄巾力士 (Soldier template), INT+20%.
 *
 * @see design/gdd/enemy-system.md — MVP Boss list
 */
export const ZHANG_JUE_EXTENSION: BossExtension = {
  phases: [
    {
      hpThreshold: 0.5,
      statModifier: { [StatType.INT]: 1.20 },
      dialogue: '黄天已立！天助我也！',
    },
  ],
  summonWaves: [
    {
      trigger: 'phase_change',
      units:   [NamelessTemplateType.Soldier, NamelessTemplateType.Soldier],
    },
  ],
  immunities: [],
}

// ---------------------------------------------------------------------------
// Boss extension — 董卓 (2-phase, fire weakness, rage)
// ---------------------------------------------------------------------------

/**
 * Boss extension for 董卓 (Dong Zhuo).
 * Phase 2: HP < 40% → ATK+30%, fire-type damage weakness.
 *
 * @see design/gdd/enemy-system.md — MVP Boss list
 */
export const DONG_ZHUO_EXTENSION: BossExtension = {
  phases: [
    {
      hpThreshold: 0.4,
      statModifier: { [StatType.STR]: 1.30 },
      dialogue: '尔等鼠辈，朕要将你们碎尸万段！',
    },
  ],
  immunities: [],
}

// ---------------------------------------------------------------------------
// Test encounter fixtures
// ---------------------------------------------------------------------------

/**
 * Early-game encounter (nodeIndex 0) — 4 nameless units + 0 named heroes.
 * Used in tests requiring a valid Normal encounter at nodeIndex 0.
 *
 * Note: uses all five positions, filling with 4 nameless + 1 extra soldier.
 */
export const EARLY_ENCOUNTER: EnemyEncounter = createEncounter(
  [
    createNamelessUnit(NamelessTemplateType.Soldier,       0, 0),
    createNamelessUnit(NamelessTemplateType.Soldier,       0, 1),
    createNamelessUnit(NamelessTemplateType.LegionLeader,  0, 0),
    createNamelessUnit(NamelessTemplateType.Lieutenant,    0, 0),
    createNamelessUnit(NamelessTemplateType.CavalryLeader, 0, 0),
  ],
  [],
  EncounterType.Normal,
  [],
)

/**
 * Mid-game encounter (nodeIndex 8) — 2 nameless + 3 named heroes.
 * Named heroes use ZHANG_JUE_DATA and DONG_ZHUO_DATA at unscaled values.
 */
export const MID_ENCOUNTER: EnemyEncounter = createEncounter(
  [
    createNamelessUnit(NamelessTemplateType.Soldier,      8, 0),
    createNamelessUnit(NamelessTemplateType.LegionLeader, 8, 0),
  ],
  [ZHANG_JUE_DATA, DONG_ZHUO_DATA, DONG_ZHUO_DATA],
  EncounterType.Normal,
  [],
)

/**
 * Zhang Jue Boss encounter.
 * Guards: 2 军团长 + 2 谋士.
 *
 * @see design/gdd/enemy-system.md — MVP Boss list
 */
export const ZHANG_JUE_ENCOUNTER: EnemyEncounter = createBossEncounter(
  ZHANG_JUE_BOSS,
  [
    createNamelessUnit(NamelessTemplateType.LegionLeader, 5, 0),
    createNamelessUnit(NamelessTemplateType.LegionLeader, 5, 1),
    createNamelessUnit(NamelessTemplateType.Advisor,      5, 0),
    createNamelessUnit(NamelessTemplateType.Advisor,      5, 1),
  ],
  ZHANG_JUE_EXTENSION,
  [{ itemId: 'named_weapon_seven_stars', dropChance: 0.3 }],
)

/**
 * Dong Zhuo Boss encounter.
 * Guards: 华雄(A) + 李傕(B) — represented by DONG_ZHUO_DATA as stand-in until
 * those hero records exist + 2 骑兵队长.
 *
 * @see design/gdd/enemy-system.md — MVP Boss list
 */
export const DONG_ZHUO_ENCOUNTER: EnemyEncounter = createBossEncounter(
  DONG_ZHUO_BOSS,
  [
    DONG_ZHUO_DATA, // Stand-in for 华雄 until hero data exists
    ZHANG_JUE_DATA, // Stand-in for 李傕 until hero data exists
    createNamelessUnit(NamelessTemplateType.CavalryLeader, 10, 0),
    createNamelessUnit(NamelessTemplateType.CavalryLeader, 10, 1),
  ],
  DONG_ZHUO_EXTENSION,
  [{ itemId: 'named_weapon_green_dragon', dropChance: 0.5 }],
)

// ---------------------------------------------------------------------------
// Convenience array
// ---------------------------------------------------------------------------

/** All five nameless units at nodeIndex 0 as an array for iteration in tests. */
export const TEST_NAMELESS_NODE0: NamelessUnit[] = [
  SOLDIER_NODE0,
  LEGION_LEADER_NODE0,
  LIEUTENANT_NODE0,
  ADVISOR_NODE0,
  CAVALRY_LEADER_NODE0,
]
