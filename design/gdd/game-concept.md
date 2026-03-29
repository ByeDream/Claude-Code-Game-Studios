# Game Concept: 煮酒 (Heroes' Toast)

*Created: 2026-03-28*
*Status: Draft*

---

## Elevator Pitch

> 一款三国历史背景的 roguelike 卡牌游戏——你扮演一方君主，在历史剧本的推进下
> 招募武将、编排阵容、触发羁绊，通过自走棋式的自动战斗征服乱世。每一次 run
> 是一段历史的重演，每一位武将都是值得收集和培养的珍宝。
> 煮酒论英雄——谁才是真正的天下之主？

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Roguelike 卡牌 + 自走棋（Auto-battler Deckbuilder Roguelike） |
| **Platform** | PC 优先（Steam/itch.io），后续考虑移植 |
| **Target Audience** | 18-35岁中核玩家，喜欢三国题材和策略构筑 |
| **Player Count** | 单人 |
| **Session Length** | 30-60 分钟（一次 run） |
| **Monetization** | Premium（买断制） |
| **Estimated Scope** | Small-Medium（MVP 4-6 周，完整版 24+ 周） |
| **Comparable Titles** | 杀戮尖塔 (Slay the Spire) × 炉石酒馆战棋 (HS Battlegrounds) × 三国群英传 |

---

## Core Fantasy

你是乱世中的一方君主。从一个小势力起步，你通过慧眼识人招募英雄、知人善任编排
阵容，看着手下武将从无名之辈成长为一骑当千的名将。武将之间的历史羁绊被你巧妙
利用——桃园三结义、五虎上将、司马家族——每一个组合都让你的军团产生质的飞跃。

这不是一个关于操作的游戏。这是一个关于**眼光**和**养成**的游戏：选对人、放对位、
养对将，然后看着你精心构筑的阵容碾压一切。

---

## Unique Hook

> 像炉石酒馆战棋的自动战斗构筑，**AND ALSO** 套在三国历史剧本的叙事框架里——
> 每次 run 是一段真实历史的重演，武将不是随机生成的卡牌，而是带着历史故事和
> 人物关系的活生生的角色。历史事件驱动游戏节奏，你的决策重写历史细节。

这个钩子同时服务两个支柱：「收集之乐」（武将是历史人物，有天然的收集欲）和
「历史沉浸」（不是换皮，是体验三国）。

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 4 | 光荣式精美武将立绘、战斗特效、技能爆发动画 |
| **Fantasy** (make-believe, role-playing) | 2 | 扮演君主、招募历史名将、重写三国历史 |
| **Narrative** (drama, story arc) | 5 | 历史剧本驱动的大事件节点，武将的故事背景 |
| **Challenge** (obstacle course, mastery) | 3 | 阵容构筑的深度、羁绊组合的探索、boss 战的策略要求 |
| **Fellowship** (social connection) | N/A | 单人游戏，无社交系统 |
| **Discovery** (exploration, secrets) | 1 | 发现新武将、新羁绊组合、隐藏的历史事件分支 |
| **Expression** (self-expression, creativity) | 3 | 每次 run 构筑独一无二的武将阵容 |
| **Submission** (relaxation, comfort zone) | 6 | 自动战斗的轻松观战感，低操作门槛 |

### Key Dynamics (Emergent player behaviors)

- 玩家会自发记忆武将组合，形成"我的招牌阵容"
- 玩家会因为想触发特定羁绊而改变整个 run 的策略方向
- 玩家会为了一个心仪武将在事件中冒险（"赌一把挑战吕布"）
- 玩家会发现意料之外的武将搭配产生超强联动
- 玩家会在社区分享自己的"三国 IF 故事"

### Core Mechanics (Systems we build)

1. **自走棋式战斗** — 武将自动战斗 + 站位编排 + 军师技手动干预
2. **武将收集系统** — 招募、Boss掉落、事件获取，每位武将独特技能组
3. **羁绊系统** — 阵营加成 + 特殊武将组合触发独特效果
4. **武将养成** — 等级、装备（武器系统）、技能（武技/策略）
5. **历史剧本系统** — 大事件按历史推进，细节随玩家选择变化

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | 阵容构筑自由度、事件抉择、养成路线选择 | Core |
| **Competence** (mastery, skill growth) | 构筑越来越精妙、发现更强的羁绊组合、征服更难的剧本 | Core |
| **Relatedness** (connection, belonging) | 与历史武将建立情感连接、收集的满足感 | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** (goal completion, collection, progression) — 收集全武将、触发全羁绊、解锁全剧本、完美通关
- [x] **Explorers** (discovery, understanding systems, finding secrets) — 发现隐藏武将组合、探索不同构筑路线、触发隐藏历史事件
- [ ] **Socializers** (relationships, cooperation, community) — 单人游戏，但社区分享构筑和故事
- [ ] **Killers/Competitors** (domination, PvP, leaderboards) — 不适用

