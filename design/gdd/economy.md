# Economy (货币/资源系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 构筑智慧 (资源取舍是决策), 养成爆发 (资源投入养成)

## Overview

经济系统定义了煮酒中所有资源的类型、获取途径和消耗规则。本系统管理两种 Run 内资源：金币（通用货币）和材料（养成消耗品）。所有资源在每次 Run 开始时重置为起始值，Run 内通过战斗、事件获取，通过招募、养成、商店消耗。玩家不直接"玩"经济系统，但它通过制造资源紧张来驱动取舍决策——是花金币招募新武将，还是留着升级现有武将？

## Player Fantasy

**「精打细算的君主」**

你不是土豪，你是白手起家的乱世枭雄。每一笔支出都是投资决策：好的资源分配让你的势力指数级增长，浪费则让你在后期举步维艰。这种紧张感服务于「构筑智慧」支柱——不只是选什么武将、放什么位置，还有把有限的资源投给谁。

## Detailed Design

### Core Rules

#### 1. Resource Types

| 资源 | 缩写 | 用途 | 获取方式 | 持久性 |
|------|------|------|---------|--------|
| 金币 | Gold | 招募武将、商店购买装备/兵法 | 战斗奖励、事件奖励、卖出装备 | Run 内，跨 Run 重置 |
| 材料 | Material | 武将升级、装备强化、技能习得 | 战斗奖励、锻造事件、拆解装备 | Run 内，跨 Run 重置 |

#### 2. Resource Flow Rules

- 资源无上限（不设硬顶，避免"满了浪费"的挫败感）
- 资源不可为负（所有消耗操作在扣除前检查余额）
- 资源获取量随 Run 进程递增（后期节点奖励更多，匹配更高的消耗需求）
- 遵循渐进式复杂度：早期（C-B 武将阶段）只需关注金币的招募/商店消费；材料消耗主要在中后期养成中变得重要

#### 3. Faucets (水龙头) — 资源产出

| Source | Gold | Material | 触发 |
|--------|------|----------|------|
| 战斗胜利 | ✅ 基础奖励 | ✅ 基础奖励 | 每场战斗后 |
| 事件奖励 | ✅ 部分事件 | ✅ 部分事件 | 事件选择 |
| 卖出装备 | ✅ 装备价值的 50% | ❌ | 玩家主动 |
| 拆解装备 | ❌ | ✅ 按装备等级 | 玩家主动 |
| 劝降失败安慰奖 | ✅ 少量 | ❌ | 劝降失败时 |

#### 4. Sinks (排水口) — 资源消耗

| Sink | Gold | Material | 触发 |
|------|------|----------|------|
| 招募武将 | ✅ 按 Tier 定价 | ❌ | 招募事件 |
| 商店购买 | ✅ 按物品定价 | ❌ | 市集节点 |
| 武将升级 | ❌ | ✅ 按等级递增 | 养成操作 |
| 装备强化 | ✅ 少量 | ✅ 主要消耗 | 锻造操作 |
| 技能习得 | ❌ | ✅ 按技能等级 | 养成操作 |

### States and Transitions

资源系统无复杂状态机。仅维护两个运行时变量：

| State | Init Value | Lifetime | Reset Condition |
|-------|-----------|----------|-----------------|
| `currentGold` | `STARTING_GOLD` (20) | Run 内 | Run 开始时初始化，Run 结束时销毁 |
| `currentMaterial` | `STARTING_MATERIAL` (0) | Run 内 | Run 开始时初始化，Run 结束时销毁 |

