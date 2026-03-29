/**
 * Enemy System — Configuration Constants
 *
 * All tuning knobs for the enemy system live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * Values and safe ranges sourced from the GDD Tuning Knobs table.
 *
 * @module src/gameplay/enemy/enemyConfig
 * @see design/gdd/enemy-system.md — Tuning Knobs, Formulas
 */

import {
  NamelessTemplateType,
  type NamelessTemplate,
} from './types'
import {
  StatType,
  SkillType,
  TriggerCondition,
  TargetType,
  ScalingStat,
} from '../hero/types'

// ---------------------------------------------------------------------------
// Battle format
// ---------------------------------------------------------------------------

/**
 * Fixed number of enemy units in a standard (non-Boss) battle.
 * Boss encounters may exceed this number via summon reinforcements.
 *
 * @see design/gdd/enemy-system.md — Battle Format
 */
export const STANDARD_BATTLE_SIZE = 5

// ---------------------------------------------------------------------------
// Nameless unit scaling
// ---------------------------------------------------------------------------

/**
 * Per-node stat growth multiplier for nameless units.
 *
 * Formula:
 *   namelessStat = templateBaseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE)
 *
 * Safe range: 0.05–0.15. Higher → nameless units are stronger in later nodes.
 *
 * @see design/gdd/enemy-system.md — Formulas: Nameless Unit Scaling
 */
export const NAMELESS_SCALING_RATE = 0.10

// ---------------------------------------------------------------------------
// Boss multiplier
// ---------------------------------------------------------------------------

/**
 * Stat multiplier applied to a Boss's base stats from its HeroData record.
 *
 * Formula:
 *   bossStat = heroBaseStat * BOSS_STAT_MULTIPLIER
 *
 * Safe range: 1.3–2.0. Higher → tougher Boss; lower → more approachable Boss.
 *
 * @see design/gdd/enemy-system.md — Formulas: Boss Stat Multiplier
 */
export const BOSS_STAT_MULTIPLIER = 1.5

// ---------------------------------------------------------------------------
// Composition ratio
// ---------------------------------------------------------------------------

/**
 * Initial number of nameless units (out of STANDARD_BATTLE_SIZE) at nodeIndex 0.
 *
 * Formula:
 *   namelessCount = max(0, BASE_NAMELESS - floor(nodeIndex / NAMELESS_REDUCTION_STEP))
 *   namedCount    = STANDARD_BATTLE_SIZE - namelessCount
 *
 * Safe range: 3–4.
 *
 * @see design/gdd/enemy-system.md — Formulas: Composition Ratio
 */
export const BASE_NAMELESS = 4

/**
 * Every N nodes, one nameless unit slot is replaced with a named hero.
 *
 * Safe range: 3–5. Lower → difficulty ramps faster; higher → difficulty ramps slower.
 *
 * @see design/gdd/enemy-system.md — Formulas: Composition Ratio
 */
export const NAMELESS_REDUCTION_STEP = 4

// ---------------------------------------------------------------------------
// Boss phase threshold
// ---------------------------------------------------------------------------

/**
 * Default HP fraction (0–1) at which a Boss transitions to Phase 2.
 * Each Boss's phases override this if they define their own `hpThreshold`.
 *
 * Safe range: 0.3–0.6.
 *
 * @see design/gdd/enemy-system.md — Tuning Knobs
 */
export const BOSS_PHASE_THRESHOLD = 0.5

// ---------------------------------------------------------------------------
// Nameless unit templates
// ---------------------------------------------------------------------------

/**
 * Static template definitions for all five nameless unit archetypes.
 * `baseStats` are unscaled values at nodeIndex 0.
 * Skills are defined inline as minimal passive entries.
 *
 * @see design/gdd/enemy-system.md — Nameless Units table
 */
