/**
 * Equipment System — Type Definitions
 *
 * Defines all static and runtime data types for the 装备 (Equipment) system.
 * Covers three tiers: Basic (纯数值), Advanced (数值+轻微效果), Named (质变级名器).
 *
 * No-inventory design: equipment only exists on a hero's slots — it is never
 * stored separately. All stat bonuses are summed into `HeroInstance.equipBonus`
 * by the Equipment Manager on every equip/unequip operation.
 *
 * @module src/gameplay/equipment/types
 * @see design/gdd/equipment-system.md — Equipment Data Model
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * The three equipment slots available on every hero.
 *
 * Slot rules (Basic/Advanced only):
 *   - Weapon: STR or INT bonus
 *   - Armor:  DEF and/or HP bonus
 *   - Mount:  SPD bonus
 *
 * Named equipment is exempt from slot-stat constraints and may carry any stats.
 *
 * @see design/gdd/equipment-system.md — Equipment Slots
 */
export enum EquipSlot {
  Weapon = 'Weapon',
  Armor  = 'Armor',
  Mount  = 'Mount',
}

/**
 * Equipment rarity / complexity tier.
 *
 * - Basic:    Pure stat bonuses, Lv.1–2. No special effects.
 * - Advanced: Stat bonuses + minor effect, Lv.3.
 * - Named:    Legendary (三国名器). Quality-shift effects, owner bonuses.
 *             Globally unique per Run, cannot be strengthened/sold/disassembled.
 *
 * @see design/gdd/equipment-system.md — Equipment Tiers
 */
export enum EquipCategory {
  Basic    = 'Basic',
  Advanced = 'Advanced',
  Named    = 'Named',
}

// ---------------------------------------------------------------------------
// Sub-interfaces
// ---------------------------------------------------------------------------

/**
 * A special effect carried by Advanced or Named equipment.
 * Resolved by the Battle Engine when combat triggers are fired.
 *
 * Effects on Basic equipment are always null — Basic items are pure stat items.
 *
 * @see design/gdd/equipment-system.md — Equipment Tiers: Advanced / Named
 */
export interface EquipEffect {
  /**
   * Human-readable description of the effect
   * (e.g., "攻击有 10% 概率降低目标 SPD").
   */
  description: string
  /**
   * Numeric magnitude — interpretation is effect-specific
   * (e.g., 0.10 for a 10% chance, 2.0 for a ×2 multiplier).
   */
  magnitude: number
  /**
   * Duration in battle rounds (0 = instant / one-shot).
   * Passed to the Status System for timed effects.
   */
  duration: number
}

/**
 * The additional bonus granted when Named equipment is worn by its designated hero.
 * Only present on Named equipment with a specific `ownerHeroId`.
 *
 * The bonus replaces or augments the base `effect` — exact semantics are defined
 * per-item and resolved by the Battle Engine.
 *
 * @see design/gdd/equipment-system.md — Named Equipment table
 */
export interface OwnerBonus {
  /**
   * Human-readable description of the owner-specific enhancement
   * (e.g., "威压效果翻倍至 20%").
   */
  description: string
  /**
   * Numeric magnitude of the enhanced effect (scaled up from the base effect).
   * Multiplied by `NAMED_OWNER_BONUS_MULT` relative to the base effect magnitude.
   */
  magnitude: number
}

// ---------------------------------------------------------------------------
// Core data interface
// ---------------------------------------------------------------------------

/**
 * Complete static data record for a single piece of equipment.
 * This is the config-file shape — loaded once, never mutated at runtime.
 *
 * Key constraints enforced by the Equipment Manager:
 *   - Named equipment: `unique = true`, `strengthenLevel` always 0, unsellable.
 *   - Basic/Advanced:  `unique = false`, strengthenLevel 0–3.
 *   - `ownerBonus` and `ownerHeroId` are only set for Named equipment.
 *   - `effect` is only set for Advanced and Named equipment.
 *
 * @see design/gdd/equipment-system.md — Equipment Data Model
 */
export interface EquipmentData {
  /**
   * Unique identifier used for slot tracking and named-ownership checks.
   * Format: `<category>_<slot>_<short_name>` e.g. `basic_weapon_iron_sword`,
   * `named_weapon_green_dragon`.
   */
  id: string

  /** Display name (e.g., "铁刀", "青龙偃月刀"). */
  name: string

  /** Which of the three hero equipment slots this item occupies. */
  slot: EquipSlot

  /** Rarity / complexity tier. */
  category: EquipCategory

  /**
   * Equipment power level.
   * Basic Lv.1–2, Advanced Lv.3, Named Lv.4.
   * Used in disassemble and balance calculations.
   */
  level: number

  /**
   * Whether this equipment is globally unique within a Run.
   * Named = true; Basic/Advanced = false (multiple heroes may hold the same item).
   */
  unique: boolean

  /**
   * Base stat bonuses granted when equipped.
   * Partial record — only stats relevant to the slot (and Named exceptions) are set.
   *
   * Formula for effective bonus (see equipmentManager.calculateEquipBonus):
   *   effectiveStat = baseStats[stat] * (1 + strengthenLevel * STRENGTHEN_BONUS_RATE)
   */
  baseStats: Partial<Record<string, number>>

  /**
   * Special battle effect (Advanced/Named only).
   * null for Basic equipment.
   */
  effect: EquipEffect | null

  /**
   * Owner-specific enhanced effect (Named only, and only when `ownerHeroId` is set).
   * null for Basic, Advanced, and Named equipment without a designated owner.
   */
  ownerBonus: OwnerBonus | null

  /**
   * Hero ID of the designated owner for Named equipment owner bonuses.
   * null if this Named item has no specific owner (e.g., 七星宝刀 is "通用").
   * Always null for Basic and Advanced equipment.
   */
  ownerHeroId: string | null

  /**
   * Base price in gold, used for sell and shop cost calculations.
   * Named equipment has basePrice = 0 (unsellable/undisassemblable).
   *
   * Reference prices from GDD:
   *   Basic Lv.1: 15 | Basic Lv.2: 30 | Advanced Lv.3: 50 | Named: 0
   */
  basePrice: number

  /**
   * Current strengthen level (0–3).
   * Named equipment is always 0 and cannot be incremented.
   * Each level adds STRENGTHEN_BONUS_RATE (20%) to all baseStats.
   */
  strengthenLevel: number
}
