/**
 * Status System — Unit Tests
 *
 * Verifies status application, stacking, tick resolution, modifier calculation,
 * control states, boss resistance, and burn-heal interaction.
 *
 * @module tests/unit/status/status.test
 * @see design/gdd/status-system.md
 */

import { describe, it, expect } from 'vitest'

import { StatType } from '../../../src/gameplay/hero/types'

import {
  StatusEffectType,
} from '../../../src/gameplay/status/types'
import type {
  StatusEffect,
  AppliedStatus,
} from '../../../src/gameplay/status/types'

import {
  STATUS_MODIFIER_MIN,
  STATUS_MODIFIER_MAX,
  BOSS_DEBUFF_REDUCTION,
  BURN_HEAL_REDUCTION,
  STATUS_EFFECTS,
} from '../../../src/gameplay/status/statusConfig'

import {
  applyStatus,
  removeStatus,
  tickStatuses,
  getStatusModifier,
  isControlled,
  clearAllStatuses,
} from '../../../src/gameplay/status/statusManager'

// ===========================================================================
// Test helpers
// ===========================================================================

function makeEffect(overrides: Partial<StatusEffect> & { id: string }): StatusEffect {
  return {
    name: overrides.id,
    category: 'debuff',
    effectType: StatusEffectType.StatModify,
    stat: StatType.STR,
    value: 0.15,
    duration: 3,
    ...overrides,
  }
}

function makeApplied(effect: StatusEffect, duration?: number, source?: string): AppliedStatus {
  return {
    effect,
    remainingDuration: duration ?? effect.duration,
    sourceHeroId: source ?? 'hero_a',
  }
}

// ===========================================================================
// applyStatus — basic application
// ===========================================================================

describe('applyStatus', () => {

  it('test_status_apply_newEffect_returnsApplied', () => {
    // Arrange
    const effect = STATUS_EFFECTS['atk_up']

    // Act
    const [statuses, result] = applyStatus([], effect, 'hero_a')

    // Assert
    expect(result).toBe('applied')
    expect(statuses).toHaveLength(1)
    expect(statuses[0].effect.id).toBe('atk_up')
    expect(statuses[0].remainingDuration).toBe(3)
    expect(statuses[0].sourceHeroId).toBe('hero_a')
  })

  it('test_status_apply_multipleDistinct_allCoexist', () => {
    // Arrange — apply atk_down then def_down
    const [first] = applyStatus([], STATUS_EFFECTS['atk_down'], 'hero_a')
    const [second, result] = applyStatus(first, STATUS_EFFECTS['def_down'], 'hero_b')

    // Assert
    expect(result).toBe('applied')
    expect(second).toHaveLength(2)
  })

  it('test_status_apply_buffAndDebuffCoexist', () => {
    // Arrange — buff + debuff on different stats
    const [first] = applyStatus([], STATUS_EFFECTS['atk_up'], 'hero_a')
    const [second] = applyStatus(first, STATUS_EFFECTS['def_down'], 'hero_b')

    // Assert
    expect(second).toHaveLength(2)
    expect(second.some(s => s.effect.category === 'buff')).toBe(true)
    expect(second.some(s => s.effect.category === 'debuff')).toBe(true)
  })

  it('test_status_apply_doesNotMutateOriginalArray', () => {
    // Arrange
    const original: AppliedStatus[] = []

    // Act
    const [newStatuses] = applyStatus(original, STATUS_EFFECTS['atk_up'], 'hero_a')

    // Assert
    expect(original).toHaveLength(0)
    expect(newStatuses).toHaveLength(1)
  })

})

// ===========================================================================
// applyStatus — stacking rules
// ===========================================================================

