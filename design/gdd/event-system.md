# Event System (事件系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 历史沉浸, 收集之乐, 构筑智慧

## Overview

事件系统定义 Run 地图上所有节点类型的交互流程和内容生成规则。杀戮尖塔式线性分支地图中，玩家在路径分叉处选择下一个节点，每个节点进入后执行对应交互、获得结果、返回地图。系统管理 6 种节点：普通战斗、精英战斗、Boss 战、招募、市集、锻造/训练，以及问号节点（历史事件）。战斗类节点由 Battle Engine 驱动，功能类节点提供资源消费和阵容管理，问号节点是历史事件的载体——以三国故事包装的随机事件，条件匹配特殊历史事件，fallback 到通用事件。历史事件系统与战斗系统完全分离，互不影响。

## Player Fantasy

**「每一步都是抉择，每一个路口都可能改写历史。」**

地图上的每条分支都在问你同一个问题——你现在最需要什么？需要新武将？走招募。缺装备？去市集。想变强？选锻造。而那个闪烁的问号节点，可能是三顾茅庐的契机，也可能只是路边捡到几两散银——但你忍不住赌一把。

功能节点是精打细算的君主做资源规划：把有限的 Gold 花在招人还是买装备？训练谁还是强化哪件武器？问号节点是历史的馈赠：满足条件时触发专属的三国故事，解锁强力武将的掉落条件、直接强化队伍中的武将或装备，让每次 Run 都有独特的叙事体验。

**Pillar 对齐**:
- **历史沉浸**: 问号节点以三国历史事件包装，不是随机怪事而是真实典故
- **收集之乐**: 招募节点是获取新武将的主要途径，历史事件可解锁稀有武将掉落条件
- **构筑智慧**: 路线选择（走哪个节点）是宏观构筑决策的一部分

## Detailed Design

### Core Rules

#### 1. Node Types (节点类型)

| 类型 | 图标 | 对标杀戮尖塔 | 说明 |
|------|------|-------------|------|
| 普通战斗 | ⚔️ | 普通战 | 基础战斗，战后宝箱奖励 |
| 精英战斗 | 💀 | 精英战 | 更强敌人，更好的宝箱 |
| Boss | 👑 | Boss | 章节关卡，必经之路 |
| 招募 | 🏯 | — | 花 Gold 从候选池中招募武将 |
| 市集 | 🏪 | 商店 | 花 Gold 购买装备 |
| 锻造/训练 | 🔨 | 休息点 | 选择训练（升级武将）或锻造（强化装备） |
| 问号 | ❓ | 问号事件 | 历史事件——条件匹配特殊事件，fallback 通用事件 |

#### 2. Battle Nodes (战斗类节点)

战斗节点由 Battle Engine 驱动，事件系统仅负责：
- 定义该节点的敌方阵容（`EnemyEncounter`）
- 战斗结束后触发 Loot 系统生成宝箱奖励（三选一：装备/Gold/Material）

**普通战斗**：
1. 查看敌方阵容
2. 编排站位 → 开战
3. 胜利 → 宝箱三选一（铁~银箱）→ 返回地图
4. 失败 → 普通/精英战：无奖励，返回地图；Boss 战：扣除荣誉值，荣誉值归零则 Run 结束

**精英战斗**：
- 同普通战斗，但敌人更强
- 宝箱品质更高（铜~金箱）
- 精英战斗在地图上可预见（玩家可选择是否挑战）

**Boss 战**：
- 章节关卡，地图结构决定必须经过
- 多阶段 Boss 机制（详见 Battle Engine GDD）
- 宝箱品质最高（银~钻石箱）
- Boss 胜利后额外掉落判定：概率获得 S+ 武将和/或名器装备（独立于宝箱，详见 Battle Engine GDD）
- Boss 战失败 = 扣除荣誉值（中间 Boss 扣 MINI_BOSS_HONOR_COST，最终 Boss 扣 FINAL_BOSS_HONOR_COST），荣誉值归零则 Run 结束

#### 3. Recruit Node (招募节点)

**交互流程**：
1. 进入节点 → 展示 3-5 个候选武将（带属性、技能、Tier 预览）
2. 玩家选择一个 → 消耗 Gold（按 Tier 定价：C×1.0, B×1.5, A×2.5 乘以 RECRUIT_BASE_COST）
3. 武将加入队伍
4. 也可以选择不招募，直接离开
5. 返回地图

