/**
 * Enemy System — Type Definitions
 *
 * Defines all static and runtime data types for the 敌军 (Enemy) system.
 * Enemy units come in three varieties:
 *   - Nameless Units (无名武将): template-based fill units scaled by nodeIndex
 *   - Named Heroes (正式武将): full HeroData instances, no stat scaling
 *   - Boss: HeroData + BossExtension (multi-phase, summon, immunities)
 *
 * @module src/gameplay/enemy/types
 * @see design/gdd/enemy-system.md
 */

import type { BaseStats, HeroData, Skill, Effect, TargetType } from '../hero/types'

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * The five template archetypes for nameless units (无名武将).
 *
 * Each template defines a stat distribution and optional passive skill.
 * Actual stat values are scaled by nodeIndex at runtime.
 *
 * @see design/gdd/enemy-system.md — Nameless Units table
 */
export enum NamelessTemplateType {
  /** 小兵 — lowest stats, no skills. Early game fill unit. */
  Soldier = 'soldier',
  /** 军团长 — low stats, STR bias. Passive: "统领". */
  LegionLeader = 'legion_leader',
  /** 都尉 — low-mid stats, DEF bias. Passive: "坚守". */
  Lieutenant = 'lieutenant',
  /** 谋士 — low-mid stats, INT bias. Passive: "鼓舞". */
  Advisor = 'advisor',
  /** 骑兵队长 — low-mid stats, SPD bias. Passive: "冲锋". */
  CavalryLeader = 'cavalry_leader',
}

/** Battle encounter format — determines rules and unit limits. */
export enum EncounterType {
  /** Standard 5v5 battle. Composition determined by nodeIndex. */
  Normal = 'normal',
  /** Elite 5v5 — all named heroes, higher difficulty than normal. */
  Elite = 'elite',
  /**
   * Boss battle — not 5v5.
   * Boss + 2–4 guards + optional summon reinforcements.
   * `bossExtension` required on the encounter when this type is used.
   */
  Boss = 'boss',
}

// ---------------------------------------------------------------------------
// Primitive type aliases
// ---------------------------------------------------------------------------

/**
 * What triggers a Boss summon wave.
 * `phase_change` fires when the Boss transitions to a new phase.
 * `timer`        fires after N turns.
 * `hp_threshold` fires when Boss HP drops below a percentage.
 */
export type BossSummonTrigger = 'phase_change' | 'timer' | 'hp_threshold'

/**
 * A board position index (0–4) for formation placement.
 * Position 0 = front / left; position 4 = back / right.
 * Exact spatial mapping is owned by the Battle Engine.
 */
export type Position = number

// ---------------------------------------------------------------------------
// Nameless unit template & instance
// ---------------------------------------------------------------------------

/**
 * Static config record for a nameless unit template.
 * Stored in `NAMELESS_TEMPLATES` config map — one entry per NamelessTemplateType.
 * `baseStats` are the unscaled values at nodeIndex 0.
 *
 * @see src/gameplay/enemy/enemyConfig.ts — NAMELESS_TEMPLATES
 */
export interface NamelessTemplate {
  /** Template archetype. */
  type: NamelessTemplateType
  /** Display name shown in battle (e.g., "军团长", "谋士"). */
  name: string
  /** Base stat block before nodeIndex scaling. */
  baseStats: BaseStats
  /**
   * Single passive skill.
   * null for 小兵 (Soldier) which has no skills.
   */
  skill: Skill | null
}

/**
 * A runtime nameless unit instance, created by `createNamelessUnit()`.
 * Stats are pre-scaled from the template at the given nodeIndex.
 * Mutable during battle (currentHP, isKnockedOut).
 *
 * @see src/gameplay/enemy/enemyFactory.ts — createNamelessUnit
 */
export interface NamelessUnit {
  /**
   * Instance unique identifier.
   * Format: `${templateType}_node${nodeIndex}_inst${instanceIndex}`.
   */
  id: string
  /** Template this unit was instantiated from. */
  templateType: NamelessTemplateType
  /** Display name (copied from template). */
  name: string
  /**
   * Scaled stats after applying nodeIndex multiplier.
   * Formula: `round(templateBaseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE))`.
   */
  scaledStats: BaseStats
  /** Current HP in battle. Initialised to `scaledStats[HP]` on creation. */
  currentHP: number
  /** The nodeIndex at which this unit was created. */
  nodeIndex: number
  /**
   * Single passive skill, or null for Soldier.
   * Copied from the template; not scaled by nodeIndex.
   */
  skill: Skill | null
  /** Whether this unit was knocked out in the current battle. */
  isKnockedOut: boolean
}

// ---------------------------------------------------------------------------
// Boss extension types
// ---------------------------------------------------------------------------

