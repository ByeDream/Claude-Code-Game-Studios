# Hero System (武将系统)

> **Status**: In Design
> **Author**: User + Claude
> **Last Updated**: 2026-03-29
> **Implements Pillar**: 收集之乐, 养成爆发, 构筑智慧, 历史沉浸

## Overview

武将系统是煮酒的数据基础层，定义了游戏中所有武将角色的数据模型——包括基础属性（武力、智力、防御、生命、速度）、技能组、阵营归属、稀有度（Tier）、历史背景标签和立绘引用。武将既是战斗中的作战单位，也是玩家收集和养成的核心对象。玩家通过招募、事件奖励等方式获取武将，在阵容编排中选择上场武将并安排站位。本系统为战斗系统、羁绊系统、养成系统、装备系统等 15 个下游系统提供统一的武将数据接口，是全游戏最底层的依赖。

## Player Fantasy

**「我的麾下猛将如云。」**

每一位武将都不是冰冷的数据卡片，而是一个有名字、有故事、有个性的三国人物。当你翻开一张新获得的武将卡，看到精美的光荣式立绘和这位武将独特的技能组合时，你会感到兴奋和期待——这个人能为我的阵容带来什么？当你发现一位低 Tier 的武将因为独特的技能配合在你的阵容中大放异彩时，你会觉得自己慧眼识珠、知人善任。

**Pillar 对齐**:
- **收集之乐**: 每位武将都是独一无二的珍宝——独特技能、精美立绘、历史背景
- **养成爆发**: 武将有清晰的成长路径，强化效果肉眼可见
- **构筑智慧**: 武将属性和技能影响阵容搭配决策
- **历史沉浸**: 武将是真实的三国人物，技能设计反映其历史形象

## Detailed Design

### Core Rules

#### 1. Hero Data Model

每位武将由以下数据定义：

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | 唯一标识符 (e.g., `guan_yu`, `legend_guan_yu`) |
| `name` | string | 显示名称 (e.g., "关羽", "武圣·关羽") |
| `baseName` | string | 基础名 (e.g., "关羽") — 用于关联基础版和传说变体 |
| `title` | string | 称号 (e.g., "美髯公") |
| `faction` | enum | 阵营：Wei / Shu / Wu / Qun |
| `tier` | enum | C / B / A / S / SS / SSS |
| `variant` | enum | Base (基础版) / Legend (传说变体) |
| `legendTitle` | string? | 传说变体的尊号前缀 (e.g., "武圣"、"卧龙")，Base 版为 null |
| `baseStats` | object | 基础五维：STR, INT, DEF, HP, SPD |
| `skills` | Skill[] | 技能组 |
| `martialArts` | MartialArt[]? | 武技（仅高级武力将拥有） |
| `advisorSkill` | AdvisorSkill? | 军师技（仅高级智力将拥有） |
| `tags` | string[] | 特征标签 (e.g., ["骑兵", "忠义", "武力型", "先锋"]) |
| `bondKeys` | string[] | 可触发的羁绊 ID (e.g., ["桃园结义", "五虎上将"]) |
| `lore` | object | 历史背景文本、事件引用 |
| `artRef` | string | 立绘资源引用 |

#### 2. Base Stats (基础五维)

| 属性 | 缩写 | 说明 | 战斗作用 |
|------|------|------|----------|
| 武力 | STR | 近战/物理攻击力 | 影响普攻伤害和武力型技能基础值 |
| 智力 | INT | 谋略/策略能力 | 影响技能效果（伤害/治疗/控制强度）和军师技效果 |
| 防御 | DEF | 伤害减免 | 按公式减少受到的伤害 |
| 生命 | HP | 生存能力 | 被击败 = HP 归零 |
| 速度 | SPD | 行动频率 | 影响自走棋中的攻击间隔和技能充能速度 |

- 默认情况下，普攻伤害基于 STR；技能效果基于 INT
- 特殊装备可打破壁垒（例：诸葛扇 — INT 的一定比例加入普攻结算）
- 同 Tier 不同武将属性总和接近，但分布不同（关羽高STR+HP，诸葛亮高INT+SPD）
- 属性可被装备系统、养成系统、羁绊系统、状态系统修改

**最终属性计算**:

```
finalStat = (baseStat + growthBonus + equipBonus) * (1 + bondModifier + statusModifier)
```

其中 `growthBonus` 来自养成系统，`equipBonus` 来自装备系统，`bondModifier` 来自羁绊系统，`statusModifier` 来自状态系统。

