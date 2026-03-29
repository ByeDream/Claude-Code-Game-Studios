/**
 * Hero Growth System — Configuration Constants
 *
 * All tuning knobs for the Hero Growth system live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/hero-growth/growthConfig
 * @see design/gdd/hero-growth.md — Tuning Knobs, Formulas
 */

// ---------------------------------------------------------------------------
// Level limits
// ---------------------------------------------------------------------------

/**
 * Maximum hero level within a single run.
 * Safe range: 8–15. Higher = longer growth curve.
 *
 * @see design/gdd/hero-growth.md — Level System
 */
export const MAX_LEVEL = 10

// ---------------------------------------------------------------------------
// Level-up cost curve
// ---------------------------------------------------------------------------

/**
 * Base material cost for the first level-up (Lv.1 → Lv.2).
 * Safe range: 2–10.
 *
 * @see design/gdd/hero-growth.md — Formulas: Level-Up Cost
 */
export const BASE_LEVEL_COST = 5

/**
 * Linear cost increment per level beyond 2.
 * Safe range: 1–5.
 *
 * @see design/gdd/hero-growth.md — Formulas: Level-Up Cost
 */
export const COST_INCREMENT = 2

/**
 * Quadratic cost acceleration per level beyond 2.
 * Safe range: 0.5–2.
 *
 * @see design/gdd/hero-growth.md — Formulas: Level-Up Cost
 */
export const COST_ACCELERATION = 1

// ---------------------------------------------------------------------------
// Skill scaling
// ---------------------------------------------------------------------------

/**
 * Per-level skill value scaling rate.
 * At Lv.10: scaledValue = base * (1 + 9 * 0.08) = base * 1.72.
 * Safe range: 0.05–0.12.
 *
 * @see design/gdd/hero-growth.md — Formulas: Skill Scaling
 */
export const SKILL_SCALING_RATE = 0.08

// ---------------------------------------------------------------------------
// Legend variant multiplier
// ---------------------------------------------------------------------------

/**
 * Growth rate multiplier for Legend variant heroes.
 * Applied on top of base growth rates.
 * Safe range: 1.1–1.5.
 *
 * @see design/gdd/hero-growth.md — Edge Cases: Legend variant growth
 */
export const LEGEND_GROWTH_MULTIPLIER = 1.25