**候选池规则**：
- 基础池：由当前剧本决定可招募的武将列表
- 亲密度影响：武将亲密度越高，出现在候选中的概率越高
- 亲密度达到阈值的武将进入池子（跨 Run 局外积累解锁）
- 已拥有的武将不会出现在候选中
- 候选数量：RECRUIT_POOL_SIZE（初始 3-5，待调优）

> **MVP Fallback（无 Meta Progression 时）**：招募候选池 = 当前剧本所有未拥有武将的随机抽样（Tier 权重：C:50%, B:35%, A:15%），不受亲密度影响。

#### 4. Shop Node (市集节点)

**交互流程**：
1. 进入节点 → 展示商品列表（装备为主）
2. 玩家选择购买 → 消耗 Gold
3. 购买后触发装备获取流程（立即选择装备给谁/卖/拆/弃）
4. 可购买多件，也可以不买直接离开
5. 返回地图

**商品池规则**：
- 商品数量：SHOP_SIZE（初始 4-6，待调优）
- 商品品质随 Run 进度提升（前期 Basic Lv.1-2，后期 Advanced Lv.3，稀有概率出现 Named）
- 装备熟练度影响：熟练度越高，该装备出现在商品中的概率越高
- 熟练度达到阈值的装备进入池子（跨 Run 局外积累解锁）
- 定价使用 Equipment System 的 basePrice（不打折，部分事件/君主能力可能提供折扣）

> **MVP Fallback（无 Meta Progression 时）**：商品库存 = 随 nodeIndex 进度的随机装备池，不受熟练度影响。

#### 5. Rest Node (锻造/训练节点)

类似杀戮尖塔的休息点——进入后选择一个功能执行：

| 选择 | 效果 | 消耗 |
|------|------|------|
| **训练** | 选择一个武将升级 1 级 | Material（按 Hero Growth 公式） |
| **锻造** | 选择一件装备强化 1 级 | Gold + Material（按 Equipment 公式） |

**交互流程**：
1. 进入节点 → 展示两个选项：训练 / 锻造
2. 选择训练 → 选择目标武将 → 确认消耗 → 升级生效
3. 选择锻造 → 选择目标装备 → 确认消耗 → 强化生效
4. 每次进入只能执行一个操作
5. 资源不足时对应选项灰显
6. 返回地图

#### 6. Mystery Node (问号节点 — 历史事件)

问号节点是历史事件的载体。玩家走到即触发，系统根据当前状态匹配事件。

**事件匹配规则**：
```
到达问号节点 →
  遍历当前剧本的历史事件列表（按优先级排序）→
    检查每个事件的前置条件 →
      第一个满足条件的事件 → 触发
      全部不满足 → fallback 到通用事件池随机抽取
```

**前置条件类型**：

| 条件类型 | 示例 |
|---------|------|
| 君主身份 | `monarch == "刘备"` |
| 拥有特定武将 | `has_hero("关羽")` |
| 不拥有特定武将 | `!has_hero("诸葛亮")` |
| 拥有特定装备 | `has_equipment("青龙偃月刀")` |
| 击败特定 Boss | `boss_defeated("董卓")` |
| 前置事件已触发 | `event_triggered("三顾茅庐_1")` |
| 当前剧本 | `campaign == "黄巾之乱"` |

**历史事件与战斗系统完全分离**——事件不触发战斗，战斗不触发事件。

**特殊历史事件奖励类型**：

| 奖励类型 | 示例 | 说明 |
|---------|------|------|
| 武将掉落条件解锁 | 完成"三顾茅庐"后，诸葛亮进入后续战斗掉落池 | 提升战斗中获得该武将的概率 |
| 武将直接强化 | 关羽获得 STR+5 永久加成（本 Run 内） | 需要该武将在队伍中 |
| 装备直接强化 | 青龙偃月刀效果提升 | 需要该装备已拥有 |
| 技能强化 | 某武将技能倍率提升或解锁新效果 | 需要该武将在队伍中 |
| 名器掉落条件解锁 | 完成事件后，某名器加入后续战斗/商店掉落池 | 扩展掉落表 |

**通用事件（Fallback）奖励类型**：

| 奖励类型 | 示例 |
|---------|------|
| 金币 | 获得 15-40 Gold（随 Run 进度递增） |
| 材料 | 获得 8-20 Material（随 Run 进度递增） |
| 小额金币+材料 | 获得少量 Gold 和 Material |

**通用事件仍然有三国风味的文字包装**（"路过村庄，村民赠予军粮"），但奖励是基础资源。

