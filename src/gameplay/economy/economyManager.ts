/**
 * Economy System — Economy Manager
 *
 * Pure functional, immutable implementation of the EconomyAPI defined in the GDD.
 * All operations return a new `Economy` object; no state is ever mutated in place.
 *
 * Immutability contract:
 *   - `earn`  → returns a new Economy with resources added
 *   - `spend` → returns a new Economy with resources deducted; throws if insufficient
 *   - `reset` → returns a fresh Economy initialised to starting values
 *
 * All resource values are clamped to ≥ 0 (enforced by `spend` pre-check).
 *
 * @module src/gameplay/economy/economyManager
 * @see design/gdd/economy.md — Interactions with Other Systems, EconomyAPI
 */

import type { Economy } from './types'
import { STARTING_GOLD, STARTING_MATERIAL } from './economyConfig'

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a new Economy state with the given starting values.
 *
 * When called with no arguments it produces the canonical Run-start economy
 * (STARTING_GOLD gold, STARTING_MATERIAL material).
 *
 * @param startingGold     - Initial gold balance. Defaults to `STARTING_GOLD`.
 * @param startingMaterial - Initial material balance. Defaults to `STARTING_MATERIAL`.
 * @returns An immutable Economy snapshot.
 *
 * @example
 * const economy = createEconomy()       // { gold: 20, material: 0 }
 * const custom  = createEconomy(50, 10) // { gold: 50, material: 10 }
 */
