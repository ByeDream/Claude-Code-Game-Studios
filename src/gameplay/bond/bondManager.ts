/**
 * Bond System — Core Evaluation Logic
 *
 * Implements `evaluateBonds()` which takes a roster of hero instances,
 * detects activated faction and historical bonds, and returns per-hero
 * stat modifiers capped at BOND_MODIFIER_CAP.
 *
 * Pure functions — no side effects, no mutation of input data.
 *
 * @module src/gameplay/bond/bondManager
 * @see design/gdd/bond-system.md
 */

import type { HeroInstance, BaseStats } from '../hero/types'
import { Faction, StatType } from '../hero/types'
import { createZeroStats } from '../hero/statCalculation'
import type {
  ActivatedBond,
  BondResult,
  FactionBondDefinition,
  HistoricalBondDefinition,
} from './types'
import { BondType } from './types'
import { BOND_MODIFIER_CAP, FACTION_BOND_TABLE, HISTORICAL_BONDS } from './bondConfig'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Counts heroes per faction in the given roster.
 *
 * @param roster - Array of hero instances.
 * @returns A record mapping each Faction to its hero count.
 */
function countFactions(roster: ReadonlyArray<HeroInstance>): Record<Faction, number> {
  const counts: Record<Faction, number> = {
    [Faction.Wei]: 0,
    [Faction.Shu]: 0,
    [Faction.Wu]:  0,
    [Faction.Qun]: 0,
  }
  for (const hero of roster) {
    counts[hero.data.faction]++
  }
  return counts
}

/**
 * Collects all baseNames present in the roster.
 * Uses baseName so legend variants match their base hero's bond requirements.
 *
 * @param roster - Array of hero instances.
 * @returns A Set of baseName strings.
 */
function collectBaseNames(roster: ReadonlyArray<HeroInstance>): Set<string> {
  const names = new Set<string>()
  for (const hero of roster) {
    names.add(hero.data.baseName)
  }
  return names
}

/**
 * Collects all equipped item IDs across the roster.
 *
 * @param roster - Array of hero instances.
 * @returns A Set of equipment ID strings.
 */
function collectEquippedItemIds(roster: ReadonlyArray<HeroInstance>): Set<string> {
  const ids = new Set<string>()
  for (const hero of roster) {
    for (const itemId of hero.equippedItemIds) {
      ids.add(itemId)
    }
  }
  return ids
}

/**
 * Applies Partial<BaseStats> bonuses onto a target BaseStats record (mutating).
 * Only adds to stats that are defined in the bonus.
 */
function addBonuses(target: BaseStats, bonuses: Partial<BaseStats>): void {
  for (const stat of Object.values(StatType)) {
    if (bonuses[stat] !== undefined) {
      target[stat] += bonuses[stat]
    }
  }
}

/**
 * Clamps each stat in the modifier to BOND_MODIFIER_CAP.
 */
function capModifier(modifier: BaseStats): BaseStats {
  const capped = { ...modifier }
  for (const stat of Object.values(StatType)) {
    capped[stat] = Math.min(capped[stat], BOND_MODIFIER_CAP)
  }
  return capped
}

/**
 * Resolves Qun faction bonuses by replacing the placeholder stat with the
 * run's randomly determined stat.
 *
 * @param definition - The Qun faction bond definition (uses STR as placeholder).
 * @param randomStat - The stat chosen at run start for Qun's bonus.
 * @returns A new FactionBondDefinition with the placeholder replaced.
 */
function resolveQunFactionBond(
  definition: FactionBondDefinition,
  randomStat: StatType
): FactionBondDefinition {
  if (randomStat === StatType.STR) {
    return definition  // placeholder is already STR
  }
  return {
    ...definition,
    tiers: definition.tiers.map(tier => {
      const newBonuses: Partial<BaseStats> = {}
      for (const stat of Object.values(StatType)) {
        const value = tier.statBonuses[stat]
        if (value !== undefined) {
          // Replace placeholder stat (STR) with the actual random stat
          if (stat === StatType.STR) {
            newBonuses[randomStat] = value
          } else {
            newBonuses[stat] = value
          }
        }
      }
      return { ...tier, statBonuses: newBonuses }
    }),
  }
}

// ---------------------------------------------------------------------------
// Faction bond evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates faction bonds for the given roster.
 *
 * @param roster - Array of hero instances.
 * @param qunRandomStat - The stat chosen at run start for Qun's random bonus.
 * @returns Array of activated faction bonds.
 */
export function evaluateFactionBonds(
  roster: ReadonlyArray<HeroInstance>,
  qunRandomStat: StatType = StatType.STR
): ActivatedBond[] {
  const factionCounts = countFactions(roster)
  const activated: ActivatedBond[] = []

  for (const faction of Object.values(Faction)) {
    const count = factionCounts[faction]
    if (count < 2) continue  // minimum 2 heroes for any faction bond

    let bondDef = FACTION_BOND_TABLE[faction]

    // Resolve Qun placeholder
    if (faction === Faction.Qun) {
      bondDef = resolveQunFactionBond(bondDef, qunRandomStat)
    }

    // Find the highest tier reached
    let bestTier: (typeof bondDef.tiers)[number] | null = null
    let bestTierIndex = 0
    for (let i = 0; i < bondDef.tiers.length; i++) {
      if (count >= bondDef.tiers[i].requiredCount) {
        bestTier = bondDef.tiers[i]
        bestTierIndex = i + 1  // 1-based tier index
      }
    }

    if (bestTier) {
      // Participating heroes = all heroes of this faction
      const participants = roster
        .filter(h => h.data.faction === faction)
        .map(h => h.data.baseName)

      activated.push({
        type: BondType.Faction,
        name: bondDef.name,
        tier: bestTierIndex,
        statBonuses: bestTier.statBonuses,
        participatingHeroes: participants,
      })
    }
  }

  return activated
}

