/**
 * Enemy System — Enemy Factory
 *
 * Pure functions for constructing enemy instances:
 *   - `createNamelessUnit()`  — scales a template to a nodeIndex
 *   - `scaleBossStats()`      — applies BOSS_STAT_MULTIPLIER to a HeroData record
 *   - `computeNamelessCount()` — derives nameless/named ratio from nodeIndex
 *   - `createEncounter()`     — assembles a complete EnemyEncounter
 *
 * All functions are pure (no side effects, no mutations) and fully unit-testable.
 *
 * @module src/gameplay/enemy/enemyFactory
 * @see design/gdd/enemy-system.md — Encounter Generation, Formulas
 */

import type { HeroData, BaseStats } from '../hero/types'
import { StatType } from '../hero/types'
import type {
  NamelessUnit,
  EnemyEncounter,
  BossExtension,
  LootEntry,
  Position,
} from './types'
import { NamelessTemplateType, EncounterType } from './types'
import {
  NAMELESS_TEMPLATES,
  NAMELESS_SCALING_RATE,
  BOSS_STAT_MULTIPLIER,
  ELITE_STAT_MULTIPLIER,
  BASE_NAMELESS,
  NAMELESS_REDUCTION_STEP,
  STANDARD_BATTLE_SIZE,
} from './enemyConfig'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Scales a single stat value for a nameless unit at the given nodeIndex.
 *
 * Formula:
 *   scaledStat = round(templateBaseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE))
 *
 * Result is always at least 1.
 *
 * @param baseStat  - The template's unscaled stat value.
 * @param nodeIndex - The current map node index (0-based).
 * @returns Scaled stat value, minimum 1.
 */
function scaleNamelessStat(baseStat: number, nodeIndex: number): number {
  const scaled = Math.round(baseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE))
  return Math.max(1, scaled)
}

/**
 * Scales all five stats in a BaseStats record for a nameless unit.
 *
 * @param baseStats - Template base stats.
 * @param nodeIndex - Current map node index.
 * @returns A new BaseStats record with all stats scaled.
 */
function scaleAllNamelessStats(baseStats: BaseStats, nodeIndex: number): BaseStats {
  return {
    [StatType.STR]: scaleNamelessStat(baseStats[StatType.STR], nodeIndex),
    [StatType.INT]: scaleNamelessStat(baseStats[StatType.INT], nodeIndex),
    [StatType.DEF]: scaleNamelessStat(baseStats[StatType.DEF], nodeIndex),
    [StatType.HP]:  scaleNamelessStat(baseStats[StatType.HP],  nodeIndex),
    [StatType.SPD]: scaleNamelessStat(baseStats[StatType.SPD], nodeIndex),
  }
}

// ---------------------------------------------------------------------------
// Public factory functions
// ---------------------------------------------------------------------------

/**
 * Creates a runtime `NamelessUnit` instance from a template type at the given nodeIndex.
 *
 * Stats are scaled via:
 *   scaledStat = round(templateBaseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE))
 *
 * `instanceIndex` is appended to the ID to allow multiple units of the same
 * template in the same encounter without ID collision.
 *
 * @param templateType  - Which nameless template to instantiate.
 * @param nodeIndex     - Map node index determining stat scaling (≥ 0).
 * @param instanceIndex - Index within the encounter to ensure unique IDs. Defaults to 0.
 * @param isElite       - Whether this is an elite encounter (applies ELITE_STAT_MULTIPLIER). Defaults to false.
 * @returns A fully-initialised NamelessUnit with scaled stats and full HP.
 */
export function createNamelessUnit(
  templateType: NamelessTemplateType,
  nodeIndex: number,
  instanceIndex: number = 0,
  isElite: boolean = false,
): NamelessUnit {
  const template   = NAMELESS_TEMPLATES[templateType]
  let scaledStats = scaleAllNamelessStats(template.baseStats, nodeIndex)

  // Apply elite multiplier if applicable
  if (isElite) {
    scaledStats = {
      [StatType.STR]: Math.max(1, Math.round(scaledStats[StatType.STR] * ELITE_STAT_MULTIPLIER)),
      [StatType.INT]: Math.max(1, Math.round(scaledStats[StatType.INT] * ELITE_STAT_MULTIPLIER)),
      [StatType.DEF]: Math.max(1, Math.round(scaledStats[StatType.DEF] * ELITE_STAT_MULTIPLIER)),
      [StatType.HP]:  Math.max(1, Math.round(scaledStats[StatType.HP]  * ELITE_STAT_MULTIPLIER)),
      [StatType.SPD]: Math.max(1, Math.round(scaledStats[StatType.SPD] * ELITE_STAT_MULTIPLIER)),
    }
  }

  return {
    id:           `${templateType}_node${nodeIndex}_inst${instanceIndex}`,
    templateType,
    name:         template.name,
    scaledStats,
    currentHP:    scaledStats[StatType.HP],
    nodeIndex,
    skill:        template.skill,
    isKnockedOut: false,
  }
}