describe('applyStatus — stacking', () => {

  it('test_status_stack_sameIdStronger_replacesWeaker', () => {
    // Arrange — existing 15% atk_down
    const weak = makeEffect({ id: 'atk_down', value: 0.15, duration: 3 })
    const strong = makeEffect({ id: 'atk_down', value: 0.20, duration: 2 })
    const [initial] = applyStatus([], weak, 'hero_a')

    // Act
    const [result, applyResult] = applyStatus(initial, strong, 'hero_b')

    // Assert — stronger replaces weaker
    expect(applyResult).toBe('replaced_weaker')
    expect(result).toHaveLength(1)
    expect(result[0].effect.value).toBe(0.20)
    expect(result[0].remainingDuration).toBe(2)
    expect(result[0].sourceHeroId).toBe('hero_b')
  })

  it('test_status_stack_sameIdWeaker_ignoredStrongerExists', () => {
    // Arrange — existing 20% atk_down
    const strong = makeEffect({ id: 'atk_down', value: 0.20, duration: 2 })
    const weak = makeEffect({ id: 'atk_down', value: 0.15, duration: 5 })
    const [initial] = applyStatus([], strong, 'hero_a')

    // Act
    const [result, applyResult] = applyStatus(initial, weak, 'hero_b')

    // Assert — weaker discarded
    expect(applyResult).toBe('ignored_stronger_exists')
    expect(result).toHaveLength(1)
    expect(result[0].effect.value).toBe(0.20)
  })

  it('test_status_stack_sameIdEqualValue_ignoredStrongerExists', () => {
    // Arrange
    const effectA = makeEffect({ id: 'atk_down', value: 0.15, duration: 3 })
    const effectB = makeEffect({ id: 'atk_down', value: 0.15, duration: 5 })
    const [initial] = applyStatus([], effectA, 'hero_a')

    // Act
    const [result, applyResult] = applyStatus(initial, effectB, 'hero_b')

    // Assert — equal value is "not stronger", keep existing
    expect(applyResult).toBe('ignored_stronger_exists')
    expect(result).toHaveLength(1)
  })

})

// ===========================================================================
// applyStatus — boss resistance
// ===========================================================================

describe('applyStatus — boss resistance', () => {

  it('test_status_boss_debuffReduced', () => {
    // Arrange
    const effect = makeEffect({ id: 'def_down', category: 'debuff', value: 0.20, stat: StatType.DEF })

    // Act
    const [statuses, result] = applyStatus([], effect, 'hero_a', true)

    // Assert — value halved for boss
    expect(result).toBe('reduced_by_boss')
    expect(statuses[0].effect.value).toBe(0.20 * BOSS_DEBUFF_REDUCTION)
  })

  it('test_status_boss_buffNotReduced', () => {
    // Arrange
    const effect = makeEffect({ id: 'atk_up', category: 'buff', value: 0.20 })

    // Act
    const [statuses, result] = applyStatus([], effect, 'hero_a', true)

    // Assert — buffs are not reduced on bosses
    expect(result).toBe('applied')
    expect(statuses[0].effect.value).toBe(0.20)
  })

  it('test_status_boss_dotNotReducedByStatModifyRule', () => {
    // Arrange — DoT is debuff but not stat_modify type
    const effect = makeEffect({
      id: 'poison',
      category: 'debuff',
      effectType: StatusEffectType.Dot,
      value: 5,
    })

    // Act
    const [statuses, result] = applyStatus([], effect, 'hero_a', true)

    // Assert — DoT not reduced by stat_modify boss resistance
    expect(result).toBe('applied')
    expect(statuses[0].effect.value).toBe(5)
  })

})

// ===========================================================================
// removeStatus
// ===========================================================================

describe('removeStatus', () => {

  it('test_status_remove_existingStatus_removed', () => {
    // Arrange
    const [statuses] = applyStatus([], STATUS_EFFECTS['poison'], 'hero_a')

    // Act
    const result = removeStatus(statuses, 'poison')

    // Assert
    expect(result).toHaveLength(0)
  })

  it('test_status_remove_nonexistentId_noChange', () => {
    // Arrange
    const [statuses] = applyStatus([], STATUS_EFFECTS['poison'], 'hero_a')

    // Act
    const result = removeStatus(statuses, 'nonexistent')

    // Assert
    expect(result).toHaveLength(1)
  })

  it('test_status_remove_doesNotMutateOriginal', () => {
    // Arrange
    const [statuses] = applyStatus([], STATUS_EFFECTS['poison'], 'hero_a')

    // Act
    removeStatus(statuses, 'poison')

    // Assert — original unchanged
    expect(statuses).toHaveLength(1)
  })

})