#### 3. Tier System (稀有度分级)

**基础版 (C / B / A)**：所有历史武将的常规版本。Run 内可通过事件获取。

| Tier | 定位 | 属性总和范围 | 技能数量 | 获取 |
|------|------|-------------|---------|------|
| C | 普通武将 | 较低 | 1 被动 | 很容易（初始/事件） |
| B | 合格武将 | 中等 | 1 被动 | 容易（事件/招募） |
| A | 优秀武将 | 中高 | 1被动 + 1主动 | 中等（事件/Boss奖励） |

**传说变体 (S / SS / SSS)**：同一武将的巅峰形态。跨 Run 通过特殊条件解锁。

| Tier | 定位 | 属性总和范围 | 技能数量 | 特殊能力 | 解锁方式 |
|------|------|-------------|---------|---------|---------|
| S | 一流名将 | 高 | 1被动+1主动 | 武技或军师技(1个) | 跨Run成就 |
| SS | 顶级名将 | 很高 | 1被动+2主动 | 武技或军师技(1-2个) | 困难跨Run条件 |
| SSS | 绝世传奇 | 最高 | 1被动+2主动 | 武技或军师技(2个)+独特被动 | 极难跨Run挑战 |

**传说变体命名**：[尊号]·[姓名]
- 关羽 (A) → 武圣·关羽 (SS) → 义绝·关羽 (SSS)
- 诸葛亮 (A) → 卧龙·诸葛亮 (SS) → 鞠躬尽瘁·诸葛亮 (SSS)
- 吕布 (A) → 飞将·吕布 (SS) → 战神·吕布 (SSS)
- 曹操 (A) → 治世能臣·曹操 (SS)
- 赵云 (A) → 常胜将军·赵云 (SS)

**设计原则**：
- 同名武将的基础版和传说变体不能同时编入阵容
- 传说变体拥有全新立绘（不是换色）
- 传说变体的技能是基础版技能的强化或扩展，而非完全不同的技能组

#### Tier 与强度的关系（平衡哲学）

**核心原则：Tier 决定面板上限和技能规格，但不决定在特定 build 中的实际价值。**

- **高 Tier 优势**：更高的属性总和、更多技能槽（武技/军师技）、更强的单卡强度
- **低 Tier 价值**：独特的被动效果可能是某些 build 的核心引擎

**让低 Tier 不沦为废牌的设计手段**：

1. **独特技能效果**：低 Tier 武将的被动可以是某些 build 的核心。例：C 级蒋干「反间」（复制敌方 buff）面板弱但在 debuff build 中不可替代
2. **羁绊需求**：触发强力羁绊可能需要特定的低 Tier 武将——为了凑「五虎上将」，B 级黄忠也值得上场
3. **协同倍率**：完整 build 中的低 Tier 武将通过羁绊加成后，实际战力接近甚至超过孤立的高 Tier 武将
4. **经济优势**：低 Tier 武将获取成本低，养成成本低——资源紧张时是性价比之选

**预期平衡结果**：
- 单张对比：高 Tier > 低 Tier（满足收集高 Tier 的快感）
- Build 对比：精心构筑的低/中 Tier 组合 ≥ 散装高 Tier 阵容（满足构筑智慧）
- 成型前 vs 成型后：build 未成型时高 Tier 面板优势明显；build 成型后协同效果弥补面板差距

#### 4. Factions (阵营)

| 阵营 | 标识色 | 定位偏向 | 代表角色 |
|------|--------|---------|---------|
| 魏 Wei | 蓝 | 均衡/控制 | 曹操、司马懿、张辽、夏侯惇、典韦 |
| 蜀 Shu | 绿 | 攻击/义气 | 刘备、关羽、张飞、赵云、诸葛亮 |
| 吴 Wu | 红 | 速度/联动 | 孙权、周瑜、陆逊、甘宁、吕蒙 |
| 群 Qun | 紫 | 独立/特殊 | 吕布、貂蝉、董卓、华佗、袁绍 |

- 阵营影响羁绊加成（同阵营武将越多，阵营加成越强）
- 阵营不限制编队——可以混编任意阵营
- 部分武将根据历史阶段可能有不同阵营归属（吕布=群，但某些变体可能为其他阵营）

#### 5. Skill System (技能结构)