所有资源操作均为原子性：检查余额 → 扣除/增加 → 通知 UI 更新。

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| Hero Growth | Economy → Growth | `canAfford(cost): boolean` + `spend(cost): void` — 养成操作消耗材料 |
| Equipment | Economy ↔ Equipment | 卖出/拆解产出资源 (`earn(amount)`)；强化消耗资源 (`spend(cost)`) |
| Shop | Economy → Shop | 购买时调用 `canAfford()` + `spend()` |
| Loot/Rewards | Loot → Economy | 战利品中的金币/材料通过 `earn(amount)` 写入 |
| Event System | Event → Economy | 事件奖励/消耗通过 Economy 公共接口 |
| Battle Engine | Battle → Economy | 战斗结算时发送奖励数据，Economy 处理入账 |

**公共接口**:
```typescript
interface EconomyAPI {
  getGold(): number;
  getMaterial(): number;
  canAfford(gold: number, material: number): boolean;
  earn(gold: number, material: number): void;
  spend(gold: number, material: number): void;  // throws if !canAfford
  reset(): void;  // Run 开始时调用
}
```

## Formulas

### Battle Rewards

```
battleGoldReward = BASE_GOLD * (1 + nodeIndex * GOLD_SCALING) * difficultyBonus
battleMaterialReward = BASE_MATERIAL * (1 + nodeIndex * MATERIAL_SCALING) * difficultyBonus
```

| Variable | Type | Value | Range | Description |
|----------|------|-------|-------|-------------|
| BASE_GOLD | int | 10 | 5-20 | 第一场战斗的基础金币奖励 |
| BASE_MATERIAL | int | 5 | 2-15 | 第一场战斗的基础材料奖励 |
| GOLD_SCALING | float | 0.15 | 0.05-0.30 | 每个节点的金币递增系数 |
| MATERIAL_SCALING | float | 0.15 | 0.05-0.30 | 每个节点的材料递增系数 |
| nodeIndex | int | — | 0-17 | 当前节点在 Run 中的位置 (0=第一个) |
| difficultyBonus | float | — | 1.0-2.0 | 普通=1.0, 精英=1.3, Boss=2.0 |

### Recruit Cost

```
recruitCost = RECRUIT_BASE_COST * tierMultiplier
```

| Variable | Value | Description |
|----------|-------|-------------|
| RECRUIT_BASE_COST | 30 | C 级武将的招募基础价格 |
| tierMultiplier | C:1.0, B:1.5, A:2.5 | 按 Tier 递增 |

### Equipment Sell/Disassemble

```
sellGold = equipBasePrice * SELL_RATIO
disassembleMaterial = equipLevel * DISASSEMBLE_RATIO
```

| Variable | Value | Description |
|----------|-------|-------------|
| SELL_RATIO | 0.5 | 卖出价格占原价比例 |
| DISASSEMBLE_RATIO | 3 | 拆解产出材料 = 装备等级 × 系数 |

### Expected Economy Curve (18-node Run)

| 资源 | 总产出(约) | 总消耗(约) | 结余(约) |
|------|-----------|-----------|---------|
| Gold | 300-400 (不计卖装备) | 招募120-200 + 商店50-100 + 强化30-50 | 50-100 (缓冲) |
| Material | 150-200 | 升级80-120 + 强化30-50 + 技能20-40 | 10-30 (偏紧) |

**设计意图**: 金币略有盈余（允许一定的自由消费），材料偏紧（强迫玩家选择养谁）。

**经济平衡原则**（具体数值待 playtest 校准）:
- 一次 Run 材料产出应足够 5 个主战武将升到接近满级 (Lv.8-9)，占总产出约 60-75%
- 剩余 25-40% 材料用于装备强化
- 配备经济型武将/技能时应明显更宽裕
- 上述参考数值（300-400 Gold / 150-200 Material）为初始估算，需根据 Hero Growth 成本联动调优

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 资源不足以完成操作 | UI 灰显操作按钮 + 显示差额 | 玩家不应看到"余额不足"错误弹窗 |
| 卖出价格为 0 的装备 | 给 1 金币保底 | 任何操作都应有回报感 |
| Run 结束时资源清零 | 直接销毁，不结算/不转换 | Roguelike 纯度，无"存金币"策略 |
| 装备拆解和卖出的选择 | 清晰提示两个选项（卖出→金币 / 拆解→材料）和各自产出 | 避免玩家误操作 |
| 金币获取溢出 (Integer overflow) | 使用安全整数范围，实际不会发生（单 run <10000） | 防御性设计 |
| 同时获得金币和材料 | 两种资源独立增加，分别显示获取动画 | 清晰的反馈 |
| 免费招募事件（金币消耗为0） | 允许，视为特殊历史事件奖励 | 三顾茅庐得诸葛亮不该收费 |