// ===========================================================================
// tickStatuses — duration and expiry
// ===========================================================================

describe('tickStatuses — duration', () => {

  it('test_status_tick_decrementsDuration', () => {
    // Arrange
    const effect = makeEffect({ id: 'atk_up', duration: 3 })
    const statuses = [makeApplied(effect, 3)]

    // Act
    const [remaining] = tickStatuses(statuses, 100, 200)

    // Assert
    expect(remaining).toHaveLength(1)
    expect(remaining[0].remainingDuration).toBe(2)
  })

  it('test_status_tick_expiresAtZero', () => {
    // Arrange
    const effect = makeEffect({ id: 'atk_up', duration: 1 })
    const statuses = [makeApplied(effect, 1)]

    // Act
    const [remaining, result] = tickStatuses(statuses, 100, 200)

    // Assert
    expect(remaining).toHaveLength(0)
    expect(result.expired).toContain('atk_up')
  })

  it('test_status_tick_multipleStatusesMixed', () => {
    // Arrange — one expires, one stays
    const expiring = makeApplied(makeEffect({ id: 'atk_up', duration: 1 }), 1)
    const staying = makeApplied(makeEffect({ id: 'def_up', duration: 3 }), 3)

    // Act
    const [remaining, result] = tickStatuses([expiring, staying], 100, 200)

    // Assert
    expect(remaining).toHaveLength(1)
    expect(remaining[0].effect.id).toBe('def_up')
    expect(result.expired).toEqual(['atk_up'])
  })

})

// ===========================================================================
// tickStatuses — DoT damage
// ===========================================================================

describe('tickStatuses — DoT', () => {

  it('test_status_tick_poisonDealsDamage', () => {
    // Arrange
    const poison = makeApplied({
      ...STATUS_EFFECTS['poison'],
    }, 3)

    // Act
    const [, result] = tickStatuses([poison], 100, 200)

    // Assert
    expect(result.damage).toBe(5)
  })

  it('test_status_tick_burnDealsDamage', () => {
    // Arrange
    const burn = makeApplied({ ...STATUS_EFFECTS['burn'] }, 3)

    // Act
    const [, result] = tickStatuses([burn], 100, 200)

    // Assert
    expect(result.damage).toBe(5)
  })

  it('test_status_tick_poisonAndBurnStackDamage', () => {
    // Arrange — poison (5) + burn (5)
    const poison = makeApplied({ ...STATUS_EFFECTS['poison'] }, 3)
    const burn = makeApplied({ ...STATUS_EFFECTS['burn'] }, 3)

    // Act
    const [, result] = tickStatuses([poison, burn], 100, 200)

    // Assert
    expect(result.damage).toBe(10)
  })

  it('test_status_tick_dotMinimumDamageIs1', () => {
    // Arrange — 0-value poison
    const zeroDot = makeApplied(
      makeEffect({ id: 'poison', effectType: StatusEffectType.Dot, value: 0, duration: 3 }),
      3,
    )

    // Act
    const [, result] = tickStatuses([zeroDot], 100, 200)

    // Assert — minimum 1 damage
    expect(result.damage).toBe(1)
  })

})

// ===========================================================================
// tickStatuses — HoT healing
// ===========================================================================

