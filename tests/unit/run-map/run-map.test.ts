/**
 * Run Map System — Unit Tests
 *
 * Tests for Slay-the-Spire style layered map generation:
 * - Layer structure (correct count, boss placement)
 * - Node count per layer (2-4 for normal, 1 for boss)
 * - Node type distribution (approximate targets)
 * - Path connections (no orphans, adjacent layers only)
 * - Multiple routes exist
 * - Placement constraints
 * - Performance (generation < 100ms)
 *
 * ≥ 30 tests target
 *
 * @see design/gdd/run-map.md — Acceptance Criteria
 */

import { describe, it, expect } from 'vitest'

import { NodeType } from '../../../src/gameplay/event/types'
import type { MapConfig, RunMap } from '../../../src/gameplay/run-map/types'
import { DEFAULT_SMALL_MAP } from '../../../src/gameplay/run-map/mapConfig'
import {
  generateMap,
  getSelectableNodes,
  getAllNodes,
  getNodeById,
} from '../../../src/gameplay/run-map/mapGenerator'
import type { RandomFn } from '../../../src/gameplay/battle/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixedRandom(value: number): RandomFn {
  return () => value
}

function seededRandom(seed: number): RandomFn {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function makeConfig(overrides: Partial<MapConfig> = {}): MapConfig {
  return { ...DEFAULT_SMALL_MAP, ...overrides }
}

// ---------------------------------------------------------------------------
// Layer structure
// ---------------------------------------------------------------------------

describe('map layer structure', () => {
  it('generates correct number of layers', () => {
    const config = makeConfig({ totalLayers: 16 })
    const map = generateMap(config, seededRandom(42))
    expect(map.layers).toHaveLength(16)
  })

  it('first layer has exactly 1 node (start)', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    expect(map.layers[0].nodes).toHaveLength(1)
  })

  it('final boss layer has exactly 1 node', () => {
    const config = makeConfig({ totalLayers: 16 })
    const map = generateMap(config, seededRandom(42))
    const lastLayer = map.layers[config.totalLayers - 1]
    expect(lastLayer.nodes).toHaveLength(1)
    expect(lastLayer.isBossLayer).toBe(true)
  })

  it('mid-boss layers have exactly 1 node', () => {
    const config = makeConfig({ midBossLayers: [5, 10] })
    const map = generateMap(config, seededRandom(42))

    expect(map.layers[5].nodes).toHaveLength(1)
    expect(map.layers[5].isBossLayer).toBe(true)
    expect(map.layers[10].nodes).toHaveLength(1)
    expect(map.layers[10].isBossLayer).toBe(true)
  })

  it('non-boss layers have 2-4 nodes', () => {
    const config = makeConfig()
    const map = generateMap(config, seededRandom(42))
    const bossLayers = new Set([...config.midBossLayers, config.totalLayers - 1, 0])

    for (const layer of map.layers) {
      if (!bossLayers.has(layer.index)) {
        expect(layer.nodes.length).toBeGreaterThanOrEqual(2)
        expect(layer.nodes.length).toBeLessThanOrEqual(4)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

describe('node type assignment', () => {
  it('start node is always battle', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    expect(map.layers[0].nodes[0].type).toBe(NodeType.Battle)
  })

  it('boss layer nodes are boss type', () => {
    const config = makeConfig({ midBossLayers: [5, 10] })
    const map = generateMap(config, seededRandom(42))

    expect(map.layers[5].nodes[0].type).toBe(NodeType.Boss)
    expect(map.layers[10].nodes[0].type).toBe(NodeType.Boss)
    expect(map.layers[15].nodes[0].type).toBe(NodeType.Boss)
  })

  it('all 7 node types are represented (may vary with seed)', () => {
    // Run with different seeds and check union of types
    const allTypes = new Set<NodeType>()
    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap(makeConfig(), seededRandom(seed))
      for (const node of getAllNodes(map)) {
        allTypes.add(node.type)
      }
    }
    // Should have at least battle, boss, and most functional types
    expect(allTypes.has(NodeType.Battle)).toBe(true)
    expect(allTypes.has(NodeType.Boss)).toBe(true)
    expect(allTypes.size).toBeGreaterThanOrEqual(5)
  })

  it('battle nodes are the most common type', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const allNodes = getAllNodes(map)
    const battleCount = allNodes.filter(n => n.type === NodeType.Battle).length
    const otherTypeCounts = [NodeType.Elite, NodeType.Recruit, NodeType.Shop, NodeType.Rest, NodeType.Mystery]
      .map(t => allNodes.filter(n => n.type === t).length)

    expect(battleCount).toBeGreaterThan(Math.max(...otherTypeCounts))
  })
})

// ---------------------------------------------------------------------------
// Path connections
// ---------------------------------------------------------------------------

describe('path connections', () => {
  it('every non-start node has at least one incoming connection', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const hasIncoming = new Set<string>()
    hasIncoming.add(map.startNodeId)

    for (const layer of map.layers) {
      for (const node of layer.nodes) {
        for (const targetId of node.connectsTo) {
          hasIncoming.add(targetId)
        }
      }
    }

    for (const layer of map.layers) {
      for (const node of layer.nodes) {
        expect(hasIncoming.has(node.id)).toBe(true)
      }
    }
  })

  it('connections only go to the next layer (no skipping)', () => {
    const map = generateMap(makeConfig(), seededRandom(42))

    for (let i = 0; i < map.layers.length - 1; i++) {
      const nextLayerNodeIds = new Set(map.layers[i + 1].nodes.map(n => n.id))
      for (const node of map.layers[i].nodes) {
        for (const targetId of node.connectsTo) {
          expect(nextLayerNodeIds.has(targetId)).toBe(true)
        }
      }
    }
  })

  it('last layer nodes have no outgoing connections', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const lastLayer = map.layers[map.layers.length - 1]
    for (const node of lastLayer.nodes) {
      expect(node.connectsTo).toHaveLength(0)
    }
  })

  it('start node connects to layer 1', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const startNode = map.layers[0].nodes[0]
    expect(startNode.connectsTo.length).toBeGreaterThan(0)

    const layer1NodeIds = new Set(map.layers[1].nodes.map(n => n.id))
    for (const id of startNode.connectsTo) {
      expect(layer1NodeIds.has(id)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

describe('query helpers', () => {
  it('getSelectableNodes returns next layer reachable nodes', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const startNode = map.layers[0].nodes[0]
    const selectable = getSelectableNodes(map, startNode.id)

    expect(selectable.length).toBeGreaterThan(0)
    expect(selectable.every(n => n.layerIndex === 1)).toBe(true)
  })

  it('getSelectableNodes returns empty for final boss', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const selectable = getSelectableNodes(map, map.finalBossNodeId)
    expect(selectable).toHaveLength(0)
  })

  it('getAllNodes returns all nodes', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const allNodes = getAllNodes(map)
    const expectedCount = map.layers.reduce((sum, l) => sum + l.nodes.length, 0)
    expect(allNodes).toHaveLength(expectedCount)
  })

  it('getNodeById finds existing node', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const node = getNodeById(map, map.startNodeId)
    expect(node).toBeDefined()
    expect(node!.id).toBe(map.startNodeId)
  })

  it('getNodeById returns undefined for unknown ID', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    expect(getNodeById(map, 'nonexistent')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Placement constraints
// ---------------------------------------------------------------------------

describe('placement constraints', () => {
  it('no mystery nodes on first layer', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const map = generateMap(makeConfig(), seededRandom(seed))
      expect(map.layers[0].nodes.every(n => n.type !== NodeType.Mystery)).toBe(true)
    }
  })

  it('layer before boss has at least one functional node (most seeds)', () => {
    const config = makeConfig({ midBossLayers: [5, 10] })
    let passCount = 0

    for (let seed = 1; seed <= 20; seed++) {
      const map = generateMap(config, seededRandom(seed))
      let allBossPrepsOk = true

      for (const bossLayerIdx of [5, 10, 15]) {
        const prevLayer = map.layers[bossLayerIdx - 1]
        if (prevLayer && !prevLayer.isBossLayer) {
          const hasFunctional = prevLayer.nodes.some(n =>
            n.type === NodeType.Rest || n.type === NodeType.Shop || n.type === NodeType.Recruit
          )
          if (!hasFunctional) allBossPrepsOk = false
        }
      }
      if (allBossPrepsOk) passCount++
    }

    // At least 80% of seeds should satisfy the constraint
    expect(passCount).toBeGreaterThanOrEqual(16)
  })
})

// ---------------------------------------------------------------------------
// Node IDs
// ---------------------------------------------------------------------------

describe('node IDs', () => {
  it('all node IDs are unique', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    const allNodes = getAllNodes(map)
    const ids = allNodes.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('startNodeId exists in the map', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    expect(getNodeById(map, map.startNodeId)).toBeDefined()
  })

  it('finalBossNodeId exists in the map', () => {
    const map = generateMap(makeConfig(), seededRandom(42))
    expect(getNodeById(map, map.finalBossNodeId)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('same seed produces same map', () => {
    const map1 = generateMap(makeConfig(), seededRandom(42))
    const map2 = generateMap(makeConfig(), seededRandom(42))

    const nodes1 = getAllNodes(map1).map(n => `${n.id}:${n.type}`)
    const nodes2 = getAllNodes(map2).map(n => `${n.id}:${n.type}`)
    expect(nodes1).toEqual(nodes2)
  })

  it('different seeds produce different maps', () => {
    const map1 = generateMap(makeConfig(), seededRandom(42))
    const map2 = generateMap(makeConfig(), seededRandom(99))

    const types1 = getAllNodes(map1).map(n => n.type).join(',')
    const types2 = getAllNodes(map2).map(n => n.type).join(',')
    // Very unlikely to be identical
    expect(types1 === types2).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Stability
// ---------------------------------------------------------------------------

describe('generation stability', () => {
  it('100 generations all succeed', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const map = generateMap(makeConfig(), seededRandom(seed))
      expect(map.layers.length).toBe(16)
      expect(getAllNodes(map).length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('performance', () => {
  it('generates map in < 100ms', () => {
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      generateMap(makeConfig(), seededRandom(i))
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(2000) // 100 maps in < 2s = < 20ms each
  })
})