## Dependencies

**本系统无上游依赖（Foundation Layer）。**

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero Growth | depends on Economy | 养成操作消耗材料 | Hard |
| Equipment | depends on Economy | 强化消耗资源；卖出/拆解产出资源 | Hard |
| Shop | depends on Economy | 购买消耗金币 | Hard |
| Loot/Rewards | depends on Economy | 战利品写入资源 | Hard |
| Event System | depends on Economy | 事件奖励/消耗资源 | Soft |
| Battle Engine | depends on Economy | 战斗结算产出资源 | Soft |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `BASE_GOLD` | 10 | 5-20 | 经济更宽裕，更多招募/购买 | 经济更紧张，取舍更艰难 |
| `BASE_MATERIAL` | 5 | 2-15 | 养成更快 | 养成更慢，需更精准投资 |
| `GOLD_SCALING` | 0.15 | 0.05-0.30 | 后期更富裕 | 全程经济平稳 |
| `MATERIAL_SCALING` | 0.15 | 0.05-0.30 | 后期材料更充裕 | 材料持续紧张 |
| `RECRUIT_BASE_COST` | 30 | 15-60 | 招募更贵，减少阵容更换 | 招募更便宜，更多尝试 |
| `SELL_RATIO` | 0.5 | 0.25-0.75 | 卖装备更值钱，回收流更强 | 卖装备亏损大，慎重选择 |
| `DISASSEMBLE_RATIO` | 3 | 1-8 | 拆解更多材料 | 拆解产出少 |
| `STARTING_GOLD` | 20 | 0-50 | 开局有余裕 | 开局更紧张 |
| `STARTING_MATERIAL` | 0 | 0-10 | 开局即可养成 | 需要先打几场积累 |
| `DIFFICULTY_BONUS_ELITE` | 1.3 | 1.1-1.8 | 精英战更值得打 | 精英战奖励接近普通 |
| `DIFFICULTY_BONUS_BOSS` | 2.0 | 1.5-3.0 | Boss 战奖励更丰厚 | Boss 战奖励一般 |

## Acceptance Criteria

- [ ] 所有资源获取/消耗操作正确更新余额
- [ ] 资源永远不为负（所有扣除前有余额检查）
- [ ] `canAfford()` 正确返回 true/false
- [ ] Run 开始时资源正确初始化（Gold=STARTING_GOLD, Material=STARTING_MATERIAL）
- [ ] Run 结束时资源正确清零
- [ ] 所有 Tuning Knobs 可通过配置文件调整，无硬编码
- [ ] 战斗奖励随 nodeIndex 正确递增
- [ ] 招募价格随 Tier 正确递增
- [ ] 卖出装备获得 ≥1 金币（保底）
- [ ] 经济曲线：18 节点 run 中总金币产出在 300-400 范围内
- [ ] Performance: 资源操作在 <1ms 内完成
- [ ] UI 在资源不足时正确灰显相关操作

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 精确的经济曲线需要 playtest 验证——当前数值为初始估算 | Economy Designer | Prototype phase | 通过 playtest 迭代调优 |
| 是否需要第三种 Run 内资源（如"声望"影响劝降概率） | Game Designer | Vertical Slice | 视 playtest 反馈决定 |
| 拆解/卖出 UI 的具体交互流程 | UX Designer | UI Design phase | 与 Equipment UI 同步设计 |
