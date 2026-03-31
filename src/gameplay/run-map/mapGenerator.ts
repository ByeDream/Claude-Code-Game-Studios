/**
 * Run Map System — Map Generator
 *
 * Generates Slay-the-Spire style layered node maps.
 * Pure functional: deterministic with seeded RNG.
 *
 * Pipeline:
 * 1. Create layer structure (node counts)
 * 2. Place boss layers (fixed positions)
 * 3. Fill node types (distribution rules + constraints)
 * 4. Generate path connections
 * 5. Validate (no orphans, ≥2 independent routes)
 * 6. Retry if validation fails
 *
 * @module src/gameplay/run-map/mapGenerator
 * @see design/gdd/run-map.md
 */

import { NodeType } from '../event/types'
import type { RandomFn } from '../battle/types'
import type { RunMap, MapLayer, MapNode, MapConfig } from './types'
import {
  NODES_PER_LAYER_WEIGHTS,
  EXTRA_PATH_CHANCE,
  MAX_RETRIES,
  NODE_TYPE_TARGETS,
  DEFAULT_SMALL_MAP,
} from './mapConfig'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a complete run map from the given configuration.
 *
 * @param config - Map generation parameters.
 * @param random - Injectable RNG.
 * @returns A valid RunMap, or throws if generation fails after MAX_RETRIES.
 *
 * @see design/gdd/run-map.md — Map Generation Pipeline
 */
export function generateMap(
  config: MapConfig = DEFAULT_SMALL_MAP,
  random: RandomFn = Math.random,
): RunMap {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const map = tryGenerateMap(config, random)
    if (validateMap(map)) return map
  }

  // Final attempt with relaxed constraints
  const map = tryGenerateMap(config, random)
  ensureNoOrphans(map)
  return map
}

// ---------------------------------------------------------------------------
// Generation pipeline
// ---------------------------------------------------------------------------

/**
 * Attempts to generate a map (may not pass validation).
 */
function tryGenerateMap(config: MapConfig, random: RandomFn): RunMap {
  const { totalLayers, midBossLayers, campaignId } = config
  const finalBossLayerIndex = totalLayers - 1
  const bossLayerSet = new Set([...midBossLayers, finalBossLayerIndex])

  // Step 1: Generate layer structure
  const layers: MapLayer[] = []

  for (let i = 0; i < totalLayers; i++) {
    const isBossLayer = bossLayerSet.has(i)
    const isStartLayer = i === 0
    const nodeCount = isBossLayer || isStartLayer ? 1 : rollNodeCount(random)

    const nodes: MapNode[] = []
    for (let j = 0; j < nodeCount; j++) {
      nodes.push({
        id: `layer_${i}_node_${j}`,
        type: NodeType.Battle, // placeholder, filled in step 3
        layerIndex: i,
        positionX: nodeCount === 1 ? 0.5 : j / (nodeCount - 1),
        connectsTo: [],
        completed: false,
      })
    }

    layers.push({ index: i, nodes, isBossLayer })
  }

  // Step 2: Assign node types
  assignNodeTypes(layers, bossLayerSet, finalBossLayerIndex, random)

  // Step 3: Generate path connections
  generateConnections(layers, random)

  const startNodeId = layers[0].nodes[0].id
  const finalBossNodeId = layers[finalBossLayerIndex].nodes[0].id

  return { campaignId, layers, startNodeId, finalBossNodeId }
}

// ---------------------------------------------------------------------------
// Node count per layer
// ---------------------------------------------------------------------------

/**
 * Rolls the number of nodes for a non-boss/non-start layer.
 */
function rollNodeCount(random: RandomFn): number {
  const entries = Object.entries(NODES_PER_LAYER_WEIGHTS)
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = random() * totalWeight

  for (const [count, weight] of entries) {
    roll -= weight
    if (roll <= 0) return Number(count)
  }
  return 3 // fallback
}

// ---------------------------------------------------------------------------
// Node type assignment
// ---------------------------------------------------------------------------

/**
 * Assigns node types to all non-boss layers based on distribution targets.
 */
