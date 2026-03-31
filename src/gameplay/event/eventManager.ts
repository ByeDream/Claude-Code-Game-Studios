/**
 * Event System — Event Manager
 *
 * Pure functional event resolution: recruit pool, shop inventory, rest/mystery nodes.
 * All functions are deterministic when given a seeded RNG.
 *
 * @module src/gameplay/event/eventManager
 * @see design/gdd/event-system.md
 */

import type { HeroData } from '../hero/types'
import type { EquipmentData } from '../equipment/types'
import { EquipCategory } from '../equipment/types'
import type { Economy } from '../economy/types'
import { canAfford, spend, earn } from '../economy/economyManager'
import { RECRUIT_BASE_COST } from '../economy/economyConfig'
import type { RandomFn } from '../battle/types'

import type {
  RecruitCandidate, ShopItem,
  HistoricalEvent, EventGameState, EventCondition,
  EventReward, MysteryResult,
  RecruitResult, ShopResult, RestResult,
} from './types'
import { ConditionType, RestChoice, RewardType } from './types'
import {
  RECRUIT_POOL_SIZE, RECRUIT_TIER_MULTIPLIER, RECRUIT_TIER_WEIGHTS,
  SHOP_SIZE, SHOP_TIER_INTERVAL, NAMED_SHOP_CHANCE,
  FALLBACK_SCALING,
  GENERIC_EVENTS,
} from './eventConfig'

// ---------------------------------------------------------------------------
// Recruit
// ---------------------------------------------------------------------------

/**
 * Generates a recruit pool of hero candidates.
 *
 * MVP: Random selection from all unowned heroes with tier weights (C:50%, B:35%, A:15%).
 * Higher nodeIndex slightly favors better tiers (future tuning).
 *
 * @param allHeroes - All hero definitions available in the campaign.
 * @param ownedHeroIds - IDs of heroes already in the roster.
 * @param _nodeIndex - Current node position (reserved for future tier weighting).
 * @param random - Injectable RNG.
 * @returns Array of RecruitCandidate with cost info.
 *
 * @see design/gdd/event-system.md — Recruit Node
 */
export function generateRecruitPool(
  allHeroes: HeroData[],
  ownedHeroIds: string[],
  _nodeIndex: number = 0,
  random: RandomFn = Math.random,
): RecruitCandidate[] {
  // Filter out already-owned heroes
  const ownedSet = new Set(ownedHeroIds)
  const available = allHeroes.filter(h => !ownedSet.has(h.id))

  if (available.length === 0) return []

  // Weighted selection by tier
  const candidates: RecruitCandidate[] = []
  const poolSize = Math.min(RECRUIT_POOL_SIZE, available.length)
  const selected = new Set<string>()

  for (let i = 0; i < poolSize; i++) {
    const hero = weightedTierSelect(available, selected, random)
    if (!hero) break

    selected.add(hero.id)
    const tierMult = RECRUIT_TIER_MULTIPLIER[hero.tier] ?? 1.0
    const cost = Math.round(RECRUIT_BASE_COST * tierMult)

    candidates.push({ hero, cost })
  }

  return candidates
}

/**
 * Selects a hero using tier-based weighted random.
 */
function weightedTierSelect(
  available: HeroData[],
  excluded: Set<string>,
  random: RandomFn,
): HeroData | null {
  const pool = available.filter(h => !excluded.has(h.id))
  if (pool.length === 0) return null

  // Build weighted list
  const weighted: Array<{ hero: HeroData; weight: number }> = pool.map(hero => ({
    hero,
    weight: RECRUIT_TIER_WEIGHTS[hero.tier] ?? 0.05,
  }))

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
  if (totalWeight <= 0) return pool[0] // fallback

  let roll = random() * totalWeight
  for (const entry of weighted) {
    roll -= entry.weight
    if (roll <= 0) return entry.hero
  }

  return weighted[weighted.length - 1].hero
}

/**
 * Resolves a recruit action — spends gold and returns the recruited hero.
 *
 * @param candidate - The recruit candidate selected by the player.
 * @param economy - Current economy state.
 * @returns Tuple of [RecruitResult, updatedEconomy].
 */
