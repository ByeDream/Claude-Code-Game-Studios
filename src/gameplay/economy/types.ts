/**
 * Economy System — Type Definitions
 *
 * Defines all resource types and state interfaces for the Economy system.
 * This is a foundation-layer system: no upstream dependencies.
 *
 * @module src/gameplay/economy/types
 * @see design/gdd/economy.md
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * The two run-scoped resource types managed by the Economy system.
 *
 * - Gold:     General currency. Used for recruiting heroes, shop purchases,
 *             and light equipment enhancement costs.
 * - Material: Growth consumable. Used for hero level-ups, equipment
 *             enhancement (primary cost), and skill acquisition.
 *
 * Both resources reset to starting values at the beginning of each Run.
 *
 * @see design/gdd/economy.md — Resource Types
 */
export enum ResourceType {
  Gold     = 'Gold',
  Material = 'Material',
}

// ---------------------------------------------------------------------------
// State interfaces
// ---------------------------------------------------------------------------

/**
 * Snapshot of a player's current resource balances within a Run.
 * Both values are always non-negative integers.
 *
 * @see design/gdd/economy.md — States and Transitions
 */
export interface PlayerResources {
  /** Current gold balance. Always ≥ 0. */
  readonly gold: number
  /** Current material balance. Always ≥ 0. */
  readonly material: number
}

/**
 * The immutable Economy state object passed through all economy operations.
 * Extend `PlayerResources` so it can be used wherever a resource snapshot is needed.
 *
 * The economy manager functions treat this as an opaque value type:
 * never mutate it — always produce a new instance via `earn` / `spend` / `reset`.
 */
export interface Economy extends PlayerResources {}
