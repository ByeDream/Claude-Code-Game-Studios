# Run Manager State Machine (Run 状态机)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-04-01
> **Implements Pillar**: 构筑智慧 (路线策略), 历史沉浸 (剧本叙事推进)

## Overview

Run Manager 是 Roguelike 跑局循环的核心状态机。它负责管理从开始一局到结局（胜利或败北）的全程状态：生成地图、跟踪玩家在地图上的位置、协调各类节点的交互（战斗、招募、市集、休整、神秘事件），以及维护荣誉值机制。Run Manager 采用纯函数模型（`RunState` 输入 → `RunState` 输出），不持有任何全局可变状态，所有状态均由调用方（UI 层）持有并传入。

## Player Fantasy

**「每一个抉择都留下记录，每一条路线都有代价。」**

从地图生成的那一刻起，玩家就开始运筹帷幄——这条路有两个招募点，那条路有市集和精英战斗，而荣誉值是你犯错的上限。Run Manager 是这一切的裁判：它记录你走过的节点、赢得的武将、消耗的荣誉，并在最后一击时宣告胜负。纯函数设计让每一步都可以精确复现，保证了 Roguelike 的公平性。

## Detailed Rules

### 1. State Machine Phases

Run 全程在三个阶段之间转换：

| 阶段 (`RunPhase`) | 含义 | 允许的操作 |
|-----------------|------|-----------|
| `MapView` | 玩家在查看地图，选择下一个节点 | `selectNode()` |
| `NodeInteraction` | 玩家正在与某个节点互动（战斗/事件/商店等） | `resolve*Node()` 系列 |
| `Ended` | 跑局已结束（胜利或败北） | 无（只读） |

### 2. Phase Transition Flow

```
startRun() → RunState { phase: MapView }
    ↓
selectNode(nodeId) → { phase: NodeInteraction, currentNodeId: nodeId }
    ↓
resolve*Node(...) → completeNode() → { phase: MapView, nodeIndex++ }
    ↓                              ↘ checkRunEnd() → { phase: Ended } (if applicable)
  [repeat]
```

- `selectNode()` 在 `phase !== MapView` 时原样返回 state（防御性保护）
- `selectNode()` 验证目标节点可达（在 `getSelectableNodes()` 返回的列表中）
- `completeNode()` 将节点标记为已完成，并将 `phase` 重置为 `MapView`

### 3. Node Resolvers

每种节点类型有对应的 resolver 函数：

| 节点类型 | Resolver | 核心逻辑 |
|---------|---------|---------|
| `Battle` / `Elite` / `Boss` | `resolveBattleNode()` | 调用 `runBattle()`；胜利则生成宝箱；Boss 败北扣荣誉 |
| `Recruit` | `resolveRecruitNode()` | 生成候选武将池；消耗金币招募 |
| `Shop` | `resolveShopNode()` | 生成店铺库存；消耗金币购买装备 |
| `Rest` | `resolveRestNodeAction()` | Train 或 Forge 操作；消耗材料/金币 |
| `Mystery` | `resolveMysteryNodeAction()` | 匹配历史事件或通用事件；应用奖励 |

所有 resolver 在成功或失败时都调用 `completeNode()` 以推进地图进度（失败的战斗/无法支付也会完成节点）。

### 4. Honor System (荣誉值)

荣誉值是 Run 的"生命值"——Boss 失败是唯一扣除途径：

| 情况 | 荣誉变化 |
|------|---------|
| Run 开始 | `honor = startingHonor`（默认 `DEFAULT_STARTING_HONOR = 100`） |
| 普通/精英战斗失败 | 无扣除，直接完成节点 |
| 中间 Boss 失败 | `honor -= MID_BOSS_HONOR_COST (30)` |
| 最终 Boss 失败 | `honor -= FINAL_BOSS_HONOR_COST (100)` |
| `honor <= 0` | `phase = Ended`，`endReason = HonorDepleted` |

