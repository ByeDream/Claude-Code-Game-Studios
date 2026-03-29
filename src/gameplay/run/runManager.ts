/**
 * Run Manager — Core State Machine
 *
 * Pure functional run loop management.
 * All operations: RunState in → RunState out.
 *
 * Flow: startRun → selectNode → resolve*Node → checkRunEnd → repeat
 *
 * @module src/gameplay/run/runManager
 * @see design/gdd/run-map.md
 * @see design/gdd/event-system.md
 */

import type { HeroData, HeroInstance } from '../hero/types'
import { createHeroInstance } from '../hero/heroFactory'
import type { Economy } from '../economy/types'
import { createEconomy } from '../economy/economyManager'
import type { EquipmentData } from '../equipment/types'
import type { RandomFn } from '../battle/types'
import { runBattle } from '../battle/battleEngine'
import type { BattleResult } from '../battle/battleEngineTypes'
import { BattleOutcome } from '../battle/battleEngineTypes'
import type { RunMap, MapConfig } from '../run-map/types'
import { generateMap, getSelectableNodes, getNodeById } from '../run-map/mapGenerator'
import { NodeType } from '../event/types'
import type { HistoricalEvent, RecruitCandidate, ShopItem, EventGameState } from '../event/types'
import { RestChoice } from '../event/types'
import {
  generateRecruitPool, resolveRecruit,
  generateShopInventory, resolveShopPurchase,
  resolveRestNode, resolveMysteryNode, applyEventRewards,
} from '../event/eventManager'
import { generateChests, openChest, claimOption } from '../loot/lootManager'
import type { Chest, LootOption } from '../loot/types'
import { Difficulty } from '../loot/types'
import { DEFAULT_SMALL_MAP } from '../run-map/mapConfig'

import type { RunState, RunConfig } from './types'
import { RunPhase, RunEndReason } from './types'
import { DEFAULT_STARTING_HONOR, MID_BOSS_HONOR_COST, FINAL_BOSS_HONOR_COST } from './runConfig'

// ---------------------------------------------------------------------------
// Start run
// ---------------------------------------------------------------------------

/**
 * Creates a new RunState for a fresh run.
 *
 * @param config - Run configuration.
 * @param mapConfig - Optional map generation config.
 * @param random - Injectable RNG.
 * @returns Initial RunState ready for play.
 */
export function startRun(
  config: RunConfig,
  mapConfig: MapConfig = DEFAULT_SMALL_MAP,
  random: RandomFn = Math.random,
): RunState {
  const map = generateMap({ ...mapConfig, campaignId: config.campaignId }, random)
  const roster = config.startingHeroes.map(h => createHeroInstance(h, 1))
  const economy = createEconomy()

  return {
    map,
    currentNodeId: map.startNodeId,
    completedNodeIds: [],
    roster,
    economy,
    honor: config.startingHonor ?? DEFAULT_STARTING_HONOR,
    nodeIndex: 0,
    phase: RunPhase.MapView,
    triggeredEventIds: [],
    defeatedBossIds: [],
    ownedEquipment: [],
    ownedNamedIds: new Set(),
  }
}

// ---------------------------------------------------------------------------
// Node selection
// ---------------------------------------------------------------------------

/**
 * Selects a node to move to. Validates reachability.
 *
 * @param state - Current RunState.
 * @param nodeId - Target node ID.
 * @returns Updated RunState, or original if invalid.
 */
export function selectNode(state: RunState, nodeId: string): RunState {
  if (state.phase !== RunPhase.MapView) return state

  // Verify the node is reachable from current position
  const selectable = getSelectableNodes(state.map, state.currentNodeId)
  const isReachable = selectable.some(n => n.id === nodeId)

  if (!isReachable) return state

  return {
    ...state,
    currentNodeId: nodeId,
    phase: RunPhase.NodeInteraction,
  }
}

// ---------------------------------------------------------------------------
// Battle node resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a battle node: runs the battle, generates loot on victory.
 *
 * @param state - Current RunState (must be at a battle/elite/boss node).
 * @param enemyData - Enemy units for the encounter.
 * @param lootChoice - Index of the loot option chosen (0=equipment, 1=gold, 2=material).
 * @param random - Injectable RNG.
 * @returns Updated RunState.
 */
