# Run Map (Run地图系统)

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 构筑智慧, 历史沉浸

## Overview

Run Map 系统生成和渲染杀戮尖塔式的线性分支节点地图。地图从底部起点到顶部最终 Boss，中间分为多层，每层有 2-4 个可选节点，节点之间通过路径连接形成分支结构。整张地图在 Run 开始时一次性生成且完全可见——玩家可以看到所有节点类型和路径，路线规划本身就是核心策略。地图的层数和节点分布由剧本决定，不同剧本有不同规模的地图。本系统负责地图的空间布局生成、节点放置规则和路径连接逻辑，节点内容由 Event System 填充。

## Player Fantasy

**「运筹帷幄于地图之上，决胜于路线之间。」**

一张完整展开的行军地图摆在你面前——每一个节点清晰可见，每一条路径通向不同的可能。你需要通盘考虑：这条路线经过两个招募点，适合缺武将的情况；那条路线有精英战和锻造点，适合强化现有阵容。地图上的问号节点可能藏着改变战局的历史事件，但走那条路就要放弃市集节点。这种"看得见但不能全要"的设计，让每次 Run 的路线选择都是一道有趣的策略题。

**Pillar 对齐**:
- **构筑智慧**: 路线规划是宏观层面的构筑决策——选路线就是选资源和机会的优先级
- **历史沉浸**: 地图由剧本决定，不同历史阶段有不同规模和结构的地图

## Detailed Design

### Core Rules

#### 1. Map Structure

地图采用分层结构（类似杀戮尖塔）：

```
[最终Boss]         ← 顶层：最终 Boss（固定 1 个）
   / | \
 [N] [N] [N]       ← 中间层：每层 2-4 个可选节点
  |\ |/ \|
 [N] [N] [N]
  ...
 [N] [N] [N]       ← 第 1 层
   \ | /
  [起点]            ← 底层：起点（固定 1 个）
```

- 起点和最终 Boss 固定，中间层数由剧本决定
- 每层 2-4 个节点，玩家每层选一个进入
- 路径连接：当前层节点连接到下一层的 1-3 个节点（非全连接，形成分支路径）
- 玩家只能向上移动（不能回头）

#### 2. Map Scale by Campaign

地图规模由剧本决定：

| 剧本规模 | 总层数 | 节点总数(约) | 中间 Boss | 说明 |
|---------|--------|------------|----------|------|
| 小型 | 15-18 | 40-60 | 2-3 | 单章剧本（如黄巾之乱） |
| 中型 | 22-28 | 60-90 | 3-4 | 双章剧本（如讨伐董卓） |
| 大型 | 30-36 | 90-120 | 4-5 | 多章剧本（如群雄逐鹿） |

MVP 使用小型地图（15-18 层）。

#### 3. Mid-Boss and Sections

中间 Boss 将地图分成若干"段"：

**小型地图（2-3 个中间 Boss）**：
```
层 1-5:    第一段（黄巾军）
层 6:      中间 Boss 1
层 7-11:   第二段
层 12:     中间 Boss 2
层 13-17:  第三段（董卓军）
层 18:     最终 Boss
```

**中型地图（3-4 个中间 Boss）**：
```
层 1-6:    第一段
层 7:      中间 Boss 1
层 8-13:   第二段
层 14:     中间 Boss 2
层 15-20:  第三段
层 21:     中间 Boss 3
层 22-27:  第四段
层 28:     最终 Boss
```

- 中间 Boss 层只有 1 个节点（必经之路，无法绕过）
- Boss 层之间的段内节点正常分支

#### 4. Node Placement Rules

每层的节点类型由 Event System 的分布规则决定（见 Event System GDD），Run Map 负责空间放置。

**放置约束**：
- 每层 2-4 个节点，随机决定（权重：2节点=20%, 3节点=50%, 4节点=30%）
- Boss 层固定 1 个节点
- 第 1 层至少有 1 个普通战斗节点（确保开局有资源）
- Boss 前 1-2 层应有至少 1 个功能类节点（锻造/市集，最后准备机会）
- 招募节点在各段内均匀分布（不集中在前期或后期）
- 连续两层不应出现相同类型的功能节点（避免连续两个招募点）
- 问号节点不出现在第 1 层和 Boss 前 1 层