// ---------------------------------------------------------------------------
// Historical bond evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates historical bonds for the given roster.
 *
 * @param roster - Array of hero instances.
 * @param bondDefinitions - Historical bond definitions to check (defaults to HISTORICAL_BONDS).
 * @returns Array of activated historical bonds.
 */
export function evaluateHistoricalBonds(
  roster: ReadonlyArray<HeroInstance>,
  bondDefinitions: ReadonlyArray<HistoricalBondDefinition> = HISTORICAL_BONDS
): ActivatedBond[] {
  const baseNames = collectBaseNames(roster)
  const equippedIds = collectEquippedItemIds(roster)
  const activated: ActivatedBond[] = []

  for (const bond of bondDefinitions) {
    // Check equipment requirements
    if (bond.requiredEquipmentIds.length > 0) {
      const hasAllEquipment = bond.requiredEquipmentIds.every(id => equippedIds.has(id))
      if (!hasAllEquipment) continue
    }

    // Check hero requirements
    const matchedHeroes = bond.requiredHeroes.filter(name => baseNames.has(name))

    let isActivated = false
    if (bond.requirementMode.type === 'all') {
      isActivated = matchedHeroes.length === bond.requiredHeroes.length
    } else {
      // any_n mode
      isActivated = matchedHeroes.length >= bond.requirementMode.count
    }

    if (isActivated) {
      activated.push({
        type: BondType.Historical,
        name: bond.name,
        tier: 1,
        statBonuses: bond.statBonuses,
        participatingHeroes: matchedHeroes,
      })
    }
  }

  return activated
}

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluates all bonds (faction + historical) for a roster and computes
 * per-hero stat modifiers.
 *
 * Rules:
 * - Faction bonds apply to ALL heroes of that faction in the roster.
 * - Historical bonds apply only to participating heroes (those whose baseName
 *   is in the bond's requiredHeroes list and are present in the roster).
 * - All bonuses are additive, then each stat is capped at BOND_MODIFIER_CAP.
 * - Returns both activated bond list and per-hero modifier map.
 *
 * @param roster - Array of hero instances to evaluate.
 * @param qunRandomStat - The stat chosen at run start for Qun's random bonus.
 * @param bondDefinitions - Historical bond definitions (defaults to HISTORICAL_BONDS).
 * @returns BondResult with activated bonds and per-hero modifiers.
 *
 * @see design/gdd/bond-system.md — Bond Modifier Calculation
 */
export function evaluateBonds(
  roster: ReadonlyArray<HeroInstance>,
  qunRandomStat: StatType = StatType.STR,
  bondDefinitions: ReadonlyArray<HistoricalBondDefinition> = HISTORICAL_BONDS
): BondResult {
  // Evaluate both bond types
  const factionBonds = evaluateFactionBonds(roster, qunRandomStat)
  const historicalBonds = evaluateHistoricalBonds(roster, bondDefinitions)
  const allBonds = [...factionBonds, ...historicalBonds]

  // Build per-hero modifier map
  const perHeroModifiers = new Map<string, BaseStats>()

  // Initialize all heroes with zero modifiers
  for (const hero of roster) {
    perHeroModifiers.set(hero.data.id, createZeroStats())
  }

  // Apply faction bond bonuses to all heroes of that faction
  for (const bond of factionBonds) {
    for (const hero of roster) {
      if (bond.participatingHeroes.includes(hero.data.baseName)) {
        const mod = perHeroModifiers.get(hero.data.id)!
        addBonuses(mod, bond.statBonuses)
      }
    }
  }

  // Apply historical bond bonuses to participating heroes only
  for (const bond of historicalBonds) {
    for (const hero of roster) {
      if (bond.participatingHeroes.includes(hero.data.baseName)) {
        const mod = perHeroModifiers.get(hero.data.id)!
        addBonuses(mod, bond.statBonuses)
      }
    }
  }

  // Cap each hero's modifiers
  for (const [heroId, modifier] of perHeroModifiers) {
    perHeroModifiers.set(heroId, capModifier(modifier))
  }

  return {
    activatedBonds: allBonds,
    perHeroModifiers,
  }
}

/**
 * Applies bond evaluation results to a roster by writing bondModifier on each hero.
 *
 * This is the integration point: call evaluateBonds(), then applyBondResult()
 * to write the per-stat modifiers onto each HeroInstance.
 *
 * @param roster - Mutable hero instances to update.
 * @param result - BondResult from evaluateBonds().
 */
export function applyBondResult(
  roster: HeroInstance[],
  result: BondResult
): void {
  for (const hero of roster) {
    const modifier = result.perHeroModifiers.get(hero.data.id)
    if (modifier) {
      hero.bondModifier = { ...modifier }
    }
  }
}
