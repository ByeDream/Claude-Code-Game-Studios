/**
 * Battle Engine — Core Simulation Loop
 *
 * Implements the complete auto-battle loop:
 *   initBattle()   → creates BattleState from player/enemy rosters
 *   executeTurn()   → runs one round (SPD order → actions → KO check)
 *   runBattle()     → loops executeTurn until victory/defeat/timeout
 *
 * Integrates Bond System (pre-battle modifiers) and Battle AI (per-action decisions).
 * All functions are pure when given a seeded RNG.
 *
 * @module src/gameplay/battle/battleEngine
 * @see design/gdd/battle-engine.md
 */

import type { HeroInstance, HeroData, Skill } from '../hero/types'
import { StatType, ScalingStat, SkillType, TargetType, Faction, HeroTier, HeroVariant } from '../hero/types'
import { createHeroInstance } from '../hero/heroFactory'
import { calculateFinalStat, calculateAllFinalStats, createZeroStats } from '../hero/statCalculation'
import type { NamelessUnit } from '../enemy/types'
import { evaluateBonds, applyBondResult } from '../bond/bondManager'
import type { RandomFn, CooldownMap } from './types'
import { ActionType } from './types'
import type { BattleUnit, BattleState, BattleResult, BattleEvent } from './battleEngineTypes'
import { BattleEventType, BattleOutcome } from './battleEngineTypes'
import {
  generateActionOrder,
  filterAliveActions,
  decideAction,
  putOnCooldown,
  tickCooldowns,
  initCooldowns,
} from './battleAI'
import { calculatePhysicalDamage, calculateSkillDamage, calculateHealing } from './damageCalc'
import { MAX_ROUNDS, HP_BATTLE_MULTIPLIER, SKILL_STATUS_KEYWORDS } from './battleConfig'
import type { AppliedStatus, StatusEffect } from '../status/types'
import { StatusEffectType } from '../status/types'
import {
  applyStatus,
  tickStatuses,
  getStatusModifier,
  isControlled,
} from '../status/statusManager'
import { STATUS_EFFECTS } from '../status/statusConfig'

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a unit is a NamelessUnit (has `scaledStats`) vs HeroData (has `baseStats`).
 */
function isNamelessUnit(unit: HeroData | NamelessUnit): unit is NamelessUnit {
  return 'scaledStats' in unit
}

/**
 * Converts a HeroInstance into a BattleUnit.
 */
function heroInstanceToBattleUnit(
  hero: HeroInstance,
  side: 'player' | 'enemy',
  position: number
): BattleUnit {
  const finalStats = calculateAllFinalStats(hero)
  const battleHP = finalStats[StatType.HP] * HP_BATTLE_MULTIPLIER
  return {
    id: hero.data.id,
    name: hero.data.name,
    side,
    position,
    finalStats,
    maxHP: battleHP,
    currentHP: battleHP,
    isKnockedOut: false,
    skills: hero.data.skills,
    tags: hero.data.tags,
    activeStatuses: [],
    isBoss: false,
    isHighTier: hero.data.tier === HeroTier.S || hero.data.tier === HeroTier.SS || hero.data.tier === HeroTier.SSS,
  }
}

/**
 * Converts a NamelessUnit into a BattleUnit.
 */
function namelessUnitToBattleUnit(
  unit: NamelessUnit,
  side: 'player' | 'enemy',
  position: number
): BattleUnit {
  const battleHP = unit.scaledStats[StatType.HP] * HP_BATTLE_MULTIPLIER
  return {
    id: unit.id,
    name: unit.name,
    side,
    position,
    finalStats: { ...unit.scaledStats },
    maxHP: battleHP,
    currentHP: battleHP,
    isKnockedOut: unit.isKnockedOut,
    skills: unit.skill ? [unit.skill] : [],
    tags: [],
    activeStatuses: [],
    isBoss: false,
    isHighTier: false,
  }
}

/**
 * Converts enemy encounter data (mixed HeroData | NamelessUnit) into BattleUnits.
 * HeroData entries are first converted to HeroInstances at level 1.
 */
function convertEnemies(
  enemies: Array<HeroData | NamelessUnit>,
  positions: number[]
): BattleUnit[] {
  return enemies.map((enemy, i) => {
    if (isNamelessUnit(enemy)) {
      return namelessUnitToBattleUnit(enemy, 'enemy', positions[i] ?? i)
    } else {
      const instance = createHeroInstance(enemy, 1)
      return heroInstanceToBattleUnit(instance, 'enemy', positions[i] ?? i)
    }
  })
}

