/**
 * Equipment System — Configuration Constants
 *
 * All tuning knobs for the Equipment system live here.
 * Gameplay values must never be hardcoded in logic files.
 *
 * Ranges sourced directly from the GDD Tuning Knobs table.
 *
 * @module src/gameplay/equipment/equipmentConfig
 * @see design/gdd/equipment-system.md — Tuning Knobs, Formulas
 */

// ---------------------------------------------------------------------------
// Slot limits
// ---------------------------------------------------------------------------

/**
 * Total number of equipment slots available per hero.
 * Current value = 3 (Weapon, Armor, Mount).
 * Safe range: 2–4. Higher → more build options; lower → simpler.
 *
 * @see design/gdd/equipment-system.md — Equipment Slots
 */
export const EQUIP_SLOTS = 3

// ---------------------------------------------------------------------------
// Strengthening
// ---------------------------------------------------------------------------

/**
 * Maximum strengthen level reachable on Basic/Advanced equipment.
 * Named equipment is permanently capped at 0.
 * Safe range: 1–5.
 *
 * @see design/gdd/equipment-system.md — Equipment Strengthening
 */
export const MAX_STRENGTHEN_LEVEL = 3

/**
 * Fractional bonus added per strengthen level to each base stat.
 *
 * Formula:
 *   effectiveStat = baseStats[stat] * (1 + strengthenLevel * STRENGTHEN_BONUS_RATE)
 *
 * | Level | Multiplier |
 * |-------|-----------|
 * |   +1  |   1.20    |
 * |   +2  |   1.40    |
 * |   +3  |   1.60    |
 *
 * Safe range: 0.05–0.50.
 *
 * @see design/gdd/equipment-system.md — Formulas: Equipment Stat Bonus
 */
export const STRENGTHEN_BONUS_RATE = 0.2

/**
 * Gold cost per strengthen target level.
 * Formula: strengthenGoldCost = STRENGTHEN_GOLD_PER_LEVEL * targetLevel
 *
 * | targetLevel | Gold Cost |
 * |-------------|-----------|
 * |      +1     |     10    |
 * |      +2     |     20    |
 * |      +3     |     30    |
 *
 * @see design/gdd/equipment-system.md — Formulas: Strengthen Cost
 */
export const STRENGTHEN_GOLD_PER_LEVEL = 10

/**
 * Material cost per strengthen target level.
 * Formula: strengthenMaterialCost = STRENGTHEN_MATERIAL_PER_LEVEL * targetLevel
 *
 * | targetLevel | Material Cost |
 * |-------------|--------------|
 * |      +1     |       5      |
 * |      +2     |      10      |
 * |      +3     |      15      |
 *
 * @see design/gdd/equipment-system.md — Formulas: Strengthen Cost
 */
export const STRENGTHEN_MATERIAL_PER_LEVEL = 5

// ---------------------------------------------------------------------------
// Named equipment bonuses
// ---------------------------------------------------------------------------

/**
 * The multiplier applied to a Named equipment's effect magnitude when its
 * designated owner hero equips it.
 *
 * Example: 青龙偃月刀's 威压 effect is ×1 (10% DEF reduction) on non-owners,
 * and ×2 (20% DEF reduction) when Guan Yu wears it.
 *
 * Safe range: 1.5–3.0. Higher → stronger owner synergy, lower → free equipping is more viable.
 *
 * @see design/gdd/equipment-system.md — Tuning Knobs
 */
export const NAMED_OWNER_BONUS_MULT = 2.0

// ---------------------------------------------------------------------------
// Base stat ranges per level (for reference / validation)
// ---------------------------------------------------------------------------

/**
 * Expected base-stat range for equipment at each level.
 * Used for balance validation — actual item stat values should fall within these bounds.
 *
 * | Level | Category | Main-stat range |
 * |-------|----------|----------------|
 * |   1   | Basic    |     3–5        |
 * |   2   | Basic    |     6–10       |
 * |   3   | Advanced |    11–16       |
 * |   4   | Named    |    14–25       |
 *
 * @see design/gdd/equipment-system.md — Tuning Knobs: LV1/LV2/LV3_STAT_RANGE
 */
export const STAT_RANGE_BY_LEVEL: Record<number, { min: number; max: number }> = {
  1: { min: 3,  max: 5  },
  2: { min: 6,  max: 10 },
  3: { min: 11, max: 16 },
  4: { min: 14, max: 25 },
}