**技能数据模型**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | 技能名称 (e.g., "青龙偃月") |
| `type` | enum | passive (被动/光环) / active (主动，自动释放) |
| `trigger` | TriggerCondition | 触发条件 |
| `effect` | Effect[] | 效果列表（可有多个效果） |
| `target` | TargetType | self / single_enemy / all_enemies / single_ally / all_allies / aoe_area |
| `scaling` | ScalingStat | 成长基准属性 (STR / INT / HP / DEF / SPD) |
| `cooldown` | number? | 冷却时间（主动技能，单位：回合/秒） |

**触发条件类型**:
- `on_battle_start` — 战斗开始时
- `on_attack` / `on_nth_attack(n)` — 每次攻击时 / 每N次攻击时
- `on_take_damage` — 受到伤害时
- `on_hp_below(threshold)` — 生命低于阈值时
- `on_ally_death` — 友方武将阵亡时
- `on_kill` — 击杀敌人时
- `on_turn_start` / `on_turn_end` — 回合开始/结束时
- `passive_aura` — 持续光环效果

**技能设计反映历史形象**（示例）:
- 关羽「青龙偃月」(active, STR scaling): 大范围高伤害斩击
- 诸葛亮「八阵图」(active, INT scaling): 全体敌人减速+降低命中
- 华佗「刮骨疗毒」(active, INT scaling): 单体治疗+清除负面状态
- 张飞「怒吼」(passive, on_battle_start): 震慑前排敌人，降低其攻击间隔
- 司马懿「隐忍」(passive, on_hp_below(50%)): 大幅提升 DEF 和 SPD

#### 6. Martial Arts & Advisor Skills (武技与军师技)

**智力将专属：军师技 (Advisor Skill)**
- 仅 S 及以上的高级智力型武将可携带
- 由玩家在战斗中手动释放，影响全局战场
- 具有冷却时间，一场战斗中使用次数有限
- 例：诸葛亮「借东风」— 全体敌人受到火焰伤害 + 降低DEF

**武力将专属：武技 (Martial Art)**
- 仅 S 及以上的高级武力型武将可携带
- 自动触发（满足条件时），作用于自身或周围
- 武技类型多样，因将而异：

| 武技类型 | 效果 | 示例 |
|---------|------|------|
| 突阵 | 无视前排直击后排 | 飞将·吕布「无双冲锋」 |
| 连斩 | 击杀后立即攻击下一目标 | 武圣·关羽「过五关」 |
| 万夫不当 | 周围敌人越多，属性加成越高 | 常胜将军·赵云「七进七出」 |
| 震慑 | 降低周围敌人属性 | 张飞「当阳桥」变体 |
| 铁壁 | 为身后友军承受伤害 | 典韦「悍卫」 |

**对称设计**:
- 智力将的军师技：全局/战略层面，玩家手动 → 体现「运筹帷幄」
- 武力将的武技：个人/战术层面，自动触发 → 体现「一骑当千」
- 两者同样强力但作用方式不同，构筑时需要平衡两种类型

#### 7. Hero Acquisition (武将获取)

| 获取方式 | 说明 | 可获取 Tier | 备注 |
|---------|------|------------|------|
| 初始随从 | 开局君主自带的起始武将 | C-B | 随君主不同而不同 |
| 招募事件 | 地图节点，消耗金币从候选池中选择 | C-A | 候选池受剧本和进度影响 |
| 历史事件 | 特殊剧情节点触发 (e.g., 三顾茅庐→诸葛亮) | B-A | 尊重历史故事线 |
| Boss 奖励 | Boss 击败后额外概率掉落（独立于宝箱），S+ 仅从 Boss 掉落。低等级武将（C-A）通过招募节点获取，不从战斗掉落 | A-S+ | Boss 击败后概率掉落 |
| 跨Run解锁 | 完成特殊成就/挑战条件 | S-SSS | 传说变体的唯一获取途径 |

> **注意**：S+ 传说变体的首次获取来自 Boss 战掉落。使用后积累亲密度，可进入局外招募池。

**设计原则**：
- 基础版 (C-A) 在单次 run 内即可获得足够阵容
- 传说变体 (S-SSS) 需要跨 run 积累，是长期目标
- 获取方式尊重历史——三顾茅庐才能得到诸葛亮，不能在市集花钱买

#### 8. Progressive Complexity (渐进式复杂度)

遵循跨系统设计准则（见 game-concept.md），武将系统的机制按内容等级逐步展开：