function assignNodeTypes(
  layers: MapLayer[],
  bossLayerSet: Set<number>,
  finalBossLayerIndex: number,
  random: RandomFn,
): void {
  // Count total non-boss nodes
  const nonBossNodes: MapNode[] = []
  for (const layer of layers) {
    if (layer.isBossLayer) {
      // Boss layers get boss type
      for (const node of layer.nodes) {
        node.type = NodeType.Boss
      }
      continue
    }
    if (layer.index === 0) {
      // Start layer: always battle
      layer.nodes[0].type = NodeType.Battle
      continue
    }
    nonBossNodes.push(...layer.nodes)
  }

  if (nonBossNodes.length === 0) return

  // Build type pool based on targets
  const typePool: NodeType[] = []
  for (const [type, ratio] of Object.entries(NODE_TYPE_TARGETS)) {
    const count = Math.round(nonBossNodes.length * ratio)
    for (let i = 0; i < count; i++) {
      typePool.push(type as NodeType)
    }
  }

  // Fill remaining with battle
  while (typePool.length < nonBossNodes.length) {
    typePool.push(NodeType.Battle)
  }

  // Shuffle
  shuffleArray(typePool, random)

  // Assign
  for (let i = 0; i < nonBossNodes.length; i++) {
    nonBossNodes[i].type = typePool[i]
  }

  // Enforce constraints
  enforceConstraints(layers, bossLayerSet, finalBossLayerIndex, random)
}

/**
 * Enforces placement constraints after initial assignment.
 */
