# Battle System — Aggregate Reference (战斗系统聚合文档)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-04-01
> **Implements Pillar**: 构筑智慧 (站位和阵容验证), 养成爆发 (战斗中看到成长效果)
> **Note**: This is an aggregate reference for the complete implemented battle system.
> For the original design intent, see `design/gdd/battle-engine.md` and
> `design/gdd/battle-ai.md`. This document reflects the code in Sprint 1.

## Overview

战斗系统是煮酒的核心 30 秒循环。采用 5v5 回合制自动战斗：`initBattle()` 初始化双方阵容，`executeTurn()` 执行单回合（SPD 排序 → 行动 → 状态 tick），`runBattle()` 循环直到胜负判定或超时。伤害采用百分比减伤模型（物理/技能/治疗）；Battle AI 负责目标选择和技能优先级决策（heal > control > damage）；Status System 集成提供 DoT/HoT/控制效果。所有函数纯函数实现，注入 RNG，与 ADR-004 一致。

## Player Fantasy

**「运筹帷幄，决胜于战前。」**

战斗是你构筑决策的验证时刻——站位是否合理、阵容搭配是否精妙、装备分配是否得当，答案在 30 秒内揭晓。高 SPD 的武将率先出手，技能在 `INITIAL_SKILL_COOLDOWN` 回合后解锁，治疗 AI 会在友军濒死时优先出手。看着己方武将的成长值转化为实际战力优势，就是养成爆发的高光时刻。

## Detailed Rules

### 1. Entry Point: `runBattle()`

```typescript
runBattle(playerHeroes, enemyData, enemyPositions?, random?, qunRandomStat?) → BattleResult
```

完整战斗流程：

```
1. initBattle()        → BattleState
2. initCooldowns()     → 预填充初始冷却（防止第 1 回合群伤技能）
3. while (!state.isFinished):
       executeTurn()   → BattleState
4. return BattleResult { outcome, totalRounds, playerSurvivors, enemySurvivors, log }
```

### 2. `initBattle()` — 战斗初始化

```typescript
initBattle(playerHeroes, enemyData, enemyPositions?, qunRandomStat?) → BattleState
```

步骤：

1. **评估并应用羁绊**：`evaluateBonds(playerHeroes, qunRandomStat)` → `applyBondResult()`，将 `bondModifier` 写入每个 `HeroInstance`
2. **转换玩家单位**：`heroInstanceToBattleUnit()`，调用 `calculateAllFinalStats()` 计算最终属性，`maxHP = finalStats[HP] × HP_BATTLE_MULTIPLIER`
3. **转换敌方单位**：`HeroData` → `createHeroInstance(level=1)` → `heroInstanceToBattleUnit()`；`NamelessUnit`（含 `scaledStats`）→ `namelessUnitToBattleUnit()`
4. 返回初始 `BattleState { playerUnits, enemyUnits, currentRound: 0, isFinished: false, log: [] }`

### 3. `executeTurn()` — 单回合执行

```typescript
executeTurn(state, cooldowns, random?) → BattleState
```

每回合固定执行顺序：

```
1. currentRound++，推送 RoundStart 事件
2. Status Tick Phase（所有存活单位）:
       [remaining, tickResult] = tickStatuses(unit.activeStatuses, currentHP, maxHP)
       - 应用 DoT 伤害（poison/burn）→ 可能 KO
       - 应用 HoT 治疗（regen）
       - 推送过期状态事件
       - recalculateUnitStats()（当前实现为 no-op 占位符）
3. 生成行动顺序：generateActionOrder(alivePlayers, aliveEnemies, random)
       排序规则：effectiveSPD 降序；平局按 tiebreaker（random()）
4. 按顺序执行每个行动者的行动：
       a. 若已 KO → 跳过
       b. decideAction() → AIDecision | null
       c. null（眩晕）→ 推送 Stunned 事件，跳过
       d. ActionType.Skill → 执行技能（伤害/治疗）+ applySkillStatuses()
       e. ActionType.Attack → calculatePhysicalDamage(multiplier=1.0)
       f. 目标 HP ≤ 0 → KO，推送 Death 事件
       g. 技能放完 → putOnCooldown()
5. tickCooldowns()（所有冷却 -1）
6. 胜负判断：
       enemiesAlive == 0 → PlayerWin
       playersAlive == 0 → EnemyWin
       currentRound >= MAX_ROUNDS → Timeout（判玩家负）
```

### 4. AI Decision Logic (`decideAction()`)

