/**
 * Hero System — Type Definitions
 *
 * Defines all static and runtime data types for the 武将 (Hero) system.
 * This is the foundation layer: all other gameplay systems depend on these types.
 *
 * @module src/gameplay/hero/types
 * @see design/gdd/hero-system.md
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** The four factions of the Three Kingdoms era. Affects bond calculations. */
export enum Faction {
  Wei = 'Wei',
  Shu = 'Shu',
  Wu = 'Wu',
  Qun = 'Qun',
}

/**
 * Rarity / power tier.
 * C–A: base variants obtainable within a single run.
 * S–SSS: legend variants unlocked via cross-run achievements.
 */
export enum HeroTier {
  C = 'C',
  B = 'B',
  A = 'A',
  S = 'S',
  SS = 'SS',
  SSS = 'SSS',
}

/** Whether this hero card is the standard version or a legend variant. */
export enum HeroVariant {
  Base = 'Base',
  Legend = 'Legend',
}

/** The five core attributes (五维). Used for stat keys and scaling references. */
export enum StatType {
  STR = 'STR', // 武力 — physical attack
  INT = 'INT', // 智力 — skill effectiveness / advisor skills
  DEF = 'DEF', // 防御 — damage reduction
  HP = 'HP',   // 生命 — survivability
  SPD = 'SPD', // 速度 — action frequency
}

/**
 * Stat that a skill's effectiveness scales with.
 * Mirrors StatType values for semantic clarity at the skill-design layer.
 */
export enum ScalingStat {
  STR = 'STR',
  INT = 'INT',
  DEF = 'DEF',
  HP = 'HP',
  SPD = 'SPD',
}

/** Whether a skill is always-on (passive) or fires automatically when triggered (active). */
export enum SkillType {
  Passive = 'passive',
  Active = 'active',
}

/**
 * All valid trigger conditions for skills.
 * Parameterized triggers (e.g., every Nth attack, HP threshold) are represented
 * as string literals with embedded values — e.g. `on_nth_attack:3`, `on_hp_below:50`.
 * Simple triggers use the plain string values below.
 */
export enum TriggerCondition {
  OnBattleStart = 'on_battle_start',
  OnAttack = 'on_attack',
  /** Use `on_nth_attack:N` string for parameterized variant */
  OnNthAttack = 'on_nth_attack',
  OnTakeDamage = 'on_take_damage',
  /** Use `on_hp_below:N` string for parameterized variant */
  OnHpBelow = 'on_hp_below',
  OnAllyDeath = 'on_ally_death',
  OnKill = 'on_kill',
  OnTurnStart = 'on_turn_start',
  OnTurnEnd = 'on_turn_end',
  PassiveAura = 'passive_aura',
}

/** Valid target selectors for skill effects. */
export enum TargetType {
  Self = 'self',
  SingleEnemy = 'single_enemy',
  AllEnemies = 'all_enemies',
  SingleAlly = 'single_ally',
  AllAllies = 'all_allies',
  AoeArea = 'aoe_area',
}

/** Sub-types of martial arts (武技), exclusive to S+ STR-focused heroes. */
export enum MartialArtType {
  /** 突阵 — bypass front row, strike back row */
  Charge = 'charge',
  /** 连斩 — chain kill, immediately attack next target */
  ChainSlash = 'chain_slash',
  /** 万夫不当 — gains bonuses based on number of surrounding enemies */
  Overwhelm = 'overwhelm',
  /** 震慑 — reduces attributes of surrounding enemies */
  Intimidate = 'intimidate',
  /** 铁壁 — absorbs damage intended for allied heroes behind */
  IronWall = 'iron_wall',
}

// ---------------------------------------------------------------------------
// Base Stats map
// ---------------------------------------------------------------------------

/** A record of all five stat values for a hero. */
export type BaseStats = Record<StatType, number>

// ---------------------------------------------------------------------------
// Skill & ability interfaces
// ---------------------------------------------------------------------------

/**
 * A single atomic effect produced by a skill.
 * Concrete effect resolution is handled by the Battle Engine and Status System.
 */
export interface Effect {
  /** Human-readable description of what this effect does. */
  description: string
  /**
   * Numeric magnitude of the effect.
   * Interpretation depends on context: damage multiplier, heal amount, debuff magnitude, etc.
   */
  magnitude: number
  /**
   * Duration in turns/rounds (0 = instant / one-time effect).
   * Status effects with duration > 0 are managed by the Status System.
   */
  duration: number
}

/**
 * A skill entry in a hero's skill list.
 * Passive skills fire automatically via aura; active skills fire on their trigger condition.
 */
export interface Skill {
  /** Display name of the skill (e.g., "青龙偃月"). */
  name: string
  /** Whether this skill is passive (always-on aura) or active (trigger-based). */
  type: SkillType
  /**
   * Trigger condition string.
   * For parameterized triggers use the format `on_nth_attack:3` or `on_hp_below:50`.
   */
  trigger: TriggerCondition | string
  /** One or more effects applied when the skill fires. */
  effects: Effect[]
  /** Who this skill affects. */
  target: TargetType
  /** Which base stat this skill's numeric output scales with. */
  scaling: ScalingStat
  /**
   * Cooldown in turns (active skills only).
   * Undefined for passive skills.
   */
  cooldown?: number
}

/**
 * A martial art (武技) — exclusive to S+ STR-focused heroes.
 * Triggers automatically when conditions are met; affects self or nearby units.
 */