**事件展示流程**：
1. 进入问号节点
2. 显示事件名称、历史背景文字
3. 直接展示奖励
4. 返回地图

问号事件没有分支选择——走到即触发，看故事拿奖励。决策点在地图路线选择上（是否走问号节点），而非事件内部。

**事件数据模型**：
```typescript
interface HistoricalEvent {
  id: string;                    // e.g., "taoyuan_oath"
  name: string;                  // "桃园结义"
  description: string;           // 剧情文本
  campaign: string;              // 所属剧本
  priority: number;              // 匹配优先级（高优先）
  conditions: Condition[];       // 前置条件列表（AND 关系）
  rewards: Reward[];             // 直接奖励
  triggerOnce: boolean;          // 是否只触发一次（通常为 true）
}

interface Condition {
  type: 'has_hero' | 'not_has_hero' | 'has_equipment' | 'boss_defeated' | 'event_triggered' | 'monarch' | 'campaign';
  params: Record<string, any>;
}

interface Reward {
  type: 'gold' | 'material' | 'hero_unlock' | 'named_unlock' | 'hero_growth' | 'equip_enhance' | 'skill_enhance';
  params: Record<string, any>;
}
```

#### 7. Node Data Model (节点通用数据模型)

```typescript
interface MapNode {
  id: string;
  type: 'battle' | 'elite' | 'boss' | 'recruit' | 'shop' | 'rest' | 'mystery';
  position: { row: number; column: number };  // 地图层级和横向位置
  connections: string[];                       // 可到达的下一层节点 ID
}

interface BattleNode extends MapNode {
  type: 'battle' | 'elite' | 'boss';
  encounter: EnemyEncounter;
  chestConfig: ChestConfig;     // 宝箱等级和数量
}

interface RecruitNode extends MapNode {
  type: 'recruit';
  poolSize: number;             // 候选武将数量
}

interface ShopNode extends MapNode {
  type: 'shop';
  shopSize: number;             // 商品数量
}

interface RestNode extends MapNode {
  type: 'rest';
}

interface MysteryNode extends MapNode {
  type: 'mystery';
  boundEvents: string[];        // 该节点可匹配的事件 ID（按优先级）
  fallbackPool: string;         // 通用事件池 ID
}
```

#### 8. Node Distribution (节点分布)

一个 12-18 节点的 Run 中，节点类型的大致比例：

| 节点类型 | 数量(18节点Run) | 占比 | 说明 |
|---------|----------------|------|------|
| 普通战斗 | 6-8 | ~40% | 主要内容 |
| 精英战斗 | 2-3 | ~15% | 可选挑战 |
| Boss | 1-2 | ~8% | 章节关卡（中间Boss + 最终Boss） |
| 招募 | 2-3 | ~12% | 武将获取核心途径 |
| 市集 | 1-2 | ~8% | 装备获取 |
| 锻造/训练 | 1-2 | ~8% | 养成消费 |
| 问号 | 2-3 | ~12% | 历史事件 |

**分布规则**：
- Boss 节点位置固定（中间和最终）
- 前 1-3 个节点必有至少 1 个普通战斗（确保开局有资源）
- Boss 前 1-2 个节点应有锻造/训练或市集选择（最后的准备机会）
- 招募节点均匀分布在 Run 中（不集中在前期或后期）
- 问号节点随机分布

### States and Transitions

#### Node Interaction Flow

所有节点共享统一的生命周期：

| State | Entry | Exit | Behavior |
|-------|-------|------|----------|
| **Visible** | 地图生成时 | 玩家选择进入 → Active | 在地图上显示图标和类型 |
| **Active** | 玩家点击进入 | 交互完成 → Completed | 执行对应节点的交互流程 |
| **Completed** | 交互流程结束 | — | 标记完成，玩家回到地图选择下一个节点 |

#### Run State Machine