### Flow State Design

- **Onboarding curve**: 第一个剧本（黄巾之乱）作为教程，逐步引入武将、站位、羁绊概念。前 3 场战斗只需关注基础站位，第 4 场引入第一个羁绊
- **Difficulty scaling**: 历史剧本自然提供难度曲线——黄巾军 < 董卓军 < 群雄割据。同时 run 内敌人强度逐步提升
- **Feedback clarity**: 武将升级有明确的数值展示和视觉变化；羁绊触发时有醒目的特效反馈；战斗伤害数字清晰可见
- **Recovery from failure**: Roguelike 模式——失败后回到剧本选择，保留跨 run 解锁进度。失败时展示"差一点"的反馈（boss 剩余血量），激励再来一次

---

## Core Loop

### Moment-to-Moment (30 seconds)
**编排 → 观战 → 干预**

战前阶段：查看敌方阵容 → 排列武将站位（前排/后排/侧翼）→ 选择军师技。
战斗开始后武将自动攻击，玩家观察战况，在关键时刻使用军师技扭转战局。
一场战斗 30-60 秒。

核心满足感：看到精心编排的阵容自动碾压敌人，或用一手军师技绝境翻盘。

### Short-Term (5-15 minutes)
**事件节点推进**

在剧本地图上选择下一个节点：
- ⚔️ **战斗**: 与敌军交战，获得战利品
- 🏯 **招募**: 获得新武将卡牌（核心多巴胺时刻）
- 🔨 **锻造/训练**: 强化武将（升级、装备、学技能）
- 📜 **历史事件**: 触发剧情选择，影响后续路线和可用武将
- 🏪 **市集**: 购买装备和兵法卡

"再打一个节点"的驱动力：下一个节点可能招到梦寐以求的武将，或触发强力羁绊。

### Session-Level (30-60 minutes)
**一次 Run = 一个历史剧本**

选择历史起点（如「黄巾之乱」）→ 选择君主 → 经历 12-18 个节点 →
面对章节 Boss → 根据表现获得评价和跨 run 奖励。

一次 run 约 30-60 分钟。自然的结束点是 Boss 战结束（胜利或失败）。

### Long-Term Progression
**跨 Run 解锁**

- 解锁新的历史剧本起点（黄巾之乱 → 讨伐董卓 → 群雄逐鹿 → 三雄鼎立 → ...）
- 解锁新的可选君主（不同君主有不同的起始武将和被动能力）
- 扩展武将卡池（新武将进入可招募池）
- 解锁新的羁绊线
- 成就系统（收集进度、特殊通关条件）

### Retention Hooks

- **Curiosity**: "下一个剧本会有什么新武将？" "我还没触发过五虎上将的满羁绊效果"
- **Investment**: 跨 run 解锁的武将和剧本进度，不想浪费
- **Social**: 社区分享独特的 run 故事和构筑搭配
- **Mastery**: "这次我要用纯谋士阵容通关" "我要无伤过赤壁之战"

---

## Game Pillars

### Pillar 1: 收集之乐 (The Joy of Collection)
每一位武将都是独一无二的珍宝——独特的技能、光荣式精美立绘、历史背景故事。
获得新武将的瞬间是游戏最核心的多巴胺时刻。

*Design test*: 如果在「增加一个新系统」和「增加 5 个有特色的新武将」之间选，
我们选新武将。

### Pillar 2: 构筑智慧 (Tactical Assembly)
游戏的深度在构筑而非操作——站位、阵容搭配、羁绊组合、装备分配。每次构筑
都应该让玩家觉得自己在运筹帷幄。

*Design test*: 如果一个机制增加了操作强度但减少了构筑选择，我们砍掉它。

### Pillar 3: 历史沉浸 (Living History)
三国不是换皮的借口——历史事件、武将性格、势力关系应该影响游戏机制。玩家
应该觉得自己在亲历三国，而不只是在玩带三国图案的卡牌。

*Design test*: 如果一个机制放到任何题材都能用（没有三国特色），我们要么赋予
它三国灵魂，要么砍掉。

