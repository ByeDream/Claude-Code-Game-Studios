# Battle Engine (战斗系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 构筑智慧 (站位和阵容验证), 养成爆发 (战斗中看到成长效果)

## Overview

战斗系统是煮酒的核心 30 秒循环。采用自走棋式 5v5 回合制自动战斗，双方武将排成一排，按对位关系进行攻击。玩家在战前编排站位顺序（决定谁对谁），战斗开始后武将按 SPD 顺序自动执行攻击和技能。玩家唯一的战中操作是释放军师技（Vertical Slice 阶段实现）。伤害采用百分比减伤模型。

## Player Fantasy

**「运筹帷幄，决胜于战前。」**

战斗本身是你构筑决策的验证时刻——站位顺序是否合理（我的坦克对着他的输出？）、阵容搭配是否精妙、装备分配是否得当，答案在 30 秒内揭晓。偶尔在关键时刻释放一手军师技扭转战局，这就是少数手动操作的高光时刻。

## Detailed Design

### Core Rules

#### 1. Battlefield Layout

双方各一排 5 个位置：

```
我方:   [pos 0] [pos 1] [pos 2] [pos 3] [pos 4]

敌方:   [pos 0] [pos 1] [pos 2] [pos 3] [pos 4]
```

- 每方固定 5 个位置（5v5），Boss 战敌方可扩展
- 位置编号 0-4，从左到右
- **相邻关系**：pos N 与 pos N-1、pos N+1 相邻（影响 AOE/溅射/光环/保护）
- 站位顺序决定相邻组合 = 玩家的核心站位策略

#### 2. Target Selection (随机攻击)

**默认规则：攻击随机一个存活的敌方单位**

```
defaultTarget = randomPick(aliveEnemies)
```

- 完全随机，不受位置影响（炉石酒馆战棋/大巴扎模式）
- 每次攻击独立随机选择目标
- 简单、符合自走棋品类惯例

**技能/武技可覆盖目标逻辑**（已在 Battle AI 中定义）：
- `target_lowest_hp` → 打 HP 最低的
- `target_highest_threat` → 打 ATK/INT 最高的
- `target_all_enemies` → 全体
- `target_adjacent` → 随机目标 + 其左右相邻单位（溅射）
- `target_self` / `target_lowest_hp_ally` / `target_all_allies` → 友方目标
- 等等（完整列表见 Battle AI GDD）

#### 3. Position Strategy

随机攻击模式下，站位策略的核心是**相邻关系**（谁挨着谁）：

| 策略 | 做法 | 目的 |
|------|------|------|
| 兄弟并肩 | 需要互相保护的武将放相邻位置 | 利用相邻保护/光环效果 |
| 输出核心居中 | 核心输出放 pos 2，两侧放辅助/坦克 | 最大化相邻buff覆盖 |
| AOE 诱导 | 高HP武将放在一起 | 诱导敌方 AOE 打向坦克群 |
| 溅射最大化 | 自己的 AOE 武将放中间 | 溅射可以覆盖左右相邻 |
| 分散风险 | 关键武将不相邻 | 避免被单次 AOE 同时击中 |

#### 4. Battle Flow

```
战前准备 → 战斗循环 → 结算
```

**战前准备**（玩家操控阶段）：
1. 查看敌方阵容和站位顺序
2. 编排我方武将站位顺序（拖拽排列 5 个位置）
3. 选择军师技（如有，Vertical Slice+）
4. 点击「开战」

**战斗循环**（自动执行）：
```
while (双方均有存活武将 && 回合数 < MAX_ROUNDS):
    回合开始:
        1. 处理回合开始类被动/状态效果
    行动阶段:
        2. 生成本回合行动顺序（按 SPD 降序，平局随机）
        3. 按顺序执行每个武将的行动：
           a. 检查是否存活 → 已死亡则跳过
           b. 调用 Battle AI 获取决策（攻击/技能 + 目标）
           c. 执行决策 → 计算伤害/效果 → 应用
           d. 检查被动触发（攻击后/受伤后/击杀后等）
           e. 武技触发检查（条件满足时自动执行，不占行动）
    回合结束:
        4. 处理回合结束类被动/状态
        5. 状态效果持续时间 -1，过期移除
        6. 检查胜负条件
```

