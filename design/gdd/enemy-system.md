# Enemy System (敌军系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 历史沉浸, 构筑智慧

## Overview

敌军系统管理 Run 中所有对手的生成、配置和难度曲线。除 Boss 战外，所有战斗均为 5v5。敌方阵容由正式武将（复用 Hero 数据模型）和无名武将（军团长、都尉等战斗填充单位）混合组成。前期战斗中无名武将占比高以降低难度，后期逐渐被正式武将替代。每个历史剧本章节末有 Boss 战，Boss 在武将模型基础上拥有额外机制。

## Player Fantasy

**「前方来犯的敌将，可能是你未来的收集目标。」**

普通战斗中的敌人不是无面杂兵——正式武将是有名有姓的历史人物，击败后可能掉落为你所用。Boss 则是历史中的重要人物（董卓、吕布、曹操等），需要针对性策略。你不是在打怪，你是在和三国群雄交锋。

## Detailed Design

### Core Rules

#### 1. Enemy Unit Types

| 类型 | 数据模型 | 用途 |
|------|---------|------|
| **无名武将** | 简化 Hero 模型（固定模板，无独特技能） | 前期战斗填充、难度调节、Boss 召唤物 |
| **正式武将** | 完全复用 Hero 数据模型 (C-A tier) | 中后期战斗主力敌人 |
| **Boss** | Hero 数据模型 + BossExtension | 章节末 Boss 战 |

#### 2. Nameless Units (无名武将)

无名武将是低成本战斗填充单位，使用预定义模板：

| 模板名 | 属性定位 | 技能 | 说明 |
|--------|---------|------|------|
| 小兵 | 极低五维，无偏向 | 无技能 | 最弱填充，仅出现在最初 1-2 场 |
| 军团长 | 低五维，偏 STR | 1 个简单被动（如"统领：周围小兵 ATK+5%"） | 前期常见 |
| 都尉 | 中低五维，偏 DEF | 1 个简单被动（如"坚守：自身 DEF+10%"） | 前期防御型填充 |
| 谋士 | 中低五维，偏 INT | 1 个简单被动（如"鼓舞：回合开始全体回复少量 HP"） | 前期辅助型填充 |
| 骑兵队长 | 中低五维，偏 SPD | 1 个简单被动（如"冲锋：首次攻击伤害+20%"） | 前期速度型填充 |

- 无名武将约 **5 种模板**，属性随 nodeIndex 缩放
- 无独特立绘（使用通用士兵图标），无历史背景
- 不可触发羁绊（无名武将不触发；正式敌将的羁绊由 Bond System 独立计算）
- 也作为 Boss 的召唤增援使用

#### 3. Battle Format

**标准战斗：固定 5v5**

所有非 Boss 战斗均为 5v5，敌方始终出 5 个单位。难度通过阵容质量控制（无名武将 vs 正式武将的比例）：

| Run 阶段 | 节点范围 | 敌方阵容构成 |
|---------|---------|------------|
| 早期 | 1-4 | 3-4 无名武将 + 1-2 正式 C 级武将 |
| 中前期 | 5-8 | 2-3 无名武将 + 2-3 正式 B 级武将 |
| 中后期 | 9-13 | 0-1 无名武将 + 4-5 正式 B-A 级武将 |
| 后期 | 14-18 | 0 无名武将 + 5 正式 A 级武将 |

精英战斗：同为 5v5，但敌方全为正式武将且属性更高。

**Boss 战：Boss + 护卫（数量可变）**

Boss 战不受 5v5 限制：
- Boss 本身占 1 个位置
- 初始护卫 2-4 个（正式武将或无名武将）
- Boss 可在战斗中召唤无名武将增援（超过 5 个敌方单位）
- 玩家仍为 5 个武将

#### 4. Enemy Attribute Rules

**正式武将**：使用 Hero 数据文件中的原始属性，**不做任何数值缩放**。
- 一个 B 级华雄作为敌人时，和玩家拥有的 B 级华雄属性完全相同
- 确保历史一致性——同一武将在敌方和玩家方实力一致

**无名武将**：属性随 nodeIndex 缩放（因为没有固定的 Hero 数据）：
```
namelessStat = templateBaseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE)
```

**Boss**：使用 Hero 数据文件中的原始属性 + Boss 倍率加成：
```
bossStat = heroBaseStat * BOSS_STAT_MULTIPLIER
```

