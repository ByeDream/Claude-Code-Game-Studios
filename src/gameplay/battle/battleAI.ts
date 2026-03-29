/**
 * Battle AI — Core Decision Logic
 *
 * Implements the AI decision loop for auto-battle:
 * 1. Target selection (random default + deterministic overrides)
 * 2. Skill release priority (heal > control > damage)
 * 3. SPD-based action ordering
 *
 * All functions are pure — no side effects, deterministic when given
 * a seeded RNG. Symmetric: same rules for player and enemy sides.
 *
 * @module src/gameplay/battle/battleAI
 * @see design/gdd/battle-ai.md
 */

import type { HeroInstance, Skill } from '../hero/types'
import { TargetType, StatType, SkillType } from '../hero/types'
import { calculateFinalStat } from '../hero/statCalculation'
import { isControlled as queryControlState } from '../status/statusManager'
import type { AppliedStatus } from '../status/types'
import type { AIDecision, ActionOrderEntry, CooldownMap, RandomFn } from './types'
import { TargetStrategy, SkillCategory, ActionType } from './types'
import { HEAL_THRESHOLD, SKILL_PRIORITY_OVER_ATTACK, INITIAL_SKILL_COOLDOWN } from './battleConfig'

// ---------------------------------------------------------------------------
// TargetType → TargetStrategy mapping
// ---------------------------------------------------------------------------

/**
 * Maps a skill's TargetType (from Hero System) to a TargetStrategy (for Battle AI).
 *
 * @param targetType - The skill's target type from hero data.
 * @returns The corresponding target selection strategy.
 */
export function mapTargetTypeToStrategy(targetType: TargetType): TargetStrategy {
  switch (targetType) {
    case TargetType.Self:         return TargetStrategy.Self
    case TargetType.SingleEnemy:  return TargetStrategy.Random  // single enemy = random pick
    case TargetType.AllEnemies:   return TargetStrategy.AllEnemies
    case TargetType.SingleAlly:   return TargetStrategy.LowestHpAlly
    case TargetType.AllAllies:    return TargetStrategy.AllAllies
    case TargetType.AoeArea:      return TargetStrategy.Random  // AOE area = random center
    default:                      return TargetStrategy.Random
  }
}

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

/**
 * Selects target(s) based on the given strategy.
 *
 * @param strategy - The target selection strategy.
 * @param self - The acting hero.
 * @param allies - All alive allies (including self).
 * @param enemies - All alive enemies.
 * @param random - Random number generator (injectable for testing).
 * @returns Array of target hero IDs.
 */
export function selectTarget(
  strategy: TargetStrategy,
  self: HeroInstance,
  allies: ReadonlyArray<HeroInstance>,
  enemies: ReadonlyArray<HeroInstance>,
  random: RandomFn = Math.random
): string[] {
  switch (strategy) {
    case TargetStrategy.Random:
      return [pickRandom(enemies, random)]

    case TargetStrategy.LowestHp:
      return [pickLowestHp(enemies)]

    case TargetStrategy.HighestThreat:
      return [pickHighestThreat(enemies)]

    case TargetStrategy.Self:
      return [self.data.id]

    case TargetStrategy.LowestHpAlly:
      return [pickLowestHp(allies)]

    case TargetStrategy.AllEnemies:
      return enemies.map(e => e.data.id)

    case TargetStrategy.AllAllies:
      return allies.map(a => a.data.id)

    default:
      return [pickRandom(enemies, random)]
  }
}

/**
 * Picks a random hero from a list and returns their ID.
 */
function pickRandom(heroes: ReadonlyArray<HeroInstance>, random: RandomFn): string {
  const index = Math.floor(random() * heroes.length)
  return heroes[index].data.id
}

/**
 * Picks the hero with the lowest current HP.
 * Ties broken by first occurrence (stable).
 */
function pickLowestHp(heroes: ReadonlyArray<HeroInstance>): string {
  let lowest = heroes[0]
  for (let i = 1; i < heroes.length; i++) {
    if (heroes[i].currentHP < lowest.currentHP) {
      lowest = heroes[i]
    }
  }
  return lowest.data.id
}

/**
 * Picks the hero with the highest threat (max of finalSTR and finalINT).
 * Ties broken by first occurrence (stable).
 */
function pickHighestThreat(heroes: ReadonlyArray<HeroInstance>): string {
  let highest = heroes[0]
  let highestThreat = getThreat(highest)
  for (let i = 1; i < heroes.length; i++) {
    const threat = getThreat(heroes[i])
    if (threat > highestThreat) {
      highest = heroes[i]
      highestThreat = threat
    }
  }
  return highest.data.id
}

/**
 * Threat value = max(finalSTR, finalINT).
 */
function getThreat(hero: HeroInstance): number {
  return Math.max(
    calculateFinalStat(hero, StatType.STR),
    calculateFinalStat(hero, StatType.INT)
  )
}

// ---------------------------------------------------------------------------
// Skill classification
// ---------------------------------------------------------------------------