export interface MartialArt {
  /** Display name (e.g., "无双冲锋"). */
  name: string
  /** Functional sub-type determining battle resolution logic. */
  martialArtType: MartialArtType
  /** Atomic effects applied on trigger. */
  effects: Effect[]
  /** Target selector. */
  target: TargetType
  /** Trigger condition. */
  trigger: TriggerCondition | string
}

/**
 * An advisor skill (军师技) — exclusive to S+ INT-focused heroes.
 * Manually activated by the player; affects the global battlefield.
 */
export interface AdvisorSkill {
  /** Display name (e.g., "借东风"). */
  name: string
  /** Atomic effects applied on activation. */
  effects: Effect[]
  /** Target selector. */
  target: TargetType
  /** Cooldown between uses in turns. */
  cooldown: number
  /** Maximum number of uses per battle. */
  maxUsesPerBattle: number
}

// ---------------------------------------------------------------------------
// Lore
// ---------------------------------------------------------------------------

/** Historical background text attached to a hero card. */
export interface HeroLore {
  /** One-paragraph historical summary. */
  biography: string
  /** Relevant historical events (e.g., "三顾茅庐", "赤壁之战"). */
  historicalEvents: string[]
}

// ---------------------------------------------------------------------------
// Static hero data (loaded from config)
// ---------------------------------------------------------------------------

/**
 * Complete static data record for a hero.
 * This is the config-file shape — loaded once, never mutated at runtime.
 * All gameplay values originate from this object.
 *
 * @see design/gdd/hero-system.md — Hero Data Model
 */
export interface HeroData {
  /** Unique identifier (e.g., "guan_yu", "legend_guan_yu"). */
  id: string
  /** Display name (e.g., "关羽", "武圣·关羽"). */
  name: string
  /** Base name used to link a base hero to its legend variants (e.g., "关羽"). */
  baseName: string
  /** Courtesy title / epithet (e.g., "美髯公"). */
  title: string
  /** Faction alignment. */
  faction: Faction
  /** Rarity / power tier. */
  tier: HeroTier
  /** Base or Legend variant. */
  variant: HeroVariant
  /**
   * Honorific prefix for legend variants (e.g., "武圣", "卧龙").
   * null for Base variant heroes.
   */
  legendTitle: string | null
  /** Five core base attributes as defined in the data file. */
  baseStats: BaseStats
  /**
   * Per-stat growth rate per level above 1.
   * Used by the Hero Growth system: `growthBonus[stat] = floor(baseStats[stat] * growthRate[stat] * (level - 1))`.
   * Range: 0.0–0.5 per stat per level.
   */
  statGrowthRates: BaseStats
  /** Skill list (1 passive for C/B; 1 passive + 1 active for A; up to 4 for SSS). */
  skills: Skill[]
  /**
   * Martial arts (武技) — only populated for S+ STR-focused heroes.
   * null for heroes without martial arts.
   */
  martialArts: MartialArt[] | null
  /**
   * Advisor skill (军师技) — only populated for S+ INT-focused heroes.
   * null for heroes without an advisor skill.
   */
  advisorSkill: AdvisorSkill | null
  /** Characteristic tags for bond / synergy queries (e.g., ["骑兵", "忠义", "武力型"]). */
  tags: string[]
  /** Bond IDs this hero can participate in (e.g., ["桃园结义", "五虎上将"]). */
  bondKeys: string[]
  /** Historical lore text. */
  lore: HeroLore
  /** Path / key for the hero portrait asset. */
  artRef: string
}

// ---------------------------------------------------------------------------
// Runtime hero instance (mutable, per-run state)
// ---------------------------------------------------------------------------

/**
 * Runtime state of a hero within a run.
 * Created from `HeroData` by `createHeroInstance()`.
 * Mutated by: Equipment System, Bond System, Hero Growth, Status System, Battle Engine.
 *
 * @see design/gdd/hero-system.md — States and Transitions
 */
export interface HeroInstance {
  /** Reference to the immutable static data record. */
  data: HeroData

  /** Current hero level (starts at 1). */
  level: number

  /** Current HP during / between battles. Set to maxHP on creation. */
  currentHP: number

  /**
   * Additive stat bonus from the Hero Growth system.
   * Computed per stat: `floor(baseStats[stat] * statGrowthRates[stat] * (level - 1))`.
   */
  growthBonus: BaseStats

  /**
   * Additive stat bonus from equipped items.
   * Written by the Equipment System. Initialized to all-zero.
   */
  equipBonus: BaseStats

  /**
   * Multiplicative bond modifier (percentage as decimal, e.g., 0.10 = +10%).
   * Written by the Bond System. Initialized to 0.
   */
  bondModifier: number

  /**
   * Multiplicative status modifier (percentage as decimal, e.g., -0.20 = −20%).
   * Written by the Status System. Range: −0.5 to +1.0. Initialized to 0.
   */
  statusModifier: number

  /**
   * IDs of items currently equipped by this hero.
   * Slot management enforced by the Equipment System.
   */
  equippedItemIds: string[]

  /**
   * IDs of active status effects currently on this hero.
   * Managed by the Status System.
   */
  activeStatusIds: string[]

  /**
   * Whether this hero was knocked out in the current battle.
   * Resets to false at the start of each battle.
   */
  isKnockedOut: boolean
}