| State | Entry | Exit |
|-------|-------|------|
| **Map View** | Run 开始 / 节点完成后 | 选择节点 → Node Interaction |
| **Node Interaction** | 选择节点 | 节点完成 → Map View / 战斗失败 → Run End |
| **Run End** | Boss 击败 / 战斗失败 | 结算 → 跨 Run 积累 → 主菜单 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Battle Engine** | Event → Battle | 战斗节点传入 `EnemyEncounter`，接收 `BattleResult` |
| **Loot/Rewards** | Event → Loot | 战斗胜利后调用 Loot 系统生成宝箱 |
| **Economy** | Event ↔ Economy | 招募/市集/锻造消耗 Gold/Material；通用事件产出资源 |
| **Hero System** | Event → Hero | 招募产出武将实例；事件解锁武将掉落条件 |
| **Equipment System** | Event → Equipment | 市集出售装备；事件强化装备 |
| **Hero Growth** | Event → Growth | 锻造/训练节点调用升级/强化接口；事件直接强化武将 |
| **Run Map** | Map ↔ Event | Map 提供节点布局和路径结构；Event 提供节点内容 |
| **Campaign System** | Campaign → Event | 剧本决定可用历史事件池、敌人配置、招募基础池 |
| **Meta Progression** | Meta → Event | 亲密度/熟练度影响招募池和商店池 |

**公共接口**:
```typescript
interface EventSystemAPI {
  // Node interaction
  enterNode(nodeId: string): void;
  getNodeInfo(nodeId: string): MapNode;

  // Recruit
  generateRecruitPool(campaignId: string, metaState: MetaState): Hero[];
  recruit(heroId: string): void;  // spends Gold via Economy

  // Shop
  generateShopInventory(nodeIndex: number, metaState: MetaState): Equipment[];
  purchase(equipmentId: string): void;  // spends Gold via Economy

  // Rest
  train(heroId: string): void;    // spends Material via Economy, calls HeroGrowth
  forge(heroId: string, slot: EquipSlot): void;  // spends Gold+Material, calls Equipment

  // Mystery events
  matchEvent(nodeId: string, gameState: GameState): HistoricalEvent;
  resolveEvent(eventId: string): Reward[];

  // Node generation
  generateNodeDistribution(campaignId: string, totalNodes: number): MapNode[];
}
```

## Formulas

### Recruit Cost

延用 Economy GDD 已定义的公式：
```
recruitCost = RECRUIT_BASE_COST * tierMultiplier
```

| Variable | Value | Description |
|----------|-------|-------------|
| RECRUIT_BASE_COST | 30 | C 级武将基础价格（待 playtest 校准） |
| tierMultiplier | C:1.0, B:1.5, A:2.5 | 按 Tier 递增 |

### Shop Pricing

延用 Equipment GDD 已定义的 basePrice：
```
shopPrice = equipment.basePrice
```

| Category | Level | basePrice |
|----------|-------|-----------|
| Basic | Lv.1 | 15 |
| Basic | Lv.2 | 30 |
| Advanced | Lv.3 | 50 |
| Named | — | 特殊定价（100-200，待定） |

### Shop Quality Progression

```
shopQualityTier = floor(nodeIndex / SHOP_TIER_INTERVAL)
```

| Variable | Value | Description |
|----------|-------|-------------|
| SHOP_TIER_INTERVAL | 6 | 每 6 个节点商品品质提升一档 |

| Run 进度 | 商品品质 |
|---------|---------|
| 节点 0-5 | Basic Lv.1-2 |
| 节点 6-11 | Basic Lv.2 + Advanced Lv.3 |
| 节点 12-17 | Advanced Lv.3 + Named 概率 |

### Fallback Event Reward Scaling

```
fallbackGold = BASE_FALLBACK_GOLD * (1 + nodeIndex * FALLBACK_SCALING)
fallbackMaterial = BASE_FALLBACK_MAT * (1 + nodeIndex * FALLBACK_SCALING)
```

| Variable | Value | Description |
|----------|-------|-------------|
| BASE_FALLBACK_GOLD | 20 | 通用事件基础金币（待 playtest 校准） |
| BASE_FALLBACK_MAT | 10 | 通用事件基础材料（待 playtest 校准） |
| FALLBACK_SCALING | 0.1 | 节点进度递增系数 |

### Affinity / Proficiency Impact on Pools

```
appearChance = BASE_APPEAR_CHANCE + affinityLevel * AFFINITY_BONUS
```

| Variable | Value | Description |
|----------|-------|-------------|
| BASE_APPEAR_CHANCE | 0.0 | 未解锁时不出现在池中 |
| AFFINITY_BONUS | per level | 亲密度/熟练度每级提升出现概率（具体值待 Meta Progression GDD 定义） |