export function resolveRecruit(
  candidate: RecruitCandidate,
  economy: Economy,
): [RecruitResult, Economy] {
  if (!canAfford(economy, candidate.cost, 0)) {
    return [
      { success: false, reason: `Gold 不足: 需要 ${candidate.cost}, 拥有 ${economy.gold}` },
      economy,
    ]
  }

  const newEconomy = spend(economy, candidate.cost, 0)
  return [
    { success: true, hero: candidate.hero, goldSpent: candidate.cost },
    newEconomy,
  ]
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

/**
 * Generates shop inventory based on node progression.
 *
 * Quality progression:
 * - Node 0-5: Basic Lv.1-2
 * - Node 6-11: Basic Lv.2 + Advanced Lv.3
 * - Node 12+: Advanced Lv.3 + Named chance
 *
 * @param allEquipment - All equipment definitions available.
 * @param ownedNamedIds - Named equipment already owned (for uniqueness).
 * @param nodeIndex - Current node position.
 * @param random - Injectable RNG.
 * @returns Array of ShopItem with price info.
 *
 * @see design/gdd/event-system.md — Shop Node
 */
export function generateShopInventory(
  allEquipment: EquipmentData[],
  ownedNamedIds: Set<string> = new Set(),
  nodeIndex: number = 0,
  random: RandomFn = Math.random,
): ShopItem[] {
  const qualityTier = Math.floor(nodeIndex / SHOP_TIER_INTERVAL)
  const items: ShopItem[] = []
  const selectedIds = new Set<string>()

  for (let i = 0; i < SHOP_SIZE; i++) {
    const equip = selectShopEquipment(allEquipment, ownedNamedIds, selectedIds, qualityTier, random)
    if (!equip) break

    selectedIds.add(equip.id)
    items.push({
      equipment: equip,
      price: equip.basePrice > 0 ? equip.basePrice : 100, // Named fallback price
    })
  }

  return items
}

/**
 * Selects equipment for a shop slot based on quality tier.
 */
function selectShopEquipment(
  allEquipment: EquipmentData[],
  ownedNamedIds: Set<string>,
  selectedIds: Set<string>,
  qualityTier: number,
  random: RandomFn,
): EquipmentData | null {
  let candidates: EquipmentData[]

  if (qualityTier === 0) {
    // Node 0-5: Basic Lv.1-2
    candidates = allEquipment.filter(e =>
      e.category === EquipCategory.Basic && e.level <= 2 && !selectedIds.has(e.id)
    )
  } else if (qualityTier === 1) {
    // Node 6-11: Basic Lv.2 + Advanced Lv.3
    candidates = allEquipment.filter(e =>
      ((e.category === EquipCategory.Basic && e.level === 2) ||
       (e.category === EquipCategory.Advanced && e.level === 3)) &&
      !selectedIds.has(e.id)
    )
  } else {
    // Node 12+: Advanced Lv.3 + Named chance
    const tryNamed = random() < NAMED_SHOP_CHANCE
    if (tryNamed) {
      candidates = allEquipment.filter(e =>
        e.category === EquipCategory.Named && !ownedNamedIds.has(e.id) && !selectedIds.has(e.id)
      )
      if (candidates.length === 0) {
        // Fallback to Advanced
        candidates = allEquipment.filter(e =>
          e.category === EquipCategory.Advanced && e.level === 3 && !selectedIds.has(e.id)
        )
      }
    } else {
      candidates = allEquipment.filter(e =>
        e.category === EquipCategory.Advanced && e.level === 3 && !selectedIds.has(e.id)
      )
    }
  }

  if (candidates.length === 0) {
    // Final fallback: anything not yet selected
    candidates = allEquipment.filter(e =>
      !selectedIds.has(e.id) && e.category !== EquipCategory.Named
    )
  }

  if (candidates.length === 0) return null

  const index = Math.floor(random() * candidates.length)
  return candidates[index]
}

/**
 * Resolves a shop purchase — spends gold and returns equipment.
 *
 * @param item - The shop item selected.
 * @param economy - Current economy state.
 * @returns Tuple of [ShopResult, updatedEconomy].
 */
export function resolveShopPurchase(
  item: ShopItem,
  economy: Economy,
): [ShopResult, Economy] {
  if (!canAfford(economy, item.price, 0)) {
    return [
      { success: false, reason: `Gold 不足: 需要 ${item.price}, 拥有 ${economy.gold}` },
      economy,
    ]
  }

  const newEconomy = spend(economy, item.price, 0)
  return [
    { success: true, equipment: item.equipment, goldSpent: item.price },
    newEconomy,
  ]
}

// ---------------------------------------------------------------------------
// Rest node
// ---------------------------------------------------------------------------

/**
 * Resolves a rest node training action (hero level up).
 * Cost comes from Hero Growth system — simplified for MVP.
 *
 * @param choice - Train or Forge.
 * @param materialCost - Material cost for the action.
 * @param goldCost - Gold cost for the action (forge only).
 * @param economy - Current economy state.
 * @returns Tuple of [RestResult, updatedEconomy].
 *
 * @see design/gdd/event-system.md — Rest Node
 */
export function resolveRestNode(
  choice: RestChoice,
  materialCost: number,
  goldCost: number,
  economy: Economy,
): [RestResult, Economy] {
  if (!canAfford(economy, goldCost, materialCost)) {
    return [
      {
        success: false,
        reason: `资源不足: 需要 ${goldCost} Gold + ${materialCost} Material`,
        choice,
      },
      economy,
    ]
  }

  const newEconomy = spend(economy, goldCost, materialCost)
  return [{ success: true, choice }, newEconomy]
}

// ---------------------------------------------------------------------------
// Mystery node
// ---------------------------------------------------------------------------

/**
 * Evaluates whether a single condition is met.
 *
 * @param condition - The condition to evaluate.
 * @param gameState - Current game state.
 * @returns true if condition is met.
 */
export function evaluateCondition(
  condition: EventCondition,
  gameState: EventGameState,
): boolean {
  switch (condition.type) {
    case ConditionType.HasHero:
      return gameState.ownedHeroIds.includes(condition.params['heroId'] ?? '')
    case ConditionType.NotHasHero:
      return !gameState.ownedHeroIds.includes(condition.params['heroId'] ?? '')
    case ConditionType.HasEquipment:
      return gameState.ownedEquipmentIds.includes(condition.params['equipmentId'] ?? '')
    case ConditionType.BossDefeated:
      return gameState.defeatedBossIds.includes(condition.params['bossId'] ?? '')
    case ConditionType.EventTriggered:
      return gameState.triggeredEventIds.includes(condition.params['eventId'] ?? '')
    case ConditionType.Monarch:
      return gameState.monarchId === condition.params['monarchId']
    case ConditionType.Campaign:
      return gameState.campaignId === condition.params['campaignId']
    default:
      return false
  }
}

/**
 * Matches the best historical event for a mystery node.
 * Checks events in priority order; first match wins.
 * Falls back to a generic event if no historical event matches.
 *
 * @param historicalEvents - Available historical events (pre-sorted by priority desc).
 * @param gameState - Current game state for condition evaluation.
 * @param triggeredEventIds - Events already triggered in this run.
 * @returns The matched event, or null if no match (use generic fallback).
 *
 * @see design/gdd/event-system.md — Mystery Node: Event Matching
 */
export function matchHistoricalEvent(
  historicalEvents: HistoricalEvent[],
  gameState: EventGameState,
  triggeredEventIds: Set<string> = new Set(),
): HistoricalEvent | null {
  // Sort by priority descending (highest first)
  const sorted = [...historicalEvents].sort((a, b) => b.priority - a.priority)

  for (const event of sorted) {
    // Skip already-triggered triggerOnce events
    if (event.triggerOnce && triggeredEventIds.has(event.id)) continue

    // Check all conditions (AND logic)
    const allMet = event.conditions.every(c => evaluateCondition(c, gameState))
    if (allMet) return event
  }

  return null
}

/**
 * Resolves a mystery node — matches historical event or falls back to generic.
 *
 * @param historicalEvents - Available historical events.
 * @param gameState - Current game state.
 * @param triggeredEventIds - Already-triggered event IDs.
 * @param nodeIndex - Current node position (for fallback reward scaling).
 * @param random - Injectable RNG.
 * @returns MysteryResult with event info and rewards.
 *
 * @see design/gdd/event-system.md — Mystery Node
 */
export function resolveMysteryNode(
  historicalEvents: HistoricalEvent[],
  gameState: EventGameState,
  triggeredEventIds: Set<string>,
  nodeIndex: number,
  random: RandomFn = Math.random,
): MysteryResult {
  // Try historical event match
  const matched = matchHistoricalEvent(historicalEvents, gameState, triggeredEventIds)

  if (matched) {
    return {
      isHistorical: true,
      eventId: matched.id,
      eventName: matched.name,
      description: matched.description,
      rewards: matched.rewards,
    }
  }

  // Fallback to generic event
  return resolveGenericEvent(nodeIndex, random)
}

/**
 * Resolves a generic fallback event with scaled resource rewards.
 *
 * @param nodeIndex - Current node position.
 * @param random - Injectable RNG.
 * @returns MysteryResult with gold/material rewards.
 *
 * @see design/gdd/event-system.md — Formulas: Fallback Event Reward Scaling
 */
export function resolveGenericEvent(
  nodeIndex: number,
  random: RandomFn = Math.random,
): MysteryResult {
  // Pick a random generic event
  const pool = GENERIC_EVENTS
  if (pool.length === 0) {
    return {
      isHistorical: false,
      eventId: 'generic_empty',
      eventName: '平静的旅途',
      description: '一路平安，无事发生。',
      rewards: [],
    }
  }

  const index = Math.floor(random() * pool.length)
  const event = pool[index]

  // Scale rewards by nodeIndex
  const scaling = 1 + nodeIndex * FALLBACK_SCALING
  const goldReward = Math.floor(event.baseGold * scaling)
  const materialReward = Math.floor(event.baseMaterial * scaling)

  const rewards: EventReward[] = []
  if (goldReward > 0) {
    rewards.push({ type: RewardType.Gold, params: { amount: goldReward } })
  }
  if (materialReward > 0) {
    rewards.push({ type: RewardType.Material, params: { amount: materialReward } })
  }

  return {
    isHistorical: false,
    eventId: event.id,
    eventName: event.name,
    description: event.description,
    rewards,
  }
}

/**
 * Applies mystery event rewards to the economy.
 *
 * @param rewards - Rewards from the event.
 * @param economy - Current economy state.
 * @returns Updated economy state.
 */
export function applyEventRewards(
  rewards: EventReward[],
  economy: Economy,
): Economy {
  let current = economy
  for (const reward of rewards) {
    if (reward.type === RewardType.Gold) {
      current = earn(current, Number(reward.params['amount'] ?? 0), 0)
    } else if (reward.type === RewardType.Material) {
      current = earn(current, 0, Number(reward.params['amount'] ?? 0))
    }
    // Other reward types (hero_unlock, etc.) are handled by their respective systems
  }
  return current
}
