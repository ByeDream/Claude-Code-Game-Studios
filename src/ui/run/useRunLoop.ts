/**
 * Run Loop — React Hook for RunState management
 *
 * Wraps the pure functional RunManager with React state management.
 * Provides the bridge between the gameplay logic layer and the UI layer.
 *
 * @module src/ui/run/useRunLoop
 * @see src/gameplay/run/runManager
 */

import { useState, useCallback, useMemo } from 'react'
import type { RunState, RunConfig } from '../../gameplay/run/types'
import { RunPhase } from '../../gameplay/run/types'
import type { HeroData } from '../../gameplay/hero/types'
import type { NamelessUnit } from '../../gameplay/enemy/types'
import type { EquipmentData } from '../../gameplay/equipment/types'
import { RestChoice } from '../../gameplay/event/types'
import { NodeType } from '../../gameplay/event/types'
import type { MapNode } from '../../gameplay/run-map/types'
import { getSelectableNodes, getNodeById } from '../../gameplay/run-map/mapGenerator'
import {
  startRun,
  selectNode,
  resolveBattleNode,
  resolveRecruitNode,
  resolveShopNode,
  resolveRestNodeAction,
  resolveMysteryNodeAction,
  checkRunEnd,
} from '../../gameplay/run/runManager'
import { createNamelessUnit } from '../../gameplay/enemy/enemyFactory'
import { NamelessTemplateType } from '../../gameplay/enemy/types'
import { generateRecruitPool } from '../../gameplay/event/eventManager'
import { generateShopInventory } from '../../gameplay/event/eventManager'

// ---------------------------------------------------------------------------
// Auto-generated enemies for battle nodes (MVP placeholder)
// ---------------------------------------------------------------------------

/**
 * Generates a simple enemy squad based on node type and nodeIndex.
 * In production, this would come from campaign data.
 */
function generateEnemySquad(
  nodeType: NodeType,
  nodeIndex: number,
): Array<HeroData | NamelessUnit> {
  const isElite = nodeType === NodeType.Elite
  const templates = [
    NamelessTemplateType.Soldier,
    NamelessTemplateType.LegionLeader,
    NamelessTemplateType.Lieutenant,
    NamelessTemplateType.Advisor,
    NamelessTemplateType.CavalryLeader,
  ]

  return Array.from({ length: 5 }, (_, i) =>
    createNamelessUnit(templates[i % templates.length], nodeIndex, i, isElite)
  )
}

// ---------------------------------------------------------------------------
// Hook state
// ---------------------------------------------------------------------------

/** Ephemeral UI state for node interactions (not persisted in RunState). */
export interface NodeInteractionState {
  /** Current node being interacted with. */
  node: MapNode
  /** Type of interaction (derived from node type). */
  type: NodeType
  /** Whether the interaction has been resolved. */
  resolved: boolean
  /** Result message to display. */
  resultMessage: string
  /** Recruit candidates (for recruit nodes). */
  recruitPool?: Array<{ hero: HeroData; cost: number }>
  /** Shop inventory (for shop nodes). */
  shopInventory?: Array<{ equipment: EquipmentData; price: number }>
  /** Mystery event description (for mystery nodes). */
  mysteryDescription?: string
  /** Battle outcome (for battle nodes). */
  battleOutcome?: 'win' | 'lose'
  /** Generated enemies for battle nodes. */
  enemies?: Array<HeroData | NamelessUnit>
}

export interface RunLoopState {
  /** The core gameplay RunState. */
  runState: RunState | null
  /** Whether a run is active. */
  isRunning: boolean
  /** Current node interaction (null when in MapView). */
  interaction: NodeInteractionState | null
  /** Nodes the player can currently select. */
  selectableNodeIds: string[]
}

