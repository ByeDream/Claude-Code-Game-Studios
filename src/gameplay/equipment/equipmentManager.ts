/**
 * Equipment System — Equipment Manager
 *
 * Pure functional, immutable implementation of core equipment operations.
 * All operations return new objects; no state is ever mutated in place.
 *
 * Responsibilities:
 *   - equip / unequip items on a HeroInstance
 *   - calculateEquipBonus: sum all equipped items' effective stat bonuses
 *   - strengthen: increment strengthenLevel (max 3, Named = 0)
 *   - getSellGold / getDisassembleMaterial: economy formula wrappers
 *
 * This module owns only the data-model layer. Economy resource deduction
 * (spending gold/material on strengthen) is the caller's responsibility and
 * must be handled via the Economy system before calling `strengthen()`.
 *
 * @module src/gameplay/equipment/equipmentManager
 * @see design/gdd/equipment-system.md — Formulas, Interactions with Other Systems
 */

import type { HeroInstance, BaseStats } from '../hero/types'
import { StatType } from '../hero/types'
import { createZeroStats } from '../hero/statCalculation'
import type { EquipmentData } from './types'
import { EquipSlot, EquipCategory } from './types'
import {
  MAX_STRENGTHEN_LEVEL,
  STRENGTHEN_BONUS_RATE,
  STRENGTHEN_GOLD_PER_LEVEL,
  STRENGTHEN_MATERIAL_PER_LEVEL,
} from './equipmentConfig'
import { SELL_RATIO, DISASSEMBLE_RATIO } from '../economy/economyConfig'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the `EquipSlot` key used when indexing into a conceptual slot map.
 * Provides a single point of truth for slot-to-key mapping.
 *
 * @param slot - The equipment slot to resolve.
 * @returns The string key for this slot.
 */
function slotKey(slot: EquipSlot): string {
  return slot as string
}

/**
 * Finds the equipment currently occupying a given slot on a hero by scanning
 * the equipped-item IDs against a registry of available equipment data.
 *
 * The Equipment Manager is stateless — it does not maintain a global registry.
 * Callers must supply the list of all equipped `EquipmentData` objects so the
 * manager can identify which item occupies the target slot.
 *
 * @param hero          - The hero instance to inspect.
 * @param slot          - The slot to look up.
 * @param equippedItems - Full list of EquipmentData objects currently on this hero.
 * @returns The EquipmentData in the slot, or null if the slot is empty.
 */
