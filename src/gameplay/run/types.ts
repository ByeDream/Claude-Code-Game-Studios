/**
 * Run Manager — Type Definitions
 *
 * Defines the RunState and all types for the roguelike run loop.
 * Pure functional: RunState in → RunState out.
 *
 * @module src/gameplay/run/types
 * @see design/gdd/run-map.md
 * @see design/gdd/event-system.md
 */

import type { RunMap } from '../run-map/types'
import type { HeroInstance, HeroData } from '../hero/types'
import type { Economy } from '../economy/types'
import type { EquipmentData } from '../equipment/types'

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

/**
 * Run phase — high level state of the run.
 */
export enum RunPhase {
  /** Looking at the map, choosing next node. */
  MapView = 'map_view',
  /** Interacting with a node (battle, recruit, etc). */
  NodeInteraction = 'node_interaction',
  /** Run has ended (victory or defeat). */
  Ended = 'ended',
}

/**
 * Run end reason.
 */
export enum RunEndReason {
  /** Final boss defeated — victory! */
  Victory = 'victory',
  /** Honor reached 0 — defeat. */
  HonorDepleted = 'honor_depleted',
  /** Player abandoned run. */
  Abandoned = 'abandoned',
}

/**
 * Complete state of an ongoing or completed run.
 * All operations produce a new RunState — never mutate in place.
 */
export interface RunState {
  /** The generated map for this run. */
  map: RunMap
  /** Current node ID (where the player is). */
  currentNodeId: string
  /** Set of completed node IDs. */
  completedNodeIds: string[]
  /** Player's hero roster (HeroInstances). */
  roster: HeroInstance[]
  /** Current economy state. */
  economy: Economy
  /** Current honor value (starts at MAX_HONOR, 0 = run ends). */
  honor: number
  /** Sequential node counter (used for scaling calculations). */
  nodeIndex: number
  /** Current phase of the run. */
  phase: RunPhase
  /** End reason (only set when phase = Ended). */
  endReason?: RunEndReason
  /** IDs of events triggered in this run (for triggerOnce tracking). */
  triggeredEventIds: string[]
  /** IDs of bosses defeated in this run. */
  defeatedBossIds: string[]
  /** All equipment in the player's possession (equipped on heroes). */
  ownedEquipment: EquipmentData[]
  /** Named equipment IDs owned (for uniqueness checks). */
  ownedNamedIds: Set<string>
}

/**
 * Configuration for starting a new run.
 */
export interface RunConfig {
  /** Campaign ID. */
  campaignId: string
  /** Starting hero data (will be instantiated at level 1). */
  startingHeroes: HeroData[]
  /** Starting honor. */
  startingHonor: number
  /** Available equipment pool for the campaign. */
  equipmentPool: EquipmentData[]
  /** Available hero pool for recruitment. */
  heroPool: HeroData[]
}
