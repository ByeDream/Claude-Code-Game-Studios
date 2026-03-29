/**
 * Hero System — Configuration Constants
 *
 * All tuning knobs for the hero system live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/hero/heroConfig
 * @see design/gdd/hero-system.md — Tuning Knobs
 */

import { HeroTier } from './types'

// ---------------------------------------------------------------------------
// Roster limits
// ---------------------------------------------------------------------------

/** Maximum number of heroes a player can hold on the bench during a run. */
export const BENCH_MAX_SIZE = 8

/** Maximum number of heroes that can be deployed (on the battle board). */
export const DEPLOY_MAX_SIZE = 5

// ---------------------------------------------------------------------------
// Stat floor
// ---------------------------------------------------------------------------

/**
 * No final stat value may fall below this after all modifiers.
 * Prevents division-by-zero errors and logical anomalies.
 */
export const MIN_STAT_VALUE = 1

// ---------------------------------------------------------------------------
// Tier stat ranges
// ---------------------------------------------------------------------------

/**
 * Valid base-stat total range per tier.
 * Used for validation of hero data files and balance checks.
 *
 * @see design/gdd/hero-system.md — Base Stat Ranges by Tier
 */
export const TIER_STAT_RANGES: Record<HeroTier, { min: number; max: number }> = {
  [HeroTier.C]:   { min: 35,  max: 55  },
  [HeroTier.B]:   { min: 55,  max: 85  },
  [HeroTier.A]:   { min: 85,  max: 130 },
  [HeroTier.S]:   { min: 130, max: 180 },
  [HeroTier.SS]:  { min: 180, max: 240 },
  [HeroTier.SSS]: { min: 240, max: 320 },
}

// ---------------------------------------------------------------------------
// Skill slots per tier
// ---------------------------------------------------------------------------

/**
 * Number of skill slots available to heroes of each tier.
 * C: 1 passive
 * B: 1 passive
 * A: 1 passive + 1 active = 2
 * S: 1 passive + 1 active = 2 (+ martial art or advisor skill)
 * SS: 1 passive + 2 active = 3
 * SSS: 1 passive + 2 active = 4 (includes additional unique passive)
 *
 * @see design/gdd/hero-system.md — Tuning Knobs: SKILL_SLOTS_BY_TIER
 */
export const SKILL_SLOTS_BY_TIER: Record<HeroTier, number> = {
  [HeroTier.C]:   1,
  [HeroTier.B]:   1,
  [HeroTier.A]:   2,
  [HeroTier.S]:   2,
  [HeroTier.SS]:  3,
  [HeroTier.SSS]: 4,
}

// ---------------------------------------------------------------------------
// Advisor skill usage limit
// ---------------------------------------------------------------------------

/** Maximum advisor skills a player may activate in a single turn. */
export const ADVISOR_SKILL_PER_TURN = 1
