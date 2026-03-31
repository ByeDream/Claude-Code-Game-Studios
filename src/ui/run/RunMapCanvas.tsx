/**
 * Run Map Canvas — Slay-the-Spire Style Map Renderer
 *
 * Renders the layered node map on an HTML Canvas.
 * Nodes are drawn as colored circles, connections as lines,
 * and selectable nodes are highlighted.
 *
 * @module src/ui/run/RunMapCanvas
 * @see src/gameplay/run-map/types
 */

import { useRef, useEffect, useCallback } from 'react'
import type { RunMap, MapNode } from '../../gameplay/run-map/types'
import { NodeType } from '../../gameplay/event/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 700
const NODE_RADIUS = 18
const LAYER_PADDING_TOP = 60
const LAYER_PADDING_BOTTOM = 40
const SIDE_PADDING = 60

/** Node type → color + emoji */
const NODE_STYLES: Record<NodeType, { color: string; emoji: string; label: string }> = {
  [NodeType.Battle]:  { color: '#e74c3c', emoji: '⚔️', label: '战斗' },
  [NodeType.Elite]:   { color: '#e67e22', emoji: '🔥', label: '精英' },
  [NodeType.Boss]:    { color: '#8e44ad', emoji: '👹', label: 'Boss' },
  [NodeType.Recruit]: { color: '#27ae60', emoji: '🎖️', label: '招募' },
  [NodeType.Shop]:    { color: '#f1c40f', emoji: '🛒', label: '商店' },
  [NodeType.Rest]:    { color: '#3498db', emoji: '🏕️', label: '休息' },
  [NodeType.Mystery]: { color: '#9b59b6', emoji: '❓', label: '神秘' },
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RunMapCanvasProps {
  /** The generated run map. */
  map: RunMap
  /** Current node ID (player's position). */
  currentNodeId: string
  /** IDs of completed nodes. */
  completedNodeIds: string[]
  /** IDs of nodes the player can select. */
  selectableNodeIds: string[]
  /** Callback when a node is clicked. */
  onNodeClick: (nodeId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Canvas-based Slay-the-Spire style run map renderer.
 * Draws nodes, connections, and highlights selectable paths.
 */
export function RunMapCanvas({
  map,
  currentNodeId,
  completedNodeIds,
  selectableNodeIds,
  onNodeClick,
}: RunMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Compute node positions based on layer structure
  const getNodePosition = useCallback((node: MapNode) => {
    const layerCount = map.layers.length
    const layerHeight = (CANVAS_HEIGHT - LAYER_PADDING_TOP - LAYER_PADDING_BOTTOM) / Math.max(1, layerCount - 1)
    // Render bottom-up: layer 0 at bottom, last layer at top
    const y = CANVAS_HEIGHT - LAYER_PADDING_BOTTOM - (node.layerIndex * layerHeight)

    const layer = map.layers[node.layerIndex]
    const nodeCount = layer.nodes.length
    const totalWidth = CANVAS_WIDTH - SIDE_PADDING * 2
    const spacing = totalWidth / (nodeCount + 1)
    const nodeIdxInLayer = layer.nodes.findIndex(n => n.id === node.id)
    const x = SIDE_PADDING + spacing * (nodeIdxInLayer + 1)

    return { x, y }
  }, [map])

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Title
    ctx.fillStyle = '#ecf0f1'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🗺️ 征途地图', CANVAS_WIDTH / 2, 30)

    // Draw connections first (behind nodes)
    ctx.lineWidth = 2
    for (const layer of map.layers) {
      for (const node of layer.nodes) {
        const from = getNodePosition(node)
        for (const targetId of node.connectsTo) {
          const targetNode = map.layers.flatMap(l => l.nodes).find(n => n.id === targetId)
          if (!targetNode) continue
          const to = getNodePosition(targetNode)

          // Color connections differently based on state
          const isSelectable = currentNodeId === node.id && selectableNodeIds.includes(targetId)
          const isCompleted = completedNodeIds.includes(node.id) && completedNodeIds.includes(targetId)

          ctx.strokeStyle = isSelectable
            ? '#f1c40f'
            : isCompleted
              ? '#2ecc71'
              : '#34495e'
          ctx.globalAlpha = isSelectable ? 1.0 : 0.5
          ctx.beginPath()
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.stroke()
        }
      }
    }
    ctx.globalAlpha = 1.0

    // Draw nodes
    const allNodes = map.layers.flatMap(l => l.nodes)
    for (const node of allNodes) {
      const { x, y } = getNodePosition(node)
      const style = NODE_STYLES[node.type]
      const isCurrent = node.id === currentNodeId
      const isCompleted = completedNodeIds.includes(node.id)
      const isSelectable = selectableNodeIds.includes(node.id)

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2)

      if (isCurrent) {
        // Current node: bright outline
        ctx.fillStyle = style.color
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 3
        ctx.stroke()
      } else if (isSelectable) {
        // Selectable: glowing outline
        ctx.fillStyle = style.color
        ctx.fill()
        ctx.strokeStyle = '#f1c40f'
        ctx.lineWidth = 3
        ctx.stroke()
      } else if (isCompleted) {
        // Completed: dimmed
        ctx.fillStyle = '#2c3e50'
        ctx.fill()
        ctx.strokeStyle = '#7f8c8d'
        ctx.lineWidth = 1
        ctx.stroke()
      } else {
        // Future: dark
        ctx.fillStyle = '#34495e'
        ctx.fill()
        ctx.strokeStyle = '#555'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Node emoji/label
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (isCompleted && !isCurrent) {
        ctx.fillStyle = '#7f8c8d'
        ctx.fillText('✓', x, y)
      } else {
        ctx.fillStyle = '#fff'
        ctx.fillText(style.emoji, x, y)
      }

      // Label below node
      if (isCurrent || isSelectable) {
        ctx.font = '10px sans-serif'
        ctx.fillStyle = isCurrent ? '#fff' : '#bdc3c7'
        ctx.fillText(style.label, x, y + NODE_RADIUS + 12)
      }
    }

    // Current position indicator
    const currentNode = allNodes.find(n => n.id === currentNodeId)
    if (currentNode) {
      const { x, y } = getNodePosition(currentNode)
      ctx.font = '20px sans-serif'
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText('📍', x, y - NODE_RADIUS - 10)
    }

    // Legend
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    let legendY = CANVAS_HEIGHT - 20
    const legendItems = Object.entries(NODE_STYLES)
    const legendSpacing = (CANVAS_WIDTH - 40) / legendItems.length
    legendItems.forEach(([, style], i) => {
      const lx = 20 + i * legendSpacing
      ctx.fillStyle = style.color
      ctx.fillText(`${style.emoji} ${style.label}`, lx, legendY)
    })
  }, [map, currentNodeId, completedNodeIds, selectableNodeIds, getNodePosition])

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Find clicked node
    const allNodes = map.layers.flatMap(l => l.nodes)
    for (const node of allNodes) {
      const { x, y } = getNodePosition(node)
      const dx = clickX - x
      const dy = clickY - y
      if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS * 1.5) {
        if (selectableNodeIds.includes(node.id)) {
          onNodeClick(node.id)
        }
        return
      }
    }
  }, [map, getNodePosition, selectableNodeIds, onNodeClick])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onClick={handleClick}
      style={{
        border: '2px solid #34495e',
        borderRadius: '8px',
        cursor: selectableNodeIds.length > 0 ? 'pointer' : 'default',
        display: 'block',
      }}
    />
  )
}
