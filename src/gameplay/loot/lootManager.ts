/**
 * Loot/Rewards System — Loot Manager
 *
 * Pure functional loot management: generate chests, open chests, claim options.
 * All functions are deterministic when given a seeded RNG.
 *
 * @module src/gameplay/loot/lootManager
 * @see design/gdd/loot-rewards.md
 */

import type { EquipmentData } from '../equipment/types'
import { EquipCategory } from '../equipment/types'
import type { Economy } from '../economy/types'
import { earn } from '../economy/economyManager'
import type { RandomFn } from '../battle/types'

import type { Chest, LootOption, ChestPreview } from './types'
import { ChestTier, Difficulty, LootOptionType } from './types'
import {
  TIER_GOLD_BASE,
  TIER_MAT_BASE,
  GOLD_NODE_SCALING,
  MAT_NODE_SCALING,
  DIFFICULTY_BASE_TIER,
  MAX_TIER_BY_DIFFICULTY,
  TIER_UPGRADE_INTERVAL,
  BASE_CHEST_COUNT,
  BONUS_CHEST_THRESHOLD,
  NAMED_DROP_RATE_GOLD,
  NAMED_DROP_RATE_DIAMOND,
  LOOT_VARIANCE_MIN,
  LOOT_VARIANCE_MAX,
  TIER_ORDER,
} from './lootConfig'

// ---------------------------------------------------------------------------
// Chest tier determination
// ---------------------------------------------------------------------------

/**
 * Determines the chest tier for a given node index and difficulty.
 *
 * Formula:
 *   baseTier = DIFFICULTY_BASE_TIER[difficulty]
 *   tierUpgrade = floor(nodeIndex / TIER_UPGRADE_INTERVAL)
 *   finalTier = min(baseTier + tierUpgrade, MAX_TIER[difficulty])
 *
 * @param nodeIndex - Current node position in the Run (0-based).
 * @param difficulty - Battle difficulty level.
 * @returns The chest tier for this node/difficulty combination.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Tier Determination
 */
export function determineChestTier(nodeIndex: number, difficulty: Difficulty): ChestTier {
  const baseTierIndex = DIFFICULTY_BASE_TIER[difficulty]
  const tierUpgrade = Math.floor(nodeIndex / TIER_UPGRADE_INTERVAL)
  const finalTierIndex = Math.min(baseTierIndex + tierUpgrade, MAX_TIER_BY_DIFFICULTY[difficulty])
  return TIER_ORDER[finalTierIndex]
}

/**
 * Determines the number of chests for a given node index and difficulty.
 *
 * Formula:
 *   chestCount = BASE_COUNT[difficulty] + (nodeIndex >= BONUS_CHEST_THRESHOLD ? 1 : 0)
 *
 * @param nodeIndex - Current node position.
 * @param difficulty - Battle difficulty.
 * @returns Number of chests to generate.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Count
 */