#### 5. Path Connection Rules

路径决定了玩家可以走哪些路线：

- 每个节点向下一层连接 1-3 个节点
- 不允许"孤立节点"（每个节点至少有 1 条入路径和 1 条出路径）
- 路径允许交叉（不同节点可连接到下一层的同一个节点）
- 路径不允许跨层跳跃（只能连接相邻层）
- 保证从起点到最终 Boss 至少有 2 条完全不同的路线

**连接算法概述**：
1. 为每层生成节点位置（水平方向上均匀分布）
2. 每个节点向下一层连接距离最近的 1-2 个节点
3. 随机添加额外连接（概率 30%），增加路线多样性
4. 验证：确保无孤立节点，确保至少 2 条独立路线
5. 如验证失败，重新生成

#### 6. Full Visibility

整张地图在 Run 开始时完全可见：
- 所有节点的类型图标可见
- 所有路径连接可见
- 玩家当前位置高亮
- 已完成节点标记为已通过
- 当前可选的下一步节点高亮

这让路线规划成为核心策略——玩家可以提前看到"走左边这条路有 2 个招募点但没有市集，走右边有市集但只有 1 个招募点"。

#### 7. Map Data Model

```typescript
interface RunMap {
  campaignId: string;
  layers: MapLayer[];
  startNode: string;         // 起点节点 ID
  finalBossNode: string;     // 最终 Boss 节点 ID
}

interface MapLayer {
  index: number;              // 层号（0 = 起点层）
  nodes: MapNode[];           // 该层的节点列表
  isBossLayer: boolean;       // 是否为 Boss 层
}

interface MapNode {
  id: string;
  type: NodeType;             // battle | elite | boss | recruit | shop | rest | mystery
  layerIndex: number;
  positionX: number;          // 水平位置（0.0-1.0 归一化）
  connectsTo: string[];       // 下一层可到达的节点 ID
  completed: boolean;
}

type NodeType = 'battle' | 'elite' | 'boss' | 'recruit' | 'shop' | 'rest' | 'mystery';
```

#### 8. Map Generation Pipeline

```
1. 读取剧本配置（层数、段数、Boss 数量）
2. 生成层结构（每层节点数量）
3. 放置 Boss 层（固定位置）
4. 填充节点类型（按 Event System 分布规则 + 放置约束）
5. 生成路径连接（连接算法）
6. 验证（无孤立节点、至少 2 条独立路线、约束满足）
7. 如验证失败，从步骤 2 重新生成（最多重试 MAX_RETRIES 次）
```

### States and Transitions

| State | Entry | Exit | Behavior |
|-------|-------|------|----------|
| **Generated** | Run 开始 | 玩家进入起点 → Navigating | 地图完整可见 |
| **Navigating** | 节点完成后返回 | 选择下一个节点 → Node Active | 显示当前位置，高亮可选节点 |
| **Node Active** | 玩家选择节点 | 节点交互完成 → Navigating / 战败 → Run End | 事件系统接管节点交互 |
| **Run End** | Boss 击败 / 战斗失败 | 结算画面 | 显示 Run 路线回顾 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Event System** | Map ↔ Event | Map 提供节点空间布局；Event 填充节点内容和类型分布 |
| **Campaign System** | Campaign → Map | 剧本决定地图规模（层数、段数、Boss 配置） |
| **Battle Engine** | Map → Battle (间接) | 通过 Event System 触发战斗 |
| **Battle UI / Map UI** | Map → UI | 提供地图渲染数据（节点、路径、状态） |