export const NAMELESS_TEMPLATES: Record<NamelessTemplateType, NamelessTemplate> = {

  // ---------------------------------------------------------------------------
  // 小兵 (Soldier) — weakest fill unit, no skills
  // Total base stats: STR:8 INT:6 DEF:7 HP:10 SPD:8 = 39
  // ---------------------------------------------------------------------------
  [NamelessTemplateType.Soldier]: {
    type: NamelessTemplateType.Soldier,
    name: '小兵',
    baseStats: {
      [StatType.STR]: 8,
      [StatType.INT]: 6,
      [StatType.DEF]: 7,
      [StatType.HP]:  10,
      [StatType.SPD]: 8,
    },
    skill: null,
  },

  // ---------------------------------------------------------------------------
  // 军团长 (Legion Leader) — STR bias, passive "统领"
  // Total: STR:14 INT:7 DEF:10 HP:12 SPD:9 = 52
  // ---------------------------------------------------------------------------
  [NamelessTemplateType.LegionLeader]: {
    type: NamelessTemplateType.LegionLeader,
    name: '军团长',
    baseStats: {
      [StatType.STR]: 14,
      [StatType.INT]: 7,
      [StatType.DEF]: 10,
      [StatType.HP]:  12,
      [StatType.SPD]: 9,
    },
    skill: {
      name:    '统领',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '周围小兵ATK+5%', magnitude: 0.05, duration: 0 }],
      target:  TargetType.AllAllies,
      scaling: ScalingStat.STR,
    },
  },

  // ---------------------------------------------------------------------------
  // 都尉 (Lieutenant) — DEF bias, passive "坚守"
  // Total: STR:10 INT:8 DEF:15 HP:13 SPD:8 = 54
  // ---------------------------------------------------------------------------
  [NamelessTemplateType.Lieutenant]: {
    type: NamelessTemplateType.Lieutenant,
    name: '都尉',
    baseStats: {
      [StatType.STR]: 10,
      [StatType.INT]: 8,
      [StatType.DEF]: 15,
      [StatType.HP]:  13,
      [StatType.SPD]: 8,
    },
    skill: {
      name:    '坚守',
      type:    SkillType.Passive,
      trigger: TriggerCondition.PassiveAura,
      effects: [{ description: '自身DEF+10%', magnitude: 0.10, duration: 0 }],
      target:  TargetType.Self,
      scaling: ScalingStat.DEF,
    },
  },

  // ---------------------------------------------------------------------------
  // 谋士 (Advisor) — INT bias, passive "鼓舞"
  // Total: STR:8 INT:16 DEF:9 HP:11 SPD:10 = 54
  // ---------------------------------------------------------------------------
  [NamelessTemplateType.Advisor]: {
    type: NamelessTemplateType.Advisor,
    name: '谋士',
    baseStats: {
      [StatType.STR]: 8,
      [StatType.INT]: 16,
      [StatType.DEF]: 9,
      [StatType.HP]:  11,
      [StatType.SPD]: 10,
    },
    skill: {
      name:    '鼓舞',
      type:    SkillType.Passive,
      trigger: TriggerCondition.OnTurnStart,
      effects: [{ description: '回合开始全体回复少量HP', magnitude: 3, duration: 0 }],
      target:  TargetType.AllAllies,
      scaling: ScalingStat.INT,
    },
  },

  // ---------------------------------------------------------------------------
  // 骑兵队长 (Cavalry Leader) — SPD bias, passive "冲锋"
  // Total: STR:12 INT:7 DEF:9 HP:11 SPD:15 = 54
  // ---------------------------------------------------------------------------
  [NamelessTemplateType.CavalryLeader]: {
    type: NamelessTemplateType.CavalryLeader,
    name: '骑兵队长',
    baseStats: {
      [StatType.STR]: 12,
      [StatType.INT]: 7,
      [StatType.DEF]: 9,
      [StatType.HP]:  11,
      [StatType.SPD]: 15,
    },
    skill: {
      name:    '冲锋',
      type:    SkillType.Passive,
      trigger: TriggerCondition.OnBattleStart,
      effects: [{ description: '首次攻击伤害+20%', magnitude: 0.20, duration: 1 }],
      target:  TargetType.Self,
      scaling: ScalingStat.STR,
    },
  },
}