| 复杂度层 | Tier | 涉及机制 | 玩家需理解 | 开发阶段 |
|---------|------|---------|-----------|---------|
| **基础层** | C-B | 五维属性、1 个简单被动、基础装备槽 | 属性高低 + 站位前后 | MVP 必须 |
| **中级层** | A | 主动技能（自动释放）、羁绊组合触发、装备强化 | 技能触发条件 + 阵营搭配 | MVP 必须 |
| **高级层** | S-SSS | 武技/军师技、特殊装备词条、传说变体、复杂状态交互 | 武技类型选择 + 军师技时机 + 高级构筑策略 | Vertical Slice+ |

**规则**：
- C-B 级武将绝不使用高级层机制——它们只有基础被动，没有武技/军师技
- A 级武将引入主动技能，但不涉及武技/军师技
- S+ 传说变体才携带武技或军师技——这些是跨 Run 解锁的奖励内容
- MVP 可以只实现基础层+中级层就得到完整可玩的核心循环

### States and Transitions

武将在一次 Run 中的生命周期状态：

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Unowned** | 默认状态 / 游戏数据中存在 | 通过获取事件进入 Owned | 不可使用，不可查看详情（图鉴中显示剪影） |
| **Owned (Bench)** | 获取武将 | 编入阵容 → Deployed / Run 结束 → 归档 | 在替补席中，可查看、可养成、可装备 |
| **Deployed** | 被编入当前出战阵容 | 移出阵容 → Bench / 战斗中阵亡 → KO | 参与战斗，占据棋盘站位 |
| **In Combat** | 战斗开始 | 战斗结束 → Deployed / HP归零 → KO | 执行自动战斗逻辑、释放技能、受到状态效果 |
| **KO** | 战斗中 HP 归零 | 战斗结束 → Owned (需恢复) | 本场战斗不可行动；战斗结束后自动恢复到满HP（roguelike简化） |

**传说变体状态**:

| State | Entry Condition | Exit Condition |
|-------|----------------|----------------|
| **Locked** | 默认 | 满足跨Run解锁条件 → Unlocked |
| **Unlocked** | 解锁条件达成 | 永久解锁，Run 开始时可选用 |

**约束**：同名武将的基础版和传说变体不能同时处于 Deployed 状态。

### Interactions with Other Systems

| System | Direction | Interface Description |
|--------|-----------|----------------------|
| **Equipment System** | 双向 | 装备附着在武将上；装备属性加成写入 `equipBonus`；武将提供装备槽数据 |
| **Bond System** | 读取 Hero | 读取阵容中所有武将的 `faction` 和 `bondKeys`，计算羁绊加成写入 `bondModifier` |
| **Hero Growth** | 修改 Hero | 读取武将当前属性，写入 `growthBonus`（等级/经验/技能升级） |
| **Battle Engine** | 读取 Hero | 读取 Deployed 武将的最终属性 + 技能 + 武技/军师技，驱动战斗逻辑 |
| **Battle AI** | 读取 Hero | 读取武将技能、目标类型、属性，决定自动行为 |
| **Enemy System** | 共享模型 | 敌方武将复用 Hero 数据模型（可能有特殊敌人专属字段） |
| **Event System** | 触发 → Hero | 事件产出新武将实例（招募/历史事件） |
| **Loot System** | 触发 → Hero | 战利品可能包含武将卡 |
| **Status System** | 修改 Hero (runtime) | 战斗中施加/移除状态效果，影响 `statusModifier` |
| **Campaign System** | 约束 Hero | 剧本决定哪些武将在当前 run 的可获取池中 |
| **Monarch System** | 提供初始 | 君主决定起始武将阵容 |
| **Meta Progression** | 解锁 Hero | 跨Run进度解锁传说变体 |
| **Save/Load** | 序列化 Hero | 持久化武将拥有状态、养成进度、解锁记录 |
| **Hero Detail UI** | 读取 Hero | 显示武将立绘、属性、技能、装备、羁绊、背景故事 |
| **Battle UI** | 读取 Hero | 显示战斗中武将血条、技能动画、站位 |

## Formulas

### Final Stat Calculation

