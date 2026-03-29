/**
 * Loot/Rewards System — Configuration Constants
 *
 * All tuning knobs for the loot chest system.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/loot/lootConfig
 * @see design/gdd/loot-rewards.md — Tuning Knobs, Formulas
 */

import { ChestTier, Difficulty } from './types'

// ---------------------------------------------------------------------------
// Chest tier gold base values
// ---------------------------------------------------------------------------

/**
 * Base gold reward per chest tier.
 * Safe range: ±50% of initial values.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Gold Reward
 */
export const TIER_GOLD_BASE: Record<ChestTier, number> = {
  [ChestTier.Iron]: 12,
  [ChestTier.Bronze]: 20,
  [ChestTier.Silver]: 32,
  [ChestTier.Gold]: 52,
  [ChestTier.Diamond]: 80,
}

/**
 * Base material reward per chest tier.
 * Safe range: ±50% of initial values.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Material Reward
 */
export const TIER_MAT_BASE: Record<ChestTier, number> = {
  [ChestTier.Iron]: 6,
  [ChestTier.Bronze]: 11,
  [ChestTier.Silver]: 18,
  [ChestTier.Gold]: 28,
  [ChestTier.Diamond]: 42,
}

// ---------------------------------------------------------------------------
// Node scaling
// ---------------------------------------------------------------------------

/**
 * Per-node gold scaling factor.
 * Safe range: 0.01–0.08.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Gold Reward
 */
export const GOLD_NODE_SCALING = 0.03

/**
 * Per-node material scaling factor.
 * Safe range: 0.01–0.08.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Material Reward
 */
export const MAT_NODE_SCALING = 0.03

// ---------------------------------------------------------------------------
// Chest tier determination
// ---------------------------------------------------------------------------

/**
 * Base chest tier index per difficulty (0=Iron, 1=Bronze, 2=Silver, 3=Gold, 4=Diamond).
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Tier Determination
 */
export const DIFFICULTY_BASE_TIER: Record<Difficulty, number> = {
  [Difficulty.Normal]: 0,
  [Difficulty.Elite]: 1,
  [Difficulty.Boss]: 2,
}

/**
 * Maximum chest tier index per difficulty.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Tier Determination
 */
export const MAX_TIER_BY_DIFFICULTY: Record<Difficulty, number> = {
  [Difficulty.Normal]: 2,  // Silver max
  [Difficulty.Elite]: 3,   // Gold max
  [Difficulty.Boss]: 4,    // Diamond max
}

/**
 * Every N nodes, chest tier upgrades by 1.
 * Safe range: 4–9.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Tier Determination
 */
export const TIER_UPGRADE_INTERVAL = 6

// ---------------------------------------------------------------------------
// Chest count
// ---------------------------------------------------------------------------

/**
 * Base chest count per difficulty.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Count
 */
export const BASE_CHEST_COUNT: Record<Difficulty, number> = {
  [Difficulty.Normal]: 1,
  [Difficulty.Elite]: 1,
  [Difficulty.Boss]: 2,
}

/**
 * NodeIndex threshold for bonus chest (+1).
 * Safe range: 9–15.
 *
 * @see design/gdd/loot-rewards.md — Formulas: Chest Count
 */
export const BONUS_CHEST_THRESHOLD = 12

// ---------------------------------------------------------------------------
// Equipment pool weights
// ---------------------------------------------------------------------------

/**
 * Named equipment drop rate for Gold-tier chests.
 * Safe range: 10–50%.
 *
 * @see design/gdd/loot-rewards.md — Equipment Selection
 */
export const NAMED_DROP_RATE_GOLD = 0.30

/**
 * Named equipment drop rate for Diamond-tier chests.
 * Safe range: 40–80%.
 *
 * @see design/gdd/loot-rewards.md — Equipment Selection
 */
export const NAMED_DROP_RATE_DIAMOND = 0.65

// ---------------------------------------------------------------------------
// Random variance
// ---------------------------------------------------------------------------

/**
 * Minimum random variance multiplier for gold/material rewards.
 * Safe range: 0.8–1.0.
 */
export const LOOT_VARIANCE_MIN = 0.9

/**
 * Maximum random variance multiplier for gold/material rewards.
 * Safe range: 1.0–1.2.
 */
export const LOOT_VARIANCE_MAX = 1.1

// ---------------------------------------------------------------------------
// Ordered tier list (for tier index lookups)
// ---------------------------------------------------------------------------

/**
 * Ordered array of chest tiers from lowest to highest quality.
 * Index matches DIFFICULTY_BASE_TIER and MAX_TIER_BY_DIFFICULTY values.
 */
export const TIER_ORDER: ChestTier[] = [
  ChestTier.Iron,
  ChestTier.Bronze,
  ChestTier.Silver,
  ChestTier.Gold,
  ChestTier.Diamond,
]