export function determineChestCount(nodeIndex: number, difficulty: Difficulty): number {
  return BASE_CHEST_COUNT[difficulty] + (nodeIndex >= BONUS_CHEST_THRESHOLD ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Gold / Material reward calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the gold reward amount for a chest of a given tier.
 *
 * Formula: chestGold = TIER_GOLD_BASE[tier] * (1 + nodeIndex * GOLD_NODE_SCALING) * variance
 *
 * @param tier - Chest quality tier.
 * @param nodeIndex - Current node position.
 * @param random - Injectable RNG for variance.
 * @returns Gold amount (integer, minimum 1).
 *
 * @see design/gdd/loot-rewards.md — Formulas: Gold Reward
 */
export function calculateChestGold(
  tier: ChestTier,
  nodeIndex: number,
  random: RandomFn = Math.random,
): number {
  const base = TIER_GOLD_BASE[tier]
  const scaling = 1 + nodeIndex * GOLD_NODE_SCALING
  const variance = LOOT_VARIANCE_MIN + random() * (LOOT_VARIANCE_MAX - LOOT_VARIANCE_MIN)
  return Math.max(1, Math.floor(base * scaling * variance))
}

/**
 * Calculates the material reward amount for a chest of a given tier.
 *
 * Formula: chestMaterial = TIER_MAT_BASE[tier] * (1 + nodeIndex * MAT_NODE_SCALING) * variance
 *
 * @param tier - Chest quality tier.
 * @param nodeIndex - Current node position.
 * @param random - Injectable RNG for variance.
 * @returns Material amount (integer, minimum 1).
 *
 * @see design/gdd/loot-rewards.md — Formulas: Material Reward
 */
export function calculateChestMaterial(
  tier: ChestTier,
  nodeIndex: number,
  random: RandomFn = Math.random,
): number {
  const base = TIER_MAT_BASE[tier]
  const scaling = 1 + nodeIndex * MAT_NODE_SCALING
  const variance = LOOT_VARIANCE_MIN + random() * (LOOT_VARIANCE_MAX - LOOT_VARIANCE_MIN)
  return Math.max(1, Math.floor(base * scaling * variance))
}

// ---------------------------------------------------------------------------
// Equipment selection
// ---------------------------------------------------------------------------

/**
 * Selects an equipment item from the pool based on chest tier.
 *
 * Pool rules per tier:
 * - Iron: Basic Lv.1 only
 * - Bronze: Basic Lv.1 (40%) + Lv.2 (60%)
 * - Silver: Basic Lv.2 (40%) + Advanced Lv.3 (60%)
 * - Gold: Advanced Lv.3 (70%) + Named (30%)
 * - Diamond: Advanced Lv.3 (35%) + Named (65%)
 *
 * Named equipment filtered by ownedNamedIds (global uniqueness).
 * Falls back to Advanced Lv.3 if no Named available.
 *
 * @param tier - Chest quality tier.
 * @param equipmentPool - All available equipment definitions.
 * @param ownedNamedIds - Set of Named equipment IDs already owned.
 * @param random - Injectable RNG.
 * @returns A selected equipment item, or null if pool is empty.
 *
 * @see design/gdd/loot-rewards.md — Equipment Selection
 */
export function selectEquipment(
  tier: ChestTier,
  equipmentPool: EquipmentData[],
  ownedNamedIds: Set<string> = new Set(),
  random: RandomFn = Math.random,
): EquipmentData | null {
  // Filter pool by tier rules
  const basicLv1 = equipmentPool.filter(e => e.category === EquipCategory.Basic && e.level === 1)
  const basicLv2 = equipmentPool.filter(e => e.category === EquipCategory.Basic && e.level === 2)
  const advancedLv3 = equipmentPool.filter(e => e.category === EquipCategory.Advanced && e.level === 3)
  const namedAvailable = equipmentPool.filter(
    e => e.category === EquipCategory.Named && !ownedNamedIds.has(e.id)
  )

  let candidates: EquipmentData[] = []
  const roll = random()

  switch (tier) {
    case ChestTier.Iron:
      candidates = basicLv1
      break

    case ChestTier.Bronze:
      candidates = roll < 0.4 ? basicLv1 : basicLv2
      // Fallback if selected tier is empty
      if (candidates.length === 0) candidates = basicLv1.length > 0 ? basicLv1 : basicLv2
      break

    case ChestTier.Silver:
      candidates = roll < 0.4 ? basicLv2 : advancedLv3
      if (candidates.length === 0) candidates = basicLv2.length > 0 ? basicLv2 : advancedLv3
      break

    case ChestTier.Gold: {
      const isNamed = roll < NAMED_DROP_RATE_GOLD && namedAvailable.length > 0
      candidates = isNamed ? namedAvailable : advancedLv3
      if (candidates.length === 0) candidates = advancedLv3.length > 0 ? advancedLv3 : basicLv2
      break
    }

    case ChestTier.Diamond: {
      const isNamed = roll < NAMED_DROP_RATE_DIAMOND && namedAvailable.length > 0
      candidates = isNamed ? namedAvailable : advancedLv3
      if (candidates.length === 0) candidates = advancedLv3.length > 0 ? advancedLv3 : basicLv2
      break
    }
  }

  if (candidates.length === 0) return null

  // Random selection from candidates
  const index = Math.floor(random() * candidates.length)
  return candidates[index]
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Generates chests for a battle reward based on node position and difficulty.
 *
 * @param nodeIndex - Current node position in the Run.
 * @param difficulty - Battle difficulty level.
 * @param equipmentPool - Available equipment for selection.
 * @param ownedNamedIds - Named equipment IDs already owned (for uniqueness).
 * @param random - Injectable RNG.
 * @returns Array of Chest objects with 3 options each.
 *
 * @see design/gdd/loot-rewards.md — Core Rules: Chest System
 */
export function generateChests(
  nodeIndex: number,
  difficulty: Difficulty,
  equipmentPool: EquipmentData[] = [],
  ownedNamedIds: Set<string> = new Set(),
  random: RandomFn = Math.random,
): Chest[] {
  const count = determineChestCount(nodeIndex, difficulty)
  const tier = determineChestTier(nodeIndex, difficulty)
  const chests: Chest[] = []

  // Track names claimed in this batch to enforce uniqueness across multi-chest
  const batchOwnedNamed = new Set(ownedNamedIds)

  for (let i = 0; i < count; i++) {
    const gold = calculateChestGold(tier, nodeIndex, random)
    const material = calculateChestMaterial(tier, nodeIndex, random)
    const equipment = selectEquipment(tier, equipmentPool, batchOwnedNamed, random)

    // If equipment was Named, track it for next chest in batch
    if (equipment && equipment.category === EquipCategory.Named) {
      batchOwnedNamed.add(equipment.id)
    }

    const options: LootOption[] = [
      {
        type: LootOptionType.Equipment,
        equipment: equipment ?? undefined,
      },
      {
        type: LootOptionType.Gold,
        gold,
      },
      {
        type: LootOptionType.Material,
        material,
      },
    ]

    chests.push({
      id: `chest_${nodeIndex}_${difficulty}_${i}`,
      tier,
      options,
    })
  }

  return chests
}

/**
 * Opens a chest and returns its 3 options.
 * This is a passthrough for the generated chest's options.
 *
 * @param chest - The chest to open.
 * @returns Array of 3 LootOptions.
 *
 * @see design/gdd/loot-rewards.md — States and Transitions: Opened
 */
export function openChest(chest: Chest): LootOption[] {
  return chest.options
}

/**
 * Claims a loot option and applies it to the economy.
 * Equipment claims return the equipment data for further processing.
 *
 * @param option - The selected loot option.
 * @param economy - Current economy state.
 * @returns Updated economy state (gold/material added if applicable).
 *
 * @see design/gdd/loot-rewards.md — States and Transitions: Claimed
 */
export function claimOption(option: LootOption, economy: Economy): Economy {
  switch (option.type) {
    case LootOptionType.Gold:
      return earn(economy, option.gold ?? 0, 0)
    case LootOptionType.Material:
      return earn(economy, 0, option.material ?? 0)
    case LootOptionType.Equipment:
      // Equipment is handled by the Equipment System externally
      // Economy is unchanged
      return economy
  }
}

/**
 * Generates chest preview information for map display.
 *
 * @param nodeIndex - Current node position.
 * @param difficulty - Battle difficulty.
 * @returns Array of ChestPreview objects.
 *
 * @see design/gdd/loot-rewards.md — Map Preview
 */
export function getChestPreview(nodeIndex: number, difficulty: Difficulty): ChestPreview[] {
  const count = determineChestCount(nodeIndex, difficulty)
  const tier = determineChestTier(nodeIndex, difficulty)
  return [{ tier, count }]
}