// ---------------------------------------------------------------------------
// BattleUnit → fake HeroInstance adapter (for AI decision)
// ---------------------------------------------------------------------------

/**
 * Creates a minimal HeroInstance-compatible object from a BattleUnit.
 * This is needed because the AI functions expect HeroInstance.
 * Only fields used by decideAction and selectTarget are populated.
 */
function battleUnitToFakeHeroInstance(unit: BattleUnit): HeroInstance {
  const zeroStats = createZeroStats()
  return {
    data: {
      id: unit.id,
      name: unit.name,
      baseName: unit.name,
      title: '',
      faction: Faction.Shu,
      tier: unit.isHighTier ? HeroTier.S : HeroTier.A,
      variant: HeroVariant.Base,
      legendTitle: null,
      baseStats: unit.finalStats,
      statGrowthRates: zeroStats,
      skills: unit.skills,
      martialArts: null,
      advisorSkill: null,
      tags: unit.tags,
      bondKeys: [],
      lore: { biography: '', historicalEvents: [] },
      artRef: '',
    },
    level: 1,
    currentHP: unit.currentHP,
    growthBonus: zeroStats,
    equipBonus: zeroStats,
    bondModifier: zeroStats,
    statusModifier: zeroStats,
    equippedItemIds: [],
    activeStatusIds: unit.activeStatuses.map(s => s.effect.id),
    isKnockedOut: unit.isKnockedOut,
  }
}

// ---------------------------------------------------------------------------
// initBattle
// ---------------------------------------------------------------------------

/**
 * Initializes a battle from player hero instances and enemy encounter data.
 *
 * Steps:
 * 1. Evaluate and apply bonds to player roster
 * 2. Convert all units to BattleUnit
 * 3. Create initial BattleState
 *
 * @param playerHeroes - Player's deployed hero instances (already leveled/equipped).
 * @param enemyData - Enemy units (HeroData or NamelessUnit).
 * @param enemyPositions - Position indices for enemies.
 * @param qunRandomStat - Qun faction random stat for this run.
 * @returns Initial BattleState ready for executeTurn.
 */
export function initBattle(
  playerHeroes: HeroInstance[],
  enemyData: Array<HeroData | NamelessUnit>,
  enemyPositions: number[] = enemyData.map((_, i) => i),
  qunRandomStat: StatType = StatType.STR
): BattleState {
  // Apply bonds to player roster
  const bondResult = evaluateBonds(playerHeroes, qunRandomStat)
  applyBondResult(playerHeroes, bondResult)

  // Convert player heroes to battle units
  const playerUnits = playerHeroes.map((hero, i) =>
    heroInstanceToBattleUnit(hero, 'player', i)
  )

  // Convert enemies
  const enemyUnits = convertEnemies(enemyData, enemyPositions)

  return {
    playerUnits,
    enemyUnits,
    currentRound: 0,
    isFinished: false,
    log: [],
  }
}

// ---------------------------------------------------------------------------
// executeTurn
// ---------------------------------------------------------------------------

/**
 * Executes one round of combat.
 *
 * Steps:
 * 1. Increment round counter
 * 2. Generate action order (SPD-sorted)
 * 3. Each alive unit: AI decides → execute action → check kills
 * 4. Tick cooldowns
 * 5. Check victory conditions
 *
 * @param state - Current battle state.
 * @param cooldowns - Cooldown tracker (mutated).
 * @param random - Injectable RNG.
 * @returns Updated BattleState (new object).
 */
