/**
 * Event System — Type Definitions
 *
 * Defines all data types for the node interaction system.
 * 7 node types, historical events, recruit/shop/rest/mystery resolution.
 *
 * @module src/gameplay/event/types
 * @see design/gdd/event-system.md
 */

import type { HeroData } from '../hero/types'
import type { EquipmentData } from '../equipment/types'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * All node types in the Run map.
 *
 * @see design/gdd/event-system.md — Node Types
 */
export enum NodeType {
  Battle = 'battle',
  Elite = 'elite',
  Boss = 'boss',
  Recruit = 'recruit',
  Shop = 'shop',
  Rest = 'rest',
  Mystery = 'mystery',
}

/**
 * Choice available at a rest node.
 */
export enum RestChoice {
  /** Train a hero (level up). Costs Material. */
  Train = 'train',
  /** Forge equipment (strengthen). Costs Gold + Material. */
  Forge = 'forge',
}

// ---------------------------------------------------------------------------
// Recruit types
// ---------------------------------------------------------------------------

/**
 * A hero candidate in the recruit pool with cost information.
 */
export interface RecruitCandidate {
  /** The hero data. */
  hero: HeroData
  /** Gold cost to recruit. */
  cost: number
}

// ---------------------------------------------------------------------------
// Shop types
// ---------------------------------------------------------------------------

/**
 * A shop item with price information.
 */
export interface ShopItem {
  /** The equipment for sale. */
  equipment: EquipmentData
  /** Gold price. */
  price: number
}

// ---------------------------------------------------------------------------
// Mystery / Historical event types
// ---------------------------------------------------------------------------

/**
 * Condition type for historical event matching.
 *
 * @see design/gdd/event-system.md — Mystery Node: Condition Types
 */
export enum ConditionType {
  HasHero = 'has_hero',
  NotHasHero = 'not_has_hero',
  HasEquipment = 'has_equipment',
  BossDefeated = 'boss_defeated',
  EventTriggered = 'event_triggered',
  Monarch = 'monarch',
  Campaign = 'campaign',
}

/**
 * A single condition for matching a historical event.
 */
export interface EventCondition {
  /** Condition type. */
  type: ConditionType
  /** Parameters for this condition (e.g., heroId, equipmentId, etc.). */
  params: Record<string, string>
}

/**
 * Reward type for events.
 */
export enum RewardType {
  Gold = 'gold',
  Material = 'material',
  HeroUnlock = 'hero_unlock',
  NamedUnlock = 'named_unlock',
  HeroGrowth = 'hero_growth',
  EquipEnhance = 'equip_enhance',
  SkillEnhance = 'skill_enhance',
}

/**
 * A reward from an event.
 */
export interface EventReward {
  /** Reward type. */
  type: RewardType
  /** Reward parameters. */
  params: Record<string, string | number>
}

/**
 * A historical event definition.
 *
 * @see design/gdd/event-system.md — Mystery Node
 */
export interface HistoricalEvent {
  /** Unique ID (e.g., "taoyuan_oath"). */
  id: string
  /** Display name (e.g., "桃园结义"). */
  name: string
  /** Story text. */
  description: string
  /** Associated campaign. */
  campaign: string
  /** Matching priority (higher = checked first). */
  priority: number
  /** All conditions must be met (AND logic). */
  conditions: EventCondition[]
  /** Rewards on trigger. */
  rewards: EventReward[]
  /** Whether this event can only trigger once per run. */
  triggerOnce: boolean
}

/**
 * A generic/fallback event with simple resource rewards.
 */
export interface GenericEvent {
  /** Unique ID. */
  id: string
  /** Display name. */
  name: string
  /** Story text. */
  description: string
  /** Gold reward (before scaling). */
  baseGold: number
  /** Material reward (before scaling). */
  baseMaterial: number
}

// ---------------------------------------------------------------------------
// Game state for event matching
// ---------------------------------------------------------------------------

/**
 * Minimal game state snapshot for event condition matching.
 */
export interface EventGameState {
  /** IDs of heroes currently in the roster. */
  ownedHeroIds: string[]
  /** IDs of equipment currently owned. */
  ownedEquipmentIds: string[]
  /** IDs of bosses defeated in this run. */
  defeatedBossIds: string[]
  /** IDs of events already triggered in this run. */
  triggeredEventIds: string[]
  /** Current monarch identity. */
  monarchId: string
  /** Current campaign ID. */
  campaignId: string
}

// ---------------------------------------------------------------------------
// Node resolution results
// ---------------------------------------------------------------------------

/**
 * Result of resolving a recruit node.
 */
export interface RecruitResult {
  /** Whether recruitment was successful. */
  success: boolean
  /** Error reason if failed. */
  reason?: string
  /** The recruited hero (if success). */
  hero?: HeroData
  /** Gold spent (if success). */
  goldSpent?: number
}

/**
 * Result of resolving a shop purchase.
 */
export interface ShopResult {
  /** Whether purchase was successful. */
  success: boolean
  /** Error reason if failed. */
  reason?: string
  /** The purchased equipment (if success). */
  equipment?: EquipmentData
  /** Gold spent (if success). */
  goldSpent?: number
}

/**
 * Result of resolving a rest node.
 */
export interface RestResult {
  /** Whether the action was successful. */
  success: boolean
  /** Error reason if failed. */
  reason?: string
  /** The choice made. */
  choice?: RestChoice
}

/**
 * Result of resolving a mystery node.
 */
export interface MysteryResult {
  /** Whether a historical event was triggered (vs generic). */
  isHistorical: boolean
  /** The event that was triggered. */
  eventId: string
  /** Event name. */
  eventName: string
  /** Event description text. */
  description: string
  /** Rewards earned. */
  rewards: EventReward[]
}