/**
 * Applies the Boss stat multiplier to a HeroData's base stats.
 *
 * Formula:
 *   bossStat = round(heroBaseStat * BOSS_STAT_MULTIPLIER)
 *
 * Returns a new HeroData record — the original is never mutated.
 *
 * @param heroData - The hero record used as the Boss base.
 * @returns A new HeroData with scaled baseStats. All other fields are unchanged.
 */
export function scaleBossStats(heroData: HeroData): HeroData {
  const scaledBaseStats: BaseStats = {
    [StatType.STR]: Math.round(heroData.baseStats[StatType.STR] * BOSS_STAT_MULTIPLIER),
    [StatType.INT]: Math.round(heroData.baseStats[StatType.INT] * BOSS_STAT_MULTIPLIER),
    [StatType.DEF]: Math.round(heroData.baseStats[StatType.DEF] * BOSS_STAT_MULTIPLIER),
    [StatType.HP]:  Math.round(heroData.baseStats[StatType.HP]  * BOSS_STAT_MULTIPLIER),
    [StatType.SPD]: Math.round(heroData.baseStats[StatType.SPD] * BOSS_STAT_MULTIPLIER),
  }

  return { ...heroData, baseStats: scaledBaseStats }
}

/**
 * Computes how many nameless units should appear in an encounter at the given nodeIndex.
 *
 * Formula (from GDD):
 *   namelessCount = max(0, BASE_NAMELESS - floor(nodeIndex / NAMELESS_REDUCTION_STEP))
 *   namedCount    = STANDARD_BATTLE_SIZE - namelessCount
 *
 * @param nodeIndex - Current map node index (0-based).
 * @returns Number of nameless units to include (0–BASE_NAMELESS).
 */
export function computeNamelessCount(nodeIndex: number): number {
  return Math.max(0, BASE_NAMELESS - Math.floor(nodeIndex / NAMELESS_REDUCTION_STEP))
}

/**
 * Assembles a complete `EnemyEncounter` for a Normal or Elite battle.
 *
 * Enemies are listed nameless-first, then named heroes.
 * Formation positions are assigned sequentially: 0, 1, 2, 3, 4.
 *
 * @param namelessUnits  - Pre-created NamelessUnit instances.
 * @param namedHeroes    - HeroData records for named enemy heroes (not scaled).
 * @param encounterType  - Normal or Elite.
 * @param lootTable      - Drop table for this encounter.
 * @returns A fully-assembled EnemyEncounter ready for the Battle Engine.
 * @throws {Error} if total enemy count does not equal STANDARD_BATTLE_SIZE.
 */
export function createEncounter(
  namelessUnits: NamelessUnit[],
  namedHeroes: HeroData[],
  encounterType: EncounterType.Normal | EncounterType.Elite,
  lootTable: LootEntry[],
): EnemyEncounter {
  const enemies = [...namelessUnits, ...namedHeroes]

  if (enemies.length !== STANDARD_BATTLE_SIZE) {
    throw new Error(
      `createEncounter: enemy count must be ${STANDARD_BATTLE_SIZE}, ` +
      `got ${enemies.length} (${namelessUnits.length} nameless + ${namedHeroes.length} named).`,
    )
  }

  const formation: Position[] = enemies.map((_, i) => i)

  return {
    enemies,
    formation,
    encounterType,
    lootTable,
  }
}

/**
 * Assembles a complete `EnemyEncounter` for a Boss battle.
 *
 * Boss unit must be the first element of `enemies`.
 * Boss battles are exempt from the STANDARD_BATTLE_SIZE constraint
 * (Boss + 2–4 guards + possible summon reinforcements).
 *
 * @param bossUnit       - Scaled Boss HeroData (use `scaleBossStats()` first).
 * @param guards         - Initial guard units (NamelessUnit or HeroData).
 * @param bossExtension  - Multi-phase / summon / immunity data.
 * @param lootTable      - Drop table for this Boss encounter.
 * @returns A fully-assembled Boss EnemyEncounter.
 */
export function createBossEncounter(
  bossUnit: HeroData,
  guards: Array<HeroData | NamelessUnit>,
  bossExtension: BossExtension,
  lootTable: LootEntry[],
): EnemyEncounter {
  const enemies: Array<HeroData | NamelessUnit> = [bossUnit, ...guards]
  const formation: Position[]                   = enemies.map((_, i) => i)

  return {
    enemies,
    formation,
    encounterType: EncounterType.Boss,
    bossExtension,
    lootTable,
  }
}
