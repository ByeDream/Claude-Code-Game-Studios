/**
 * Economy System — Configuration Constants
 *
 * All tuning knobs for the Economy system live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * Ranges sourced directly from the GDD Tuning Knobs table.
 *
 * @module src/gameplay/economy/economyConfig
 * @see design/gdd/economy.md — Tuning Knobs, Formulas
 */

import { HeroTier } from '../hero/types'

// ---------------------------------------------------------------------------
// Starting resources
// ---------------------------------------------------------------------------

/**
 * Gold balance at the start of every Run.
 * Safe range: 0–50. Higher → more recruit freedom early game.
 *
 * @see design/gdd/economy.md — States and Transitions: currentGold init
 */
export const STARTING_GOLD = 20

/**
 * Material balance at the start of every Run.
 * Safe range: 0–10. Starting at 0 means players must win battles before upgrading.
 *
 * @see design/gdd/economy.md — States and Transitions: currentMaterial init
 */
export const STARTING_MATERIAL = 0

// ---------------------------------------------------------------------------
// Battle reward scaling
// ---------------------------------------------------------------------------

/**
 * Base gold reward for the first battle node (nodeIndex = 0).
 * Safe range: 5–20.
 *
 * @see design/gdd/economy.md — Formulas: Battle Rewards
 */
export const BASE_GOLD = 10

/**
 * Base material reward for the first battle node (nodeIndex = 0).
 * Safe range: 2–15.
 *
 * @see design/gdd/economy.md — Formulas: Battle Rewards
 */
export const BASE_MATERIAL = 5

/**
 * Per-node gold scaling multiplier.
 * Each node index increments the gold reward by this fraction.
 * Safe range: 0.05–0.30.
 *
 * @see design/gdd/economy.md — Formulas: Battle Rewards
 */
export const GOLD_SCALING = 0.15

/**
 * Per-node material scaling multiplier.
 * Safe range: 0.05–0.30.
 *
 * @see design/gdd/economy.md — Formulas: Battle Rewards
 */
export const MATERIAL_SCALING = 0.15

// ---------------------------------------------------------------------------
// Difficulty bonus multipliers
// ---------------------------------------------------------------------------

/** Reward multiplier for normal battle nodes. */
export const DIFFICULTY_BONUS_NORMAL = 1.0

/**
 * Reward multiplier for elite battle nodes.
 * Safe range: 1.1–1.8.
 *
 * @see design/gdd/economy.md — Tuning Knobs
 */
export const DIFFICULTY_BONUS_ELITE = 1.3

/**
 * Reward multiplier for boss battle nodes.
 * Safe range: 1.5–3.0.
 *
 * @see design/gdd/economy.md — Tuning Knobs
 */
export const DIFFICULTY_BONUS_BOSS = 2.0

// ---------------------------------------------------------------------------
// Recruit cost
// ---------------------------------------------------------------------------

/**
 * Base recruit cost for a C-tier hero.
 * Higher-tier heroes apply a `TIER_RECRUIT_MULTIPLIER` on top of this.
 * Safe range: 15–60.
 *
 * @see design/gdd/economy.md — Formulas: Recruit Cost
 */
export const RECRUIT_BASE_COST = 30

/**
 * Per-tier multiplier applied to `RECRUIT_BASE_COST`.
 * Only C, B, A tiers are defined; S+ hero recruitment is not part of MVP scope.
 *
 * Formula: recruitCost = RECRUIT_BASE_COST * TIER_RECRUIT_MULTIPLIER[tier]
 *
 * @see design/gdd/economy.md — Formulas: Recruit Cost
 */
export const TIER_RECRUIT_MULTIPLIER: Partial<Record<HeroTier, number>> = {
  [HeroTier.C]: 1.0,
  [HeroTier.B]: 1.5,
  [HeroTier.A]: 2.5,
}

// ---------------------------------------------------------------------------
// Equipment sell / disassemble
// ---------------------------------------------------------------------------

/**
 * Fraction of an equipment's base price returned as gold when sold.
 * Safe range: 0.25–0.75.
 *
 * Formula: sellGold = equipBasePrice * SELL_RATIO  (minimum 1)
 *
 * @see design/gdd/economy.md — Formulas: Equipment Sell/Disassemble
 * @see design/gdd/economy.md — Edge Cases: 卖出价格为 0 的装备
 */
export const SELL_RATIO = 0.5

/**
 * Material yield per equipment level when disassembling.
 * Safe range: 1–8.
 *
 * Formula: disassembleMaterial = equipLevel * DISASSEMBLE_RATIO
 *
 * @see design/gdd/economy.md — Formulas: Equipment Sell/Disassemble
 */
export const DISASSEMBLE_RATIO = 3