```
优先级决策树：
1. controlState == 'stunned'  → return null（跳过回合）
2. controlState == 'silenced' → 跳过技能检查，直接普攻
3. SKILL_PRIORITY_OVER_ATTACK == true:
       tryUseSkill():
           收集所有 ready 的 Active 技能（isSkillReady(cooldowns, heroId, i)）
           按优先级排序：Heal(0) > Control(1) > Damage(2)
           Heal：仅当存在友军 currentHP/maxHP < HEAL_THRESHOLD(0.5) 时使用
           Control：always use if ready
           Damage：always use if ready
           返回第一个可用的技能决策
4. 默认：普攻随机存活敌人
```

**技能分类 (`classifySkill()`)** 规则：

| 分类 | 判断条件 |
|------|---------|
| `Heal` | `skill.target` 为 `SingleAlly` 或 `AllAllies` |
| `Control` | 有 `duration > 0 && magnitude ≤ 1.0` 的效果且无 `magnitude > 1.0` 的效果 |
| `Damage` | 其他情况 |

**目标选择策略 (`TargetType` → `TargetStrategy` 映射)**：

| TargetType | TargetStrategy | 实现 |
|-----------|---------------|------|
| `Self` | `Self` | 返回 `[self.data.id]` |
| `SingleEnemy` | `Random` | `pickRandom(enemies, random)` |
| `AllEnemies` | `AllEnemies` | `enemies.map(e => e.data.id)` |
| `SingleAlly` | `LowestHpAlly` | `pickLowestHp(allies)` |
| `AllAllies` | `AllAllies` | `allies.map(a => a.data.id)` |
| `AoeArea` | `Random` | 随机中心点（溅射由技能效果处理） |

### 5. Status Effect Integration

**触发**：技能伤害/治疗结算后，调用 `applySkillStatuses(skill, actor, target, ...)`。

**关键词匹配**：`extractStatusEffects(skill)` 遍历 `skill.effects`，对每个 effect 检查 `effect.description` 或 `skill.name` 是否包含 `SKILL_STATUS_KEYWORDS` 中的中文关键词（如 `'眩晕'` → `'stun'`），匹配后从 `STATUS_EFFECTS` 查找定义，合并 `duration`/`value`。详见 ADR-005。

**应用**：`applyStatus(target.activeStatuses, statusEffect, actorId, isBoss, isHighTier)` 处理 Boss/高阶单位抗性。

**Tick**（每回合开始）：`tickStatuses(activeStatuses, currentHP, maxHP)` 返回 `[remaining, tickResult]`，包含本回合的 DoT 伤害、HoT 治疗和已过期状态 ID 列表。

### 6. Cooldown System

- `initCooldowns(units, cooldowns)`：战斗开始时为所有 Active 技能预填充 `INITIAL_SKILL_COOLDOWN = 2` 的冷却，防止第 1-2 回合群伤技能直接清场
- `putOnCooldown(cooldowns, heroId, skillIndex, skill.cooldown)`：技能使用后设置冷却
- `tickCooldowns(cooldowns)`：每回合结束全部冷却 -1
- `isSkillReady(cooldowns, heroId, skillIndex)`：判断技能是否可用（冷却值 ≤ 0）
- `cooldownKey = "${heroId}_${skillIndex}"`

### 7. Unit Abstraction (`BattleUnit`)

`BattleUnit` 统一了 `HeroInstance` 和 `NamelessUnit` 两种输入格式：

| 字段 | 来源（HeroInstance） | 来源（NamelessUnit） |
|------|-------------------|-------------------|
| `finalStats` | `calculateAllFinalStats(hero)` | `unit.scaledStats` |
| `maxHP` | `finalStats[HP] × HP_BATTLE_MULTIPLIER` | `scaledStats[HP] × HP_BATTLE_MULTIPLIER` |
| `skills` | `hero.data.skills` | `[unit.skill]` 或 `[]` |
| `isBoss` | 始终 `false`（由战斗上下文决定） | 始终 `false` |
| `isHighTier` | `tier` 为 S/SS/SSS | 始终 `false` |

`battleUnitToFakeHeroInstance()` 将 `BattleUnit` 包装为最小兼容的 `HeroInstance`，供 AI 函数复用（AI 接受 `HeroInstance` 参数）。

### 8. Battle Event Log

每个 `executeTurn()` 调用追加 `BattleEvent[]` 到 `state.log`，供 UI 渲染和回放：

