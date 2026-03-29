/**
 * Bond System — Configuration Constants & Data
 *
 * All tuning knobs and bond definitions live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/bond/bondConfig
 * @see design/gdd/bond-system.md — Tuning Knobs, Faction Bonds, Historical Bonds
 */

import { Faction, StatType } from '../hero/types'
import type { FactionBondDefinition, HistoricalBondDefinition } from './types'

// ---------------------------------------------------------------------------
// Global tuning knobs
// ---------------------------------------------------------------------------

/**
 * Maximum per-stat bond modifier (percentage as decimal).
 * No single stat's bondModifier may exceed this value.
 *
 * @see design/gdd/bond-system.md — Formulas: BOND_MODIFIER_CAP
 */
export const BOND_MODIFIER_CAP = 0.25

// ---------------------------------------------------------------------------
// Faction Bond Table
// ---------------------------------------------------------------------------

/**
 * Faction bond definitions with tiered thresholds.
 *
 * GDD source:
 *   蜀 Shu: STR/HP focused
 *   魏 Wei: INT/DEF focused
 *   吴 Wu:  SPD/DEF focused
 *   群 Qun: random attribute (resolved at run start)
 *
 * @see design/gdd/bond-system.md — Faction Bonds
 */
export const FACTION_BOND_TABLE: Record<Faction, FactionBondDefinition> = {
  [Faction.Shu]: {
    faction: Faction.Shu,
    name: '蜀汉阵营',
    tiers: [
      { requiredCount: 2, statBonuses: { [StatType.STR]: 0.03 } },
      { requiredCount: 3, statBonuses: { [StatType.STR]: 0.05, [StatType.HP]: 0.03 } },
      { requiredCount: 4, statBonuses: { [StatType.STR]: 0.08, [StatType.HP]: 0.05 } },
      { requiredCount: 5, statBonuses: { [StatType.STR]: 0.10, [StatType.HP]: 0.08 } },
    ],
  },
  [Faction.Wei]: {
    faction: Faction.Wei,
    name: '魏国阵营',
    tiers: [
      { requiredCount: 2, statBonuses: { [StatType.INT]: 0.03 } },
      { requiredCount: 3, statBonuses: { [StatType.INT]: 0.05, [StatType.DEF]: 0.03 } },
      { requiredCount: 4, statBonuses: { [StatType.INT]: 0.08, [StatType.DEF]: 0.05 } },
      { requiredCount: 5, statBonuses: { [StatType.INT]: 0.10, [StatType.DEF]: 0.08 } },
    ],
  },
  [Faction.Wu]: {
    faction: Faction.Wu,
    name: '东吴阵营',
    tiers: [
      { requiredCount: 2, statBonuses: { [StatType.SPD]: 0.03 } },
      { requiredCount: 3, statBonuses: { [StatType.SPD]: 0.05, [StatType.DEF]: 0.03 } },
      { requiredCount: 4, statBonuses: { [StatType.SPD]: 0.08, [StatType.DEF]: 0.05 } },
      { requiredCount: 5, statBonuses: { [StatType.SPD]: 0.10, [StatType.DEF]: 0.08 } },
    ],
  },
  [Faction.Qun]: {
    faction: Faction.Qun,
    name: '群雄阵营',
    tiers: [
      // Qun bonuses target a random stat determined at run start.
      // The evaluator replaces the placeholder stat with the run's random stat.
      // Here we use STR as placeholder — bondManager resolves this at runtime.
      { requiredCount: 2, statBonuses: { [StatType.STR]: 0.03 } },
      { requiredCount: 3, statBonuses: { [StatType.STR]: 0.05 } },
      { requiredCount: 4, statBonuses: { [StatType.STR]: 0.08 } },
      { requiredCount: 5, statBonuses: { [StatType.STR]: 0.12 } },
    ],
  },
}

// ---------------------------------------------------------------------------
// Historical Bond Definitions (MVP — 8 bonds)
// ---------------------------------------------------------------------------

