/**
 * Hero System — Test Hero Data
 *
 * Five A-tier hero data records used for unit tests, integration tests, and
 * prototype battles. All values satisfy the A-tier stat constraints from the GDD
 * (total 85–130, each individual stat 15–40).
 *
 * These records are NOT production hero files — production heroes will be loaded
 * from JSON config files in assets/data/heroes/.
 *
 * @module src/gameplay/hero/testHeroes
 * @see design/gdd/hero-system.md — Base Stat Ranges by Tier
 */

import type { HeroData } from './types'
import {
  Faction,
  HeroTier,
  HeroVariant,
  StatType,
  SkillType,
  TriggerCondition,
  TargetType,
  ScalingStat,
} from './types'

// ---------------------------------------------------------------------------
// 关羽 (Guan Yu) — 蜀 / A — STR + DEF + HP bruiser
// GDD example: STR:38 INT:12 DEF:28 HP:34 SPD:18  total = 130
// ---------------------------------------------------------------------------

/** 关羽 — 美髯公, Shu faction, A-tier STR/HP bruiser. Total base stats: 130. */
export const GUAN_YU: HeroData = {
  id:          'guan_yu',
  name:        '关羽',
  baseName:    '关羽',
  title:       '美髯公',
  faction:     Faction.Shu,
  tier:        HeroTier.A,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 38,
    [StatType.INT]: 12,
    [StatType.DEF]: 28,
    [StatType.HP]:  34,
    [StatType.SPD]: 18,
  },
  // Growth rates reflect his physical archetype: STR and HP grow fastest.
  statGrowthRates: {
    [StatType.STR]: 0.08,
    [StatType.INT]: 0.02,
    [StatType.DEF]: 0.06,
    [StatType.HP]:  0.07,
    [StatType.SPD]: 0.03,
  },
  skills: [
    {
      name:     '忠义之心',
      type:     SkillType.Passive,
      trigger:  TriggerCondition.PassiveAura,
      effects:  [{ description: '每回合开始时，自身STR+2，持续3回合', magnitude: 2, duration: 3 }],
      target:   TargetType.Self,
      scaling:  ScalingStat.STR,
    },
    {
      name:     '青龙偃月',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnNthAttack,
      effects:  [{ description: '对前排所有敌人造成大量物理伤害', magnitude: 2.5, duration: 0 }],
      target:   TargetType.AllEnemies,
      scaling:  ScalingStat.STR,
      cooldown: 4,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:      ['骑兵', '忠义', '武力型', '先锋', '五虎上将'],
  bondKeys:  ['桃园结义', '五虎上将', '蜀汉阵营'],
  lore: {
    biography:       '关羽，字云长，河东郡解县人。东汉末年名将，早期跟随刘备辗转各地。曾被曹操俘虏，后千里走单骑归还刘备。镇守荆州期间水淹七军，威震华夏。后兵败麦城，为孙权所杀。',
    historicalEvents: ['桃园结义', '过五关斩六将', '千里走单骑', '水淹七军', '麦城之战'],
  },
  artRef: 'heroes/guan_yu_base',
}

// ---------------------------------------------------------------------------
// 张飞 (Zhang Fei) — 蜀 / A — STR + HP tank with battle-start intimidation
// Total: STR:32 INT:10 DEF:26 HP:38 SPD:16 = 122
// ---------------------------------------------------------------------------

/** 张飞 — 燕人张飞, Shu faction, A-tier tank/intimidator. Total base stats: 122. */
export const ZHANG_FEI: HeroData = {
  id:          'zhang_fei',
  name:        '张飞',
  baseName:    '张飞',
  title:       '燕人张飞',
  faction:     Faction.Shu,
  tier:        HeroTier.A,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 32,
    [StatType.INT]: 10,
    [StatType.DEF]: 26,
    [StatType.HP]:  38,
    [StatType.SPD]: 16,
  },
  statGrowthRates: {
    [StatType.STR]: 0.07,
    [StatType.INT]: 0.02,
    [StatType.DEF]: 0.06,
    [StatType.HP]:  0.09,
    [StatType.SPD]: 0.02,
  },
  skills: [
    {
      name:    '怒吼',
      type:    SkillType.Passive,
      trigger: TriggerCondition.OnBattleStart,
      effects: [{ description: '战斗开始时震慑前排敌人，降低其攻击频率20%，持续2回合', magnitude: 0.2, duration: 2 }],
      target:  TargetType.AllEnemies,
      scaling: ScalingStat.STR,
    },
    {
      name:     '长坂坡怒吼',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnNthAttack,
      effects:  [{ description: '对单个敌人造成高额物理伤害，有概率使其眩晕1回合', magnitude: 3.0, duration: 1 }],
      target:   TargetType.SingleEnemy,
      scaling:  ScalingStat.STR,
      cooldown: 5,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:      ['步兵', '忠义', '武力型', '先锋', '五虎上将'],
  bondKeys:  ['桃园结义', '五虎上将', '蜀汉阵营'],
  lore: {
    biography:       '张飞，字益德，涿郡人。刘备结义兄弟，以勇猛善战著称。长坂坡一声大喝令曹军胆寒。后随刘备入蜀，封西乡侯，官至车骑将军。',
    historicalEvents: ['桃园结义', '长坂坡之战', '入川之战', '阆中镇守'],
  },
  artRef: 'heroes/zhang_fei_base',
}

// ---------------------------------------------------------------------------
// 曹操 (Cao Cao) — 魏 / A — balanced commander with leadership aura
// Total: STR:25 INT:30 DEF:22 HP:28 SPD:17 = 122
// ---------------------------------------------------------------------------

/** 曹操 — 治世之能臣, Wei faction, A-tier balanced commander. Total base stats: 122. */
export const CAO_CAO: HeroData = {
  id:          'cao_cao',
  name:        '曹操',
  baseName:    '曹操',
  title:       '治世之能臣，乱世之奸雄',
  faction:     Faction.Wei,
  tier:        HeroTier.A,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 25,
    [StatType.INT]: 30,
    [StatType.DEF]: 22,
    [StatType.HP]:  28,
    [StatType.SPD]: 17,
  },
  statGrowthRates: {
    [StatType.STR]: 0.04,
    [StatType.INT]: 0.07,
    [StatType.DEF]: 0.05,
    [StatType.HP]:  0.05,
    [StatType.SPD]: 0.04,
  },
  skills: [
    {
      name:    '王霸之气',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '友方全体STR和INT各提升5%（光环）', magnitude: 0.05, duration: 0 }],
      target:  TargetType.AllAllies,
      scaling: ScalingStat.INT,
    },
    {
      name:     '挟天子以令诸侯',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnTurnStart,
      effects:  [{ description: '使敌方单体混乱，下回合攻击随机目标（含友方），持续2回合', magnitude: 1.0, duration: 2 }],
      target:   TargetType.SingleEnemy,
      scaling:  ScalingStat.INT,
      cooldown: 4,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:      ['骑兵', '统帅', '智谋型', '领袖', '魏五将'],
  bondKeys:  ['魏国阵营', '官渡之战', '曹魏核心'],
  lore: {
    biography:       '曹操，字孟德，沛国谯县人。东汉末年杰出的政治家、军事家、文学家。挟天子以令诸侯，统一中国北方，奠定曹魏基础。其诗"对酒当歌，人生几何"传颂至今。',
    historicalEvents: ['讨伐黄巾', '迎献帝都许', '官渡之战', '赤壁之战', '铜雀台赋'],
  },
  artRef: 'heroes/cao_cao_base',
}

// ---------------------------------------------------------------------------
// 周瑜 (Zhou Yu) — 吴 / A — INT-focused strategist
// Total: STR:15 INT:38 DEF:20 HP:26 SPD:25 = 124
// ---------------------------------------------------------------------------

/** 周瑜 — 美周郎, Wu faction, A-tier INT strategist. Total base stats: 124. */
export const ZHOU_YU: HeroData = {
  id:          'zhou_yu',
  name:        '周瑜',
  baseName:    '周瑜',
  title:       '美周郎',
  faction:     Faction.Wu,
  tier:        HeroTier.A,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 15,
    [StatType.INT]: 38,
    [StatType.DEF]: 20,
    [StatType.HP]:  26,
    [StatType.SPD]: 25,
  },
  statGrowthRates: {
    [StatType.STR]: 0.02,
    [StatType.INT]: 0.09,
    [StatType.DEF]: 0.04,
    [StatType.HP]:  0.04,
    [StatType.SPD]: 0.06,
  },
  skills: [
    {
      name:    '火攻精通',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '己方火属性技能伤害提升15%（光环）', magnitude: 0.15, duration: 0 }],
      target:  TargetType.AllAllies,
      scaling: ScalingStat.INT,
    },
    {
      name:     '火烧连营',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnTurnEnd,
      effects:  [{ description: '对敌方全体造成中等火焰伤害，并施加燃烧状态2回合', magnitude: 1.8, duration: 2 }],
      target:   TargetType.AllEnemies,
      scaling:  ScalingStat.INT,
      cooldown: 4,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:      ['水军', '智谋型', '火攻', '吴国核心'],
  bondKeys:  ['吴国阵营', '赤壁之战', '江东双壁'],
  lore: {
    biography:       '周瑜，字公瑾，庐江郡舒县人。东汉末年东吴名将，以赤壁之战大破曹操而名垂青史。精通音律，时有"曲有误，周郎顾"之说。',
    historicalEvents: ['赤壁之战', '江夏之战', '南郡之战'],
  },
  artRef: 'heroes/zhou_yu_base',
}

