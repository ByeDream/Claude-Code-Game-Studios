# Sprint 1 -- 2026-03-31 to 2026-04-13

## Sprint Goal

搭建项目基础架构，实现核心数据模型（武将/装备/羁绊/经济），并产出可运行的战斗系统原型以验证「自走棋自动战斗是否好玩」这一核心假设。

## Capacity

- Total days: 10（工作日）
- Buffer (20%): 2 days（预留给意外问题、学习曲线、环境问题）
- Available: 8 days

说明：首次 Sprint，无历史 velocity 数据。1 人 + AI agents 的产能估算偏保守，
实际产能在 Sprint 结束后校准。AI agents 可并行处理独立任务，但集成和审查仍需人工。

## Tasks

### Must Have (Critical Path)

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|--------------|---------------------|
| S1-01 | **项目脚手架搭建**: 初始化 React 19 + Vite + TypeScript (strict) 项目；配置 Vitest + React Testing Library；配置 ESLint/Prettier；创建目录结构 (src/core, src/gameplay, src/ui 等)；确保 `npm run dev` / `npm run test` / `npm run build` 均可运行 | Developer | 0.5 | — | `npm run dev` 启动无报错；`npm run test` 运行示例测试通过；`npm run build` 构建成功；TypeScript strict mode 启用；目录结构符合 CLAUDE.md 定义 |
| S1-02 | **Canvas + React 混合渲染 PoC**: 创建基础 Canvas 组件嵌入 React；验证 Canvas 绘制循环 (requestAnimationFrame) 与 React 状态管理共存；实现简单的棋盘网格绘制（5v5 一排对位布局） | Developer | 1 | S1-01 | Canvas 在 React 组件中正常渲染；60fps 绘制循环运行；可在 Canvas 上绘制 5v5 位置网格；React 状态变化能触发 Canvas 重绘 |
| S1-03 | **Hero System 数据模型**: 实现 `HeroData` TypeScript 类型/接口（id, name, faction, tier, baseStats, skills, tags, bondKeys 等完整字段）；创建 `HeroInstance` 运行时状态类型（当前HP, 当前属性, 装备槽, 状态效果等）；实现 `createHeroInstance(data, level)` 工厂函数；编写 3-5 个测试武将数据（关羽、张飞、曹操、周瑜、吕布） | Developer | 1 | S1-01 | 类型定义完整覆盖 hero-system.md 的数据模型；`createHeroInstance` 正确计算含等级加成的属性；5 个测试武将数据可加载；单元测试覆盖属性计算和工厂函数 |
| S1-04 | **Economy 数据模型**: 实现 `ResourceType` 枚举（Gold, Wood, Iron）；实现 `PlayerResources` 状态接口；实现 `canAfford()` / `spend()` / `gain()` 工具函数 | Developer | 0.5 | S1-01 | 类型定义匹配 economy.md；`canAfford` / `spend` / `gain` 函数单元测试通过；负数资源抛出错误；不可透支 |
| S1-05 | **Equipment System 数据模型**: 实现 `EquipmentData` 类型（id, name, type, stats, rarity）；实现 `equipItem()` / `unequipItem()` 函数；实现装备属性叠加到 HeroInstance 的逻辑 | Developer | 0.5 | S1-03 | 类型定义匹配 equipment-system.md；装备/卸装函数正确修改 HeroInstance 属性；装备槽位限制生效；单元测试覆盖装备叠加和边界情况 |
| S1-06 | **Bond System 数据模型**: 实现 `BondDefinition` 类型（id, name, requiredHeroes, effect）；实现 `evaluateBonds(roster)` 函数——输入当前阵容，输出已激活的羁绊列表及效果；实现羁绊属性加成计算 | Developer | 1 | S1-03 | 类型定义匹配 bond-system.md；`evaluateBonds` 正确检测阵营羁绊和特殊组合羁绊；桃园结义（关羽+张飞+刘备）测试用例通过；属性加成正确叠加到 HeroInstance；单元测试覆盖 0/部分/完全激活场景 |
| S1-07 | **Enemy System 数据模型**: 实现 `EnemyTemplate` 类型；实现 `createEnemySquad(templateId, difficulty)` 工厂函数；创建 3-4 个测试敌军模板（黄巾军小兵、黄巾军精英、张角 boss） | Developer | 0.5 | S1-03 | 类型定义匹配 enemy-system.md；工厂函数根据难度缩放敌军属性；测试模板数据可正常加载；单元测试通过 |
| S1-08 | **Battle AI 核心逻辑**: 实现目标选择函数（默认随机攻击 + `target_lowest_hp` / `target_highest_threat` 等覆盖策略）；实现技能释放优先级判定；实现 SPD 排序的行动顺序计算 | Developer | 1 | S1-03, S1-07 | 默认随机目标选择函数在存活敌方中均匀随机；技能覆盖目标策略（lowest_hp, highest_threat）正确筛选目标；SPD 排序正确处理同速情况；单元测试覆盖所有目标选择策略 |
| S1-09 | **Battle Engine 核心原型**: 实现 `BattleState` 类型（双方阵容、回合数、战斗日志）；实现 `initBattle(playerSquad, enemySquad)` → `BattleState`；实现 `executeTurn(state)` → `BattleState`（一回合：按 SPD 排序 → 每个单位行动 → 检查胜负）；实现 `runBattle(state)` → `BattleResult`（循环执行回合直到一方全灭或达到回合上限）；实现百分比减伤公式：`actualDamage = baseDamage * (100 / (100 + DEF))` | Developer | 2 | S1-03, S1-06, S1-07, S1-08 | `initBattle` 正确初始化双方阵容，羁绊加成已计算；`executeTurn` 按 SPD 顺序执行，死亡单位不再行动；`runBattle` 产出胜负结果和完整战斗日志；百分比减伤公式计算正确；回合上限（30回合）超时判定为平局；单元测试：5v5 战斗可运行至结束，强势阵容 vs 弱势阵容胜率 >80%（跑 100 次） |