```
finalStat = (baseStat + growthBonus + equipBonus) * (1 + bondModifier + statusModifier)
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| baseStat | int | 1-200 | Hero data file | 武将基础属性值（由 Tier 和角色设计决定） |
| growthBonus | int | 0-100 | Hero Growth System | 等级提升带来的属性加成 |
| equipBonus | int | 0-80 | Equipment System | 装备提供的属性加成 |
| bondModifier | float | 0.0-0.25 | Bond System | 羁绊加成（百分比） |
| statusModifier | float | -0.5-1.0 | Status System | 战斗中 buff/debuff（百分比） |

**Expected output range**: finalStat 约 1-500 (满级满装满羁绊满buff)
**Clamp**: finalStat 最低为 1（任何属性不得被减至 0 或负数）

### Base Stat Ranges by Tier

| Tier | Single Stat Range | Total Stats (5维总和) |
|------|-------------------|----------------------|
| C | 5-15 | 35-55 |
| B | 10-25 | 55-85 |
| A | 15-40 | 85-130 |
| S | 25-55 | 130-180 |
| SS | 35-70 | 180-240 |
| SSS | 50-90 | 240-320 |

**注意**: 同 Tier 内总和范围相近，但单项属性分布差异大。例如 A 级关羽可能是 STR:38 INT:12 DEF:28 HP:35 SPD:18 (总和131)，A 级诸葛亮可能是 STR:10 INT:40 DEF:15 HP:25 SPD:35 (总和125)。

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| 属性被 debuff 减至 0 以下 | Clamp 到 1，属性永远不为 0 或负数 | 防止除零错误和逻辑异常 |
| 同名基础版和传说变体同时在阵容中 | 系统阻止，UI 提示"同名武将不可同时上场" | 防止数据冲突和平衡问题 |
| 所有 Deployed 武将在战斗中被 KO | 战斗判负，进入失败结算 | 这是正常的失败条件 |
| 武将 tags 为空 | 允许，但该武将不会触发任何基于 tag 的羁绊 | C 级小兵型武将可能没有特征标签 |
| 传说变体的基础版未被拥有 | 允许直接使用传说变体，不要求拥有基础版 | 传说变体是独立卡牌，不是"升级" |
| Run 中获取武将时阵容已满（替补席上限） | 玩家必须选择放弃一位现有武将或放弃新武将 | 替补席上限制造有意义的取舍 |
| 同一场战斗中多个军师技同时可用 | 允许多个智力将各自携带军师技，但每回合只能使用一个 | 军师技是稀缺资源，不能无限叠加 |
| 武将在战斗中被施加多个同类状态 | 不叠加，取效果最强的一个（详见 Status System GDD） | 防止状态叠加导致数值爆炸 |

## Dependencies

**本系统无上游依赖（Foundation Layer）。**

| System | Direction | Nature | Hard/Soft |
|--------|-----------|--------|-----------|
| Equipment System | depends on Hero | 读取武将装备槽，写入 equipBonus | Hard |
| Bond System | depends on Hero | 读取 faction + bondKeys，写入 bondModifier | Hard |
| Hero Growth | depends on Hero | 读取武将属性，写入 growthBonus | Hard |
| Battle Engine | depends on Hero | 读取最终属性+技能，驱动战斗 | Hard |
| Battle AI | depends on Hero | 读取技能和属性做决策 | Hard |
| Enemy System | depends on Hero | 复用数据模型 | Hard |
| Event System | depends on Hero | 事件产出武将实例 | Hard |
| Loot System | depends on Hero | 战利品包含武将卡 | Soft |
| Status System | modifies Hero (runtime) | 战斗中修改 statusModifier | Hard |
| Campaign System | constrains Hero | 决定可获取武将池 | Soft |
| Monarch System | depends on Hero | 提供初始武将 | Hard |
| Meta Progression | depends on Hero | 解锁传说变体 | Soft |
| Save/Load | depends on Hero | 序列化武将数据 | Hard |
| Hero Detail UI | depends on Hero | 显示武将信息 | Hard |
| Battle UI | depends on Hero | 显示战斗中武将 | Hard |

**注意**：Status System 已加入 systems-index (#21, Designed)。

## Tuning Knobs

| Parameter | Current Value | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|--------------|------------|-------------------|-------------------|
| `BENCH_MAX_SIZE` | 8 | 5-12 | 更多阵容灵活性，降低取舍压力 | 更强的取舍决策，更紧张的资源管理 |
| `DEPLOY_MAX_SIZE` | 5 | 3-7 | 更多武将上场，羁绊更容易触发 | 更精简阵容，每个位置权重更大 |
| `TIER_STAT_MULTIPLIER` | 见Formulas | ±20% | Tier 差距加大，高 Tier 更强势 | Tier 差距缩小，低 Tier 更有价值 |
| `LEGEND_UNLOCK_DIFFICULTY` | (per variant) | — | 延长长期目标，增加重玩价值 | 缩短解锁周期，更快体验完整内容 |
| `SKILL_SLOTS_BY_TIER` | C:1 B:1 A:2 S:2 SS:3 SSS:4 | ±1 per tier | 高Tier武将更强更多样 | 技能数量差距缩小 |
| `ADVISOR_SKILL_PER_TURN` | 1 | 1-2 | 军师技影响力增大 | — |

## Visual/Audio Requirements

| Event | Visual Feedback | Audio Feedback | Priority |
|-------|----------------|---------------|----------|
| 获得新武将 | 光荣式立绘展开动画 + Tier 对应的光效（SSS=金色粒子） | 铜锣/鼓声，Tier越高越庄重 | High |
| 武将升级 | 属性数字上涨动画 + 闪光 | 升级音效 | Medium |
| 技能释放 | 技能专属动画（半身立绘切入 + 特效） | 技能专属音效 | High |
| 武技触发 | 屏幕震动 + 武将特写 + 斩击/冲锋特效 | 冲击音效 | High |
| 军师技释放 | 全屏演出（短暂） + 全局特效 | 战鼓/号角 | High |
| 武将 KO | 倒下动画 + 灰度化 | 坠落音效 | Medium |
| 羁绊触发 | 涉及武将连线光效 + 羁绊名称弹出 | 和弦音效 | Medium |

## UI Requirements

| Information | Display Location | Update Frequency | Condition |
|-------------|-----------------|-----------------|-----------|
| 武将立绘+名字+Tier | 武将卡牌 | 静态 | 始终显示 |
| 五维属性 (当前/最终) | 武将详情面板 | 装备/养成变化时 | 点击武将卡 |
| 技能列表+描述 | 武将详情面板 | 静态 | 点击武将卡 |
| 武技/军师技标识 | 武将卡牌角标 | 静态 | S+武将 |
| 阵营图标 | 武将卡牌 | 静态 | 始终显示 |
| 战斗中 HP 条 | 棋盘上武将头顶 | 每帧 | 战斗中 |
| 战斗中技能冷却 | 武将头顶小图标 | 每帧 | 战斗中 |
| 替补席武将列表 | 编队界面侧栏 | 获取/移除武将时 | 编队阶段 |

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| 替补席上限 (BENCH_MAX_SIZE) 的最佳值需要原型验证 | Game Designer | Prototype phase | 通过 playtesting 确定 |
| 出战人数 (DEPLOY_MAX_SIZE) 的最佳值需要配合棋盘大小设计 | Game Designer | Battle System GDD | 与 Battle Engine 同步决定 |
| 传说变体的具体解锁条件需要配合 Meta Progression 设计 | Game Designer | Meta Progression GDD | 设计该系统时确定 |
| 武技类型是否需要更多种类 | Game Designer | Balance Check | Prototype 后根据多样性需求扩展 |
| Status System 需要作为新系统加入 systems-index | Producer | Next session | **已解决**：Status System 已加入 systems-index (#21, Designed) |
| 军师技的冷却机制和使用次数需在 Battle Engine GDD 中细化 | Game Designer | Battle Engine GDD | **已解决**：Battle Engine GDD 已定义 ADVISOR_SKILL_USES |

## Acceptance Criteria

- [ ] 所有武将数据可从 JSON/配置文件加载，无硬编码
- [ ] 五维属性计算 `finalStat` 正确应用所有加成（growth + equip + bond + status）
- [ ] 属性值永远不低于 1（clamp 生效）
- [ ] 同名基础版和传说变体不能同时编入阵容（UI 阻止 + 逻辑校验）
- [ ] 6 个 Tier 的属性总和范围符合 Formulas 中定义的区间
- [ ] 技能触发条件正确执行（on_kill, on_hp_below 等）
- [ ] 武技和军师技仅在对应类型的 S+ 武将上生效
- [ ] 4 阵营数据正确加载，用于羁绊系统查询
- [ ] 替补席上限 (`BENCH_MAX_SIZE`) 生效，超出时提示玩家取舍
- [ ] 武将获取的 5 种方式均可正确产出武将实例
- [ ] 每个武将的 tags 和 bondKeys 可被其他系统正确读取
- [ ] Performance: 武将属性计算在 1ms 内完成（单个武将）
- [ ] MVP 有 15-20 个完整定义的武将数据文件可加载