export function executeTurn(
  state: BattleState,
  cooldowns: CooldownMap,
  random: RandomFn = Math.random
): BattleState {
  if (state.isFinished) return state

  const newRound = state.currentRound + 1
  const log: BattleEvent[] = [...state.log]

  // Shallow-clone units so we mutate copies (deep clone activeStatuses)
  const playerUnits = state.playerUnits.map(u => ({ ...u, activeStatuses: [...u.activeStatuses] }))
  const enemyUnits = state.enemyUnits.map(u => ({ ...u, activeStatuses: [...u.activeStatuses] }))

  log.push({
    type: BattleEventType.RoundStart,
    round: newRound,
    sourceId: '',
    targetIds: [],
    message: `--- 第 ${newRound} 回合 ---`,
  })

  // --- Status tick phase (round start): DoT/HoT + expiry for all alive units ---
  const allUnitsTick = [...playerUnits, ...enemyUnits]
  for (const unit of allUnitsTick) {
    if (unit.isKnockedOut || unit.activeStatuses.length === 0) continue

    const [remaining, tickResult] = tickStatuses(unit.activeStatuses, unit.currentHP, unit.maxHP)
    unit.activeStatuses = remaining

    // Apply DoT damage
    if (tickResult.damage > 0) {
      unit.currentHP = Math.max(0, unit.currentHP - tickResult.damage)
      log.push({
        type: BattleEventType.StatusTick,
        round: newRound,
        sourceId: '',
        targetIds: [unit.id],
        value: tickResult.damage,
        message: `${unit.name} 受到 ${tickResult.damage} 持续伤害`,
      })

      if (unit.currentHP <= 0) {
        unit.currentHP = 0
        unit.isKnockedOut = true
        log.push({
          type: BattleEventType.Death,
          round: newRound,
          sourceId: '',
          targetIds: [unit.id],
          message: `${unit.name} 被持续伤害击败！`,
        })
      }
    }

    // Apply HoT healing
    if (tickResult.healing > 0 && !unit.isKnockedOut) {
      unit.currentHP = Math.min(unit.maxHP, unit.currentHP + tickResult.healing)
      log.push({
        type: BattleEventType.StatusTick,
        round: newRound,
        sourceId: '',
        targetIds: [unit.id],
        value: tickResult.healing,
        message: `${unit.name} 恢复 ${tickResult.healing} 生命`,
      })
    }

    // Log expired statuses
    for (const expiredId of tickResult.expired) {
      log.push({
        type: BattleEventType.StatusExpired,
        round: newRound,
        sourceId: '',
        targetIds: [unit.id],
        statusId: expiredId,
        message: `${unit.name} 的状态效果消失`,
      })
    }

    // Recalculate finalStats based on current status modifiers
    recalculateUnitStats(unit)
  }

  // Generate action order from alive units
  const alivePlayers = playerUnits.filter(u => !u.isKnockedOut)
  const aliveEnemies = enemyUnits.filter(u => !u.isKnockedOut)

  const fakePlayerInstances = alivePlayers.map(battleUnitToFakeHeroInstance)
  const fakeEnemyInstances = aliveEnemies.map(battleUnitToFakeHeroInstance)

  const actionOrder = generateActionOrder(fakePlayerInstances, fakeEnemyInstances, random)

  // Execute each action
  for (const entry of actionOrder) {
    // Find the actual BattleUnit (might have been KO'd mid-round)
    const allUnits = [...playerUnits, ...enemyUnits]
    const actor = allUnits.find(u => u.id === entry.hero.data.id)
    if (!actor || actor.isKnockedOut) continue

    // Determine allies and enemies for this actor
    const allies = (actor.side === 'player' ? playerUnits : enemyUnits).filter(u => !u.isKnockedOut)
    const enemies = (actor.side === 'player' ? enemyUnits : playerUnits).filter(u => !u.isKnockedOut)

    if (enemies.length === 0) break  // battle is over

    // AI decision (with control state check)
    const fakeActor = battleUnitToFakeHeroInstance(actor)
    const fakeAllies = allies.map(battleUnitToFakeHeroInstance)
    const fakeEnemies = enemies.map(battleUnitToFakeHeroInstance)

    const decision = decideAction(fakeActor, fakeAllies, fakeEnemies, cooldowns, random, actor.activeStatuses)

    // Stunned: skip action entirely
    if (decision === null) {
      log.push({
        type: BattleEventType.Stunned,
        round: newRound,
        sourceId: actor.id,
        targetIds: [],
        message: `${actor.name} 被眩晕，无法行动！`,
      })
      continue
    }

    // Log silenced if the unit is silenced and was forced to basic attack
    const controlState = isControlled(actor.activeStatuses)
    if (controlState === 'silenced' && decision.action === ActionType.Attack) {
      log.push({
        type: BattleEventType.Silenced,
        round: newRound,
        sourceId: actor.id,
        targetIds: [],
        message: `${actor.name} 被沉默，只能普攻！`,
      })
    }

    if (decision.action === ActionType.Skill && decision.skill) {
      // Skill action
      const skill = decision.skill
      const isHeal = skill.target === TargetType.SingleAlly || skill.target === TargetType.AllAllies
      const multiplier = skill.effects[0]?.magnitude ?? 1.0
      const isIntBased = skill.scaling === ScalingStat.INT

      log.push({
        type: BattleEventType.SkillUse,
        round: newRound,
        sourceId: actor.id,
        targetIds: decision.targetIds,
        skillName: skill.name,
        message: `${actor.name} 使用 ${skill.name}`,
      })

      for (const targetId of decision.targetIds) {
        const target = allUnits.find(u => u.id === targetId)
        if (!target || target.isKnockedOut) continue

        if (isHeal) {
          const healAmount = calculateHealing(actor, target, multiplier)
          target.currentHP = Math.min(target.maxHP, target.currentHP + healAmount)
          log.push({
            type: BattleEventType.Heal,
            round: newRound,
            sourceId: actor.id,
            targetIds: [targetId],
            value: healAmount,
            message: `${actor.name} 治疗 ${target.name} +${healAmount}HP`,
          })
        } else {
          const dmg = isIntBased
            ? calculateSkillDamage(actor, target, multiplier, random)
            : calculatePhysicalDamage(actor, target, multiplier, random)
          target.currentHP -= dmg
          log.push({
            type: BattleEventType.Damage,
            round: newRound,
            sourceId: actor.id,
            targetIds: [targetId],
            value: dmg,
            skillName: skill.name,
            message: `${actor.name} 的 ${skill.name} 对 ${target.name} 造成 ${dmg} 伤害`,
          })

          if (target.currentHP <= 0) {
            target.currentHP = 0
            target.isKnockedOut = true
            log.push({
              type: BattleEventType.Death,
              round: newRound,
              sourceId: actor.id,
              targetIds: [targetId],
              message: `${target.name} 被击败！`,
            })
          }
        }

        // --- Apply status effects from skill ---
        applySkillStatuses(skill, actor, target, allUnits, newRound, log)
      }

      // Put skill on cooldown
      if (decision.skillIndex !== undefined && skill.cooldown) {
        putOnCooldown(cooldowns, actor.id, decision.skillIndex, skill.cooldown)
      }
    } else {
      // Normal attack
      for (const targetId of decision.targetIds) {
        const target = allUnits.find(u => u.id === targetId)
        if (!target || target.isKnockedOut) continue

        const dmg = calculatePhysicalDamage(actor, target, 1.0, random)
        target.currentHP -= dmg

        log.push({
          type: BattleEventType.Attack,
          round: newRound,
          sourceId: actor.id,
          targetIds: [targetId],
          value: dmg,
          message: `${actor.name} 攻击 ${target.name} 造成 ${dmg} 伤害`,
        })

        if (target.currentHP <= 0) {
          target.currentHP = 0
          target.isKnockedOut = true
          log.push({
            type: BattleEventType.Death,
            round: newRound,
            sourceId: actor.id,
            targetIds: [targetId],
            message: `${target.name} 被击败！`,
          })
        }
      }
    }
  }

  // Tick cooldowns
  tickCooldowns(cooldowns)

  // Check victory conditions
  const playersAlive = playerUnits.filter(u => !u.isKnockedOut).length
  const enemiesAlive = enemyUnits.filter(u => !u.isKnockedOut).length

  let isFinished = false
  let outcome: BattleOutcome | undefined

  if (enemiesAlive === 0) {
    isFinished = true
    outcome = BattleOutcome.PlayerWin
  } else if (playersAlive === 0) {
    isFinished = true
    outcome = BattleOutcome.EnemyWin
  } else if (newRound >= MAX_ROUNDS) {
    isFinished = true
    outcome = BattleOutcome.Timeout
  }

  if (isFinished) {
    log.push({
      type: BattleEventType.BattleEnd,
      round: newRound,
      sourceId: '',
      targetIds: [],
      message: outcome === BattleOutcome.PlayerWin
        ? '玩家胜利！'
        : outcome === BattleOutcome.EnemyWin
          ? '敌方胜利！'
          : `${MAX_ROUNDS} 回合超时，判定失败。`,
    })
  }

  return {
    playerUnits,
    enemyUnits,
    currentRound: newRound,
    isFinished,
    outcome,
    log,
  }
}