describe('tickStatuses — HoT', () => {

  it('test_status_tick_regenHeals', () => {
    // Arrange — regen 8 HP, missing 50 HP
    const regen = makeApplied({ ...STATUS_EFFECTS['regen'] }, 3)

    // Act
    const [, result] = tickStatuses([regen], 150, 200)

    // Assert
    expect(result.healing).toBe(8)
  })

  it('test_status_tick_regenCappedAtMissingHP', () => {
    // Arrange — regen 8 HP but only 3 HP missing
    const regen = makeApplied({ ...STATUS_EFFECTS['regen'] }, 3)

    // Act
    const [, result] = tickStatuses([regen], 197, 200)

    // Assert — should cap at 3 (missing HP)
    expect(result.healing).toBe(3)
  })

  it('test_status_tick_regenZeroWhenFull', () => {
    // Arrange — already at full HP
    const regen = makeApplied({ ...STATUS_EFFECTS['regen'] }, 3)

    // Act
    const [, result] = tickStatuses([regen], 200, 200)

    // Assert
    expect(result.healing).toBe(0)
  })

  it('test_status_tick_burnReducesRegen', () => {
    // Arrange — regen 8 + burn active → healing halved
    const regen = makeApplied({ ...STATUS_EFFECTS['regen'] }, 3)
    const burn = makeApplied({ ...STATUS_EFFECTS['burn'] }, 3)

    // Act
    const [, result] = tickStatuses([regen, burn], 100, 200)

    // Assert — healing = 8 * 0.5 = 4
    expect(result.healing).toBe(4)
    // Also takes burn damage
    expect(result.damage).toBe(5)
  })

})

// ===========================================================================
// getStatusModifier
// ===========================================================================

describe('getStatusModifier', () => {

  it('test_status_modifier_singleBuff_positiveValue', () => {
    // Arrange
    const statuses = [makeApplied(STATUS_EFFECTS['atk_up'], 3)]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert — STR gets +0.15
    expect(mod[StatType.STR]).toBeCloseTo(0.15)
    expect(mod[StatType.DEF]).toBe(0)
  })

  it('test_status_modifier_singleDebuff_negativeValue', () => {
    // Arrange
    const statuses = [makeApplied(STATUS_EFFECTS['atk_down'], 3)]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert — STR gets -0.15
    expect(mod[StatType.STR]).toBeCloseTo(-0.15)
  })

  it('test_status_modifier_buffAndDebuffSameStat_netResult', () => {
    // Arrange — atk_up (+0.15 STR) and atk_down (-0.15 STR)
    const statuses = [
      makeApplied(STATUS_EFFECTS['atk_up'], 3),
      makeApplied(STATUS_EFFECTS['atk_down'], 3),
    ]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert — net 0
    expect(mod[StatType.STR]).toBeCloseTo(0)
  })

  it('test_status_modifier_clampedToMin', () => {
    // Arrange — massive debuff
    const bigDebuff = makeEffect({ id: 'atk_down', category: 'debuff', value: 0.80, stat: StatType.STR })
    const statuses = [makeApplied(bigDebuff, 3)]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert — clamped to STATUS_MODIFIER_MIN
    expect(mod[StatType.STR]).toBe(STATUS_MODIFIER_MIN)
  })

  it('test_status_modifier_clampedToMax', () => {
    // Arrange — massive buff
    const bigBuff = makeEffect({ id: 'atk_up', category: 'buff', value: 1.50, stat: StatType.STR })
    const statuses = [makeApplied(bigBuff, 3)]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert — clamped to STATUS_MODIFIER_MAX
    expect(mod[StatType.STR]).toBe(STATUS_MODIFIER_MAX)
  })

  it('test_status_modifier_multipleStatsCombine', () => {
    // Arrange — def_up (+0.15 DEF) + spd_down (-0.15 SPD)
    const statuses = [
      makeApplied(STATUS_EFFECTS['def_up'], 3),
      makeApplied(STATUS_EFFECTS['spd_down'], 3),
    ]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert
    expect(mod[StatType.DEF]).toBeCloseTo(0.15)
    expect(mod[StatType.SPD]).toBeCloseTo(-0.15)
    expect(mod[StatType.STR]).toBe(0)
  })

  it('test_status_modifier_dotIgnored', () => {
    // Arrange — poison is a DoT, should not affect stat modifiers
    const statuses = [makeApplied(STATUS_EFFECTS['poison'], 3)]

    // Act
    const mod = getStatusModifier(statuses)

    // Assert — all zero
    for (const stat of Object.values(StatType)) {
      expect(mod[stat]).toBe(0)
    }
  })

  it('test_status_modifier_emptyStatuses_allZero', () => {
    // Act
    const mod = getStatusModifier([])

    // Assert
    for (const stat of Object.values(StatType)) {
      expect(mod[stat]).toBe(0)
    }
  })

})