**玩家手动操作**（军师技，Vertical Slice+）：
- 战斗进行中，军师技图标在可用时亮起
- 玩家在任意武将行动间隙点击释放
- 效果立即执行，然后战斗继续自动进行
- 每场战斗军师技使用次数有限（ADVISOR_SKILL_USES）

#### 5. Damage Calculation

**物理伤害**（普攻 + STR scaling 技能）：
```
physicalDamage = attackerSTR * skillMultiplier * (100 / (100 + targetDEF)) * randomVariance
```

**技能伤害**（INT scaling 技能）：
```
skillDamage = attackerINT * skillMultiplier * (100 / (100 + targetDEF * INT_DEF_RATIO)) * randomVariance
```

| Variable | Value | Description |
|----------|-------|-------------|
| skillMultiplier | 1.0 (普攻) / per skill | 技能倍率（Hero System 定义） |
| INT_DEF_RATIO | 0.5 | INT 技能受 DEF 减免的比率（谋略穿透更强） |
| randomVariance | 0.95-1.05 | 微量随机波动（±5%），增加观赏性 |
| MIN_DAMAGE | 1 | 最低伤害保底 |

**百分比减伤特性**：
- DEF=100: 物理伤害减半
- DEF=200: 物理伤害减至 1/3
- DEF 永远不会提供 100% 减免
- INT 技能的减伤只有物理的 50%（谋略穿透更强）

#### 6. Healing Calculation

```
healAmount = healerINT * healMultiplier
```

- 治疗不受 DEF 影响，直接回复 HP
- 最大不超过目标 maxHP
- 治疗目标由 AI 决定（默认 HP 最低的友军）

#### 7. Critical Hit (暴击)

遵循渐进式复杂度——暴击是高级装备/名器才引入的机制：

```
if (random() < critChance):
    finalDamage = damage * CRIT_MULTIPLIER
```

| Variable | Value | Description |
|----------|-------|-------------|
| critChance | 0 + 装备/技能加成 | 基础 0，仅通过装备/技能获得 |
| CRIT_MULTIPLIER | 1.5 | 暴击伤害倍率 |

#### 8. Adjacent Effects (相邻效果)

相邻关系（pos N ± 1）影响以下机制：

| 效果类型 | 说明 | 示例 |
|---------|------|------|
| 溅射/AOE | 技能伤害溅射到目标相邻位置 | 方天画戟：攻击可伤害相邻敌人 |
| 光环 | 被动效果作用于相邻友军 | 某些武将被动"鼓舞：相邻友军 ATK+5%" |
| 保护 | 为相邻友军承受伤害 | 典韦「悍卫」：为相邻友军承受 25% 伤害 |

#### 9. Victory/Defeat Conditions

| 条件 | 结果 |
|------|------|
| 所有敌方被击败 | 胜利 → 进入结算 |
| 所有我方被击败 | 失败 |
| 超过 MAX_ROUNDS (30) | 判玩家负 |
| Boss HP 归零（Boss 战） | 胜利（即使有护卫存活） |

#### 10. Honor System (荣誉值)

荣誉值是 Boss 战失败惩罚的核心机制（类似大巴扎的 HP 机制）：

| 规则 | 说明 |
|------|------|
| Run 开始时 | 荣誉值 = MAX_HONOR (初始 100, 待调优) |
| 普通战斗失败 | 不扣荣誉值，仅无奖励 |
| 中间 Boss 失败 | 扣 MINI_BOSS_HONOR_COST (30-50, 随进度递增) |
| 最终 Boss 失败 | 扣 FINAL_BOSS_HONOR_COST (100, 即一次扣满) |
| 荣誉值 ≤ 0 | Run 结束 |

游戏越往后，中间 Boss 扣除的荣誉值越多，容错空间逐步缩小。

#### 11. Battle Result & Rewards

