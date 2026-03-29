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
import { MAX_ROUNDS, HP_BATTLE_MULTIPLIER } from './battleConfig'

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
      tier: HeroTier.A,
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
    activeStatusIds: [],
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

  // Shallow-clone units so we mutate copies
  const playerUnits = state.playerUnits.map(u => ({ ...u }))
  const enemyUnits = state.enemyUnits.map(u => ({ ...u }))

  log.push({
    type: BattleEventType.RoundStart,
    round: newRound,
    sourceId: '',
    targetIds: [],
    message: `--- 第 ${newRound} 回合 ---`,
  })

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

    // AI decision
    const fakeActor = battleUnitToFakeHeroInstance(actor)
    const fakeAllies = allies.map(battleUnitToFakeHeroInstance)
    const fakeEnemies = enemies.map(battleUnitToFakeHeroInstance)

    const decision = decideAction(fakeActor, fakeAllies, fakeEnemies, cooldowns, random)

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
