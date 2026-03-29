# Loot/Rewards (战利品系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 收集之乐, 构筑智慧

## Overview

战利品系统管理战斗胜利后的奖励生成和分配。所有战利品以"宝箱"形式呈现——每个宝箱提供 3 个随机选项，玩家选择其一。宝箱分为四个等级（铁/铜/银/金），等级决定选项池的品质范围。不同战斗难度奖励不同数量和等级的宝箱：普通战斗开 1 个铁/铜箱，精英战开 1-2 个铜/银箱，Boss 战开 2-3 个银/金箱。每次三选一都是一个微型决策点——要金币还是装备？要材料还是特殊道具？这让每场战斗的结算都有参与感，而非被动领取固定奖励。本系统为 Economy 提供资源注入、为 Equipment 提供装备产出，也为 Event System 提供通用的奖励生成接口。

## Player Fantasy

**「战后论功行赏，打开缴获的军需。」**

每场胜仗之后，你面前摆着缴获的战利品箱。拆开铁箱是日常补给——几把铁刀、一袋银两，选你最需要的；拆开金箱是心跳加速的瞬间——青龙偃月刀、赤兔马、还是一大笔军资？三选一的设计让你不是被动领工资，而是每次都在做"我的军团现在最缺什么"的决策。

宝箱的等级和类型在地图上有所暗示——银箱比铜箱更值得冒险去打，军需箱图标意味着装备机会更大。这让路线规划多了一层考量：是走安全路线拿铜箱，还是挑战精英战搏一个银箱？打完一场硬仗看到金色宝箱图标亮起的那一刻，就是最好的正反馈。

**Pillar 对齐**:
- **收集之乐**: 宝箱是获得新装备的核心途径，高级箱的开启是多巴胺时刻
- **构筑智慧**: 三选一迫使玩家在金币、材料、装备之间做取舍；地图上的宝箱预览影响路线规划决策

## Detailed Design

### Core Rules

#### 1. Chest System (宝箱机制)

所有战利品以宝箱形式发放。每个宝箱打开后展示 3 个选项，玩家选择其一获得。

> **注意**：宝箱三选一（装备/Gold/Material）不包含武将卡。Boss 战的 S+ 武将和名器装备掉落由 Battle Engine 独立处理，不经过宝箱系统。详见 Battle Engine GDD 的 Boss Exclusive Drops 章节。

**宝箱选项**：

| 槽位 | 内容类型 | 说明 |
|------|---------|------|
| A | 装备 | 从当前等级对应的装备池中随机 |
| B | Gold | 金币奖励 |
| C | Material | 材料奖励 |

三个选项始终是**不同类别**，保证每次选择都是有意义的资源取舍。

#### 2. Chest Tiers (宝箱等级)

| 等级 | 名称 | 装备池 | Gold 范围 | Material 范围 |
|------|------|--------|----------|--------------|
| ⬜ 铁 | 铁箱 | Basic Lv.1 | 8-15 | 4-8 |
| 🟫 铜 | 铜箱 | Basic Lv.1-2 | 15-25 | 8-14 |
| ⬛ 银 | 银箱 | Basic Lv.2 / Advanced Lv.3 | 25-40 | 14-22 |
| 🟨 金 | 金箱 | Advanced Lv.3 / Named | 40-65 | 22-35 |
| 💎 钻石 | 钻石箱 | Named 高概率 / Advanced Lv.3 | 65-100 | 35-50 |

#### 3. Battle Difficulty → Chest Configuration

| 难度 | 宝箱数量 | 等级范围（随节点进度提升） |
|------|---------|------------------------|
| 普通战 | 1 | 铁 → 铜 → 银 |
| 精英战 | 1~2 | 铜 → 银 → 金 |
| Boss 战 | 2~3 | 银 → 金 → 钻石 |

节点进度影响等级：Run 前 1/3 取范围低端，中 1/3 取中间，后 1/3 取范围高端。

#### 4. Map Preview

地图节点上预显示宝箱奖励信息：
- 宝箱数量和等级（如"银箱 ×1"）
- 帮助玩家规划路线——更难的节点奖励更好的宝箱

#### 5. Named Equipment Drop Rules

名器仅在金箱和钻石箱中作为装备选项出现：
- 金箱：装备选项有一定概率为名器
- 钻石箱：装备选项高概率为名器
- 名器遵循全局唯一规则（已拥有的名器不会出现在选项中）
- 名器专属武将不在阵容中时仍可出现（任何人可装备，但无专属加成）

#### 6. Progressive Complexity

- **前期**（铁/铜箱）：选项简单——基础装备 vs Gold vs Material，新手零门槛
- **后期**（金/钻石箱）：装备选项可能是名器，需要评估当前阵容需求和专属匹配

### States and Transitions

宝箱从生成到消耗的完整生命周期：