export interface RunLoopActions {
  /** Start a new run with the given config. */
  startNewRun: (config: RunConfig) => void
  /** Select a map node to move to. */
  onSelectNode: (nodeId: string) => void
  /** Resolve a battle node (auto-battle, then pick loot). */
  onResolveBattle: () => void
  /** Recruit a hero at the given index (or null to skip). */
  onResolveRecruit: (chosenIndex: number | null) => void
  /** Purchase items at the given indices. */
  onResolveShop: (purchaseIndices: number[]) => void
  /** Choose a rest action. */
  onResolveRest: (choice: RestChoice) => void
  /** Resolve a mystery event. */
  onResolveMystery: () => void
  /** Complete the current interaction and return to map. */
  onCompleteInteraction: () => void
  /** Abandon the current run. */
  onAbandonRun: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for managing the complete Run Loop lifecycle.
 *
 * @param heroPool - Available heroes for recruitment.
 * @param equipPool - Available equipment for shops.
 * @returns Current state and action handlers.
 */
export function useRunLoop(
  heroPool: HeroData[] = [],
  equipPool: EquipmentData[] = [],
): RunLoopState & RunLoopActions {
  const [runState, setRunState] = useState<RunState | null>(null)
  const [interaction, setInteraction] = useState<NodeInteractionState | null>(null)

  const selectableNodeIds = useMemo(() => {
    if (!runState || runState.phase !== RunPhase.MapView) return []
    return getSelectableNodes(runState.map, runState.currentNodeId).map(n => n.id)
  }, [runState])

  const startNewRun = useCallback((config: RunConfig) => {
    const state = startRun(config)
    // Mark the starting node as completed so the player immediately sees
    // selectable nodes in layer 1 (start node has no interaction).
    const startNode = getNodeById(state.map, state.currentNodeId)
    if (startNode) {
      startNode.completed = true
    }
    setRunState({
      ...state,
      completedNodeIds: [state.currentNodeId],
    })
    setInteraction(null)
  }, [])

  const onSelectNode = useCallback((nodeId: string) => {
    if (!runState) return
    const newState = selectNode(runState, nodeId)
    if (newState === runState) return // invalid selection

    const node = getNodeById(newState.map, nodeId)
    if (!node) return

    setRunState(newState)

    // Set up interaction based on node type
    const interactionState: NodeInteractionState = {
      node,
      type: node.type,
      resolved: false,
      resultMessage: '',
    }

    // Pre-generate data for battle/recruit/shop nodes
    if (node.type === NodeType.Battle || node.type === NodeType.Elite || node.type === NodeType.Boss) {
      interactionState.enemies = generateEnemySquad(node.type, newState.nodeIndex)
    } else if (node.type === NodeType.Recruit) {
      const ownedIds = newState.roster.map(h => h.data.id)
      interactionState.recruitPool = generateRecruitPool(heroPool, ownedIds, newState.nodeIndex)
    } else if (node.type === NodeType.Shop) {
      interactionState.shopInventory = generateShopInventory(
        equipPool, newState.ownedNamedIds, newState.nodeIndex,
      )
    }

    setInteraction(interactionState)
  }, [runState, heroPool, equipPool])

  const onResolveBattle = useCallback(() => {
    if (!runState || !interaction) return
    const enemies = generateEnemySquad(interaction.type, runState.nodeIndex)
    const newState = resolveBattleNode(runState, enemies)
    const checked = checkRunEnd(newState)
    const won = checked.completedNodeIds.length > runState.completedNodeIds.length
    setRunState(checked)
    setInteraction({
      ...interaction,
      resolved: true,
      battleOutcome: won ? 'win' : 'lose',
      resultMessage: won ? '⚔️ 战斗胜利！获得战利品！' : '💀 战斗失败...',
    })
  }, [runState, interaction])

  const onResolveRecruit = useCallback((chosenIndex: number | null) => {
    if (!runState) return
    const newState = resolveRecruitNode(runState, heroPool, chosenIndex)
    setRunState(checkRunEnd(newState))
    setInteraction(prev => prev ? {
      ...prev,
      resolved: true,
      resultMessage: chosenIndex !== null ? '🎉 招募成功！' : '跳过招募',
    } : null)
  }, [runState, heroPool])

  const onResolveShop = useCallback((purchaseIndices: number[]) => {
    if (!runState) return
    const newState = resolveShopNode(runState, equipPool, purchaseIndices)
    setRunState(checkRunEnd(newState))
    setInteraction(prev => prev ? {
      ...prev,
      resolved: true,
      resultMessage: purchaseIndices.length > 0
        ? `🛒 购买了 ${purchaseIndices.length} 件装备！`
        : '离开商店',
    } : null)
  }, [runState, equipPool])

  const onResolveRest = useCallback((choice: RestChoice) => {
    if (!runState) return
    const cost = choice === RestChoice.Train ? 20 : 30
    const newState = resolveRestNodeAction(runState, choice, cost, cost)
    setRunState(checkRunEnd(newState))
    setInteraction(prev => prev ? {
      ...prev,
      resolved: true,
      resultMessage: choice === RestChoice.Train ? '🏋️ 训练完成！' : '🔨 锻造完成！',
    } : null)
  }, [runState])

  const onResolveMystery = useCallback(() => {
    if (!runState) return
    const newState = resolveMysteryNodeAction(runState)
    setRunState(checkRunEnd(newState))
    setInteraction(prev => prev ? {
      ...prev,
      resolved: true,
      resultMessage: '🔮 事件已解决！',
    } : null)
  }, [runState])

  const onCompleteInteraction = useCallback(() => {
    setInteraction(null)
    // RunState already updated, phase should be MapView or Ended
  }, [])

  const onAbandonRun = useCallback(() => {
    setRunState(null)
    setInteraction(null)
  }, [])

  return {
    runState,
    isRunning: runState !== null && runState.phase !== RunPhase.Ended,
    interaction,
    selectableNodeIds,
    startNewRun,
    onSelectNode,
    onResolveBattle,
    onResolveRecruit,
    onResolveShop,
    onResolveRest,
    onResolveMystery,
    onCompleteInteraction,
    onAbandonRun,
  }
}