| 事件类型 | 触发时机 |
|---------|---------|
| `RoundStart` | 每回合开始 |
| `StatusTick` | DoT 伤害 / HoT 治疗 |
| `StatusExpired` | 状态效果到期 |
| `Stunned` | 被眩晕单位的行动被跳过 |
| `Silenced` | 被沉默单位被迫普攻 |
| `SkillUse` | 技能使用（含技能名） |
| `Damage` | 技能伤害结算 |
| `Heal` | 治疗结算 |
| `Attack` | 普攻伤害结算 |
| `Death` | 单位 KO |
| `StatusApplied` | 状态施加成功 |
| `BattleEnd` | 战斗结束（含结局文本） |

## Formulas

### Physical Damage (物理伤害)

```
physicalDamage = max(MIN_DAMAGE, round(
    attackerSTR × skillMultiplier × (100 / (100 + targetDEF)) × variance
))
variance = uniform(RANDOM_VARIANCE_MIN, RANDOM_VARIANCE_MAX)
```

### Skill Damage (技能伤害，INT scaling)

```
skillDamage = max(MIN_DAMAGE, round(
    attackerINT × skillMultiplier × (100 / (100 + targetDEF × INT_DEF_RATIO)) × variance
))
```

### Healing (治疗)

```
healAmount = min(round(healerINT × healMultiplier), max(0, target.maxHP - target.currentHP))
```

### Critical Hit (暴击)

```
if (random() < critChance):
    finalDamage = round(damage × CRIT_MULTIPLIER)
critChance = 0 + equipment/skill bonuses  // 基础 0
```

### Battle HP (战斗 HP 缩放)

```
battleMaxHP = finalStats[HP] × HP_BATTLE_MULTIPLIER
```

### Action Order (行动顺序)

```
actionOrder = sort(allAliveUnits, by: effectiveSPD DESC, tiebreaker: random() DESC)
effectiveSPD = calculateFinalStat(hero, StatType.SPD)
```

### Variable Reference

| Variable | Value | Safe Range | Description |
|----------|-------|-----------|-------------|
| `MIN_DAMAGE` | 1 | 1 | 最低伤害保底 |
| `INT_DEF_RATIO` | 0.5 | 0.3–0.8 | INT 技能受 DEF 减免的比率（越低穿透越强） |
| `RANDOM_VARIANCE_MIN` | 0.95 | 0.9–1.0 | 伤害随机下界 |
| `RANDOM_VARIANCE_MAX` | 1.05 | 1.0–1.1 | 伤害随机上界 |
| `CRIT_MULTIPLIER` | 1.5 | 1.3–2.0 | 暴击伤害倍率 |
| `HP_BATTLE_MULTIPLIER` | 10 | 6–15 | 战斗 HP 缩放倍率（目标：4-8 回合打完） |
| `MAX_ROUNDS` | 30 | 20–50 | 超时回合数上限 |
| `HEAL_THRESHOLD` | 0.5 | 0.3–0.7 | 触发治疗 AI 的友军 HP 比例阈值 |
| `INITIAL_SKILL_COOLDOWN` | 2 | 0–4 | 战斗开始时技能初始冷却回合数 |
| `CHAIN_KILL_LIMIT` | 3 | 2–5 | 单回合最大连锁击杀次数 |
| `SKILL_PRIORITY_OVER_ATTACK` | `true` | — | 技能优先于普攻 |
| `CONTROL_AVOID_OVERLAP` | `true` | — | 避免对已受控目标叠加控制（当前为配置项，实现中尚未全面应用） |

## Edge Cases