### Pillar 4: 养成爆发 (From Nobody to Legend)
武将的成长弧线是情感核心——从无名之辈到一骑当千。每次强化都应该有肉眼可见
的回馈感。

*Design test*: 如果一个养成系统的效果不够直观（玩家看不出变强了），我们要么
增加反馈效果，要么重新设计数值。

### Cross-System Design Principle: 渐进式复杂度 (Progressive Complexity)

**高级武将/装备/技能才引入高级系统机制。** 这是贯穿所有系统的设计准则：

- **低 Tier 内容 (C-B)** 只使用最基础的规则（五维属性、简单被动、普通装备），玩家入门零门槛
- **中 Tier 内容 (A)** 引入中级机制（主动技能、羁绊组合、装备强化），自然展开系统深度
- **高 Tier 内容 (S-SSS)** 引入高级机制（武技/军师技、特殊装备词条、传说变体、复杂状态效果），给老手提供挖掘空间

**这个原则同时服务于三个目标**：
1. **玩家体验递进**：理解成本随游戏进程自然分摊，不会一上来就信息过载
2. **内容消耗节奏**：新机制持续解锁，延长新鲜感和探索感
3. **开发优先级**：基础层可独立运作，高级机制可逐步实现——MVP 只需实现 C-B 级内容涉及的规则

*Design test*: 如果一个系统机制只有获取 S+ 内容时才接触到，那它不属于 MVP 的必须实现项。

### Anti-Pillars (What This Game Is NOT)

- **NOT 操作游戏**: 不会添加需要反应速度或手动微操的机制，这会损害「构筑智慧」
- **NOT 硬核策略游戏**: 不做光荣三国志那样复杂的内政/外交系统，精简策略层
- **NOT PvP 竞技游戏**: 核心体验是单人叙事+收集养成，不设计围绕 PvP 平衡的系统
- **NOT 开放世界**: Run 有明确的路径和节点结构，不做自由探索

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| 杀戮尖塔 (Slay the Spire) | Roguelike 地图节点结构、run-based 进度 | 自走棋战斗取代手动出牌；三国剧本取代随机地图 | 验证了单人 roguelike 卡牌的巨大市场 |
| 炉石酒馆战棋 / 大巴扎 | 自走棋式自动战斗 + 阵容编排 | 单人 PvE 而非 PvP；加入历史叙事和武将养成 | 验证了自动战斗构筑的长期吸引力 |
| 三国群英传 | 历史剧本框架、武将收集、势力征服感 | 大幅精简策略层，聚焦卡牌战斗和收集养成 | 验证了三国题材 + 武将收集的持久市场 |
| 太阁立志传 | 大事件遵循历史大纲，细节按玩家进度变化 | 更线性的节点结构，不做开放世界 | 验证了"历史 sandbox"的叙事模式 |

**Non-game inspirations**:
- 太阁立志传系列的视听美学——清晰、节俭、历史感强，用简洁手法传达厚重感
- 《三国演义》原著——武将性格、经典桥段（桃园结义、过五关斩六将、空城计）作为游戏事件的灵感
- 策略桌游（如 War of the Ring）——有限行动点 + 关键时刻的重大决策感

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 18-35 |
| **Gaming experience** | Mid-core（中核玩家） |
| **Time availability** | 30-60 分钟 session，工作日晚上或周末 |
| **Platform preference** | PC (Steam) |
| **Current games they play** | 杀戮尖塔、炉石酒馆战棋、大巴扎、率土之滨、三国志战略版 |
| **What they're looking for** | 有深度的策略构筑 + 三国情怀 + 单人可反复游玩的收集养成 |
| **What would turn them away** | 过于复杂的操作要求；无深度的纯数值碾压；对三国的不尊重或低品质换皮 |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Engine** | Web (React 19 + HTML Canvas + TypeScript)，Tauri v2 打包为独立桌面应用。开发时纯 Web 流程（Agent 可自动测试/截图），发布时零改动打包 |
| **Build Tool** | Vite |
| **Rendering** | HTML Canvas (棋盘/战斗) + React DOM (UI) |
| **Key Technical Challenges** | 武将技能多样性实现；羁绊组合爆炸测试；历史事件脚本系统；自走棋 AI |
| **Art Style** | 武将立绘采用光荣式精美写实风格（武将和装备是收集核心，必须漂亮）；UI 采用太阁立志传式干净清晰的历史感界面；历史事件卡采用水墨画风格 |
| **Art Pipeline Complexity** | High（武将立绘要求高品质；UI 风格节制但需要统一感；事件卡水墨画风需要专门制作） |
| **Audio Needs** | Moderate（太阁立志传式配乐——清淡古风、历史感强、不喧宾夺主。战斗音效简洁有力） |
| **Networking** | None（单机） |
| **Content Volume** | MVP: 15-20 武将, 1 剧本, ~5 小时 → 完整版: 80+ 武将, 5+ 剧本, 30+ 小时 |
| **Procedural Systems** | 事件节点的半随机生成（固定大事件 + 随机小事件）；战利品随机 |