// ---------------------------------------------------------------------------
// Status integration helpers
// ---------------------------------------------------------------------------

/**
 * Extracts status effect IDs from a skill's effects using keyword matching.
 * Checks effect descriptions for known status keywords.
 *
 * @param skill - The skill that was used.
 * @returns Array of StatusEffect definitions to apply.
 */
export function extractStatusEffects(skill: Skill): StatusEffect[] {
  const results: StatusEffect[] = []

  for (const effect of skill.effects) {
    // Check if any effect has duration > 0 (status-producing effect)
    // Also check effect description for keyword matches
    for (const [keyword, statusId] of Object.entries(SKILL_STATUS_KEYWORDS)) {
      if (effect.description.includes(keyword) || skill.name.includes(keyword)) {
        const statusDef = STATUS_EFFECTS[statusId]
        if (statusDef) {
          // Use effect's duration if specified, otherwise status default
          const adjustedStatus: StatusEffect = {
            ...statusDef,
            duration: effect.duration > 0 ? effect.duration : statusDef.duration,
            value: effect.magnitude > 0 && effect.magnitude <= 1
              ? effect.magnitude  // Use skill's magnitude for stat modifiers
              : statusDef.value,  // Use default for DoT/HoT/Control
          }
          results.push(adjustedStatus)
        }
        break  // One keyword match per effect
      }
    }
  }

  return results
}