/**
 * Classifies a skill into heal / control / damage category for AI priority.
 *
 * Heuristic:
 * - Heal: targets allies (SingleAlly / AllAllies) and effects have positive magnitude
 * - Control: targets enemies and effects have duration > 0 and magnitude ≤ 1
 * - Damage: everything else targeting enemies
 *
 * @param skill - The skill to classify.
 * @returns The skill's AI priority category.
 */
export function classifySkill(skill: Skill): SkillCategory {
  const isAllyTarget = skill.target === TargetType.SingleAlly || skill.target === TargetType.AllAllies
  if (isAllyTarget) {
    return SkillCategory.Heal
  }

  // Check if it's a control skill: has duration effects with magnitude ≤ 1
  const hasControlEffect = skill.effects.some(e => e.duration > 0 && e.magnitude <= 1.0)
  const hasDamageEffect = skill.effects.some(e => e.magnitude > 1.0)

  if (hasControlEffect && !hasDamageEffect) {
    return SkillCategory.Control
  }

  return SkillCategory.Damage
}

// ---------------------------------------------------------------------------
// Cooldown helpers
// ---------------------------------------------------------------------------

/**
 * Creates a cooldown key for a hero's skill.
 */
export function cooldownKey(heroId: string, skillIndex: number): string {
  return `${heroId}_${skillIndex}`
}

/**
 * Checks if a skill is off cooldown and ready to use.
 *
 * @param cooldowns - The current cooldown map.
 * @param heroId - Hero's data.id.
 * @param skillIndex - Index of the skill in hero's skills array.
 * @returns true if the skill is ready (cooldown 0 or not tracked).
 */
export function isSkillReady(cooldowns: CooldownMap, heroId: string, skillIndex: number): boolean {
  const key = cooldownKey(heroId, skillIndex)
  const remaining = cooldowns.get(key) ?? 0
  return remaining <= 0
}

/**
 * Puts a skill on cooldown after use.
 *
 * @param cooldowns - The cooldown map (mutated).
 * @param heroId - Hero's data.id.
 * @param skillIndex - Index of the skill.
 * @param cooldownTurns - How many turns until ready again.
 */
export function putOnCooldown(
  cooldowns: CooldownMap,
  heroId: string,
  skillIndex: number,
  cooldownTurns: number
): void {
  const key = cooldownKey(heroId, skillIndex)
  cooldowns.set(key, cooldownTurns)
}

/**
 * Ticks all cooldowns down by 1 (called at end of round).
 */
export function tickCooldowns(cooldowns: CooldownMap): void {
  for (const [key, value] of cooldowns) {
    if (value > 0) {
      cooldowns.set(key, value - 1)
    }
  }
}

// ---------------------------------------------------------------------------
// AI decision
// ---------------------------------------------------------------------------

/**
 * Determines the best action for a hero to take this turn.
 *
 * Decision priority (from GDD):
 * 1. If stunned → skip turn (return null action)
 * 2. If silenced → normal attack only (no skills)
 * 3. If an active skill is ready → use skill (priority: heal > control > damage)
 * 4. Otherwise → normal attack (random target)
 *
 * Heal skills are only used when an ally is below HEAL_THRESHOLD HP ratio.
 *
 * @param hero - The acting hero instance.
 * @param allies - All alive allies (including self).
 * @param enemies - All alive enemies.
 * @param cooldowns - Current cooldown state.
 * @param random - Injectable RNG.
 * @param activeStatuses - Active status effects on this hero (for control check).
 * @returns An AIDecision with action type, optional skill, and target IDs.
 *          Returns null if the unit is stunned and cannot act.
 *
 * @see design/gdd/battle-ai.md — AI Decision Loop
 * @see design/gdd/status-system.md — Control States
 */
export function decideAction(
  hero: HeroInstance,
  allies: ReadonlyArray<HeroInstance>,
  enemies: ReadonlyArray<HeroInstance>,
  cooldowns: CooldownMap,
  random: RandomFn = Math.random,
  activeStatuses: readonly AppliedStatus[] = [],
): AIDecision | null {
  if (enemies.length === 0) {
    // No enemies — shouldn't happen but defensive
    return { action: ActionType.Attack, targetIds: [] }
  }

  // Check control state from active statuses
  const controlState = queryControlState(activeStatuses)

  if (controlState === 'stunned') {
    // Stunned: cannot act at all
    return null
  }

  // Silenced: can only normal attack (skip skill check)
  if (controlState !== 'silenced' && SKILL_PRIORITY_OVER_ATTACK) {
    const skillDecision = tryUseSkill(hero, allies, enemies, cooldowns, random)
    if (skillDecision) {
      return skillDecision
    }
  }

  // Default: normal attack on a random enemy
  const targetIds = selectTarget(TargetStrategy.Random, hero, allies, enemies, random)
  return { action: ActionType.Attack, targetIds }
}

/**
 * Attempts to find the best skill to use, respecting priority ordering.
 *
 * @returns An AIDecision to use a skill, or null if no skill should be used.
 */