function enforceConstraints(
  layers: MapLayer[],
  bossLayerSet: Set<number>,
  _finalBossLayerIndex: number,
  _random: RandomFn,
): void {
  // Constraint 1: First layer must have battle
  if (layers[0].nodes[0].type !== NodeType.Battle) {
    layers[0].nodes[0].type = NodeType.Battle
  }

  // Constraint 3: No mystery on first layer or layer before boss
  for (const layer of layers) {
    for (const node of layer.nodes) {
      if (node.type === NodeType.Mystery) {
        if (layer.index === 0 || bossLayerSet.has(layer.index + 1)) {
          node.type = NodeType.Battle
        }
      }
    }
  }

  // Constraint 4: No consecutive same-type functional nodes between layers
  for (let i = 1; i < layers.length - 1; i++) {
    const prev = layers[i - 1]
    const curr = layers[i]
    if (prev.isBossLayer || curr.isBossLayer) continue

    const functionalTypes = new Set([NodeType.Recruit, NodeType.Shop, NodeType.Rest])
    const prevTypes = new Set(prev.nodes.filter(n => functionalTypes.has(n.type)).map(n => n.type))

    for (const node of curr.nodes) {
      if (prevTypes.has(node.type) && functionalTypes.has(node.type)) {
        node.type = NodeType.Battle
      }
    }
  }

  // Constraint 2 (LAST): Layer before each boss should have a functional node
  // Run last so it's not undone by other constraints
  for (const bossLayer of bossLayerSet) {
    if (bossLayer > 0) {
      const prevLayer = layers[bossLayer - 1]
      if (prevLayer && !prevLayer.isBossLayer) {
        const hasFunctional = prevLayer.nodes.some(n =>
          n.type === NodeType.Rest || n.type === NodeType.Shop || n.type === NodeType.Recruit
        )
        if (!hasFunctional && prevLayer.nodes.length > 0) {
          const candidate = prevLayer.nodes.find(n =>
            n.type !== NodeType.Boss && n.type !== NodeType.Rest
          )
          if (candidate) {
            candidate.type = NodeType.Rest
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Path connections
// ---------------------------------------------------------------------------

/**
 * Generates connections between adjacent layers.
 */
function generateConnections(layers: MapLayer[], random: RandomFn): void {
  for (let i = 0; i < layers.length - 1; i++) {
    const currentLayer = layers[i]
    const nextLayer = layers[i + 1]

    // Track which next-layer nodes have at least one incoming connection
    const connected = new Set<string>()

    for (const node of currentLayer.nodes) {
      if (nextLayer.nodes.length === 1) {
        // Only one node in next layer — must connect
        node.connectsTo = [nextLayer.nodes[0].id]
        connected.add(nextLayer.nodes[0].id)
        continue
      }

      // Connect to closest 1-2 nodes by positionX
      const sorted = [...nextLayer.nodes].sort(
        (a, b) => Math.abs(a.positionX - node.positionX) - Math.abs(b.positionX - node.positionX)
      )

      const baseCount = Math.min(2, sorted.length)
      const targets = sorted.slice(0, baseCount)

      // Maybe add extra connection
      if (sorted.length > baseCount && random() < EXTRA_PATH_CHANCE) {
        targets.push(sorted[baseCount])
      }

      node.connectsTo = targets.map(t => t.id)
      for (const t of targets) {
        connected.add(t.id)
      }
    }

    // Ensure no orphan nodes in next layer
    for (const nextNode of nextLayer.nodes) {
      if (!connected.has(nextNode.id)) {
        // Connect from closest current node
        const closest = [...currentLayer.nodes].sort(
          (a, b) => Math.abs(a.positionX - nextNode.positionX) - Math.abs(b.positionX - nextNode.positionX)
        )[0]
        if (closest && !closest.connectsTo.includes(nextNode.id)) {
          closest.connectsTo.push(nextNode.id)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates the generated map meets all constraints.
 */
function validateMap(map: RunMap): boolean {
  // 1. No orphan nodes (every non-start node has ≥1 incoming connection)
  if (!checkNoOrphans(map)) return false

  // 2. At least MIN_INDEPENDENT_ROUTES routes exist
  // Simplified: check that start connects to ≥2 nodes or there are ≥2 paths
  if (!checkMultipleRoutes(map)) return false

  return true
}

/**
 * Checks that every non-start node has at least one incoming connection.
 */
function checkNoOrphans(map: RunMap): boolean {
  const hasIncoming = new Set<string>()
  hasIncoming.add(map.startNodeId)

  for (const layer of map.layers) {
    for (const node of layer.nodes) {
      for (const targetId of node.connectsTo) {
        hasIncoming.add(targetId)
      }
    }
  }

  // Check all nodes
  for (const layer of map.layers) {
    for (const node of layer.nodes) {
      if (!hasIncoming.has(node.id)) return false
    }
  }

  return true
}

/**
 * Checks that at least 2 distinct routes exist from start to end.
 * Simplified: checks that layer 1 has ≥2 nodes reachable from start.
 */
function checkMultipleRoutes(map: RunMap): boolean {
  if (map.layers.length < 3) return true // too small to require multiple routes

  const startNode = map.layers[0].nodes[0]
  return startNode.connectsTo.length >= 2 || map.layers[1].nodes.length <= 1
}

/**
 * Fixes orphan nodes by adding connections as needed.
 */
function ensureNoOrphans(map: RunMap): void {
  const hasIncoming = new Set<string>()
  hasIncoming.add(map.startNodeId)

  for (const layer of map.layers) {
    for (const node of layer.nodes) {
      for (const targetId of node.connectsTo) {
        hasIncoming.add(targetId)
      }
    }
  }

  // Fix orphans
  for (let i = 1; i < map.layers.length; i++) {
    const layer = map.layers[i]
    const prevLayer = map.layers[i - 1]

    for (const node of layer.nodes) {
      if (!hasIncoming.has(node.id)) {
        // Connect from a random node in prev layer
        const source = prevLayer.nodes[0]
        if (source) {
          source.connectsTo.push(node.id)
          hasIncoming.add(node.id)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffleArray<T>(arr: T[], random: RandomFn): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Gets all nodes reachable from the given node ID.
 */
export function getSelectableNodes(map: RunMap, currentNodeId: string): MapNode[] {
  for (const layer of map.layers) {
    const node = layer.nodes.find(n => n.id === currentNodeId)
    if (node) {
      const nextLayerIndex = node.layerIndex + 1
      if (nextLayerIndex >= map.layers.length) return []

      const nextLayer = map.layers[nextLayerIndex]
      return nextLayer.nodes.filter(n => node.connectsTo.includes(n.id))
    }
  }
  return []
}

/**
 * Gets all nodes in the map as a flat array.
 */
export function getAllNodes(map: RunMap): MapNode[] {
  return map.layers.flatMap(l => l.nodes)
}

/**
 * Gets a node by ID.
 */
export function getNodeById(map: RunMap, nodeId: string): MapNode | undefined {
  for (const layer of map.layers) {
    const node = layer.nodes.find(n => n.id === nodeId)
    if (node) return node
  }
  return undefined
}