// ===========================================================================
// isControlled
// ===========================================================================

describe('isControlled', () => {

  it('test_status_control_none_whenNoControlStatuses', () => {
    // Arrange
    const statuses = [makeApplied(STATUS_EFFECTS['poison'], 3)]

    // Assert
    expect(isControlled(statuses)).toBe('none')
  })

  it('test_status_control_stunned_whenStunActive', () => {
    // Arrange
    const stun: StatusEffect = {
      id: 'stun',
      name: '眩晕',
      category: 'debuff',
      effectType: StatusEffectType.Control,
      controlType: 'stun',
      value: 0,
      duration: 1,
    }
    const statuses = [makeApplied(stun, 1)]

    // Assert
    expect(isControlled(statuses)).toBe('stunned')
  })

  it('test_status_control_silenced_whenSilenceActive', () => {
    // Arrange
    const silence: StatusEffect = {
      id: 'silence',
      name: '沉默',
      category: 'debuff',
      effectType: StatusEffectType.Control,
      controlType: 'silence',
      value: 0,
      duration: 2,
    }
    const statuses = [makeApplied(silence, 2)]

    // Assert
    expect(isControlled(statuses)).toBe('silenced')
  })

  it('test_status_control_stunPriority_whenBothStunAndSilence', () => {
    // Arrange — stun takes priority per GDD
    const stun: StatusEffect = {
      id: 'stun',
      name: '眩晕',
      category: 'debuff',
      effectType: StatusEffectType.Control,
      controlType: 'stun',
      value: 0,
      duration: 1,
    }
    const silence: StatusEffect = {
      id: 'silence',
      name: '沉默',
      category: 'debuff',
      effectType: StatusEffectType.Control,
      controlType: 'silence',
      value: 0,
      duration: 2,
    }
    const statuses = [makeApplied(silence, 2), makeApplied(stun, 1)]

    // Assert — stun takes priority
    expect(isControlled(statuses)).toBe('stunned')
  })

  it('test_status_control_none_whenEmpty', () => {
    expect(isControlled([])).toBe('none')
  })

})

// ===========================================================================
// clearAllStatuses
// ===========================================================================

describe('clearAllStatuses', () => {

  it('test_status_clearAll_returnsEmptyArray', () => {
    expect(clearAllStatuses()).toEqual([])
    expect(clearAllStatuses()).toHaveLength(0)
  })

})

// ===========================================================================
// Config validation
// ===========================================================================

describe('Status config', () => {

  it('test_status_config_mvpEffectsAre9', () => {
    expect(Object.keys(STATUS_EFFECTS)).toHaveLength(9)
  })

  it('test_status_config_allEffectsHavePositiveValue', () => {
    for (const effect of Object.values(STATUS_EFFECTS)) {
      expect(effect.value).toBeGreaterThan(0)
    }
  })

  it('test_status_config_allEffectsHavePositiveDuration', () => {
    for (const effect of Object.values(STATUS_EFFECTS)) {
      expect(effect.duration).toBeGreaterThan(0)
    }
  })

  it('test_status_config_statModifyEffectsHaveStat', () => {
    for (const effect of Object.values(STATUS_EFFECTS)) {
      if (effect.effectType === StatusEffectType.StatModify) {
        expect(effect.stat).toBeDefined()
      }
    }
  })

  it('test_status_config_modifierMinLessThanMax', () => {
    expect(STATUS_MODIFIER_MIN).toBeLessThan(STATUS_MODIFIER_MAX)
  })

  it('test_status_config_bossReductionBetween0And1', () => {
    expect(BOSS_DEBUFF_REDUCTION).toBeGreaterThan(0)
    expect(BOSS_DEBUFF_REDUCTION).toBeLessThanOrEqual(1)
  })

  it('test_status_config_burnHealReductionBetween0And1', () => {
    expect(BURN_HEAL_REDUCTION).toBeGreaterThan(0)
    expect(BURN_HEAL_REDUCTION).toBeLessThanOrEqual(1)
  })

})