// ---------------------------------------------------------------------------
// 吕布 (Lv Bu) — 群 / A — highest STR, lone wolf
// Total: STR:40 INT:12 DEF:24 HP:32 SPD:18 = 126
// ---------------------------------------------------------------------------

/** 吕布 — 飞将，Qun faction, A-tier highest-STR lone warrior. Total base stats: 126. */
export const LV_BU: HeroData = {
  id:          'lv_bu',
  name:        '吕布',
  baseName:    '吕布',
  title:       '飞将',
  faction:     Faction.Qun,
  tier:        HeroTier.A,
  variant:     HeroVariant.Base,
  legendTitle: null,
  baseStats: {
    [StatType.STR]: 40,
    [StatType.INT]: 12,
    [StatType.DEF]: 24,
    [StatType.HP]:  32,
    [StatType.SPD]: 18,
  },
  statGrowthRates: {
    [StatType.STR]: 0.10,
    [StatType.INT]: 0.02,
    [StatType.DEF]: 0.05,
    [StatType.HP]:  0.06,
    [StatType.SPD]: 0.04,
  },
  skills: [
    {
      name:    '无双',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '自身STR提升10%（持续光环），但无法触发阵营羁绊', magnitude: 0.10, duration: 0 }],
      target:  TargetType.Self,
      scaling: ScalingStat.STR,
    },
    {
      name:     '方天画戟',
      type:     SkillType.Active,
      trigger:  TriggerCondition.OnNthAttack,
      effects:  [{ description: '对单体目标造成极高物理伤害', magnitude: 3.5, duration: 0 }],
      target:   TargetType.SingleEnemy,
      scaling:  ScalingStat.STR,
      cooldown: 5,
    },
  ],
  martialArts:  null,
  advisorSkill: null,
  tags:      ['骑兵', '武力型', '独狼', '飞将'],
  bondKeys:  ['群雄阵营', '三英战吕布'],
  lore: {
    biography:       '吕布，字奉先，五原郡九原县人。东汉末年第一猛将，以"人中吕布，马中赤兔"著称。先事丁原，后投董卓，辗转多处，最终为曹操所擒，被处死于白门楼。',
    historicalEvents: ['虎牢关之战', '濮阳之战', '白门楼'],
  },
  artRef: 'heroes/lv_bu_base',
}

// ---------------------------------------------------------------------------
// Convenience export
// ---------------------------------------------------------------------------

/** All five test heroes as an array, useful for iteration in tests. */
export const TEST_HEROES: HeroData[] = [GUAN_YU, ZHANG_FEI, CAO_CAO, ZHOU_YU, LV_BU]