### Should Have

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|--------------|---------------------|
| S1-10 | **Battle Engine 可视化原型**: 将 S1-09 的纯逻辑战斗接入 S1-02 的 Canvas 渲染；用简单矩形+文字表示武将（显示名字、HP条）；逐回合播放战斗过程（每回合间隔 0.5-1s）；显示伤害数字和技能名称 | Developer | 1.5 | S1-02, S1-09 | 5v5 战斗在 Canvas 上可视化播放；每个武将显示名字和 HP 条；攻击时有目标连线或高亮指示；伤害数字浮动显示；战斗结束显示胜负；可通过按钮重新开始战斗 |
| S1-11 | **Status System 数据模型**: 实现 `StatusEffect` 类型（id, type, duration, magnitude）；实现 `applyStatus()` / `tickStatus()` / `removeStatus()` 函数；实现 buff/debuff 对属性的影响计算 | Developer | 0.5 | S1-03 | 类型定义匹配 status-system.md；buff/debuff 正确修改有效属性；持续时间每回合递减，到期自动移除；同类状态叠加规则正确；单元测试覆盖申请/tick/移除/叠加场景 |

### Nice to Have

| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|--------------|---------------------|
| S1-12 | **Hero Growth 数据模型**: 实现 `levelUp(hero, expGained)` 函数；实现等级→属性成长曲线计算；创建经验值需求表 | Developer | 0.5 | S1-03, S1-04 | 升级函数正确计算新属性；经验值需求表匹配 hero-growth.md 公式；升至满级时不再获取经验；单元测试通过 |
| S1-13 | **战斗平衡初步验证**: 编写自动化测试脚本，批量运行 100+ 场战斗，统计不同阵容搭配的胜率分布；验证羁绊加成的实际战斗影响；输出简单的平衡报告 | Developer | 0.5 | S1-09 | 批量测试脚本可运行；输出胜率统计报告；有羁绊阵容 vs 无羁绊阵容有显著胜率差异（验证羁绊系统有意义） |

## Carryover from Previous Sprint

N/A（首个 Sprint）

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 自走棋战斗不好玩 / 太被动 | Medium | Critical — 核心假设失败需要重新设计 | Sprint 1 优先产出可视化原型 (S1-10)，尽早人工体验并评估手感；记录具体的"不好玩"原因以指导迭代 |
| Canvas + React 集成复杂度超预期 | Low | Medium — 阻塞可视化原型 | S1-02 作为早期 PoC 独立验证；如集成困难，战斗引擎逻辑层（S1-09）仍可独立推进和测试 |
| 数据模型设计遗漏，后续需要大幅重构 | Medium | Medium — 返工成本 | 严格参照已审批的 13 个 GDD 设计文档实现数据模型；每个模型都有单元测试保护，重构有安全网 |
| 首个 Sprint 产能估算不准 | High | Low — 仅影响排期预期 | Must Have 任务已包含 buffer；Should Have / Nice to Have 是弹性空间；Sprint 结束后校准 velocity |
| 战斗公式数值不平衡 | Medium | Low — MVP 阶段可迭代调整 | S1-13 提供自动化平衡验证工具；所有数值外部配置，不硬编码 |