**公共接口**:
```typescript
interface RunMapAPI {
  generateMap(campaignConfig: CampaignMapConfig): RunMap;
  getCurrentNode(): MapNode;
  getSelectableNodes(): MapNode[];
  selectNode(nodeId: string): void;    // triggers Event System
  markCompleted(nodeId: string): void;
  getMapState(): RunMap;               // for rendering
  getRouteHistory(): string[];         // 已走过的节点 ID 列表
}

interface CampaignMapConfig {
  totalLayers: number;
  midBossCount: number;
  midBossLayers: number[];           // 中间 Boss 所在层号
  nodeDistribution: NodeDistribution; // 各类型节点的比例（来自 Event System）
}
```

## Formulas

### Nodes Per Layer

```
nodesInLayer = weightedRandom({2: 0.20, 3: 0.50, 4: 0.30})
```

Boss 层固定为 1。

### Path Connections

```
baseConnections = min(2, nextLayerNodeCount)  // 至少连 1 个，通常连 2 个
extraConnection = random() < EXTRA_PATH_CHANCE ? 1 : 0
totalConnections = baseConnections + extraConnection
```

| Variable | Value | Description |
|----------|-------|-------------|
| EXTRA_PATH_CHANCE | 0.3 | 额外路径连接概率 |

### Node Type Distribution

延用 Event System GDD 定义的分布比例，由地图生成器执行：

| 节点类型 | 目标占比 |
|---------|---------|
| 普通战斗 | ~40% |
| 精英战斗 | ~15% |
| 招募 | ~12% |
| 市集 | ~8% |
| 锻造/训练 | ~8% |
| 问号 | ~12% |
| Boss | 固定位置 |

实际生成时按目标占比分配，允许 ±5% 浮动。

**注意**：所有数值为初始估算，需 playtest 校准。

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 生成算法无法满足所有约束 | 重试，最多 MAX_RETRIES(10) 次，仍失败则放宽"连续同类型"约束 | 防止死循环 |
| 某层只有 2 个节点，都是战斗 | 允许——分布约束是全图层面的，单层可以例外 | 太严格的约束导致生成困难 |
| 路径导致某个节点无法被任何路线到达 | 验证阶段检测并修复（添加入连接） | 不允许孤立节点 |
| 玩家到达最终 Boss 层 | 只有 1 个节点（Boss），自动进入 | Boss 必经 |
| 中间 Boss 击败后的下一层 | 正常分支节点（第二段开始） | 中间 Boss 是段的分界 |
| Run 结束后查看地图 | 显示完整地图 + 玩家走过的路线高亮 | Run 回顾 |
| 剧本配置层数 < 10 | 允许，但可能导致节点类型覆盖不全 | 超小地图用于教程/特殊剧本 |
| 同一层所有节点都连接到下一层同一个节点 | 允许——形成"瓶颈"结构 | 杀戮尖塔也有此设计 |

## Dependencies

**上游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Event System | Map reads Event | 节点类型分布规则 | Hard |
| Campaign System | Campaign → Map | 地图规模配置 | Hard |
| Loot/Rewards | Map reads Loot | 战斗节点宝箱预览 | Soft |

**下游依赖**:

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Map UI | UI depends on Map | 渲染地图 | Hard |
| Campaign System | Campaign reads Map | 剧本进度跟踪 | Soft |

## Tuning Knobs

| Parameter | Initial | Safe Range | Effect of ↑ | Effect of ↓ |
|-----------|---------|------------|------------|------------|
| `NODES_PER_LAYER_WEIGHTS` | {2:0.20, 3:0.50, 4:0.30} | — | 更多选择（4节点权重↑） | 更少选择（2节点权重↑） |
| `EXTRA_PATH_CHANCE` | 0.3 | 0.1-0.5 | 路径更密，路线更灵活 | 路径更稀疏，路线更受限 |
| `SMALL_MAP_LAYERS` | 15-18 | 12-22 | Run 更长 | Run 更短 |
| `MEDIUM_MAP_LAYERS` | 22-28 | 18-32 | Run 更长 | Run 更短 |
| `LARGE_MAP_LAYERS` | 30-36 | 26-40 | Run 更长 | Run 更短 |
| `MAX_RETRIES` | 10 | 5-20 | 更多重试保证质量 | 更快生成 |
| `MIN_INDEPENDENT_ROUTES` | 2 | 2-3 | 保证更多独立路线 | 允许更受限的地图 |

