# Battle AI (战斗AI)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 构筑智慧 (AI 可预测，站位和阵容选择有意义)

## Overview

战斗AI控制自走棋式自动战斗中所有武将（友方和敌方）的行为决策——目标选择、普攻执行、技能释放时机。普攻目标为随机敌人（炉石酒馆战棋模式），技能目标由技能定义决定（确定性选择）。AI 对友方和敌方使用完全相同的规则（公平对称）。

## Player Fantasy

**「我的布阵决定了一切。」**

你不操控武将——你布局、你构筑、你预判。看着你精心安排的阵容按照你预期的方式碾压敌人，这种"一切尽在掌握"的感觉就是核心体验。AI 是你棋局的执行者，不是不可控的随机因素。

## Detailed Design

### Core Rules

#### 1. AI Decision Loop

每个武将每次行动执行以下决策链（按优先级从高到低）：

```
1. 检查是否有主动技能可释放 → 有则释放技能
2. 无可用技能 → 执行普攻
```

- 武将按 SPD 决定行动顺序（SPD 高的先行动）
- SPD 相同时，随机决定顺序（每回合重新随机）

#### 2. Target Selection (目标选择)

**默认规则：攻击随机一个存活的敌方单位**

棋盘为一排布局（详见 Battle Engine GDD），普攻目标完全随机选择（炉石酒馆战棋模式）。

```
defaultTarget = randomPick(aliveEnemies)
```

- 每次攻击独立随机选择，无对位/距离逻辑
- 简单、符合自走棋品类惯例、高观赏性

**技能/武技可覆盖随机逻辑（确定性选择）**：

| 覆盖类型 | 目标选择 | 示例 |
|---------|---------|------|
| 默认（无覆盖） | 最近敌人 | 大多数普攻和基础技能 |
| `target_lowest_hp` | HP 绝对值最低的敌人 | 刺客型技能"斩杀" |
| `target_highest_threat` | ATK 或 INT 最高的敌人 | 控制型技能"缴械" |
| `target_backline` | 最远的敌人（后排） | 突阵类武技 |
| `target_self` | 自己 | 自buff技能 |
| `target_lowest_hp_ally` | HP 最低的友军 | 治疗技能 |
| `target_all_enemies` | 全体敌人 | AOE 技能 |
| `target_all_allies` | 全体友军 | 群体buff |
| `target_adjacent` | 目标周围的单位 | 溅射/范围效果 |

技能的 `target` 字段决定使用哪种选择逻辑（已在 Hero System 中定义）。

#### 3. Skill Release Logic (技能释放)

主动技能有冷却时间(cooldown)。当冷却完成时，AI 在下一次行动时优先释放技能而非普攻。

**释放优先级**（当多个技能同时可用时）：

```
1. 治疗技能 — 当有友军 HP < HEAL_THRESHOLD (50%) 时优先释放
2. 控制技能 — 当目标无控制效果时优先释放（不重复控制）
3. 伤害技能 — 默认释放
```

**被动技能**：不经过 AI 决策，由触发条件自动执行（已在 Hero System 中定义）。

**武技**：自动触发型，满足条件时立即执行，不占用行动回合。

#### 4. AI Behavior Tags

武将可通过 tags 微调 AI 偏好（不改变基础规则，只影响优先级权重）：

| Tag | AI 偏好 | 影响 |
|-----|---------|------|
| 武力型 | 倾向攻击 DEF 较低的目标 | 平局时选 DEF 低的 |
| 谋略型 | 倾向使用技能而非普攻 | 技能冷却完立即释放 |
| 防御型 | 倾向保护 HP 低的友军（若有保护技能） | 保护技能优先级提升 |

这些是**微调**而非重写——基础规则不变，只在平局时影响选择。

#### 5. Design Principle: 简洁 + 技能确定性

- 普攻随机选择目标——符合自走棋品类惯例，观赏性高
- 技能目标为确定性选择——技能的 target 类型决定打谁（最低HP、全体等），玩家可预判技能行为
- 站位策略来自**相邻关系**（谁挨着谁影响光环/溅射/保护），而非攻击对位
- 友方和敌方使用完全相同的 AI 规则（公平对称）
- AI 不作弊——不会读取玩家未来行动

### States and Transitions

