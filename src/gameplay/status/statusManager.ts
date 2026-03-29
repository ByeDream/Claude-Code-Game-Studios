/**
 * Status System — Status Manager
 *
 * Pure functional status management: apply, remove, tick, and query
 * status effects on battle units. All functions take an array of
 * AppliedStatus and return new arrays — no mutation.
 *
 * @module src/gameplay/status/statusManager
 * @see design/gdd/status-system.md
 */

import type { BaseStats } from '../hero/types'
import { StatType } from '../hero/types'
import { createZeroStats } from '../hero/statCalculation'
import type {
  StatusEffect,
  AppliedStatus,
  ApplyResult,
  TickResult,
  ControlState,
} from './types'
import { StatusEffectType } from './types'
import {
  STATUS_MODIFIER_MIN,
  STATUS_MODIFIER_MAX,
  BOSS_DEBUFF_REDUCTION,
  BOSS_CONTROL_REDUCTION,
  BURN_HEAL_REDUCTION,
  TENACITY_REDUCTION,
} from './statusConfig'

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * Applies a status effect to a unit's active status list.
 *
 * Stacking rule: same-ID statuses do not stack. If a same-ID status already
 * exists, the stronger one (by `value`) is kept. If the new one is weaker,
 * it is discarded.
 *
 * Boss targets have debuff values reduced by BOSS_DEBUFF_REDUCTION.
 * Boss targets have control duration reduced by BOSS_CONTROL_REDUCTION.
 * S+ tier heroes have control duration reduced by TENACITY_REDUCTION.
 *
 * @param statuses - Current active statuses on the target (not mutated).
 * @param effect - The status effect definition to apply.
 * @param sourceHeroId - ID of the hero applying this status.
 * @param isBoss - Whether the target is a boss (applies boss resistance).
 * @param isHighTier - Whether the target is S+ tier (applies tenacity).
 * @returns Tuple of [newStatuses, ApplyResult].
 */