**胜利结算**：
1. 显示战斗回顾（MVP 武将、伤害统计）
2. 获得战利品（宝箱三选一）— Loot 系统处理
3. Boss 战额外掉落：概率获得 S+ 武将和/或名器装备（仅 Boss 战）
4. 返回 Run 地图

#### Boss Exclusive Drops (Boss 战额外掉落)

Boss 战胜利后，独立于宝箱的额外掉落判定：

- S+ 武将加入概率：`BOSS_S_PLUS_DROP_RATE`（初始 0.2，待调优）
- 名器装备掉落概率：`BOSS_NAMED_DROP_RATE`（初始 0.3，待调优）
- 两者独立判定，可能同时掉落、只掉一个、或都不掉
- 掉落的武将直接加入队伍（触发武将获取动画）
- 掉落的装备触发 `triggerEquipFlow()`（立即选择装备给谁/卖/拆/弃）
- 低等级武将（C-A）不从战斗掉落，通过招募节点获取

```
if (isBossVictory):
    // 宝箱三选一照常（Loot 系统）
    loot.generateChests(...)

    // Boss 额外掉落（独立判定）
    if (random() < BOSS_S_PLUS_DROP_RATE):
        hero = rollBossHeroDrop(bossId)
        addHeroToRoster(hero)
    if (random() < BOSS_NAMED_DROP_RATE):
        equipment = rollBossNamedDrop(bossId)
        triggerEquipFlow(equipment)
```

**失败结算**（普通战斗/精英战斗）：
- 无法获得奖励，直接返回地图继续前进
- 武将 HP 恢复到满（roguelike 简化）
- 不可重试该节点

**失败结算**（Boss 战）：
- 中间 Boss 失败：扣除荣誉值（MINI_BOSS_HONOR_COST，随进度递增）
- 最终 Boss 失败：扣除 FINAL_BOSS_HONOR_COST（一次扣满全部荣誉值）
- 荣誉值 ≤ 0 → Run 结束 → 显示 Run 总结 → 跨 Run 奖励结算 → 返回主界面
- 所有节点不允许重试

### States and Transitions

| State | Entry | Exit | Player Control |
|-------|-------|------|---------------|
| **Preparation** | 进入战斗节点 | 点击「开战」→ Combat | ✅ 编排站位、选军师技 |
| **Combat** | 开战 | 一方全灭/超时 → Resolution | ⚠️ 仅军师技（VS+）|
| **Resolution** | 战斗结束 | 奖励完成 → 返回 Run Map | ✅ 装备处理 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Hero System** | Battle 读取 | 最终属性(base+growth+equip+bond)、技能组、武技/军师技 |
| **Equipment System** | Battle 读取 | 名器特殊效果，注册战斗触发器 |
| **Bond System** | Battle 读取 | 战斗开始时读取已激活羁绊效果 |
| **Battle AI** | Battle 调用 | 每次行动调用 AI 获取决策（目标+动作） |
| **Enemy System** | Enemy → Battle | 提供 EnemyEncounter（阵容+站位+Boss机制） |
| **Status System** | Battle ↔ Status | 施加/移除状态效果，查询当前状态 |
| **Economy** | Battle → Economy | 战斗结算发送奖励 (Gold+Material) |
| **Loot/Rewards** | Battle → Loot | 传递战利品数据 |
| **Battle UI** | Battle → UI | 每个动作推送 BattleEvent 给 UI 渲染 |

**公共接口**:
```typescript
interface BattleEngine {
  startBattle(playerTeam: DeployedHero[], encounter: EnemyEncounter): Battle;
  executeRound(battle: Battle): RoundResult;
  useAdvisorSkill(battle: Battle, skillId: string): void;
  getBattleState(battle: Battle): BattleState;
}

interface DeployedHero {
  hero: Hero;           // 完整武将数据（含最终属性）
  position: number;     // 站位 0-4
  equipment: Equipment[];
}

interface BattleEvent {
  type: 'attack' | 'skill' | 'damage' | 'heal' | 'death' | 'status' | 'martial_art' | 'advisor_skill' | 'boss_phase';
  source: string;       // 武将 ID
  target: string[];     // 目标 ID(s)
  value?: number;       // 伤害/治疗数值
  isCrit?: boolean;
}
```