| 情景 | 行为 | 原因 |
|------|------|------|
| 伤害计算结果 < 1 | 保底 1 点伤害 | 防止完全免伤 |
| 治疗超过 maxHP | Clamp 到 maxHP（通过 missingHP 限制） | 不允许超量治疗 |
| 武将在自己回合前被 DoT KO | `isKnockedOut` 检查跳过该武将行动 | 死人不行动 |
| 眩晕单位 | `decideAction()` 返回 `null`，整个行动跳过 | 符合眩晕控制语义 |
| 沉默单位 | 跳过技能检查，强制普攻 | 符合沉默控制语义 |
| 所有 SPD 相同 | `tiebreaker = random()` 决定顺序 | 随机但确定性（seeded） |
| 技能命中已 KO 目标 | 检查 `target.isKnockedOut` 跳过 | 目标可能在同技能多目标中被前一个目标击杀 |
| `INITIAL_SKILL_COOLDOWN = 0` | `initCooldowns()` 为 no-op，技能第 1 回合可用 | 通过配置控制 |
| `extractStatusEffects()` 多关键词匹配 | 每个 effect 只匹配一个关键词（`break` 后退出内层循环）| 防止单 effect 产生多个状态 |
| Boss/高阶单位受状态影响 | `applyStatus()` 通过 `isBoss`/`isHighTier` 参数处理抗性 | 见 Status System |
| `recalculateUnitStats()` 当前为 no-op | DoT/HoT 和控制效果已生效；属性重算待 Phase 2 实现 | 已记录为 tech debt |
| 超时 30 回合 | `outcome = Timeout`，判玩家负 | 防止无限对战僵局 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | Battle 读取 | `calculateAllFinalStats()`, `HeroInstance`, `HeroData`, `Skill`, `StatType` | Hard |
| Bond System | Battle 调用 | `evaluateBonds()`, `applyBondResult()` 在 `initBattle` 时执行 | Hard |
| Status System | Battle ↔ Status | `applyStatus()`, `tickStatuses()`, `isControlled()`, `getStatusModifier()` | Hard |
| Enemy System | Enemy → Battle | `NamelessUnit` (含 `scaledStats`) 输入格式 | Hard |
| Equipment System | Battle 读取（间接） | 装备加成已通过 `calculateAllFinalStats()` 合并进 `finalStats` | Soft |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Run Manager | Run 调用 Battle | `runBattle()` 是 `resolveBattleNode()` 的核心 | Hard |
| Battle UI | UI 消费 `BattleEvent[]` | 渲染动画、伤害数字、技能特效 | Hard |
| Balance Report | 测试工具调用 `runBattle()` | 使用 seeded RNG 批量模拟，验证平衡性 | Soft |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `HP_BATTLE_MULTIPLIER` | 10 | 6–15 | 战斗回合数↑，更持久 | 战斗更快，更爆发 |
| `MAX_ROUNDS` | 30 | 20–50 | 超时判定更宽松 | 超时更快 |
| `INT_DEF_RATIO` | 0.5 | 0.3–0.8 | INT 技能受 DEF 影响↑（弱化谋略流） | INT 穿透更强（强化谋略流） |
| `RANDOM_VARIANCE_MIN/MAX` | 0.95/1.05 | ±5%–±10% | 伤害更随机，运气影响更大 | 伤害更稳定，技术性更强 |
| `CRIT_MULTIPLIER` | 1.5 | 1.3–2.0 | 暴击更爆炸 | 暴击更温和 |
| `HEAL_THRESHOLD` | 0.5 | 0.3–0.7 | AI 更激进治疗（友军 50% HP 就治） | AI 更保守治疗（快死才治） |
| `INITIAL_SKILL_COOLDOWN` | 2 | 0–4 | 技能出场更晚，前期更多普攻 | 0=第1回合可用技能，节奏更快 |
| `CHAIN_KILL_LIMIT` | 3 | 2–5 | 允许更长的连锁击杀 | 限制连锁，防止滚雪球 |
| `SKILL_PRIORITY_OVER_ATTACK` | `true` | — | 改为 `false` 则技能不优先普攻 | — |

## Acceptance Criteria

- [ ] `runBattle()` 在相同 seed 下产生相同结果（纯函数验证）
- [ ] 物理伤害公式 `STR × mult × (100/(100+DEF)) × variance` 计算正确，最低 1 点
- [ ] 技能伤害公式 `INT × mult × (100/(100+DEF×0.5)) × variance` 计算正确
- [ ] 治疗不超过目标缺失 HP
- [ ] 行动顺序按 SPD 降序排列；SPD 相同时 tiebreaker 随机决定
- [ ] `INITIAL_SKILL_COOLDOWN = 2`：前 2 回合技能不可用
- [ ] 眩晕单位跳过整个行动（不普攻、不技能）
- [ ] 沉默单位仅能普攻
- [ ] 治疗 AI 仅在存在友军 HP < 50% 时使用治疗技能
- [ ] 关键词匹配正确触发状态（`'眩晕'` → `stun`，`'中毒'` → `poison` 等）
- [ ] DoT 每回合开始造成伤害；目标可被 DoT KO
- [ ] HoT 每回合开始回复 HP；不超过 maxHP
- [ ] 超时 30 回合时 `outcome = Timeout`
- [ ] `playerSurvivors` 和 `enemySurvivors` 计数正确
- [ ] `BattleResult.log` 包含完整事件序列，UI 可复现整场战斗
- [ ] Performance: 完整 30 回合战斗模拟 < 100ms（无动画）