---

## Risks and Open Questions

### Design Risks
- 自动战斗可能让玩家感觉缺乏参与感——「军师技」必须提供足够的决策权重和爽快感
- 羁绊系统容易出现"最优解"，导致每次 run 收敛到同一阵容——需要多条可行路线和随机性制衡
- 历史剧本可能限制随机性——需要平衡"按历史来"和"每次 run 不同"的张力

### Technical Risks
- Canvas 战斗动画的表现力上限——需要验证是否足以呈现有冲击力的战斗场面
- 武将技能多样性实现——50+ 武将各有独特技能，测试和平衡工作量大
- 自走棋 AI 的目标选择和技能释放逻辑需要仔细调教

### Market Risks
- 三国题材在国际市场的接受度——可能需要出色的本地化和文化包装
- Roguelike 卡牌市场趋于成熟——需要足够的差异化（历史叙事 + 自走棋是我们的答案）
- 独立开发者的美术品质与光荣式立绘期望之间的差距——可能需要策略性地控制立绘数量

### Scope Risks
- 武将内容生产是最大瓶颈——每位武将需要：立绘、技能设计、平衡数值、背景故事
- 历史剧本撰写和事件分支设计工作量可能超出预期
- Phase 1 → Phase 2 的引擎迁移可能比预想耗时

### Open Questions
- 军师技的具体设计——多少个？冷却机制？如何让它成为关键决策点？→ 需要原型验证
- 武将 tier 分布——S/A/B/C 的比例和获取方式？→ 需要经济系统设计
- 自走棋棋盘尺寸和站位设计——多大的棋盘？几个武将上场？→ 需要原型验证
- 跨 run 解锁的节奏——太快则无新鲜感，太慢则有挫败感 → 需要数值调优

---

## MVP Definition

**Core hypothesis**: 「在三国历史事件推进下，自走棋式武将编排 + 武将收集养成 +
羁绊联动的核心循环足够有趣，能让玩家持续投入 30 分钟以上的 session 并想要再来一次」

**Required for MVP**:
1. 1 个历史剧本起点（黄巾之乱 → 讨伐董卓），12-18 个节点
2. 15-20 个武将，覆盖 3-4 个阵营，每位有独特技能
3. 自走棋式战斗系统（站位编排 + 自动战斗 + 2-3 个军师技）
4. 基础羁绊系统（阵营加成 + 3-5 个特殊组合触发）
5. 事件系统（战斗 / 招募 / 锻造 / 历史事件 节点）
6. 武将基础养成（等级提升 + 装备系统）

**Explicitly NOT in MVP** (defer to later):
- 多个君主选择（MVP 只有一位默认君主）
- 多个历史剧本起点
- 完整的武技/策略技能系统
- 跨 Run 永久解锁系统
- 精美 UI / 音效 / 动画打磨
- 高品质武将立绘（MVP 使用占位美术）

### Scope Tiers

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 15-20 武将, 1 剧本 | 核心战斗+收集+基础羁绊 | 4-6 周 |
| **Vertical Slice** | 30 武将, 2 剧本 | +完整羁绊+养成+军师技 | 8-10 周 |
| **Alpha** | 50 武将, 3 剧本 | +跨Run解锁+多君主+正式美术 | 14-18 周 |
| **Full Vision** | 80+ 武将, 5+ 剧本 | 全功能+打磨+音效+本地化 | 24+ 周 |

---

## Next Steps

- [ ] Decompose concept into systems (`/map-systems` — maps dependencies, assigns priorities)
- [ ] Author per-system GDDs (`/design-system` — guided, section-by-section)
- [ ] Create first architecture decision record (`/architecture-decision`)
- [ ] Prototype core loop (`/prototype card-battle`)
- [ ] Validate core loop with playtest (`/playtest-report`)
- [ ] Plan first milestone (`/sprint-plan new`)