/**
 * A partial stat change applied during a Boss phase transition.
 *
 * Each key is a StatType, and each value is a multiplier applied to the
 * Boss's stat at phase entry (e.g., `{ STR: 1.30 }` = +30% STR).
 *
 * Only the stated stats are modified; unlisted stats are unchanged.
 *
 * @see design/gdd/enemy-system.md — Boss System: BossPhase
 */
export type StatModifier = Partial<BaseStats>

/**
 * A Boss-exclusive ability — stronger than a normal hero skill.
 * Resolved by the Battle Engine when triggered.
 *
 * @see design/gdd/enemy-system.md — Boss mechanisms table
 */
export interface BossAbility {
  /** Display name (e.g., "唯才是举"). */
  name: string
  /** One or more atomic effects applied on trigger. */
  effects: Effect[]
  /** Who this ability targets. */
  target: TargetType
  /** Cooldown in turns between activations. */
  cooldown?: number
}

/**
 * A wave of nameless unit reinforcements summoned by a Boss.
 *
 * @see design/gdd/enemy-system.md — Boss System: SummonWave
 */
export interface SummonWave {
  /** What triggers this wave (phase change, timer, or HP threshold). */
  trigger: BossSummonTrigger
  /**
   * Template archetypes of the summoned units.
   * The factory creates NamelessUnit instances at the current nodeIndex.
   */
  units: NamelessTemplateType[]
}

/**
 * A single phase of a multi-phase Boss fight.
 * Triggered when the Boss's HP drops below `hpThreshold` (expressed as a fraction 0–1).
 *
 * @see design/gdd/enemy-system.md — Boss System: BossPhase
 */
export interface BossPhase {
  /**
   * HP percentage threshold (0.0–1.0) that triggers this phase.
   * Example: 0.5 = triggers when Boss HP < 50%.
   */
  hpThreshold: number
  /**
   * Stat multipliers applied to the Boss on phase entry.
   * Partial — only listed stats change.
   */
  statModifier: StatModifier
  /**
   * An additional ability unlocked when this phase begins.
   * undefined if no new ability is granted.
   */
  newAbility?: BossAbility
  /**
   * Optional flavour dialogue line displayed at phase transition.
   * Rendered by the Battle UI system.
   */
  dialogue?: string
}

/**
 * Boss-specific metadata attached to a `EnemyEncounter` of type Boss.
 * The Boss unit itself is a `HeroData` record in `EnemyEncounter.enemies`.
 *
 * @see design/gdd/enemy-system.md — Boss System
 */
export interface BossExtension {
  /**
   * Ordered list of phase definitions, from last phase to first.
   * Phase check order: phases are checked lowest `hpThreshold` first.
   */
  phases: BossPhase[]
  /**
   * Status effect IDs this Boss is immune to (e.g., 'stun', 'slow').
   * Checked by the Status System before applying any effect.
   */
  immunities?: string[]
  /**
   * Summon reinforcement waves triggered during the fight.
   * Each wave adds NamelessUnit instances to the enemy side.
   */
  summonWaves?: SummonWave[]
  /**
   * Boss-exclusive special ability.
   * Available from Phase 1 unless introduced in a later phase.
   */
  specialAbility?: BossAbility
}

// ---------------------------------------------------------------------------
// Loot
// ---------------------------------------------------------------------------

/**
 * A single entry in an encounter's loot table.
 * Resolved by the Loot/Rewards System after battle victory.
 *
 * @see design/gdd/loot-rewards.md — Loot Table format (future)
 */
export interface LootEntry {
  /** Hero ID or equipment item ID that may drop. */
  itemId: string
  /** Probability of dropping (0.0–1.0). */
  dropChance: number
}

// ---------------------------------------------------------------------------
// Enemy encounter
// ---------------------------------------------------------------------------

/**
 * A complete enemy encounter record passed to the Battle Engine.
 * Created by the Event System / Campaign System before entering a battle node.
 *
 * `enemies[0]` is treated as the Boss when `encounterType === EncounterType.Boss`.
 *
 * @see design/gdd/enemy-system.md — Encounter Generation
 */
export interface EnemyEncounter {
  /**
   * All enemy units in this encounter.
   * Mix of `NamelessUnit` and `HeroData` (for named heroes / Boss).
   * Non-Boss encounters always have exactly 5 enemies (STANDARD_BATTLE_SIZE).
   */
  enemies: Array<HeroData | NamelessUnit>
  /**
   * Formation positions for each enemy, indexed parallel to `enemies`.
   * Each value is a Position (0–4).
   */
  formation: Position[]
  /** Whether this is a normal, elite, or boss battle. */
  encounterType: EncounterType
  /**
   * Boss metadata.
   * Required when `encounterType === EncounterType.Boss`.
   * undefined for Normal and Elite encounters.
   */
  bossExtension?: BossExtension
  /** Drop table evaluated after victory. May be empty. */
  lootTable: LootEntry[]
}
