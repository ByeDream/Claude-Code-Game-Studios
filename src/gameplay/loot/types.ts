/**
 * Loot/Rewards System — Type Definitions
 *
 * Defines all data types for the chest-based loot system.
 * Chests are generated after battle victories and contain 3 mutually exclusive
 * options (equipment/gold/material) for player choice.
 *
 * @module src/gameplay/loot/types
 * @see design/gdd/loot-rewards.md
 */

import type { EquipmentData } from '../equipment/types'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Chest quality tiers, determining the value range of options inside.
 *
 * @see design/gdd/loot-rewards.md — Chest Tiers
 */
export enum ChestTier {
  Iron = 'iron',
  Bronze = 'bronze',
  Silver = 'silver',
  Gold = 'gold',
  Diamond = 'diamond',
}

/**
 * Battle difficulty levels affecting chest tier and count.
 *
 * @see design/gdd/loot-rewards.md — Battle Difficulty → Chest Configuration
 */
export enum Difficulty {
  Normal = 'normal',
  Elite = 'elite',
  Boss = 'boss',
}

/**
 * The type of loot option presented in a chest.
 */
export enum LootOptionType {
  Equipment = 'equipment',
  Gold = 'gold',
  Material = 'material',
}

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

/**
 * A single chest generated from battle rewards.
 * Contains exactly 3 mutually-exclusive options.
 */
export interface Chest {
  /** Unique ID for this chest instance. */
  id: string
  /** Quality tier determining option value ranges. */
  tier: ChestTier
  /** The three options inside (always equipment + gold + material). */
  options: LootOption[]
}

/**
 * A single selectable option within a chest.
 */
export interface LootOption {
  /** Which type of reward this option provides. */
  type: LootOptionType
  /** Gold amount (only when type = Gold). */
  gold?: number
  /** Material amount (only when type = Material). */
  material?: number
  /** Equipment data (only when type = Equipment). */
  equipment?: EquipmentData
}

/**
 * Preview information for map display — shows chest count and tiers.
 *
 * @see design/gdd/loot-rewards.md — Map Preview
 */
export interface ChestPreview {
  /** Chest quality tier. */
  tier: ChestTier
  /** Number of chests at this tier. */
  count: number
}