中间 Boss 判定：`node.type === NodeType.Boss && currentNodeId !== map.finalBossNodeId`。

### 5. Run End Conditions

`checkRunEnd()` 检查两个终止条件：

| 条件 | `endReason` |
|------|------------|
| `defeatedBossIds` 包含 `map.finalBossNodeId` | `Victory` |
| `honor <= 0` | `HonorDepleted` |

玩家放弃跑局时由 UI 直接将 `phase` 设置为 `Ended`，`endReason = Abandoned`。

### 6. Node Index (节点计数器)

`nodeIndex` 从 0 开始，每完成一个节点加 1。它用于：
- 宝箱生成的难度缩放（`generateChests(nodeIndex, difficulty, ...)`）
- 招募池的可用等级缩放（`generateRecruitPool(heroPool, ownedIds, nodeIndex, ...)`）
- 商店库存的价格/品质缩放（`generateShopInventory(equipPool, ..., nodeIndex, ...)`）

### 7. Loot Flow in Battle Nodes

```
resolveBattleNode():
  1. 确定难度 (Normal / Elite / Boss)
  2. runBattle(roster, enemies, positions, random)
  3. if PlayerWin:
       chests = generateChests(nodeIndex, difficulty, ...)
       for each chest:
           options = openChest(chest)
           chosen  = options[lootChoices[i] ?? 1]  // default: gold
           economy = claimOption(chosen, economy)
       if node is Boss: add to defeatedBossIds
       completeNode()
  4. if EnemyWin && node is Boss:
       honor -= honorCost
       if honor <= 0: phase = Ended, endReason = HonorDepleted
       else: phase = MapView  // retry allowed by returning to map
  5. if EnemyWin && not Boss:
       completeNode()  // no loot, proceed
```

## Formulas

### Starting Honor

```
initialHonor = config.startingHonor ?? DEFAULT_STARTING_HONOR
DEFAULT_STARTING_HONOR = 100
```

### Honor Loss on Boss Defeat

```
isFinalBoss = (currentNodeId === map.finalBossNodeId)
honorCost   = isFinalBoss ? FINAL_BOSS_HONOR_COST : MID_BOSS_HONOR_COST
newHonor    = max(0, honor - honorCost)
runEnds     = (newHonor <= 0)
```

| Variable | Value | Description |
|----------|-------|-------------|
| `DEFAULT_STARTING_HONOR` | 100 | 每局初始荣誉值 |
| `MID_BOSS_HONOR_COST` | 30 | 中间 Boss 失败扣除量 |
| `FINAL_BOSS_HONOR_COST` | 100 | 最终 Boss 失败扣除量（一次扣满） |

### Node Index Scaling (used by downstream systems)

```
// 传入 nodeIndex 给下游系统，由各系统自行决定缩放公式
generateChests(nodeIndex, difficulty, ...)
generateRecruitPool(heroPool, ownedIds, nodeIndex, random)
generateShopInventory(equipPool, ownedNamedIds, nodeIndex, random)
```

## Edge Cases