function tryUseSkill(
  hero: HeroInstance,
  allies: ReadonlyArray<HeroInstance>,
  enemies: ReadonlyArray<HeroInstance>,
  cooldowns: CooldownMap,
  random: RandomFn
): AIDecision | null {
  // Collect all active skills that are off cooldown
  const readySkills: Array<{ skill: Skill; index: number; category: SkillCategory }> = []

  for (let i = 0; i < hero.data.skills.length; i++) {
    const skill = hero.data.skills[i]
    // Only consider active skills (passives are handled separately)
    if (skill.type !== SkillType.Active) continue
    if (!isSkillReady(cooldowns, hero.data.id, i)) continue

    readySkills.push({
      skill,
      index: i,
      category: classifySkill(skill),
    })
  }

  if (readySkills.length === 0) return null

  // Sort by priority: Heal > Control > Damage
  const priorityOrder: Record<SkillCategory, number> = {
    [SkillCategory.Heal]: 0,
    [SkillCategory.Control]: 1,
    [SkillCategory.Damage]: 2,
  }
  readySkills.sort((a, b) => priorityOrder[a.category] - priorityOrder[b.category])

  // Try each skill in priority order
  for (const { skill, index, category } of readySkills) {
    // Heal: only use if someone needs healing
    if (category === SkillCategory.Heal) {
      const maxHpMap = getAllyMaxHpMap(allies)
      const needsHeal = allies.some(a => {
        const maxHp = maxHpMap.get(a.data.id) ?? a.currentHP
        return a.currentHP / maxHp < HEAL_THRESHOLD
      })
      if (!needsHeal) continue
    }

    // Determine target strategy from skill's TargetType
    const strategy = mapTargetTypeToStrategy(skill.target)
    const targetIds = selectTarget(strategy, hero, allies, enemies, random)

    if (targetIds.length > 0) {
      return {
        action: ActionType.Skill,
        skillIndex: index,
        skill,
        targetIds,
      }
    }
  }

  return null
}

/**
 * Builds a map of hero ID → max HP for heal threshold checks.
 * MaxHP is the hero's finalStat for HP.
 */
function getAllyMaxHpMap(allies: ReadonlyArray<HeroInstance>): Map<string, number> {
  const map = new Map<string, number>()
  for (const ally of allies) {
    map.set(ally.data.id, calculateFinalStat(ally, StatType.HP))
  }
  return map
}

// ---------------------------------------------------------------------------
// Action order generation
// ---------------------------------------------------------------------------

/**
 * Generates the action order for a round.
 *
 * All alive units from both sides are sorted by effective SPD (descending).
 * Ties are broken randomly (each round produces a fresh random tiebreaker).
 *
 * @param playerTeam - Alive player heroes.
 * @param enemyTeam - Alive enemy heroes.
 * @param random - Injectable RNG for tiebreaking.
 * @returns Sorted array of ActionOrderEntry (highest SPD first).
 *
 * @see design/gdd/battle-ai.md — Action Order formula
 */
export function generateActionOrder(
  playerTeam: ReadonlyArray<HeroInstance>,
  enemyTeam: ReadonlyArray<HeroInstance>,
  random: RandomFn = Math.random
): ActionOrderEntry[] {
  const entries: ActionOrderEntry[] = []

  for (const hero of playerTeam) {
    entries.push({
      hero,
      side: 'player',
      effectiveSPD: calculateFinalStat(hero, StatType.SPD),
      tiebreaker: random(),
    })
  }

  for (const hero of enemyTeam) {
    entries.push({
      hero,
      side: 'enemy',
      effectiveSPD: calculateFinalStat(hero, StatType.SPD),
      tiebreaker: random(),
    })
  }

  // Sort: highest SPD first. Ties broken by tiebreaker (higher = earlier).
  entries.sort((a, b) => {
    if (a.effectiveSPD !== b.effectiveSPD) {
      return b.effectiveSPD - a.effectiveSPD
    }
    return b.tiebreaker - a.tiebreaker
  })

  return entries
}

/**
 * Filters the action order to only include alive heroes.
 * Called during action execution to skip KO'd units.
 *
 * @param order - The original action order.
 * @returns Filtered entries where the hero is not knocked out.
 */
export function filterAliveActions(order: ReadonlyArray<ActionOrderEntry>): ActionOrderEntry[] {
  return order.filter(entry => !entry.hero.isKnockedOut)
}

// ---------------------------------------------------------------------------
// Initial cooldown setup
// ---------------------------------------------------------------------------

/**
 * Pre-fills cooldowns for all active skills on all battle units.
 * Prevents powerful skills from firing on turn 1.
 *
 * @param units - All battle units (player + enemy).
 * @param cooldowns - Cooldown map to populate (mutated).
 */
export function initCooldowns(
  units: ReadonlyArray<{ id: string; skills: ReadonlyArray<Skill> }>,
  cooldowns: CooldownMap,
): void {
  if (INITIAL_SKILL_COOLDOWN <= 0) return

  for (const unit of units) {
    for (let i = 0; i < unit.skills.length; i++) {
      const skill = unit.skills[i]
      if (skill.type === SkillType.Active && skill.cooldown && skill.cooldown > 0) {
        putOnCooldown(cooldowns, unit.id, i, INITIAL_SKILL_COOLDOWN)
      }
    }
  }
}