#### 5. Boss System

Boss 复用武将模型，额外拥有 `BossExtension`：

```typescript
interface BossExtension {
  phases: BossPhase[];           // 多阶段
  immunities?: string[];         // 免疫的状态/效果
  summonWaves?: SummonWave[];    // 召唤增援（无名武将模板）
  specialAbility?: BossAbility;  // Boss 专属技能
}

interface BossPhase {
  hpThreshold: number;           // 触发阈值（HP 百分比）
  statModifier: StatModifier;    // 属性变化（如暴怒 ATK+30%）
  newAbility?: BossAbility;      // 新阶段解锁的能力
  dialogue?: string;             // 阶段转换时的台词
}

interface SummonWave {
  trigger: 'phase_change' | 'timer' | 'hp_threshold';
  units: NamelessTemplate[];     // 召唤的无名武将模板
}
```

**Boss 机制类型**（渐进式复杂度）：

| 机制 | 说明 | 示例 |
|------|------|------|
| 多阶段 | HP 降到阈值时进入新阶段 | 董卓：50% HP 后暴怒 ATK+30% |
| 召唤增援 | 召唤无名武将增援 | 张角：Phase 2 召唤黄巾力士 |
| 特殊免疫 | 免疫某些效果 | 吕布：免疫减速和眩晕 |
| Boss 专属技能 | 普通武将没有的强力技能 | 曹操：「唯才是举」复制一个玩家武将技能 |
| 弱点 | 特定条件下受额外伤害 | 董卓：火属性伤害+50% |

**MVP Boss 列表**（黄巾→董卓剧本）：

| Boss | 阶段 | 机制 | 初始护卫 |
|------|------|------|---------|
| 张角 | 2 阶段 | Phase 2 (HP<50%): 召唤黄巾力士×2, INT+20% | 2 军团长 + 2 谋士 |
| 董卓 | 2 阶段 | Phase 2 (HP<40%): 暴怒 ATK+30%, 火属性弱点 | 华雄(A) + 李傕(B) + 2 骑兵队长 |

Boss 不可直接获取，但击败后有丰厚奖励（名器/稀有武将概率掉落）。

#### 6. Encounter Generation

```typescript
interface EnemyEncounter {
  enemies: (Hero | NamelessUnit)[];  // 敌方单位列表
  formation: Position[];              // 敌方站位
  encounterType: 'normal' | 'elite' | 'boss';
  bossExtension?: BossExtension;
  lootTable: LootEntry[];
}
```

敌方阵容生成规则：
- **受剧本约束**：当前历史阶段决定敌方可用的武将池
- **受 nodeIndex 约束**：决定无名武将/正式武将比例
- **阵容有逻辑**：同一场战斗的敌人倾向同阵营
- **正式武将不降数值**：用原始 Hero 数据

### States and Transitions

无持久状态。敌方阵容在进入战斗节点时生成，战斗结束后销毁。

Boss 阶段状态由 Battle Engine 管理：

| Boss State | Entry | Exit |
|------------|-------|------|
| Phase 1 | 战斗开始 | HP < phase2.hpThreshold → Phase 2 |
| Phase 2 | HP 阈值触发 | HP = 0 → Defeated |
| Defeated | HP = 0 | 战斗结束 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Hero System** | Enemy 复用 Hero | 正式敌将使用 Hero 数据模型和原始属性 |
| **Battle Engine** | Enemy → Battle | 提供 EnemyEncounter 数据 |
| **Campaign System** | Campaign → Enemy | 剧本决定敌方武将池和 Boss 配置 |
| **Event System** | Event → Enemy | 战斗节点请求 Enemy 生成阵容 |
| **Loot/Rewards** | Enemy → Loot | Encounter 携带战利品表 |
| **Bond System** | Bond → Enemy | 敌方正式武将享受阵营羁绊加成（Bond System 的 recalculate 接受 enemyRoster 参数，独立计算敌方羁绊） |

## Formulas

### Nameless Unit Scaling

```
namelessStat = templateBaseStat * (1 + nodeIndex * NAMELESS_SCALING_RATE)
```

| Variable | Value | Range | Description |
|----------|-------|-------|-------------|
| NAMELESS_SCALING_RATE | 0.10 | 0.05-0.15 | 无名武将每节点属性递增 |
| templateBaseStat | per template | — | 各模板的基础属性 |