| State | Entry | Exit | Behavior |
|-------|-------|------|----------|
| **Generated** | 节点生成时确定宝箱等级和数量 | 战斗胜利 → Pending | 地图上显示宝箱预览图标 |
| **Pending** | 战斗结算开始 | 玩家点击打开 → Opened | 显示宝箱等级，等待玩家点击 |
| **Opened** | 玩家点击宝箱 | 玩家选择一项 → Claimed | 展示 3 个选项（装备/Gold/Material） |
| **Claimed** | 玩家选择选项 | — (终态) | 奖励写入对应系统（Economy/Equipment），宝箱消失 |

**多宝箱流程**（Boss 战等）：
1. 所有宝箱同时显示为 Pending 状态
2. 玩家依次点击打开，逐个三选一
3. 全部 Claimed 后进入下一结算步骤

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Battle Engine** | Battle → Loot | 战斗结算时传入 `BattleResult`（难度、nodeIndex），Loot 系统生成宝箱 |
| **Economy** | Loot → Economy | 玩家选择 Gold/Material 选项时调用 `economy.earn(gold, material)` |
| **Equipment System** | Loot → Equipment | 玩家选择装备选项时触发装备获取流程（立即选择装备给谁/卖/拆/弃） |
| **Hero System** | Loot 读取 Hero | 生成装备选项时检查阵容武将（用于名器专属匹配的参考展示） |
| **Event System** | Event → Loot | 非战斗事件（宝箱节点、探索等）也可调用 Loot 系统生成宝箱 |
| **Run Map** | Map 读取 Loot | 节点生成时调用 Loot 系统确定宝箱配置，地图显示预览 |

**公共接口**:
```typescript
interface LootAPI {
  generateChests(nodeIndex: number, difficulty: Difficulty): Chest[];
  openChest(chest: Chest): LootOption[];  // returns 3 options
  claimOption(option: LootOption): void;  // writes to Economy or Equipment
  getChestPreview(nodeIndex: number, difficulty: Difficulty): ChestPreview[];  // for map display
}

interface Chest {
  tier: ChestTier;  // Iron | Bronze | Silver | Gold | Diamond
}

interface LootOption {
  type: 'gold' | 'material' | 'equipment';
  gold?: number;
  material?: number;
  equipment?: Equipment;
}

interface ChestPreview {
  tier: ChestTier;
  count: number;
}
```

## Formulas

### Gold Reward (宝箱金币选项)

```
chestGold = TIER_GOLD_BASE[tier] * (1 + nodeIndex * GOLD_NODE_SCALING) * randomRange(0.9, 1.1)
```

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| TIER_GOLD_BASE | int[] | Iron:12, Bronze:20, Silver:32, Gold:52, Diamond:80 | 各等级基础金币 |
| GOLD_NODE_SCALING | float | 0.03 | 节点进度微调（主要靠宝箱等级提升控制） |
| nodeIndex | int | 0-17 | 当前节点位置 |

### Material Reward (宝箱材料选项)

```
chestMaterial = TIER_MAT_BASE[tier] * (1 + nodeIndex * MAT_NODE_SCALING) * randomRange(0.9, 1.1)
```

| Variable | Type | Value | Description |
|----------|------|-------|-------------|
| TIER_MAT_BASE | int[] | Iron:6, Bronze:11, Silver:18, Gold:28, Diamond:42 | 各等级基础材料 |
| MAT_NODE_SCALING | float | 0.03 | 节点进度微调 |

### Equipment Selection (装备选项生成)

```
equipPool = TIER_EQUIP_POOL[tier]  // 该等级可选装备列表
equipment = weightedRandom(equipPool, weights)
```

| 宝箱等级 | 装备池 | Named 概率 |
|---------|--------|-----------|
| 铁 | Basic Lv.1 only | 0% |
| 铜 | Basic Lv.1 (40%) + Lv.2 (60%) | 0% |
| 银 | Basic Lv.2 (40%) + Advanced Lv.3 (60%) | 0% |
| 金 | Advanced Lv.3 (70%) + Named (30%) | 30% |
| 钻石 | Advanced Lv.3 (35%) + Named (65%) | 65% |

Named 装备从未拥有的名器池中随机；如果所有名器已拥有，回退为 Advanced Lv.3。

### Chest Tier Determination (宝箱等级确定)

```
baseTier = DIFFICULTY_BASE_TIER[difficulty]
tierUpgrade = floor(nodeIndex / TIER_UPGRADE_INTERVAL)
finalTier = min(baseTier + tierUpgrade, MAX_TIER[difficulty])
```