## Formulas

### Physical Damage

```
physicalDamage = max(MIN_DAMAGE, attackerSTR * skillMultiplier * (100 / (100 + targetDEF)) * randomVariance)
```

### Skill Damage (INT-based)

```
skillDamage = max(MIN_DAMAGE, attackerINT * skillMultiplier * (100 / (100 + targetDEF * INT_DEF_RATIO)) * randomVariance)
```

### Healing

```
healAmount = min(healerINT * healMultiplier, target.maxHP - target.currentHP)
```

### Critical Hit

```
finalDamage = isCrit ? damage * CRIT_MULTIPLIER : damage
critChance = 0 + sum(equipment/skill crit bonuses)
```

### Action Order

```
actionOrder = sortBy(allAliveUnits, unit => -unit.finalSPD, tiebreaker: random)
```

### Target Selection

```
defaultTarget = randomPick(aliveEnemies)
// 技能可覆盖: target_lowest_hp, target_highest_threat, target_all_enemies, etc.
```

### Variable Reference

| Variable | Value | Range | Description |
|----------|-------|-------|-------------|
| skillMultiplier | per skill | 0.5-3.0 | 技能伤害倍率 |
| INT_DEF_RATIO | 0.5 | 0.3-0.8 | INT 技能受 DEF 影响的比率 |
| randomVariance | uniform(0.95, 1.05) | 0.9-1.1 | 伤害微量随机波动 |
| MIN_DAMAGE | 1 | 1 | 最低伤害保底 |
| CRIT_MULTIPLIER | 1.5 | 1.3-2.0 | 暴击伤害倍率 |
| MAX_ROUNDS | 30 | 20-50 | 超时回合数 |
| ADVISOR_SKILL_USES | 1 | 1-3 | 每场军师技使用次数 |
| MAX_HONOR | 100 | 50-200 | Run 初始荣誉值 |
| MINI_BOSS_HONOR_COST | 30-50 | 20-60 | 中间 Boss 失败扣除荣誉值（随进度递增） |
| FINAL_BOSS_HONOR_COST | 100 | 80-150 | 最终 Boss 失败扣除荣誉值 |
| BOSS_S_PLUS_DROP_RATE | 0.2 | 0.05-0.4 | Boss 战 S+ 武将额外掉落概率 |
| BOSS_NAMED_DROP_RATE | 0.3 | 0.1-0.5 | Boss 战名器装备额外掉落概率 |