export function createEconomy(
  startingGold:     number = STARTING_GOLD,
  startingMaterial: number = STARTING_MATERIAL,
): Economy {
  return { gold: startingGold, material: startingMaterial }
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Returns the current gold balance.
 *
 * @param economy - The current Economy state.
 * @returns Current gold amount (always ≥ 0).
 */
export function getGold(economy: Economy): number {
  return economy.gold
}

/**
 * Returns the current material balance.
 *
 * @param economy - The current Economy state.
 * @returns Current material amount (always ≥ 0).
 */
export function getMaterial(economy: Economy): number {
  return economy.material
}

// ---------------------------------------------------------------------------
// Affordability check
// ---------------------------------------------------------------------------

/**
 * Returns whether the current economy can cover the specified cost without
 * going negative on either resource.
 *
 * Supports partial costs: pass 0 for a resource that isn't required.
 *
 * @param economy       - The current Economy state.
 * @param goldCost      - Gold required. Must be ≥ 0.
 * @param materialCost  - Material required. Must be ≥ 0.
 * @returns `true` if both resource balances cover the costs; `false` otherwise.
 *
 * @example
 * canAfford(economy, 30, 0)   // true if gold >= 30
 * canAfford(economy, 0, 10)   // true if material >= 10
 * canAfford(economy, 30, 10)  // true if gold >= 30 AND material >= 10
 */
export function canAfford(
  economy:      Economy,
  goldCost:     number,
  materialCost: number,
): boolean {
  return economy.gold >= goldCost && economy.material >= materialCost
}

// ---------------------------------------------------------------------------
// Resource mutations (return new state)
// ---------------------------------------------------------------------------

/**
 * Returns a new Economy with the given amounts added to the current balances.
 *
 * Both amounts must be ≥ 0. There is no resource cap (GDD: "无上限").
 * Receiving both gold and material in the same call is supported (e.g., battle rewards).
 *
 * @param economy          - The current Economy state.
 * @param goldAmount       - Gold to add. Must be ≥ 0.
 * @param materialAmount   - Material to add. Must be ≥ 0.
 * @returns A new Economy with updated balances.
 *
 * @example
 * const after = earn(economy, 10, 5)  // gold += 10, material += 5
 */
export function earn(
  economy:        Economy,
  goldAmount:     number,
  materialAmount: number,
): Economy {
  return {
    gold:     economy.gold     + goldAmount,
    material: economy.material + materialAmount,
  }
}

/**
 * Returns a new Economy with the given costs deducted from the current balances.
 *
 * Throws a `RangeError` if the economy cannot afford the cost.
 * Callers should use `canAfford()` to gate UI actions before calling `spend()`,
 * so that the thrown error only fires on programming errors, not normal play.
 *
 * @param economy      - The current Economy state.
 * @param goldCost     - Gold to deduct. Must be ≥ 0.
 * @param materialCost - Material to deduct. Must be ≥ 0.
 * @returns A new Economy with deducted balances.
 * @throws {RangeError} If gold or material balance would go negative.
 *
 * @example
 * const after = spend(economy, 30, 0)   // recruit a C-tier hero
 * const after = spend(economy, 0, 10)   // level up a hero
 */
export function spend(
  economy:      Economy,
  goldCost:     number,
  materialCost: number,
): Economy {
  if (!canAfford(economy, goldCost, materialCost)) {
    const goldShortfall     = Math.max(0, goldCost     - economy.gold)
    const materialShortfall = Math.max(0, materialCost - economy.material)
    throw new RangeError(
      `Insufficient resources: need ${goldCost} gold (have ${economy.gold}, ` +
      `short ${goldShortfall}) and ${materialCost} material ` +
      `(have ${economy.material}, short ${materialShortfall}).`,
    )
  }

  return {
    gold:     economy.gold     - goldCost,
    material: economy.material - materialCost,
  }
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

/**
 * Returns a fresh Economy initialised to the canonical Run-start values
 * (`STARTING_GOLD` gold, `STARTING_MATERIAL` material).
 *
 * Called at the beginning of each Run to wipe the previous run's resources.
 *
 * @returns A new Economy at starting values.
 *
 * @example
 * const freshRun = reset()  // { gold: STARTING_GOLD, material: STARTING_MATERIAL }
 */
export function reset(): Economy {
  return createEconomy()
}

// ---------------------------------------------------------------------------
// Derived formula helpers
// ---------------------------------------------------------------------------

/**
 * Calculates the gold reward from selling a piece of equipment.
 *
 * Formula: sellGold = max(1, floor(equipBasePrice * SELL_RATIO))
 *
 * The minimum of 1 gold implements the GDD edge case:
 * "卖出价格为 0 的装备 → 给 1 金币保底".
 *
 * @param equipBasePrice - The equipment's original base price in gold.
 * @param sellRatio      - The sell ratio constant (default imported from config).
 * @returns Gold earned from selling, minimum 1.
 *
 * @see design/gdd/economy.md — Formulas: Equipment Sell/Disassemble
 * @see design/gdd/economy.md — Edge Cases: 卖出价格为 0 的装备
 */
export function calcSellGold(equipBasePrice: number, sellRatio: number): number {
  return Math.max(1, Math.floor(equipBasePrice * sellRatio))
}

/**
 * Calculates the material yield from disassembling a piece of equipment.
 *
 * Formula: disassembleMaterial = equipLevel * DISASSEMBLE_RATIO
 *
 * @param equipLevel         - The equipment's current upgrade level (≥ 1).
 * @param disassembleRatio   - The disassemble ratio constant (default imported from config).
 * @returns Material earned from disassembly.
 *
 * @see design/gdd/economy.md — Formulas: Equipment Sell/Disassemble
 */
export function calcDisassembleMaterial(
  equipLevel:        number,
  disassembleRatio:  number,
): number {
  return equipLevel * disassembleRatio
}

/**
 * Calculates the gold cost to recruit a hero using the tier multiplier.
 *
 * Formula: recruitCost = RECRUIT_BASE_COST * tierMultiplier
 *
 * @param recruitBaseCost  - Base recruit cost constant.
 * @param tierMultiplier   - Multiplier for the hero's tier (from TIER_RECRUIT_MULTIPLIER).
 * @returns Gold cost to recruit the hero.
 *
 * @see design/gdd/economy.md — Formulas: Recruit Cost
 */
export function calcRecruitCost(
  recruitBaseCost: number,
  tierMultiplier:  number,
): number {
  return Math.round(recruitBaseCost * tierMultiplier)
}

/**
 * Calculates the battle reward for a given node and difficulty.
 *
 * Formula:
 *   battleGoldReward     = BASE_GOLD     * (1 + nodeIndex * GOLD_SCALING)     * difficultyBonus
 *   battleMaterialReward = BASE_MATERIAL * (1 + nodeIndex * MATERIAL_SCALING) * difficultyBonus
 *
 * NOTE: Per the GDD this formula is superseded by the loot chest mechanism in
 * full production. It remains here for balance calibration and testing purposes.
 *
 * @param nodeIndex       - Position of the current battle node in the Run (0 = first battle).
 * @param difficultyBonus - Reward multiplier (1.0 = normal, 1.3 = elite, 2.0 = boss).
 * @param baseGold        - BASE_GOLD config constant.
 * @param baseMaterial    - BASE_MATERIAL config constant.
 * @param goldScaling     - GOLD_SCALING config constant.
 * @param materialScaling - MATERIAL_SCALING config constant.
 * @returns Object with `gold` and `material` reward amounts (floored to integers).
 *
 * @see design/gdd/economy.md — Formulas: Battle Rewards
 */
export function calcBattleReward(
  nodeIndex:        number,
  difficultyBonus:  number,
  baseGold:         number,
  baseMaterial:     number,
  goldScaling:      number,
  materialScaling:  number,
): { gold: number; material: number } {
  const gold     = Math.floor(baseGold     * (1 + nodeIndex * goldScaling)     * difficultyBonus)
  const material = Math.floor(baseMaterial * (1 + nodeIndex * materialScaling) * difficultyBonus)
  return { gold, material }
}