function findItemInSlot(
  hero:          HeroInstance,
  slot:          EquipSlot,
  equippedItems: EquipmentData[],
): EquipmentData | null {
  const itemInSlot = equippedItems.find(
    (item) => item.slot === slot && hero.equippedItemIds.includes(item.id),
  )
  return itemInSlot ?? null
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Equips an item to the matching slot on a hero.
 *
 * If the slot is already occupied, the existing item is removed (replaced).
 * The caller is responsible for handling the replaced item (sell/disassemble/drop)
 * per the no-inventory design.
 *
 * Immutability: returns a new HeroInstance; the original is never mutated.
 *
 * @param hero          - The current hero instance.
 * @param equipment     - The item to equip.
 * @param equippedItems - All items currently equipped on this hero (for slot lookup).
 * @returns Object containing:
 *   - `hero`: new HeroInstance with updated equippedItemIds and equipBonus.
 *   - `replaced`: the item that was displaced from the slot, or null.
 *
 * @see design/gdd/equipment-system.md — States and Transitions: 获取新装备流程
 */
export function equip(
  hero:          HeroInstance,
  equipment:     EquipmentData,
  equippedItems: EquipmentData[],
): { hero: HeroInstance; replaced: EquipmentData | null } {
  const replaced = findItemInSlot(hero, equipment.slot, equippedItems)

  // Build the new equipped-item ID list: remove displaced item, add new item.
  const withoutReplaced = hero.equippedItemIds.filter(
    (id) => id !== (replaced?.id ?? ''),
  )
  const newEquippedIds = [...withoutReplaced, equipment.id]

  // Build the new full equipped-items list for bonus recalculation.
  const newEquippedItems: EquipmentData[] = [
    ...equippedItems.filter((item) => item.id !== (replaced?.id ?? '')),
    equipment,
  ]

  // Recalculate bonus from the updated item set.
  const newEquipBonus = calculateEquipBonus(newEquippedItems)

  const newHero: HeroInstance = {
    ...hero,
    equippedItemIds: newEquippedIds,
    equipBonus:      newEquipBonus,
  }

  return { hero: newHero, replaced }
}

/**
 * Removes the item from the specified slot on a hero.
 *
 * If the slot is empty, `removed` is null and the hero is returned unchanged.
 *
 * Immutability: returns a new HeroInstance; the original is never mutated.
 *
 * @param hero          - The current hero instance.
 * @param slot          - The slot to unequip.
 * @param equippedItems - All items currently equipped on this hero (for slot lookup).
 * @returns Object containing:
 *   - `hero`: new HeroInstance with the item removed from equippedItemIds and
 *             recalculated equipBonus.
 *   - `removed`: the item that was in the slot, or null if the slot was empty.
 *
 * @see design/gdd/equipment-system.md — States and Transitions: 主动卖出/拆解
 */
export function unequip(
  hero:          HeroInstance,
  slot:          EquipSlot,
  equippedItems: EquipmentData[],
): { hero: HeroInstance; removed: EquipmentData | null } {
  const removed = findItemInSlot(hero, slot, equippedItems)

  if (removed === null) {
    return { hero, removed: null }
  }

  const newEquippedIds    = hero.equippedItemIds.filter((id) => id !== removed.id)
  const newEquippedItems  = equippedItems.filter((item) => item.id !== removed.id)
  const newEquipBonus     = calculateEquipBonus(newEquippedItems)

  const newHero: HeroInstance = {
    ...hero,
    equippedItemIds: newEquippedIds,
    equipBonus:      newEquipBonus,
  }

  return { hero: newHero, removed }
}

// ---------------------------------------------------------------------------
// Stat bonus calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the total additive stat bonus from a set of equipped items.
 *
 * Formula (per stat, per item):
 *   effectiveStatBonus = baseStats[stat] * (1 + strengthenLevel * STRENGTHEN_BONUS_RATE)
 *
 * The results are summed across all items and floored to integers.
 * This value is written to `HeroInstance.equipBonus` after every equip/unequip.
 *
 * @param equippedItems - The list of EquipmentData currently on the hero.
 * @returns A BaseStats record with the total bonus for each of the five stats.
 *
 * @see design/gdd/equipment-system.md — Formulas: Equipment Stat Bonus
 */
export function calculateEquipBonus(equippedItems: EquipmentData[]): BaseStats {
  const bonus = createZeroStats()

  for (const item of equippedItems) {
    const multiplier = 1 + item.strengthenLevel * STRENGTHEN_BONUS_RATE

    for (const stat of Object.values(StatType)) {
      const baseStat = (item.baseStats[stat] as number | undefined) ?? 0
      bonus[stat] += Math.floor(baseStat * multiplier)
    }
  }

  return bonus
}

// ---------------------------------------------------------------------------
// Strengthening
// ---------------------------------------------------------------------------

/**
 * Returns a new EquipmentData record with `strengthenLevel` incremented by 1.
 *
 * Constraints enforced:
 *   - Named equipment (category === Named) cannot be strengthened — returns the
 *     original item unchanged.
 *   - strengthenLevel is capped at MAX_STRENGTHEN_LEVEL — returns the original
 *     item unchanged if already at max.
 *
 * Note: This function does NOT deduct economy resources. The caller must call
 * `economy.spend(gold, material)` before calling this.
 *
 * @param equipment - The current equipment data record.
 * @returns A new EquipmentData with strengthenLevel += 1, or the same record if
 *          strengthening is not allowed.
 *
 * @see design/gdd/equipment-system.md — Equipment Strengthening
 * @see design/gdd/equipment-system.md — Edge Cases: 尝试强化名器
 */
export function strengthen(equipment: EquipmentData): EquipmentData {
  if (equipment.category === EquipCategory.Named) {
    return equipment
  }

  if (equipment.strengthenLevel >= MAX_STRENGTHEN_LEVEL) {
    return equipment
  }

  return {
    ...equipment,
    strengthenLevel: equipment.strengthenLevel + 1,
  }
}

// ---------------------------------------------------------------------------
// Economy formula wrappers
// ---------------------------------------------------------------------------

/**
 * Calculates the gold earned from selling a piece of equipment.
 *
 * Formula: sellGold = max(1, floor(basePrice * SELL_RATIO))
 *
 * Named equipment always returns 0 (unsellable per GDD).
 * The minimum of 1 for non-Named items mirrors the Economy GDD edge case:
 * "卖出价格为 0 的装备 → 给 1 金币保底".
 *
 * @param equipment - The equipment to sell.
 * @returns Gold earned from selling; 0 if Named (unsellable), minimum 1 otherwise.
 *
 * @see design/gdd/equipment-system.md — Formulas: Sell / Disassemble
 * @see design/gdd/equipment-system.md — Edge Cases: 名器不可卖出/拆解
 */
export function getSellGold(equipment: EquipmentData): number {
  if (equipment.category === EquipCategory.Named) {
    return 0
  }
  return Math.max(1, Math.floor(equipment.basePrice * SELL_RATIO))
}

/**
 * Calculates the material earned from disassembling a piece of equipment.
 *
 * Formula: disassembleMaterial = equipLevel * DISASSEMBLE_RATIO
 *
 * Named equipment always returns 0 (cannot be disassembled per GDD).
 *
 * @param equipment - The equipment to disassemble.
 * @returns Material earned from disassembly; 0 if Named (cannot disassemble).
 *
 * @see design/gdd/equipment-system.md — Formulas: Sell / Disassemble
 * @see design/gdd/equipment-system.md — Edge Cases: 名器不可卖出/拆解
 */
export function getDisassembleMaterial(equipment: EquipmentData): number {
  if (equipment.category === EquipCategory.Named) {
    return 0
  }
  return equipment.level * DISASSEMBLE_RATIO
}

/**
 * Calculates the gold cost to strengthen equipment to the next level.
 *
 * Formula: strengthenGoldCost = STRENGTHEN_GOLD_PER_LEVEL * targetLevel
 *
 * @param targetLevel - The strengthen level being achieved (1, 2, or 3).
 * @returns Gold required for this strengthen step.
 *
 * @see design/gdd/equipment-system.md — Formulas: Strengthen Cost
 */
export function getStrengthenGoldCost(targetLevel: number): number {
  return STRENGTHEN_GOLD_PER_LEVEL * targetLevel
}

/**
 * Calculates the material cost to strengthen equipment to the next level.
 *
 * Formula: strengthenMaterialCost = STRENGTHEN_MATERIAL_PER_LEVEL * targetLevel
 *
 * @param targetLevel - The strengthen level being achieved (1, 2, or 3).
 * @returns Material required for this strengthen step.
 *
 * @see design/gdd/equipment-system.md — Formulas: Strengthen Cost
 */
export function getStrengthenMaterialCost(targetLevel: number): number {
  return STRENGTHEN_MATERIAL_PER_LEVEL * targetLevel
}

// Export the slot key helper for use in higher-level systems that manage slot maps.
export { slotKey }