## Dependencies on External Factors

- **npm 包可用性**: React 19, Vite, Vitest, TypeScript 均为成熟包，风险极低
- **Tauri v2**: Sprint 1 不涉及桌面打包，无依赖
- **美术资源**: Sprint 1 全部使用占位图形（矩形+文字），不依赖任何美术资源
- **设计文档**: 13 个 MVP 系统 GDD 均已审批完成，无阻塞

## Definition of Done for this Sprint

- [x] 所有 Must Have 任务完成并通过验收标准
- [x] 核心数据模型（Hero, Equipment, Bond, Economy, Enemy）全部有单元测试
- [x] Battle Engine 可运行纯逻辑 5v5 自动战斗并产出胜负结果
- [x] 无 S1/S2 级 bug（崩溃、数据错误）
- [x] 所有 gameplay 数值通过外部配置，无硬编码
- [x] 代码通过 TypeScript strict 编译，无 any 类型逃逸
- [x] 设计文档中的公式与代码实现一致（可追溯）
- [x] `npm run test` 全部通过 (516 tests)
- [ ] Sprint 回顾：记录实际 velocity、阻塞点、下个 Sprint 调整建议

---

## Completion Status

| ID | Task | Status | Tests | Notes |
|----|------|--------|-------|-------|
| S1-01 | 项目脚手架搭建 | ✅ Done | — | React 19 + Vite + TS strict |
| S1-02 | Canvas + React 混合渲染 PoC | ✅ Done | — | 5v5 grid rendering |
| S1-03 | Hero System 数据模型 | ✅ Done | 43 tests | 5 test heroes, stat formula |
| S1-04 | Economy 数据模型 | ✅ Done | 73 tests | Immutable manager, GDD formulas |
| S1-05 | Equipment System 数据模型 | ✅ Done | — | Equip/unequip, strengthen |
| S1-06 | Bond System 数据模型 | ✅ Done | — | Faction + historical bonds |
| S1-07 | Enemy System 数据模型 | ✅ Done | 84 tests | Factory, scaling, boss phases |
| S1-08 | Battle AI 核心 | ✅ Done | — | SPD order, target selection |
| S1-09 | Battle Engine 核心原型 | ✅ Done | — | initBattle/executeTurn/runBattle |
| S1-10 | Battle 可视化原型 | ✅ Done | — | Canvas rendering + UI controls |
| S1-11 | Status System 数据模型 | ✅ Done | 54 tests | 11 effects, boss/tenacity resistance |
| S1-12 | Hero Growth 数据模型 | ✅ Done | 43 tests | Level-up cost, skill scaling, economy integration |
| S1-13 | 战斗平衡验证 | ✅ Done | — | 200-trial simulation, 9 scenarios |

**Total: 13/13 tasks complete, 516 tests passing**

---

## Sprint 1 总结视图

```
Week 1 (3/31 - 4/4):
  Day 1:   S1-01 项目脚手架 (0.5d) + S1-04 Economy 模型 (0.5d)
  Day 2:   S1-02 Canvas+React PoC (1d)
  Day 3:   S1-03 Hero System 数据模型 (1d)
  Day 4:   S1-05 Equipment 模型 (0.5d) + S1-07 Enemy 模型 (0.5d)
  Day 5:   S1-06 Bond System 模型 (1d)

Week 2 (4/7 - 4/11):
  Day 6:   S1-08 Battle AI 核心 (1d)
  Day 7-8: S1-09 Battle Engine 核心原型 (2d)
  Day 9:   S1-10 Battle 可视化原型 (1d — 如时间允许)
  Day 10:  S1-10 完成 (0.5d) + Buffer / S1-11 / S1-12 / S1-13
```

**Sprint 结束时的产出物**:
- 可运行的项目 + 测试基础设施
- 5 个核心数据模型（Hero, Equipment, Bond, Economy, Enemy）+ 完整单元测试
- Battle Engine 纯逻辑原型（可跑 5v5 自动战斗）
- （理想情况）Canvas 可视化战斗原型——可以亲眼看到武将打架
