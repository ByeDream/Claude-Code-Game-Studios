/**
 * Run Map System — Configuration Constants
 *
 * @module src/gameplay/run-map/mapConfig
 * @see design/gdd/run-map.md — Tuning Knobs
 */

import { NodeType } from '../event/types'

// ---------------------------------------------------------------------------
// Nodes per layer weights
// ---------------------------------------------------------------------------

/**
 * Weighted distribution for number of nodes per layer.
 * Key: node count, Value: probability weight.
 *
 * @see design/gdd/run-map.md — Formulas: Nodes Per Layer
 */
export const NODES_PER_LAYER_WEIGHTS: Record<number, number> = {
  2: 0.20,
  3: 0.50,
  4: 0.30,
}

// ---------------------------------------------------------------------------
// Path connections
// ---------------------------------------------------------------------------

/**
 * Probability of an extra path connection beyond the base connections.
 * Safe range: 0.1–0.5.
 *
 * @see design/gdd/run-map.md — Formulas: Path Connections
 */
export const EXTRA_PATH_CHANCE = 0.3

// ---------------------------------------------------------------------------
// Map scale defaults
// ---------------------------------------------------------------------------

/** Default total layers for small campaign. Safe range: 12–22. */
export const SMALL_MAP_LAYERS = 16

// ---------------------------------------------------------------------------
// Generation limits
// ---------------------------------------------------------------------------

/** Max retries before relaxing constraints. Safe range: 5–20. */
export const MAX_RETRIES = 10

/** Minimum independent routes from start to final boss. */
export const MIN_INDEPENDENT_ROUTES = 2

// ---------------------------------------------------------------------------
// Node type distribution targets (non-boss nodes)
// ---------------------------------------------------------------------------

/**
 * Target distribution for non-boss nodes.
 * Boss nodes have fixed positions and are excluded.
 *
 * @see design/gdd/run-map.md — Node Type Distribution
 */
export const NODE_TYPE_TARGETS: Record<string, number> = {
  [NodeType.Battle]: 0.42,
  [NodeType.Elite]: 0.15,
  [NodeType.Recruit]: 0.12,
  [NodeType.Shop]: 0.08,
  [NodeType.Rest]: 0.08,
  [NodeType.Mystery]: 0.15,
}

// ---------------------------------------------------------------------------
// Default small map config
// ---------------------------------------------------------------------------

/**
 * Default configuration for a small (MVP) map.
 * 16 layers, 2 mid-bosses at layers 5 and 10.
 */
export const DEFAULT_SMALL_MAP = {
  campaignId: 'default',
  totalLayers: 16,
  midBossCount: 2,
  midBossLayers: [5, 10],
}
