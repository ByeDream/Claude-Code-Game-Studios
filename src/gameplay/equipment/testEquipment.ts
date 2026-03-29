/**
 * Equipment System — Test Equipment Data
 *
 * Six equipment records used for unit tests, integration tests, and prototype battles.
 * Covers all three equipment tiers (Basic, Advanced, Named) and all three slot types
 * (Weapon, Armor, Mount), with one Named item (青龙偃月刀) as the quality-shift example.
 *
 * These records are NOT production equipment files — production data will be loaded
 * from JSON config files in assets/data/equipment/.
 *
 * @module src/gameplay/equipment/testEquipment
 * @see design/gdd/equipment-system.md — Equipment Tiers
 */

import type { EquipmentData } from './types'
import { EquipSlot, EquipCategory } from './types'
import { StatType } from '../hero/types'

// ---------------------------------------------------------------------------
// 铁刀 — Basic Lv.1 Weapon (STR-focused)
// ---------------------------------------------------------------------------

/**
 * 铁刀 — Basic Lv.1 Weapon.
 * Early-game weapon providing a modest STR bonus. No special effect.
 * Obtainable from run start / early events.
 *
 * @see design/gdd/equipment-system.md — Basic Lv.1 (3–5 main stat)
 */
export const IRON_SWORD: EquipmentData = {
  id:              'basic_weapon_iron_sword',
  name:            '铁刀',
  slot:            EquipSlot.Weapon,
  category:        EquipCategory.Basic,
  level:           1,
  unique:          false,
  baseStats: {
    [StatType.STR]: 4,
  },
  effect:          null,
  ownerBonus:      null,
  ownerHeroId:     null,
  basePrice:       15,
  strengthenLevel: 0,
}

// ---------------------------------------------------------------------------
// 钢枪 — Basic Lv.2 Weapon (STR-focused)
// ---------------------------------------------------------------------------

/**
 * 钢枪 — Basic Lv.2 Weapon.
 * Mid-game weapon with stronger STR bonus. No special effect.
 * Obtainable from mid-game events / shop.
 *
 * @see design/gdd/equipment-system.md — Basic Lv.2 (6–10 main stat)
 */
export const STEEL_SPEAR: EquipmentData = {
  id:              'basic_weapon_steel_spear',
  name:            '钢枪',
  slot:            EquipSlot.Weapon,
  category:        EquipCategory.Basic,
  level:           2,
  unique:          false,
  baseStats: {
    [StatType.STR]: 8,
  },
  effect:          null,
  ownerBonus:      null,
  ownerHeroId:     null,
  basePrice:       30,
  strengthenLevel: 0,
}

// ---------------------------------------------------------------------------
// 精钢枪 — Advanced Lv.3 Weapon (STR + minor SPD-debuff effect)
// ---------------------------------------------------------------------------

/**
 * 精钢枪 — Advanced Lv.3 Weapon.
 * Late-game weapon with significant STR bonus and a minor battle effect.
 * On attack, 10% chance to reduce the target's SPD.
 * Obtainable from late events / shop / combat loot.
 *
 * @see design/gdd/equipment-system.md — Advanced Lv.3 (11–16 main stat, minor effect)
 */
export const REFINED_STEEL_SPEAR: EquipmentData = {
  id:              'advanced_weapon_refined_steel_spear',
  name:            '精钢枪',
  slot:            EquipSlot.Weapon,
  category:        EquipCategory.Advanced,
  level:           3,
  unique:          false,
  baseStats: {
    [StatType.STR]: 12,
  },
  effect: {
    description: '攻击有 10% 概率降低目标 SPD 2 点，持续 2 回合',
    magnitude:   0.10,
    duration:    2,
  },
  ownerBonus:      null,
  ownerHeroId:     null,
  basePrice:       50,
  strengthenLevel: 0,
}

// ---------------------------------------------------------------------------
// 铁甲 — Basic Lv.1 Armor (DEF + HP)
// ---------------------------------------------------------------------------

/**
 * 铁甲 — Basic Lv.1 Armor.
 * Early-game armor providing modest DEF and HP bonuses. No special effect.
 * Obtainable from run start / early events.
 *
 * @see design/gdd/equipment-system.md — Armor slot: DEF, HP
 */
export const IRON_ARMOR: EquipmentData = {
  id:              'basic_armor_iron_armor',
  name:            '铁甲',
  slot:            EquipSlot.Armor,
  category:        EquipCategory.Basic,
  level:           1,
  unique:          false,
  baseStats: {
    [StatType.DEF]: 4,
    [StatType.HP]:  2,
  },
  effect:          null,
  ownerBonus:      null,
  ownerHeroId:     null,
  basePrice:       15,
  strengthenLevel: 0,
}

// ---------------------------------------------------------------------------
// 良马 — Basic Lv.2 Mount (SPD)
// ---------------------------------------------------------------------------

/**
 * 良马 — Basic Lv.2 Mount.
 * Mid-game mount providing a meaningful SPD bonus. No special effect.
 * Obtainable from mid-game events / shop.
 *
 * @see design/gdd/equipment-system.md — Mount slot: SPD
 */
export const GOOD_HORSE: EquipmentData = {
  id:              'basic_mount_good_horse',
  name:            '良马',
  slot:            EquipSlot.Mount,
  category:        EquipCategory.Basic,
  level:           2,
  unique:          false,
  baseStats: {
    [StatType.SPD]: 7,
  },
  effect:          null,
  ownerBonus:      null,
  ownerHeroId:     null,
  basePrice:       30,
  strengthenLevel: 0,
}

// ---------------------------------------------------------------------------
// 青龙偃月刀 — Named Weapon (owner: 关羽 / guan_yu)
// ---------------------------------------------------------------------------

/**
 * 青龙偃月刀 — Named Lv.4 Weapon.
 * Guan Yu's legendary halberd. Globally unique per Run.
 *
 * Base effect: 攻击附带「威压」— reduces target DEF by 10%.
 * Owner bonus (Guan Yu only): 威压效果翻倍至 20% DEF reduction.
 *
 * Cannot be strengthened, sold, or disassembled.
 * Any hero can equip it, but only Guan Yu triggers the owner bonus.
 *
 * @see design/gdd/equipment-system.md — Named Equipment: 青龙偃月刀
 */
export const GREEN_DRAGON_HALBERD: EquipmentData = {
  id:              'named_weapon_green_dragon_halberd',
  name:            '青龙偃月刀',
  slot:            EquipSlot.Weapon,
  category:        EquipCategory.Named,
  level:           4,
  unique:          true,
  baseStats: {
    [StatType.STR]: 20,
  },
  effect: {
    description: '攻击附带「威压」：降低目标 DEF 10%',
    magnitude:   0.10,
    duration:    0,
  },
  ownerBonus: {
    description: '威压效果翻倍至 20%（关羽专属）',
    magnitude:   0.20,
  },
  ownerHeroId:     'guan_yu',
  basePrice:       0,
  strengthenLevel: 0,
}

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

/** All six test equipment records as an array, useful for iteration in tests. */
export const TEST_EQUIPMENT: EquipmentData[] = [
  IRON_SWORD,
  STEEL_SPEAR,
  REFINED_STEEL_SPEAR,
  IRON_ARMOR,
  GOOD_HORSE,
  GREEN_DRAGON_HALBERD,
]
