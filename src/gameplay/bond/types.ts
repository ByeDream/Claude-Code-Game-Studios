/**
 * Bond System — Type Definitions
 *
 * Defines all types for the 羁绊 (Bond) system:
 * - Faction bonds: same-faction count thresholds → percentage stat boosts
 * - Historical bonds: specific hero combinations → unique effects
 *
 * @module src/gameplay/bond/types
 * @see design/gdd/bond-system.md
 */

import type { BaseStats } from '../hero/types'
import type { Faction } from '../hero/types'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** The two categories of bonds in the game. */
export enum BondType {
  /** Same-faction count thresholds → percentage stat boosts. */
  Faction = 'Faction',
  /** Specific hero combinations → unique effects from historical events. */
  Historical = 'Historical',
}

// ---------------------------------------------------------------------------
// Faction bond interfaces
// ---------------------------------------------------------------------------

/**
 * A single threshold tier within a faction bond.
 * E.g., Shu with 2 heroes → STR+3%.
 */
export interface FactionBondTier {
  /** Minimum number of same-faction heroes required to activate this tier. */
  requiredCount: number
  /** Per-stat percentage bonus as decimal (e.g., 0.03 = +3%). */
  statBonuses: Partial<BaseStats>
}

/**
 * Full faction bond definition with all threshold tiers.
 * One per faction (Wei, Shu, Wu, Qun).
 */
export interface FactionBondDefinition {
  /** The faction this bond applies to. */
  faction: Faction
  /** Display name (e.g., "蜀汉阵营"). */
  name: string
  /** Threshold tiers, ordered by requiredCount ascending. */
  tiers: FactionBondTier[]
}

// ---------------------------------------------------------------------------
// Historical bond interfaces
// ---------------------------------------------------------------------------

/**
 * Requirement mode for historical bonds.
 * - 'all': every listed hero must be present.
 * - 'any_n': at least N of the listed heroes must be present.
 */
export type HistoricalRequirementMode =
  | { type: 'all' }
  | { type: 'any_n'; count: number }

/**
 * Definition of a single historical bond.
 * Loaded from config, never mutated at runtime.
 */
export interface HistoricalBondDefinition {
  /** Unique bond identifier (e.g., "桃园结义"). */
  id: string
  /** Display name. */
  name: string
  /** Brief historical context. */
  lore: string
  /**
   * Hero IDs (baseName) required to activate this bond.
   * Uses baseName so legend variants also qualify.
   */
  requiredHeroes: string[]
  /** Whether all heroes are needed, or only N of them. */
  requirementMode: HistoricalRequirementMode
  /**
   * Per-stat percentage bonus as decimal applied to participating heroes.
   * e.g., { STR: 0.08 } means participating heroes get STR+8%.
   */
  statBonuses: Partial<BaseStats>
  /**
   * Optional: IDs of required equipped items (e.g., 赤兔马 for 绝世猛将).
   * Empty array if no equipment requirement.
   */
  requiredEquipmentIds: string[]
  /**
   * Optional description of a special conditional effect.
   * Resolved by the Battle Engine, not by the Bond System directly.
   * null if no special effect.
   */
  specialEffect: string | null
}

// ---------------------------------------------------------------------------
// Unified bond definition
// ---------------------------------------------------------------------------

/**
 * Union type encompassing both bond categories.
 * Used for getAllBonds() display and bond atlas UI.
 */
export type BondDefinition =
  | { type: BondType.Faction; definition: FactionBondDefinition }
  | { type: BondType.Historical; definition: HistoricalBondDefinition }

// ---------------------------------------------------------------------------
// Evaluation result interfaces
// ---------------------------------------------------------------------------

/** A bond that has been activated based on the current roster. */
export interface ActivatedBond {
  /** Bond type. */
  type: BondType
  /** Display name of the bond. */
  name: string
  /**
   * For faction bonds: the tier reached (e.g., 3 = "3-hero tier").
   * For historical bonds: always 1.
   */
  tier: number
  /** Per-stat bonus this bond contributes. */
  statBonuses: Partial<BaseStats>
  /** IDs of heroes participating in this bond (baseName). */
  participatingHeroes: string[]
}

/**
 * Complete result of bond evaluation for a roster.
 * Returned by evaluateBonds().
 *
 * @see design/gdd/bond-system.md — Bond Modifier Calculation
 */
export interface BondResult {
  /** All activated bonds for this roster. */
  activatedBonds: ActivatedBond[]
  /**
   * Per-hero bond modifier (keyed by hero instance id / data.id).
   * Each value is a BaseStats record with per-stat percentage bonuses,
   * already capped at BOND_MODIFIER_CAP per stat.
   */
  perHeroModifiers: Map<string, BaseStats>
}