## Visual/Audio Requirements

| Event | Visual Feedback | Audio Feedback | Priority |
|-------|----------------|---------------|----------|
| 地图展开 | Run 开始时地图从底部向上展开动画 | 卷轴展开音效 | Medium |
| 当前可选节点 | 脉冲高亮 + 可点击提示 | 无 | High |
| 选择节点 | 路径动画（棋子/旗帜沿路径移动到目标节点） | 行军脚步声 | Medium |
| 节点完成 | 节点图标变为"已通过"样式（降低透明度/打勾） | 无 | Low |
| Boss 节点 | 特殊图标（更大、带光效）、Boss 名称显示 | 低沉战鼓声（接近时） | High |
| 精英节点 | 骷髅图标带红色光效 | 无 | Medium |
| 问号节点 | 闪烁的问号，带神秘感的微光 | 无 | Low |
| Run 结束回顾 | 地图上走过的路线金色高亮，逐步回放 | 总结音乐 | Low |

## UI Requirements

| Information | Display Location | Update Frequency | Condition |
|-------------|-----------------|-----------------|-----------|
| 完整地图（所有节点+路径） | 全屏地图界面 | Run 开始时生成，之后静态 | 地图界面 |
| 节点类型图标 | 每个节点位置 | 静态 | 始终 |
| 当前位置标记 | 当前所在节点 | 每次移动后 | 始终 |
| 可选下一步节点高亮 | 当前节点连接的下一层节点 | 每次移动后 | 选择阶段 |
| 已完成节点标记 | 已通过的节点 | 节点完成后 | 始终 |
| 节点 hover 预览 | 鼠标悬停时弹出 | 实时 | hover |
| 战斗节点预览：敌方阵容概要 | hover 弹出 | 静态 | 战斗节点 hover |
| 宝箱预览：等级和数量 | hover 弹出 | 静态 | 战斗节点 hover |
| 地图缩放和滚动 | 地图界面 | 实时 | 大型地图 |
| 段分隔线（中间 Boss 之间） | Boss 层位置 | 静态 | 有中间 Boss 时 |

## Acceptance Criteria

- [ ] 地图按剧本配置正确生成（层数、Boss 位置）
- [ ] 每层 2-4 个节点（Boss 层 1 个）
- [ ] 从起点到最终 Boss 至少 2 条独立路线
- [ ] 无孤立节点（每个节点至少 1 入 1 出）
- [ ] 节点类型分布符合 Event System 定义的比例（±5%）
- [ ] 放置约束正确执行（第1层有战斗、Boss前有功能节点、无连续同类型功能节点等）
- [ ] 地图完全可见（所有节点类型和路径在 Run 开始时就展示）
- [ ] 玩家只能向上移动（不可回头）
- [ ] 当前可选节点正确高亮
- [ ] 已完成节点正确标记
- [ ] 中间 Boss 层正确分割地图为段
- [ ] 生成算法在 MAX_RETRIES 内稳定产出合法地图
- [ ] 所有 Tuning Knobs 可通过配置文件调整
- [ ] Performance: 地图生成在 <100ms 内完成

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 具体层数需配合 session 时长（30-60分钟）playtest 验证 | Game Designer | Prototype | playtest 迭代 |
| 精英战斗是否应标记为可选（玩家可以选择绕过）或必经 | Game Designer | Prototype | playtest 后决定 |
| 地图是否需要"隐藏路径"机制（满足条件开启额外路线） | Game Designer | Vertical Slice | 视需求扩展 |
| 不同剧本是否需要不同的视觉主题（黄巾=草原、董卓=宫殿） | Art Director | Vertical Slice | 美术阶段确定 |
| 地图生成种子是否暴露给玩家（用于分享/重现特定地图） | Game Designer | Alpha | 视社区需求 |
| 多章剧本的段之间是否有剧情过渡（非节点的叙事画面） | Narrative Director | Campaign GDD | 设计剧本时确定 |