**注意**：所有数值均为初始估算，需 playtest 校准。

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 招募节点但 Gold 不足以招任何人 | 允许进入查看，所有候选灰显，可直接离开 | 信息仍有价值（看看有谁） |
| 市集节点但 Gold 不足 | 同上，商品灰显，可直接离开 | 预览商品不应被阻止 |
| 锻造/训练节点但 Material 不足 | 两个选项均灰显，提示资源不足，可直接离开 | 不浪费节点但也无法操作 |
| 招募候选中已拥有的武将 | 不出现在候选中 | 避免浪费选项 |
| 招募池所有武将已拥有 | 显示空池+提示"无可招募武将"，可直接离开 | 极端情况处理 |
| 问号节点匹配到已触发的 triggerOnce 事件 | 跳过该事件，匹配下一个 | triggerOnce 事件不重复 |
| 问号节点无任何匹配事件且通用池为空 | 不应发生——通用池应始终有事件可抽 | 设计保证 |
| 历史事件奖励"武将强化"但该武将不在队伍中 | 事件条件中包含 `has_hero` 检查，不满足则不匹配 | 条件系统防止无效奖励 |
| 历史事件奖励"装备强化"但该装备不在队伍中 | 同上，`has_equipment` 条件检查 | 条件系统防止无效奖励 |
| 商店出现 Named 装备但该名器已拥有 | 不出现（`isNamedOwned` 检查） | 与 Equipment GDD 一致 |
| 锻造选项：装备已+3 满强化 | 该装备不可选，如果所有装备都满则锻造选项灰显 | 清晰反馈 |
| 训练选项：武将已满级 | 该武将不可选，如果所有武将满级则训练选项灰显 | 清晰反馈 |
| Run 中期招到新武将，想调阵容 | 需要等到下一个战斗节点前的编排阶段 | 战前编排保持不变 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | Event 读取 Hero | 武将数据、队伍状态 | Hard |
| Equipment System | Event 读取 Equipment | 装备数据、名器唯一性 | Hard |
| Economy | Event 调用 Economy | 资源消耗/产出 | Hard |
| Battle Engine | Event 调用 Battle | 战斗执行 | Hard |
| Loot/Rewards | Event 调用 Loot | 战后宝箱生成 | Hard |
| Hero Growth | Event 调用 Growth | 训练升级 | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Run Map | Map depends on Event | 节点内容和分布 | Hard |
| Campaign System | Campaign → Event | 剧本决定事件池和配置 | Hard |
| Meta Progression | Meta → Event | 亲密度/熟练度影响池子 | Soft |

**数值平衡说明**:
所有具体数值（招募候选数、商品数量、通用事件奖励、节点分布比例）均为初始估算，需 playtest 校准。

## Tuning Knobs

| Parameter | Initial | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `RECRUIT_POOL_SIZE` | 3-5 | 2-6 | 更多招募选择 | 更少选择，更看运气 |
| `SHOP_SIZE` | 4-6 | 3-8 | 更多商品选择 | 更少选择 |
| `SHOP_TIER_INTERVAL` | 6 | 4-9 | 商品品质提升更慢 | 更快接触高级装备 |
| `NAMED_SHOP_CHANCE` | 0.1 | 0.05-0.3 | Named 装备更常出现在商店 | 更稀有 |
| `BASE_FALLBACK_GOLD` | 20 | 10-40 | 通用事件金币更多 | 通用事件金币更少 |
| `BASE_FALLBACK_MAT` | 10 | 5-20 | 通用事件材料更多 | 通用事件材料更少 |
| `FALLBACK_SCALING` | 0.1 | 0.05-0.2 | 后期通用事件奖励增幅更大 | 奖励增长平缓 |
| `BATTLE_NODE_RATIO` | 0.40 | 0.30-0.50 | 更多战斗 | 更多功能/事件节点 |
| `MYSTERY_NODE_RATIO` | 0.12 | 0.08-0.20 | 更多历史事件机会 | 历史事件更稀少 |
| `RECRUIT_NODE_RATIO` | 0.12 | 0.08-0.18 | 更多招募机会 | 招募更稀缺 |

## Visual/Audio Requirements