无独立状态机。AI 每次行动时重新评估决策，无记忆/无状态积累。

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Hero System** | AI 读取 Hero | 读取武将属性、技能、tags 做决策 |
| **Battle Engine** | Battle 调用 AI | 每个武将行动时调用 AI 获取决策（目标+动作） |
| **Status System** | AI 读取 Status | 检查目标是否已有控制效果（避免重复控制） |

**公共接口**:
```typescript
interface BattleAI {
  decideAction(
    hero: Hero,
    allies: Hero[],
    enemies: Hero[],
    boardState: BoardState
  ): AIDecision;
}

interface AIDecision {
  action: 'attack' | 'skill';
  skillId?: string;             // 如果 action=skill
  targetId: string | string[];  // 目标武将 ID（可能多个，如 AOE）
}
```

## Formulas

### Action Order

```
actionOrder = sortBy(allUnits, unit => -unit.finalSPD, tiebreaker: random)
```

### Target Selection (随机攻击)

```
defaultTarget = randomPick(aliveEnemies)
// 技能覆盖时使用确定性逻辑（target_lowest_hp, target_all_enemies 等）
```

### Skill Release Check

```
canUseSkill = skill.currentCooldown === 0 && hasValidTarget(skill.targetType)
shouldHeal = canUseSkill && skill.isHeal && allies.any(a => a.hp / a.maxHp < HEAL_THRESHOLD)
shouldControl = canUseSkill && skill.isControl && !target.hasControlEffect()
shouldDamage = canUseSkill && skill.isDamage
```

## Edge Cases

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| 所有敌人距离完全相同 | 不适用——默认攻击始终随机 | 随机攻击模式 |
| 治疗技能可用但没人受伤 | 不释放，改为普攻 | 不浪费技能 |
| 控制技能目标已被控制 | 不释放该技能于该目标，选择其他目标或普攻 | 不浪费控制 |
| 技能 CD 中只能普攻 | 正常普攻最近目标 | 普攻是基础行动 |
| 突阵武技的目标条件不满足 | 武技不触发，正常攻击 | 武技有触发条件 |
| 只剩 1 个敌人 | 所有人集火该目标 | 自然行为 |
| SPD 完全相同的两个武将 | 每回合随机决定先后 | 微量随机可接受 |
| AOE 技能是否影响友军 | 不影响——AOE 只作用于敌方 | 避免自伤复杂度 |
| 武将在行动前被击杀 | 跳过该武将行动 | 死人不能行动 |
| Boss 召唤的增援何时行动 | 下一回合开始时加入行动顺序 | 召唤当回合不行动 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | depends on Hero | 读取武将属性和技能 | Hard |
| Status System | depends on Status | 检查控制效果（避免重复） | Soft |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Battle Engine | Battle calls AI | 每次行动时调用 AI | Hard |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `HEAL_THRESHOLD` | 0.5 | 0.3-0.7 | 更早使用治疗 | 更晚治疗，多打输出 |
| `FOCUS_FIRE_HP_WEIGHT` | high | — | 更倾向集火低HP | 更分散攻击 |
| `CONTROL_AVOID_OVERLAP` | true | true/false | 不重复施加控制 | 允许叠加控制 |
| `SKILL_PRIORITY_OVER_ATTACK` | true | true/false | 技能可用时优先释放 | 有时会选择普攻 |

## Acceptance Criteria

- [ ] 普攻目标从存活敌人中随机选择
- [ ] 技能/武技正确覆盖随机逻辑（所有 target 类型为确定性选择）
- [ ] 主动技能冷却完成时优先于普攻释放
- [ ] 治疗技能在无人受伤时不释放
- [ ] 控制技能不重复施加已有的控制效果
- [ ] 友方和敌方使用完全相同的 AI 规则
- [ ] 行动顺序按 SPD 排序正确
- [ ] 所有目标选择可被玩家预判（无隐藏逻辑）
- [ ] 被动技能按触发条件自动执行（不经 AI 决策）
- [ ] 武技满足条件时自动触发（不占行动回合）
- [ ] Performance: AI 单次决策在 <1ms 内完成

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 距离计算方式需配合棋盘设计确定（曼哈顿 vs 欧几里得 vs 格子） | Game Designer | Battle Engine GDD | 与棋盘设计同步 |
| 是否需要"仇恨/嘲讽"机制让某些武将吸引火力 | Game Designer | Prototype | playtest 后视需求 |
| AI behavior tags 是否需要更多种类 | Game Designer | Vertical Slice | 基础 3 种足够 MVP |
