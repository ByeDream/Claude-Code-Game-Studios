/**
 * Battle System — Configuration Constants
 *
 * All tuning knobs for the battle system.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/battle/battleConfig
 * @see design/gdd/battle-engine.md — Tuning Knobs
 * @see design/gdd/battle-ai.md — Tuning Knobs
 */

// ---------------------------------------------------------------------------
// Battle flow
// ---------------------------------------------------------------------------

/** Maximum rounds before timeout (player loses). */
export const MAX_ROUNDS = 30

/** Number of positions per side. */
export const POSITIONS_PER_SIDE = 5

// ---------------------------------------------------------------------------
// HP scaling for battle
// ---------------------------------------------------------------------------

/**
 * Multiplier applied to a unit's HP stat when entering battle.
 * Since base stats are in the 10-40 range and damage is also in that range,
 * raw HP leads to 1-hit kills. This multiplier stretches HP so battles last
 * a meaningful number of rounds (target: 4-8 rounds for normal fights).
 *
 * Example: HP base 34 × 6 = 204 → takes ~6 normal attacks to kill.
 */
export const HP_BATTLE_MULTIPLIER = 10

// ---------------------------------------------------------------------------
// Damage formulas
// ---------------------------------------------------------------------------

/** Minimum damage guaranteed per hit. */
export const MIN_DAMAGE = 1

/**
 * Ratio at which DEF reduces INT-based skill damage.
 * INT skills are reduced by DEF * INT_DEF_RATIO instead of full DEF.
 * Lower = INT skills penetrate more.
 */
export const INT_DEF_RATIO = 0.5

/** Lower bound of random damage variance. */
export const RANDOM_VARIANCE_MIN = 0.95

/** Upper bound of random damage variance. */
export const RANDOM_VARIANCE_MAX = 1.05

/** Critical hit damage multiplier. */
export const CRIT_MULTIPLIER = 1.5

/** Maximum chain kills per round to prevent infinite loops. */
export const CHAIN_KILL_LIMIT = 3

// ---------------------------------------------------------------------------
// AI tuning
// ---------------------------------------------------------------------------

/**
 * HP ratio threshold below which healing skills are prioritized.
 * When any ally has currentHP / maxHP < HEAL_THRESHOLD, the AI will
 * prefer to use healing skills over damage skills.
 *
 * @see design/gdd/battle-ai.md — Skill Release Logic
 */
export const HEAL_THRESHOLD = 0.5

/**
 * Whether the AI should avoid stacking control effects on already-controlled targets.
 *
 * @see design/gdd/battle-ai.md — Tuning Knobs
 */
export const CONTROL_AVOID_OVERLAP = true

/**
 * Whether skills are prioritized over normal attacks when available.
 *
 * @see design/gdd/battle-ai.md — Tuning Knobs
 */
export const SKILL_PRIORITY_OVER_ATTACK = true

// ---------------------------------------------------------------------------
// Honor system
// ---------------------------------------------------------------------------

/** Starting honor value for each run. */
export const MAX_HONOR = 100

/** Honor lost when failing a mini-boss fight. */
export const MINI_BOSS_HONOR_COST_BASE = 30

/** Honor lost when failing the final boss fight. */
export const FINAL_BOSS_HONOR_COST = 100

// ---------------------------------------------------------------------------
// Boss drops
// ---------------------------------------------------------------------------

/** Probability of dropping an S+ hero from a boss fight. */
export const BOSS_S_PLUS_DROP_RATE = 0.2

/** Probability of dropping a named equipment from a boss fight. */
export const BOSS_NAMED_DROP_RATE = 0.3

// ---------------------------------------------------------------------------
// Advisor skills
// ---------------------------------------------------------------------------

/** Maximum advisor skill uses per battle. */
export const ADVISOR_SKILL_USES = 1

// ---------------------------------------------------------------------------
// Initial skill cooldown
// ---------------------------------------------------------------------------

/**
 * Number of turns before active skills become available at battle start.
 * Prevents powerful AOE skills from wiping enemies on turn 1.
 * Set to 0 to allow immediate skill use.
 *
 * GDD rationale: first few turns should be normal attacks to build tension.
 */
export const INITIAL_SKILL_COOLDOWN = 2

// ---------------------------------------------------------------------------
// Skill-to-Status Mapping
// ---------------------------------------------------------------------------

/**
 * Maps skill effect descriptions (keywords) to status effect IDs.
 * When a skill fires, the battle engine checks if its effects contain
 * status-related keywords and applies the corresponding status to targets.
 *
 * This is a data-driven approach: skill definitions don't hardcode status IDs,
 * and new status effects can be added by extending this mapping.
 *
 * @see design/gdd/status-system.md — Status Effect Categories
 */
export const SKILL_STATUS_KEYWORDS: Record<string, string> = {
  '增攻': 'atk_up',
  '减攻': 'atk_down',
  '增防': 'def_up',
  '减防': 'def_down',
  '加速': 'spd_up',
  '减速': 'spd_down',
  '中毒': 'poison',
  '燃烧': 'burn',
  '回复': 'regen',
  '眩晕': 'stun',
  '沉默': 'silence',
}