export function resolveBattleNode(
  state: RunState,
  enemyData: Array<HeroData | import('../enemy/types').NamelessUnit>,
  lootChoices: number[] = [1], // default: pick gold from each chest
  random: RandomFn = Math.random,
): RunState {
  const node = getNodeById(state.map, state.currentNodeId)
  if (!node) return state

  // Determine difficulty
  const difficulty = node.type === NodeType.Boss ? Difficulty.Boss
    : node.type === NodeType.Elite ? Difficulty.Elite
    : Difficulty.Normal

  // Run the battle
  const result = runBattle(state.roster, enemyData, enemyData.map((_, i) => i), random)

  if (result.outcome === BattleOutcome.PlayerWin) {
    // Victory: generate and claim loot
    const chests = generateChests(
      state.nodeIndex, difficulty,
      [], // equipment pool simplified for MVP
      state.ownedNamedIds,
      random,
    )

    let economy = state.economy
    for (let i = 0; i < chests.length; i++) {
      const options = openChest(chests[i])
      const choiceIdx = lootChoices[i] ?? 1 // default gold
      const chosen = options[Math.min(choiceIdx, options.length - 1)]
      economy = claimOption(chosen, economy)
    }

    const newDefeatedBosses = node.type === NodeType.Boss
      ? [...state.defeatedBossIds, state.currentNodeId]
      : state.defeatedBossIds

    return completeNode({
      ...state,
      economy,
      defeatedBossIds: newDefeatedBosses,
    })
  } else {
    // Defeat: lose honor for boss battles, otherwise just return to map
    if (node.type === NodeType.Boss) {
      const isFinalBoss = state.currentNodeId === state.map.finalBossNodeId
      const honorCost = isFinalBoss ? FINAL_BOSS_HONOR_COST : MID_BOSS_HONOR_COST
      const newHonor = Math.max(0, state.honor - honorCost)

      if (newHonor <= 0) {
        return {
          ...state,
          honor: 0,
          phase: RunPhase.Ended,
          endReason: RunEndReason.HonorDepleted,
        }
      }

      return {
        ...state,
        honor: newHonor,
        phase: RunPhase.MapView,
      }
    }

    // Non-boss defeat: no loot, return to map
    return completeNode(state)
  }
}

// ---------------------------------------------------------------------------
// Recruit node resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a recruit node: generates pool and recruits a hero.
 *
 * @param state - Current RunState.
 * @param heroPool - All recruitable heroes.
 * @param chosenIndex - Index of the chosen candidate (null = skip).
 * @param random - Injectable RNG.
 * @returns Updated RunState.
 */
export function resolveRecruitNode(
  state: RunState,
  heroPool: HeroData[],
  chosenIndex: number | null = null,
  random: RandomFn = Math.random,
): RunState {
  const ownedIds = state.roster.map(h => h.data.id)
  const pool = generateRecruitPool(heroPool, ownedIds, state.nodeIndex, random)

  if (chosenIndex === null || chosenIndex < 0 || chosenIndex >= pool.length) {
    // Player chose not to recruit
    return completeNode(state)
  }

  const candidate = pool[chosenIndex]
  const [result, newEconomy] = resolveRecruit(candidate, state.economy)

  if (!result.success) {
    // Can't afford — just complete without recruiting
    return completeNode(state)
  }

  const newHero = createHeroInstance(candidate.hero, 1)

  return completeNode({
    ...state,
    roster: [...state.roster, newHero],
    economy: newEconomy,
  })
}

// ---------------------------------------------------------------------------
// Shop node resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a shop node: generates inventory and purchases equipment.
 *
 * @param state - Current RunState.
 * @param equipPool - All available equipment.
 * @param purchaseIndices - Indices of items to purchase.
 * @param random - Injectable RNG.
 * @returns Updated RunState.
 */