| 情景 | 行为 | 原因 |
|------|------|------|
| `selectNode()` 在 `NodeInteraction` 阶段调用 | 原样返回 state | 防止重复进入节点 |
| `selectNode()` 传入不可达节点 ID | 原样返回 state | 只允许走合法路径 |
| `resolveRecruitNode()` 玩家无法支付 | 跳过招募，完成节点 | 资源不足不阻塞流程 |
| `resolveShopNode()` 部分购买失败 | 跳过该件，继续购买其他 | 不影响其余购买 |
| `resolveRestNodeAction()` 支付失败 | 完成节点但无效果 | 不阻塞流程 |
| `resolveMysteryNodeAction()` 无可用事件 | 完成节点，仅应用通用奖励 | 优雅降级 |
| `checkRunEnd()` 在 Boss 胜利后未调用 | Victory 不会被检测到 | 调用方（UI 层）负责在 `resolveBattleNode()` 后调用 `checkRunEnd()` |
| 荣誉值在非 Boss 失败时变为负数 | 不可能——非 Boss 失败不扣荣誉 | 逻辑保证 |
| `ownedNamedIds` 跨节点去重 | Set 贯穿整个 RunState | 确保命名装备唯一性 |
| `map.finalBossNodeId` 节点被多次进入 | `defeatedBossIds` 以 ID 去重（spread + includes） | 理论上不可能，但安全 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Run Map Generator | RunManager 调用 | `generateMap()` 生成初始地图 | Hard |
| Battle Engine | RunManager 调用 | `runBattle()` 执行战斗 | Hard |
| Event Manager | RunManager 调用 | `generateRecruitPool`, `resolveRecruit`, `generateShopInventory`, `resolveShopPurchase`, `resolveRestNode`, `resolveMysteryNode` | Hard |
| Loot Manager | RunManager 调用 | `generateChests`, `openChest`, `claimOption` | Hard |
| Hero Factory | RunManager 调用 | `createHeroInstance()` 实例化起始武将和招募武将 | Hard |
| Economy Manager | RunManager 调用 | `createEconomy()` 初始化经济状态 | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| UI Layer (React) | UI 读取 RunState | 渲染地图/面板/状态 | Hard |
| Campaign System | Campaign 驱动 RunConfig | 决定起始武将、剧本 ID | Hard |

## Tuning Knobs

| Parameter | Current | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `DEFAULT_STARTING_HONOR` | 100 | 50–200 | 更多容错空间，Run 更宽松 | 更少容错，Run 更严格 |
| `MID_BOSS_HONOR_COST` | 30 | 10–60 | 中间 Boss 失败惩罚更重 | 惩罚更轻，可多次挑战 |
| `FINAL_BOSS_HONOR_COST` | 100 | 50–200 | 需与 `DEFAULT_STARTING_HONOR` 同步调整 | 允许多次挑战最终 Boss |
| `lootChoices` 默认值 | `[1]` (gold) | — | 由 UI 控制 | — |

## Acceptance Criteria

- [ ] `startRun()` 返回 `phase: MapView`，`honor = DEFAULT_STARTING_HONOR`，地图已生成
- [ ] `selectNode()` 在 `MapView` 阶段切换到 `NodeInteraction`，`currentNodeId` 正确更新
- [ ] `selectNode()` 在 `NodeInteraction` 或 `Ended` 阶段返回原 state 不变
- [ ] `selectNode()` 传入不可达节点 ID 时返回原 state 不变
- [ ] `resolveBattleNode()` 胜利时 `economy` 包含宝箱奖励，`completedNodeIds` 更新，`phase` 回到 `MapView`
- [ ] `resolveBattleNode()` 普通/精英战斗失败时 `honor` 不变，节点完成，`phase` 回到 `MapView`
- [ ] `resolveBattleNode()` 中间 Boss 失败时 `honor -= MID_BOSS_HONOR_COST`
- [ ] `resolveBattleNode()` 最终 Boss 失败时 `honor -= FINAL_BOSS_HONOR_COST`，若 `honor <= 0` 则 `phase = Ended`
- [ ] `resolveRecruitNode()` 成功时新武将加入 `roster`，经济减少支付额
- [ ] `resolveShopNode()` 购买成功时装备加入 `ownedEquipment`，命名装备加入 `ownedNamedIds`
- [ ] `checkRunEnd()` 在 `defeatedBossIds` 含 `finalBossNodeId` 时返回 `phase: Ended, endReason: Victory`
- [ ] `checkRunEnd()` 在 `honor <= 0` 时返回 `phase: Ended, endReason: HonorDepleted`
- [ ] 所有函数在相同输入下返回相同输出（纯函数，可用 seeded RNG 验证）
- [ ] `nodeIndex` 每完成一个节点严格递增 1