## Edge Cases

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| 伤害计算结果 < 1 | 保底 1 点伤害 | 防止完全免伤 |
| 治疗超过 maxHP | Clamp 到 maxHP | 不允许超量治疗 |
| 武将在自己行动前被击杀 | 跳过该武将行动 | 死人不行动 |
| 对位敌人已死亡 | 不适用——攻击目标始终随机选择存活敌人 | 随机攻击无 fallback 问题 |
| 同时触发多个被动 | 按被动定义顺序依次执行 | 确定性，不随机 |
| 击杀触发连锁效果 | 允许连锁，单回合最多 CHAIN_KILL_LIMIT (3) 次 | 防止无限循环 |
| 超时 30 回合 | 判玩家负 | 防止僵局 |
| Boss 召唤增援 | 增援在敌方扩展位出现（pos 5, 6...），下回合参与行动 | Boss 战不受 5 位限制 |
| 军师技释放时机 | 任意武将行动间隙均可 | 最大灵活性 |
| 所有武将 SPD 相同 | 全部随机排序 | 极端情况处理 |
| 敌方只剩 1 人 | 所有我方武将集火该目标（随机选中的必然是他） | 自然行为 |
| 相邻溅射超出位置范围 (pos 0-1 或 pos 4+1) | 超出范围的不生效 | 边界武将自然受到较少溅射 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | Battle reads Hero | 属性+技能 | Hard |
| Equipment System | Battle reads Equip | 名器效果 | Hard |
| Bond System | Battle reads Bond | 羁绊加成 | Hard |
| Battle AI | Battle calls AI | 行动决策 | Hard |
| Enemy System | Enemy → Battle | 敌方阵容 | Hard |
| Status System | Battle ↔ Status | 状态施加/查询 | Hard — 双向依赖：Battle Engine 驱动状态施加/移除时机，Status System 写入 Hero 的 statusModifier 供 Battle 读取 |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Economy | Battle → Economy | 奖励结算（实际通过 Loot 系统中介，Battle Engine 不直接调用 Economy） | Hard |
| Loot/Rewards | Battle → Loot | 战利品 | Hard |
| Battle UI | Battle → UI | 渲染事件流 | Hard |
| Event System | Event triggers Battle | 战斗节点触发 | Hard |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `MAX_ROUNDS` | 30 | 20-50 | 更宽松超时 | 更快判负 |
| `CRIT_MULTIPLIER` | 1.5 | 1.3-2.0 | 暴击更爆炸 | 暴击更温和 |
| `INT_DEF_RATIO` | 0.5 | 0.3-0.8 | INT 技能受 DEF 影响更大 | INT 穿透更强 |
| `RANDOM_VARIANCE` | 0.95-1.05 | 0.9-1.1 | 伤害波动更大 | 伤害更稳定 |
| `MIN_DAMAGE` | 1 | 1 | — | — |
| `CHAIN_KILL_LIMIT` | 3 | 2-5 | 更长连锁 | 限制连锁 |
| `ADVISOR_SKILL_USES` | 1 | 1-3 | 更多军师技干预 | 更少干预 |
| `DEFEAT_GOLD_PENALTY` | — | — | 已移除（普通战斗失败无金币惩罚） | — |
| `MAX_HONOR` | 100 | 50-200 | 更多容错空间 | 更严格 |
| `MINI_BOSS_HONOR_COST` | 30-50 | 20-60 | Boss 失败惩罚更重 | 惩罚更轻 |
| `FINAL_BOSS_HONOR_COST` | 100 | 80-150 | 最终 Boss 一次扣满（需与 MAX_HONOR 同步） | 允许多次挑战 |
| `BOSS_S_PLUS_DROP_RATE` | 0.2 | 0.05-0.4 | S+ 武将更容易从 Boss 掉落 | S+ 武将更稀有 |
| `BOSS_NAMED_DROP_RATE` | 0.3 | 0.1-0.5 | 名器更容易从 Boss 掉落 | 名器更稀有 |
| `POSITIONS_PER_SIDE` | 5 | 4-6 | 更多站位选择 | 更少选择 |

## Acceptance Criteria

- [ ] 5v5 一排战斗正确执行
- [ ] 普攻目标从存活敌人中随机选择
- [ ] 技能目标选择正确覆盖随机逻辑（lowest_hp, all_enemies 等）
- [ ] 行动顺序按 SPD 正确排序
- [ ] 物理伤害公式 `STR * mult * (100/(100+DEF))` 正确
- [ ] 技能伤害公式 `INT * mult * (100/(100+DEF*0.5))` 正确
- [ ] 暴击仅在有暴击源时触发，倍率正确
- [ ] 相邻效果（溅射/光环/保护）正确检测 pos±1
- [ ] Boss 多阶段正确触发
- [ ] Boss 召唤增援加入扩展位置
- [ ] 超时 30 回合判负
- [ ] 战斗结算正确发放奖励
- [ ] 军师技可在战斗间隙手动释放（VS+）
- [ ] 战斗事件流(BattleEvent[])正确推送给 UI
- [ ] Performance: 完整 30 回合模拟在 <100ms（无动画）

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 伤害随机波动(±5%)是否需要保留，还是完全确定性 | Game Designer | Prototype | playtest 后决定 |
| 失败后"重新挑战"是否消耗额外资源 | Game Designer | Event System GDD | **已解决**：所有节点不允许重试。普通战斗失败无奖励继续前进，Boss 战失败扣荣誉值 |
| Boss 战扩展位的具体上限 | Game Designer | Prototype | playtest 后决定 |
| 军师技的冷却/充能机制具体设计 | Game Designer | Advisor Skills GDD | 单独系统 GDD |