| Variable | Value | Description |
|----------|-------|-------------|
| DIFFICULTY_BASE_TIER | Normal:0(铁), Elite:1(铜), Boss:2(银) | 各难度起始等级 |
| TIER_UPGRADE_INTERVAL | 6 | 每 6 个节点提升一级 |
| MAX_TIER[difficulty] | Normal:2(银), Elite:3(金), Boss:4(钻石) | 各难度宝箱等级上限 |

**18 节点 Run 示例**:

| 节点 | 普通战 | 精英战 | Boss 战 |
|------|--------|--------|---------|
| 0-5 | 铁箱 | 铜箱 | 银箱 |
| 6-11 | 铜箱 | 银箱 | 金箱 |
| 12-17 | 银箱 | 金箱 | 钻石箱 |

### Chest Count (宝箱数量)

```
chestCount = BASE_COUNT[difficulty] + (nodeIndex >= BONUS_CHEST_THRESHOLD ? 1 : 0)
```

| Variable | Value | Description |
|----------|-------|-------------|
| BASE_COUNT | Normal:1, Elite:1, Boss:2 | 基础宝箱数量 |
| BONUS_CHEST_THRESHOLD | 12 | 节点 12+ 额外多 1 个宝箱 |

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 所有名器已拥有，金/钻石箱装备选项 | 回退为 Advanced Lv.3 装备 | 不显示空选项或已拥有的名器 |
| 装备池为空（极端情况，所有 Advanced 也穷尽） | 替换为等价 Gold 选项（装备 basePrice 的金币） | 保证 3 个选项始终可用 |
| 玩家选择装备但所有武将对应槽位已满 | 正常触发装备获取流程——选武将替换旧装备或卖/拆/弃 | 与 Equipment System 无背包设计一致 |
| 多宝箱时第 1 个箱选了装备，第 2 个箱的装备选项 | 独立生成，可能出现同类装备 | 每个宝箱独立 roll |
| 多宝箱时第 1 个箱选了名器，第 2 个箱 | 第 2 个箱生成时排除已获得的名器 | 名器全局唯一 |
| 战斗失败 | 不产生宝箱，无战利品 | 失败无奖励（Boss 战失败 = Run 结束） |
| nodeIndex 超出 17（扩展 Run） | 公式继续递增，宝箱等级 clamp 到难度上限 | 防溢出 |
| Gold/Material 随机波动后出现小数 | floor() 取整，最低 1 | 资源为整数 |
| 玩家关闭宝箱界面未选择 | 不允许关闭——必须三选一后才能继续 | 防止跳过奖励导致状态异常 |
| Event System 调用 Loot 生成非战斗宝箱 | 正常生成，nodeIndex 和 tier 由事件指定 | Loot 系统提供通用接口 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Hero System | Loot 读取 Hero | 检查阵容武将信息（名器专属展示） | Soft |
| Equipment System | Loot 读取 Equipment | 读取装备数据模型和名器唯一性状态 | Hard |
| Economy | Loot → Economy | 写入 Gold/Material 奖励 | Hard |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Battle Engine | Battle → Loot | 战斗结算触发宝箱生成 | Hard |
| Event System | Event → Loot | 非战斗事件调用宝箱生成 | Hard |
| Run Map | Map → Loot | 节点生成时获取宝箱预览 | Hard |
| Battle UI | UI 读取 Loot | 渲染宝箱开启界面和三选一 | Hard |

**与 Economy GDD 的交叉说明**:
- Economy 定义了 `battleGoldReward` 和 `battleMaterialReward` 公式——本系统的宝箱 Gold/Material 选项取代了那个固定奖励。Economy GDD 的战斗奖励公式应更新为"由 Loot 系统通过宝箱机制分配"，具体数值由宝箱等级公式控制。
- Economy 的 `earn(gold, material)` 接口保持不变，Loot 系统调用它。

**数值平衡说明**:
- 本文档中所有具体数值（Gold/Material 基础值、装备池权重、Named 概率、节点阈值等）均为**初始估算值**，需要在 playtest 阶段与 Economy（资源产出总量）、Hero Growth（升级成本曲线）、Equipment（强化消耗）联动校准。
- 宝箱奖励数值、选项分布比例与成长成本共同决定了 Run 整体难度曲线，无法在设计阶段单独确定——必须通过 playtest 迭代调优。
- 设计阶段优先确定的是**机制框架**（宝箱等级体系、三选一结构、等级提升规则），数值填充为占位值。

## Tuning Knobs

所有数值均为初始估算，标注安全调节范围：