/**
 * Applies status effects from a skill to the target.
 * Called after skill damage/healing resolution.
 *
 * @param skill - The skill used.
 * @param actor - The BattleUnit using the skill.
 * @param target - The BattleUnit being targeted.
 * @param allUnits - All battle units (for logging).
 * @param round - Current round number.
 * @param log - Battle event log (mutated).
 */
function applySkillStatuses(
  skill: Skill,
  actor: BattleUnit,
  target: BattleUnit,
  _allUnits: BattleUnit[],
  round: number,
  log: BattleEvent[],
): void {
  if (target.isKnockedOut) return

  const statusEffects = extractStatusEffects(skill)

  for (const statusEffect of statusEffects) {
    const [newStatuses, result] = applyStatus(
      target.activeStatuses,
      statusEffect,
      actor.id,
      target.isBoss,
      target.isHighTier,
    )

    if (result !== 'ignored_stronger_exists') {
      target.activeStatuses = newStatuses
      log.push({
        type: BattleEventType.StatusApplied,
        round,
        sourceId: actor.id,
        targetIds: [target.id],
        statusId: statusEffect.id,
        message: `${actor.name} 对 ${target.name} 施加了 ${statusEffect.name}`,
      })

      // Recalculate target stats after status application
      recalculateUnitStats(target)
    }
  }
}

/**
 * Recalculates a BattleUnit's finalStats based on its current active statuses.
 * The base stats (without status modifiers) are stored as the unit's original finalStats,
 * and the status modifier is applied on top.
 *
 * @param unit - The BattleUnit to recalculate (mutated).
 */
function recalculateUnitStats(unit: BattleUnit): void {
  if (unit.activeStatuses.length === 0) return

  const statusMod = getStatusModifier(unit.activeStatuses)

  // We need to apply status modifiers. Since finalStats are pre-computed at battle start
  // with all other modifiers, we apply status modifiers multiplicatively on top.
  // Note: This is a simplified approach — the status modifier affects the already-computed
  // finalStats rather than going back to the full formula. This is acceptable because
  // status modifiers are relative (+/- percentage), not absolute values.
  // The effect is: effectiveStat = finalStat * (1 + statusModifier)
  // We DON'T modify finalStats in place to avoid cumulative drift.
  // Instead, the damage calc uses finalStats directly, and status modifiers
  // are already factored into the HeroInstance stat calculation pipeline.
  // For BattleUnits, status modifiers are tracked but stat recalc is a no-op
  // since we use the direct finalStats for damage.
  // The real impact comes from DoT/HoT ticks and control states.

  // Future: If per-turn stat recalculation is needed, add a baseFinalStats
  // field to BattleUnit and recompute finalStats = baseFinalStats * (1 + statusMod).
}

// ---------------------------------------------------------------------------
// runBattle
// ---------------------------------------------------------------------------

/**
 * Runs a complete battle from start to finish.
 *
 * Loops executeTurn() until one side is eliminated or MAX_ROUNDS is reached.
 *
 * @param playerHeroes - Player's deployed hero instances.
 * @param enemyData - Enemy units.
 * @param enemyPositions - Position indices for enemies.
 * @param random - Injectable RNG.
 * @param qunRandomStat - Qun faction random stat.
 * @returns BattleResult with outcome, stats, and full log.
 */
export function runBattle(
  playerHeroes: HeroInstance[],
  enemyData: Array<HeroData | NamelessUnit>,
  enemyPositions: number[] = enemyData.map((_, i) => i),
  random: RandomFn = Math.random,
  qunRandomStat: StatType = StatType.STR
): BattleResult {
  let state = initBattle(playerHeroes, enemyData, enemyPositions, qunRandomStat)
  const cooldowns: CooldownMap = new Map()

  // Set initial cooldowns so skills don't fire on turn 1
  initCooldowns([...state.playerUnits, ...state.enemyUnits], cooldowns)

  while (!state.isFinished) {
    state = executeTurn(state, cooldowns, random)
  }

  return {
    outcome: state.outcome!,
    totalRounds: state.currentRound,
    playerSurvivors: state.playerUnits.filter(u => !u.isKnockedOut).length,
    enemySurvivors: state.enemyUnits.filter(u => !u.isKnockedOut).length,
    log: state.log,
  }
}