export function applyStatus(
  statuses: readonly AppliedStatus[],
  effect: StatusEffect,
  sourceHeroId: string,
  isBoss: boolean = false,
  isHighTier: boolean = false,
): [AppliedStatus[], ApplyResult] {
  // Apply boss resistance to debuff values
  let adjustedEffect = effect
  let result: ApplyResult = 'applied'

  if (isBoss && effect.category === 'debuff' && effect.effectType === StatusEffectType.StatModify) {
    adjustedEffect = {
      ...effect,
      value: effect.value * BOSS_DEBUFF_REDUCTION,
    }
    result = 'reduced_by_boss'
  }

  // Boss control duration reduction
  if (isBoss && effect.effectType === StatusEffectType.Control) {
    const reducedDuration = Math.max(1, Math.floor(effect.duration * BOSS_CONTROL_REDUCTION))
    adjustedEffect = {
      ...adjustedEffect,
      duration: reducedDuration,
    }
    result = 'reduced_by_boss'
  }

  // S+ tier tenacity: control duration reduction (stacks with boss reduction if both apply)
  if (isHighTier && adjustedEffect.effectType === StatusEffectType.Control) {
    const reducedDuration = Math.max(1, Math.floor(adjustedEffect.duration * TENACITY_REDUCTION))
    adjustedEffect = {
      ...adjustedEffect,
      duration: reducedDuration,
    }
    if (result !== 'reduced_by_boss') {
      result = 'applied' // tenacity doesn't change the result type
    }
  }

  // Check for existing same-ID status
  const existingIndex = statuses.findIndex(s => s.effect.id === effect.id)

  if (existingIndex >= 0) {
    const existing = statuses[existingIndex]
    if (adjustedEffect.value > existing.effect.value) {
      // New is stronger — replace
      const newStatuses = [...statuses]
      newStatuses[existingIndex] = {
        effect: adjustedEffect,
        remainingDuration: adjustedEffect.duration,
        sourceHeroId,
      }
      return [newStatuses, result === 'reduced_by_boss' ? result : 'replaced_weaker']
    } else {
      // Existing is stronger or equal — discard new
      return [[...statuses], 'ignored_stronger_exists']
    }
  }

  // No existing same-ID — add new
  const newStatus: AppliedStatus = {
    effect: adjustedEffect,
    remainingDuration: adjustedEffect.duration,
    sourceHeroId,
  }

  return [[...statuses, newStatus], result]
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

/**
 * Removes all statuses with the given ID from the active list.
 *
 * @param statuses - Current active statuses (not mutated).
 * @param statusId - The status effect ID to remove.
 * @returns New array with the specified status removed.
 */
export function removeStatus(
  statuses: readonly AppliedStatus[],
  statusId: string,
): AppliedStatus[] {
  return statuses.filter(s => s.effect.id !== statusId)
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

/**
 * Processes one round tick on all active statuses.
 *
 * Steps:
 * 1. Calculate DoT damage (poison, burn)
 * 2. Calculate HoT healing (regen) — reduced by burn if present
 * 3. Decrement all durations by 1
 * 4. Remove expired statuses (duration <= 0)
 *
 * @param statuses - Current active statuses (not mutated).
 * @param currentHP - Target's current HP.
 * @param maxHP - Target's max HP.
 * @returns Tuple of [remainingStatuses, TickResult].
 */
export function tickStatuses(
  statuses: readonly AppliedStatus[],
  currentHP: number,
  maxHP: number,
): [AppliedStatus[], TickResult] {
  let totalDamage = 0
  let totalHealing = 0
  const expired: string[] = []

  // Check if burning (affects heal reduction)
  const isBurning = statuses.some(s => s.effect.effectType === StatusEffectType.Burn)

  // Calculate DoT/HoT
  for (const status of statuses) {
    const { effectType } = status.effect
    if (effectType === StatusEffectType.Dot || effectType === StatusEffectType.Burn) {
      totalDamage += Math.max(1, status.effect.value)
    } else if (effectType === StatusEffectType.Hot) {
      let healAmount = status.effect.value
      if (isBurning) {
        healAmount = healAmount * BURN_HEAL_REDUCTION
      }
      // Cap healing at missing HP
      const missingHP = maxHP - (currentHP - totalDamage + totalHealing)
      totalHealing += Math.min(healAmount, Math.max(0, missingHP))
    }
  }

  // Decrement durations and collect expired
  const remaining: AppliedStatus[] = []
  for (const status of statuses) {
    const newDuration = status.remainingDuration - 1
    if (newDuration <= 0) {
      expired.push(status.effect.id)
    } else {
      remaining.push({
        ...status,
        remainingDuration: newDuration,
      })
    }
  }

  return [remaining, { damage: totalDamage, healing: totalHealing, expired }]
}

// ---------------------------------------------------------------------------
// Query: stat modifier
// ---------------------------------------------------------------------------

/**
 * Calculates the per-stat status modifier from all active stat-modify statuses.
 *
 * Buffs add positive values, debuffs subtract. Result is clamped per stat
 * to [STATUS_MODIFIER_MIN, STATUS_MODIFIER_MAX].
 *
 * @param statuses - Current active statuses.
 * @returns BaseStats record with the net status modifier per stat.
 *
 * @see design/gdd/status-system.md — Formulas: Stat Modifier Calculation
 */
export function getStatusModifier(statuses: readonly AppliedStatus[]): BaseStats {
  const modifier = createZeroStats()

  for (const status of statuses) {
    if (status.effect.effectType !== StatusEffectType.StatModify || !status.effect.stat) {
      continue
    }

    const stat = status.effect.stat
    if (status.effect.category === 'buff') {
      modifier[stat] += status.effect.value
    } else {
      modifier[stat] -= status.effect.value
    }
  }

  // Clamp each stat
  for (const stat of Object.values(StatType)) {
    modifier[stat] = Math.max(STATUS_MODIFIER_MIN, Math.min(STATUS_MODIFIER_MAX, modifier[stat]))
  }

  return modifier
}

// ---------------------------------------------------------------------------
// Query: control state
// ---------------------------------------------------------------------------

/**
 * Returns the current control state of a unit based on active statuses.
 * Stun takes priority over silence (stunned unit can't act at all).
 *
 * @param statuses - Current active statuses.
 * @returns 'stunned', 'silenced', or 'none'.
 *
 * @see design/gdd/status-system.md — Edge Cases: simultaneous stun + silence
 */
export function isControlled(statuses: readonly AppliedStatus[]): ControlState {
  let controlState: ControlState = 'none'
  for (const status of statuses) {
    if (status.effect.effectType === StatusEffectType.Control) {
      if (status.effect.controlType === 'stun') return 'stunned' // highest priority, early exit
      if (status.effect.controlType === 'silence') controlState = 'silenced'
    }
  }
  return controlState
}

// ---------------------------------------------------------------------------
// Utility: clear all statuses
// ---------------------------------------------------------------------------

/**
 * Returns an empty status array. Used at battle end to clear all statuses.
 *
 * @returns Empty array.
 */
export function clearAllStatuses(): AppliedStatus[] {
  return []
}