| Parameter | Initial | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `TIER_GOLD_BASE[*]` | 12/20/32/52/80 | ±50% | 金币更充裕 | 经济更紧张 |
| `TIER_MAT_BASE[*]` | 6/11/18/28/42 | ±50% | 养成更快 | 养成更慢 |
| `GOLD_NODE_SCALING` | 0.03 | 0.01-0.08 | 后期奖励增幅更大 | 奖励增长平缓 |
| `TIER_UPGRADE_INTERVAL` | 6 | 4-9 | 宝箱升级更慢 | 更快接触高级箱 |
| `NAMED_DROP_RATE_GOLD` | 30% | 10-50% | 名器更容易获得 | 名器更稀有 |
| `NAMED_DROP_RATE_DIAMOND` | 65% | 40-80% | 钻石箱几乎必出名器 | 钻石箱也有不确定性 |
| `BASE_COUNT[*]` | N:1, E:1, B:2 | ±1 | 奖励更丰厚 | 奖励更精简 |
| `BONUS_CHEST_THRESHOLD` | 12 | 9-15 | 后期多宝箱更早出现 | 多宝箱更晚才出现 |
| `RANDOM_VARIANCE` | 0.9-1.1 | 0.8-1.2 | 奖励波动更大 | 奖励更稳定 |

## Visual/Audio Requirements

| Event | Visual Feedback | Audio Feedback | Priority |
|-------|----------------|---------------|----------|
| 宝箱出现 | 按等级不同的光效（铁=暗淡, 铜=铜光, 银=银芒, 金=金色粒子, 钻石=彩虹闪光） | 金属落地声，等级越高越厚重 | High |
| 宝箱打开 | 开箱动画（箱盖弹开 + 光柱），等级越高动画越华丽 | 开锁音效 + 等级对应的揭晓音效 | High |
| 选项展示 | 3 个选项卡依次翻出，装备选项显示装备立绘 | 翻牌音效 | Medium |
| 选择奖励 | 选中项放大高亮，未选项淡出 | 确认音效（获得金币=钱币声, 材料=锻造声, 装备=装备音效） | Medium |
| 名器出现 | 选项卡带特殊金色边框 + 光效，名器名称有专属字体样式 | 独特的传奇音效（铜锣/号角） | High |
| 地图宝箱预览 | 节点旁小宝箱图标，颜色对应等级 | 无 | Low |

## UI Requirements

| Information | Display Location | Update Frequency | Condition |
|-------------|-----------------|-----------------|-----------|
| 宝箱等级 + 数量 | 战斗结算界面（宝箱排列） | 战斗结束时 | 胜利后 |
| 三选一选项 | 宝箱打开后全屏弹窗 | 点击宝箱时 | 每个宝箱 |
| 装备选项详情（属性、效果、专属） | 选项卡内 + hover 展开 | 静态 | 装备选项 |
| Gold/Material 数值 | 选项卡内 | 静态 | 资源选项 |
| 当前持有 Gold/Material | 选项界面底部 | 实时 | 帮助决策 |
| 宝箱预览图标 | 地图节点旁 | 节点生成时 | 始终显示 |
| 剩余未开宝箱数 | 结算界面顶部 | 每开一个更新 | 多宝箱时 |

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 所有数值（Gold/Mat 基础值、装备池权重、Named 概率）需配合 Economy + Hero Growth 做 playtest 联合校准 | Systems Designer | Prototype | playtest 迭代调优 |
| Economy GDD 的战斗奖励公式需更新——从固定发放改为由 Loot 宝箱机制分配 | Game Designer | 下次 Economy 更新 | **已解决**：Economy GDD 已添加 deprecated 注释 |
| 是否需要"特殊选项"类别（如训练令、重铸券）扩展三选一的第四种选项类型 | Game Designer | Vertical Slice | 视 playtest 反馈 |
| 宝箱开启动画时长——太短无仪式感，太长打断节奏 | UX Designer | Prototype | 原型验证后确定 |
| 非战斗事件（宝箱节点、探索）调用 Loot 系统时的具体参数传递 | Game Designer | Event System GDD | 设计事件系统时确定 |

## Acceptance Criteria

- [ ] 宝箱等级由难度 + nodeIndex 正确计算（铁→铜→银→金→钻石）
- [ ] 每个宝箱打开后展示 3 个选项：1 装备 + 1 Gold + 1 Material
- [ ] 玩家必须三选一，不可跳过
- [ ] 选择 Gold/Material 后正确调用 `economy.earn()`
- [ ] 选择装备后正确触发 Equipment 获取流程（装备/卖/拆/弃）
- [ ] Named 装备仅在金箱和钻石箱中出现
- [ ] 已拥有的名器不出现在选项中（全局唯一）
- [ ] 所有名器已拥有时，装备选项正确回退为 Advanced Lv.3
- [ ] 多宝箱流程：依次打开，逐个选择
- [ ] 地图节点正确预显示宝箱数量和等级
- [ ] 普通战 1 箱、精英战 1-2 箱、Boss 战 2-3 箱
- [ ] 所有 Tuning Knobs 可通过配置文件调整，无硬编码
- [ ] Performance: 宝箱生成和选项 roll 在 <5ms 内完成
