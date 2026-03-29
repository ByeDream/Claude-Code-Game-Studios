/**
 * Event System — Configuration Constants
 *
 * All tuning knobs for the event/node interaction system.
 * Gameplay values must never be hardcoded in logic files.
 *
 * @module src/gameplay/event/eventConfig
 * @see design/gdd/event-system.md — Tuning Knobs
 */

import { HeroTier } from '../hero/types'
import type { GenericEvent } from './types'

// ---------------------------------------------------------------------------
// Recruit
// ---------------------------------------------------------------------------

/**
 * Number of hero candidates shown at a recruit node.
 * Safe range: 2–6.
 *
 * @see design/gdd/event-system.md — Recruit Node
 */
export const RECRUIT_POOL_SIZE = 4

/**
 * Per-tier recruit cost multiplier (applied to RECRUIT_BASE_COST from economy).
 *
 * @see design/gdd/event-system.md — Formulas: Recruit Cost
 */
export const RECRUIT_TIER_MULTIPLIER: Partial<Record<HeroTier, number>> = {
  [HeroTier.C]: 1.0,
  [HeroTier.B]: 1.5,
  [HeroTier.A]: 2.5,
}

/**
 * Tier weights for recruit pool generation (MVP — no meta progression).
 * C:50%, B:35%, A:15%.
 *
 * @see design/gdd/event-system.md — Recruit Node: MVP Fallback
 */
export const RECRUIT_TIER_WEIGHTS: Record<string, number> = {
  [HeroTier.C]: 0.50,
  [HeroTier.B]: 0.35,
  [HeroTier.A]: 0.15,
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

/**
 * Number of items shown at a shop node.
 * Safe range: 3–8.
 *
 * @see design/gdd/event-system.md — Shop Node
 */
export const SHOP_SIZE = 5

/**
 * Nodes per shop tier upgrade.
 * Safe range: 4–9.
 *
 * @see design/gdd/event-system.md — Formulas: Shop Quality Progression
 */
export const SHOP_TIER_INTERVAL = 6

/**
 * Chance of Named equipment appearing in shop at high tiers.
 * Safe range: 0.05–0.3.
 *
 * @see design/gdd/event-system.md — Shop Node
 */
export const NAMED_SHOP_CHANCE = 0.1

// ---------------------------------------------------------------------------
// Mystery / Fallback events
// ---------------------------------------------------------------------------

/**
 * Base gold reward for generic (fallback) mystery events.
 * Safe range: 10–40.
 *
 * @see design/gdd/event-system.md — Formulas: Fallback Event Reward Scaling
 */
export const BASE_FALLBACK_GOLD = 20

/**
 * Base material reward for generic events.
 * Safe range: 5–20.
 *
 * @see design/gdd/event-system.md — Formulas: Fallback Event Reward Scaling
 */
export const BASE_FALLBACK_MAT = 10

/**
 * Per-node scaling for fallback event rewards.
 * Safe range: 0.05–0.2.
 *
 * @see design/gdd/event-system.md — Formulas: Fallback Event Reward Scaling
 */
export const FALLBACK_SCALING = 0.1

// ---------------------------------------------------------------------------
// Node distribution ratios
// ---------------------------------------------------------------------------

/**
 * Target node type distribution ratios for map generation.
 * Boss nodes have fixed positions and are excluded from this.
 *
 * @see design/gdd/event-system.md — Node Distribution
 */
export const NODE_DISTRIBUTION = {
  battle: 0.40,
  elite: 0.15,
  recruit: 0.12,
  shop: 0.08,
  rest: 0.08,
  mystery: 0.12,
  // remaining 5% is buffer for rounding
}

// ---------------------------------------------------------------------------
// Generic events pool (MVP)
// ---------------------------------------------------------------------------

/**
 * Pool of generic/fallback mystery events for MVP.
 * These provide basic resource rewards with Three Kingdoms flavor text.
 *
 * @see design/gdd/event-system.md — Generic Events
 */
export const GENERIC_EVENTS: GenericEvent[] = [
  {
    id: 'generic_village_supplies',
    name: '村庄补给',
    description: '路过一座村庄，村民感念义军之恩，赠予军粮。',
    baseGold: 20,
    baseMaterial: 10,
  },
  {
    id: 'generic_roadside_treasure',
    name: '路边宝物',
    description: '行军途中，斥候在路旁发现了一批被遗弃的辎重。',
    baseGold: 25,
    baseMaterial: 5,
  },
  {
    id: 'generic_merchant_caravan',
    name: '商队交易',
    description: '遇到一支行商队伍，以优惠价格购得物资。',
    baseGold: 15,
    baseMaterial: 15,
  },
  {
    id: 'generic_ancient_cache',
    name: '古墓藏宝',
    description: '发现一处前朝古墓，其中藏有珍贵的锻造材料。',
    baseGold: 10,
    baseMaterial: 20,
  },
  {
    id: 'generic_tax_collection',
    name: '征收税赋',
    description: '经过一座城池，地方官员献上税银以表忠心。',
    baseGold: 30,
    baseMaterial: 0,
  },
  {
    id: 'generic_mine_discovery',
    name: '矿脉发现',
    description: '军中匠人发现了一处小型矿脉，开采得到一批矿石。',
    baseGold: 0,
    baseMaterial: 25,
  },
  {
    id: 'generic_peasant_donation',
    name: '百姓献粮',
    description: '百姓箪食壶浆，夹道欢迎义军到来。',
    baseGold: 15,
    baseMaterial: 8,
  },
]
