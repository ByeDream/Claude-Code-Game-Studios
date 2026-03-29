/**
 * Run Map System — Type Definitions
 *
 * Defines all data types for the Slay-the-Spire style layered node map.
 *
 * @module src/gameplay/run-map/types
 * @see design/gdd/run-map.md
 */

import { NodeType } from '../event/types'

// ---------------------------------------------------------------------------
// Map data model
// ---------------------------------------------------------------------------

/**
 * A single node on the run map.
 *
 * @see design/gdd/run-map.md — Map Data Model
 */
export interface MapNode {
  /** Unique node ID (e.g., "layer_3_node_1"). */
  id: string
  /** Node type determining interaction. */
  type: NodeType
  /** Layer index (0 = start layer). */
  layerIndex: number
  /** Horizontal position (0.0-1.0 normalized). */
  positionX: number
  /** IDs of nodes in the next layer this connects to. */
  connectsTo: string[]
  /** Whether this node has been completed. */
  completed: boolean
}

/**
 * A single layer of the map.
 */
export interface MapLayer {
  /** Layer index (0 = start). */
  index: number
  /** Nodes in this layer. */
  nodes: MapNode[]
  /** Whether this is a Boss layer (single node). */
  isBossLayer: boolean
}

/**
 * Complete run map structure.
 *
 * @see design/gdd/run-map.md — Map Data Model
 */
export interface RunMap {
  /** Campaign ID this map belongs to. */
  campaignId: string
  /** All layers from bottom (start) to top (final boss). */
  layers: MapLayer[]
  /** Start node ID. */
  startNodeId: string
  /** Final boss node ID. */
  finalBossNodeId: string
}

/**
 * Configuration for map generation.
 *
 * @see design/gdd/run-map.md — Map Scale by Campaign
 */
export interface MapConfig {
  /** Campaign identifier. */
  campaignId: string
  /** Total number of layers (including start and final boss). */
  totalLayers: number
  /** Number of mid-boss encounters. */
  midBossCount: number
  /** Layer indices for mid-boss placement. */
  midBossLayers: number[]
}