| Event | Visual Feedback | Audio Feedback | Priority |
|-------|----------------|---------------|----------|
| 进入招募节点 | 候选武将卡牌依次展开，Tier 对应边框光效 | 翻牌音效 | High |
| 招募成功 | 武将立绘全屏展开 + 加入队伍动画 | 铜锣/鼓声 | High |
| 进入市集 | 商品列表展示，装备带属性预览 | 市集环境音（人声、叫卖） | Medium |
| 进入锻造/训练 | 两个选项卡（锤子/书卷图标）展示 | 篝火环境音 | Medium |
| 训练完成 | 武将属性数字上涨动画 | 升级音效 | Medium |
| 锻造完成 | 装备名称后 +N 闪光 | 锻造音效（铁锤） | Medium |
| 问号节点 — 特殊事件 | 专属事件插画 + 历史文字展开 + 奖励展示 | 古琴/战鼓（根据事件基调） | High |
| 问号节点 — 通用事件 | 简单文字 + 奖励弹出 | 轻快的获取音效 | Low |
| 特殊事件奖励：武将强化 | 武将属性上涨 + 金色光效 | 特殊强化音效 | High |
| 特殊事件奖励：解锁掉落条件 | 解锁提示 + 武将/装备剪影揭示 | 解锁音效 | High |

## UI Requirements

| Information | Display Location | Update Frequency | Condition |
|-------------|-----------------|-----------------|-----------|
| 节点类型图标 | 地图界面 | 地图生成时 | 始终 |
| 节点连接路径 | 地图界面 | 地图生成时 | 始终 |
| 当前可选节点高亮 | 地图界面 | 每次选择后 | 始终 |
| 招募候选武将列表 | 招募节点界面 | 进入节点时 | 招募中 |
| 候选武将属性/技能/Tier 预览 | 招募节点界面 — 点击展开 | 静态 | 招募中 |
| 商品列表+属性预览 | 市集节点界面 | 进入节点时 | 市集中 |
| 当前 Gold/Material | 所有功能节点界面顶部 | 实时 | 功能节点中 |
| 训练/锻造选项 + 消耗预览 | 休息节点界面 | 进入节点时 | 休息中 |
| 事件文字 + 奖励展示 | 问号节点全屏界面 | 进入节点时 | 事件中 |

## Acceptance Criteria

- [ ] 7 种节点类型正确区分并显示对应图标
- [ ] 战斗节点正确调用 Battle Engine 并在战后触发 Loot 宝箱
- [ ] 招募节点展示 RECRUIT_POOL_SIZE 个候选武将
- [ ] 已拥有武将不出现在招募候选中
- [ ] 招募正确消耗 Gold（按 Tier 定价）
- [ ] 亲密度影响武将出现在候选中的概率
- [ ] 市集展示 SHOP_SIZE 个商品，品质随 Run 进度提升
- [ ] 商品购买正确消耗 Gold 并触发装备获取流程
- [ ] 熟练度影响装备出现在商品中的概率
- [ ] 锻造/训练节点正确提供二选一，每次只能执行一个
- [ ] 训练正确调用 Hero Growth 升级接口
- [ ] 锻造正确调用 Equipment 强化接口
- [ ] 问号节点正确匹配条件最高优先级历史事件
- [ ] 无匹配时正确 fallback 到通用事件
- [ ] triggerOnce 事件不重复触发
- [ ] 特殊事件奖励（武将强化、解锁条件等）正确生效
- [ ] 通用事件奖励随 nodeIndex 正确递增
- [ ] 节点分布符合设定比例
- [ ] 资源不足时对应操作正确灰显
- [ ] 所有 Tuning Knobs 可通过配置文件调整，无硬编码
- [ ] Performance: 事件匹配在 <10ms 内完成

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 所有数值需 playtest 联合校准（招募候选数、商品数、节点分布、事件奖励等） | Systems Designer | Prototype | playtest 迭代 |
| 局外积累（亲密度/熟练度）的具体阈值和累积速度需要 Meta Progression GDD 定义 | Game Designer | Meta Progression GDD | 设计该系统时确定 |
| 历史事件的具体内容（剧情文本、条件、分支、奖励）需配合剧本设计 | Narrative Director | Campaign GDD | 内容填充阶段 |
| 通用事件池的具体内容数量（需要多少条通用事件才不会重复感太强） | Narrative Director | Vertical Slice | 内容填充阶段 |
| 地图节点的空间布局和路径分支规则由 Run Map GDD 定义 | Game Designer | Run Map GDD | 设计地图系统时确定 |
| Named 装备在商店的定价需要单独设计（当前 basePrice=0 不可售，但商店需要定价） | Economy Designer | Equipment GDD 更新 | 需要补充 Named 商店价格 |
| 招募节点是否允许同一次 Run 中多次出现同一位未招募的候选武将 | Game Designer | Prototype | playtest 后决定 |
| 市集是否也出售消耗品（恢复 HP 的药品等）还是纯装备 | Game Designer | Vertical Slice | 视需求扩展 |