/**
 * MVP historical bonds — a representative subset of the GDD's 20-30 planned bonds.
 * Covers all four factions and major gameplay patterns:
 * - Simple "all required" bonds (桃园结义, 卧龙凤雏, 江东双壁)
 * - "any N of M" bonds (五虎上将, 火烧赤壁)
 * - Cross-faction bonds (三英战吕布, 三分天下)
 * - Equipment-linked bonds (绝世猛将)
 *
 * @see design/gdd/bond-system.md — Historical Bonds
 */
export const HISTORICAL_BONDS: HistoricalBondDefinition[] = [
  // --- 蜀汉 ---
  {
    id: '桃园结义',
    name: '桃园结义',
    lore: '刘备、关羽、张飞桃园三结义，不求同年同月同日生，但求同年同月同日死。',
    requiredHeroes: ['刘备', '关羽', '张飞'],
    requirementMode: { type: 'all' },
    statBonuses: {},  // Special effect — damage sharing, handled by Battle Engine
    requiredEquipmentIds: [],
    specialEffect: '三人互相受伤时分担15%伤害',
  },
  {
    id: '五虎上将',
    name: '五虎上将',
    lore: '关羽、张飞、赵云、马超、黄忠，蜀汉五虎大将。',
    requiredHeroes: ['关羽', '张飞', '赵云', '马超', '黄忠'],
    requirementMode: { type: 'any_n', count: 3 },
    statBonuses: { [StatType.STR]: 0.08 },
    requiredEquipmentIds: [],
    specialEffect: null,
  },
  {
    id: '卧龙凤雏',
    name: '卧龙凤雏',
    lore: '诸葛亮号卧龙，庞统号凤雏，得一可安天下。',
    requiredHeroes: ['诸葛亮', '庞统'],
    requirementMode: { type: 'all' },
    statBonuses: { [StatType.INT]: 0.10 },
    requiredEquipmentIds: [],
    specialEffect: null,
  },

  // --- 曹魏 ---
  {
    id: '五子良将',
    name: '五子良将',
    lore: '张辽、乐进、于禁、张郃、徐晃，曹魏五子良将。',
    requiredHeroes: ['张辽', '乐进', '于禁', '张郃', '徐晃'],
    requirementMode: { type: 'any_n', count: 3 },
    statBonuses: { [StatType.DEF]: 0.06, [StatType.STR]: 0.04 },
    requiredEquipmentIds: [],
    specialEffect: null,
  },
  {
    id: '典韦之忠',
    name: '典韦之忠',
    lore: '典韦在宛城为保护曹操战死，忠义无双。',
    requiredHeroes: ['典韦', '曹操'],
    requirementMode: { type: 'all' },
    statBonuses: {},
    requiredEquipmentIds: [],
    specialEffect: '典韦为曹操承受25%伤害',
  },

  // --- 东吴 ---
  {
    id: '江东双壁',
    name: '江东双壁',
    lore: '孙策与周瑜，总角之好，义结金兰。',
    requiredHeroes: ['孙策', '周瑜'],
    requirementMode: { type: 'all' },
    statBonuses: {
      [StatType.STR]: 0.05,
      [StatType.INT]: 0.05,
      [StatType.DEF]: 0.05,
      [StatType.HP]:  0.05,
      [StatType.SPD]: 0.05,
    },
    requiredEquipmentIds: [],
    specialEffect: null,
  },
  {
    id: '火烧赤壁',
    name: '火烧赤壁',
    lore: '周瑜、诸葛亮、黄盖联手，火烧曹操百万大军。',
    requiredHeroes: ['周瑜', '诸葛亮', '黄盖'],
    requirementMode: { type: 'any_n', count: 2 },
    statBonuses: { [StatType.INT]: 0.05 },
    requiredEquipmentIds: [],
    specialEffect: '参与武将火属性技能+15%',
  },

  // --- 群雄/跨阵营 ---
  {
    id: '三分天下',
    name: '三分天下',
    lore: '刘备、曹操、孙权三足鼎立，天下三分。',
    requiredHeroes: ['刘备', '曹操', '孙权'],
    requirementMode: { type: 'all' },
    statBonuses: {},  // Special: each hero gets +5% to their highest stat
    requiredEquipmentIds: [],
    specialEffect: '三人各+5%最高属性',
  },
]