export function resolveShopNode(
  state: RunState,
  equipPool: EquipmentData[],
  purchaseIndices: number[] = [],
  random: RandomFn = Math.random,
): RunState {
  const inventory = generateShopInventory(equipPool, state.ownedNamedIds, state.nodeIndex, random)

  let economy = state.economy
  const newEquipment = [...state.ownedEquipment]
  const newNamedIds = new Set(state.ownedNamedIds)

  for (const idx of purchaseIndices) {
    if (idx < 0 || idx >= inventory.length) continue
    const item = inventory[idx]
    const [result, newEcon] = resolveShopPurchase(item, economy)
    if (result.success) {
      economy = newEcon
      newEquipment.push(item.equipment)
      if (item.equipment.unique) {
        newNamedIds.add(item.equipment.id)
      }
    }
  }

  return completeNode({
    ...state,
    economy,
    ownedEquipment: newEquipment,
    ownedNamedIds: newNamedIds,
  })
}

// ---------------------------------------------------------------------------
// Rest node resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a rest node: train or forge.
 *
 * @param state - Current RunState.
 * @param choice - Train or Forge.
 * @param materialCost - Material cost.
 * @param goldCost - Gold cost.
 * @returns Updated RunState.
 */
export function resolveRestNodeAction(
  state: RunState,
  choice: RestChoice,
  materialCost: number,
  goldCost: number,
): RunState {
  const [result, newEconomy] = resolveRestNode(choice, materialCost, goldCost, state.economy)

  if (!result.success) {
    return completeNode(state)
  }

  return completeNode({
    ...state,
    economy: newEconomy,
  })
}

// ---------------------------------------------------------------------------
// Mystery node resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a mystery node: matches historical or generic event.
 *
 * @param state - Current RunState.
 * @param historicalEvents - Available events.
 * @param random - Injectable RNG.
 * @returns Updated RunState.
 */
export function resolveMysteryNodeAction(
  state: RunState,
  historicalEvents: HistoricalEvent[] = [],
  random: RandomFn = Math.random,
): RunState {
  const gameState: EventGameState = {
    ownedHeroIds: state.roster.map(h => h.data.id),
    ownedEquipmentIds: state.ownedEquipment.map(e => e.id),
    defeatedBossIds: state.defeatedBossIds,
    triggeredEventIds: state.triggeredEventIds,
    monarchId: '',
    campaignId: state.map.campaignId,
  }

  const result = resolveMysteryNode(
    historicalEvents,
    gameState,
    new Set(state.triggeredEventIds),
    state.nodeIndex,
    random,
  )

  const newEconomy = applyEventRewards(result.rewards, state.economy)
  const newTriggeredEvents = result.isHistorical
    ? [...state.triggeredEventIds, result.eventId]
    : state.triggeredEventIds

  return completeNode({
    ...state,
    economy: newEconomy,
    triggeredEventIds: newTriggeredEvents,
  })
}

// ---------------------------------------------------------------------------
// Node completion
// ---------------------------------------------------------------------------

/**
 * Marks the current node as completed and transitions back to MapView.
 */
function completeNode(state: RunState): RunState {
  const node = getNodeById(state.map, state.currentNodeId)

  // Mark node completed in the map
  if (node) {
    node.completed = true
  }

  return {
    ...state,
    completedNodeIds: [...state.completedNodeIds, state.currentNodeId],
    nodeIndex: state.nodeIndex + 1,
    phase: RunPhase.MapView,
  }
}

// ---------------------------------------------------------------------------
// Run end check
// ---------------------------------------------------------------------------

/**
 * Checks if the run should end (victory or defeat).
 *
 * @param state - Current RunState.
 * @returns Updated RunState (phase may change to Ended).
 */
export function checkRunEnd(state: RunState): RunState {
  // Check victory: final boss defeated
  if (state.defeatedBossIds.includes(state.map.finalBossNodeId)) {
    return {
      ...state,
      phase: RunPhase.Ended,
      endReason: RunEndReason.Victory,
    }
  }

  // Check defeat: honor depleted
  if (state.honor <= 0) {
    return {
      ...state,
      phase: RunPhase.Ended,
      endReason: RunEndReason.HonorDepleted,
    }
  }

  return state
}