### Boss Stat Multiplier

```
bossStat = heroBaseStat * BOSS_STAT_MULTIPLIER
```

| Variable | Value | Range | Description |
|----------|-------|-------|-------------|
| BOSS_STAT_MULTIPLIER | 1.5 | 1.3-2.0 | Boss 全属性倍率 |

### Composition Ratio

```
namelessCount = max(0, BASE_NAMELESS - floor(nodeIndex / NAMELESS_REDUCTION_STEP))
namedCount = 5 - namelessCount
```

| Variable | Value | Range | Description |
|----------|-------|-------|-------------|
| BASE_NAMELESS | 4 | 3-4 | 初始无名武将数量（5人中） |
| NAMELESS_REDUCTION_STEP | 4 | 3-5 | 每 N 个节点减少 1 个无名武将 |

## Edge Cases

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| Boss 被秒杀（未触发 Phase 2） | 允许，Phase 2 不是必须经历的 | 奖励强力构筑 |
| Boss 召唤增援超过 5 个敌人 | 允许——Boss 战不受 5v5 限制 | Boss 战是特殊战斗 |
| 同一武将既是敌人又在玩家阵容中 | 允许——煮酒本质是卡牌游戏，武将是"牌"而非唯一角色。自走棋品类中双方出现同一单位是常态 | 简洁实现；自走棋惯例；跨Run收集下不可避免 |
| 敌方正式武将的羁绊 | 敌方享受阵营羁绊加成（Bond System 独立计算） | 公平对称 |
| 所有护卫被击败但 Boss 仍存活 | 战斗继续直到 Boss 被击败 | Boss 是胜利条件 |
| Boss 召唤时场上已有很多敌方 | 召唤的单位加入战场，无上限 | Boss 战压力递增 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | depends on Hero | 正式敌将复用数据模型 | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Battle Engine | Battle depends on Enemy | 读取敌方阵容 | Hard |
| Campaign System | Campaign constrains Enemy | 决定敌方武将池 | Soft |
| Event System | Event triggers Enemy | 战斗节点触发生成 | Hard |
| Loot/Rewards | Loot depends on Enemy | 读取战利品表 | Hard |
| Bond System | Bond applies to Enemy | 敌方享受羁绊 | Soft |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `NAMELESS_SCALING_RATE` | 0.10 | 0.05-0.15 | 无名武将后期更强 | 无名武将始终弱 |
| `BOSS_STAT_MULTIPLIER` | 1.5 | 1.3-2.0 | Boss 更强 | Boss 更温和 |
| `BASE_NAMELESS` | 4 | 3-4 | 前期更多无名武将(更简单) | 前期更多正式武将(更难) |
| `NAMELESS_REDUCTION_STEP` | 4 | 3-5 | 无名武将减少更慢(难度曲线缓) | 减少更快(难度曲线陡) |
| `BOSS_PHASE_THRESHOLD` | 0.5 | 0.3-0.6 | Boss 更早进入 Phase 2 | Boss 更晚进入 |
| `NAMELESS_TEMPLATE_COUNT` | 5 | 3-8 | 更多无名武将变体 | 更少变体 |

## Acceptance Criteria

- [ ] 非 Boss 战斗固定 5v5
- [ ] 正式敌将复用 Hero 数据，属性不做缩放
- [ ] 无名武将使用模板，属性随 nodeIndex 缩放
- [ ] 敌方阵容中无名/正式武将比例随 nodeIndex 变化
- [ ] Boss 多阶段在 HP 阈值时正确触发
- [ ] Boss 召唤增援正确生成无名武将
- [ ] Boss 战可超过 5 个敌方单位
- [ ] 敌方正式武将享受阵营羁绊加成
- [ ] 所有数值可通过配置调整

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 无名武将模板的具体属性数值待 playtest 确定 | Systems Designer | Prototype | playtest 后确定 |
| Boss 的具体技能设计需逐个细化 | Game Designer | Per-boss design | 每个 Boss 单独设计 |
| 精英战的出现频率和奖励倍率 | Game Designer | Run Map GDD | 与地图系统同步设计 |
| 后期是否需要"精英无名武将"作为强化版填充 | Game Designer | Vertical Slice | 视 playtest 反馈 |
