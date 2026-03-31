# Sprint 2 -- Roguelike Run Loop

## Sprint Goal

实现 Roguelike Run Loop 核心逻辑层：状态系统集成战斗引擎、战利品/奖励、事件系统、
地图生成、RunManager 状态机。Should Have 包括平衡修复和最小可玩 UI。

## Tasks

### Must Have (Critical Path)

| ID | Task | Est. Days | Dependencies | Status |
|----|------|-----------|--------------|--------|
| S2-01 | Status System → Battle Engine 集成 | 1 | S1-09, S1-11 | ✅ Done |
| S2-03 | Loot/Rewards 数据模型 | 1 | S1-04, S1-05 | ✅ Done |
| S2-04 | Event System MVP | 1.5 | S1-03, S1-04 | ✅ Done |
| S2-05 | Run Map 生成器 | 1 | — | ✅ Done |
| S2-06 | RunManager 核心状态机 | 1.5 | S2-01~05 | ✅ Done |
| S2-07 | Integration Tests + Run Simulation | 0.5 | S2-06 | ✅ Done |

### Should Have

| ID | Task | Est. Days | Dependencies | Status |
|----|------|-----------|--------------|--------|
| S2-02 | Enemy Scaling 平衡修复 | 0.5 | S1-07, S1-13 | ✅ Done |
| S2-08 | Run Loop 最小 UI | 2 | S2-06 | ✅ Done |
| S2-09 | Balance Report v2 | 0.5 | S2-02 | ✅ Done |

### Nice to Have

| ID | Task | Est. Days | Dependencies | Status |
|----|------|-----------|--------------|--------|
| S2-10 | 历史事件原型 | 1 | S2-04 | ⏩ Deferred to S3 |
| S2-11 | 多宝箱 Named drops 调优 | 0.5 | S2-03 | ⏩ Deferred to S3 |

## Completion Status

### Must Have: 7/7 ✅ | Should Have: 3/3 ✅

| ID | Task | Tests | Notes |
|----|------|-------|-------|
| S2-01 | Status System → Battle Engine | 33 | DoT/HoT, stun, silence, boss resistance |
| S2-02 | Enemy Scaling 平衡修复 | 2 | Nameless base stats → B-tier, scaling 0.10→0.15, elite ×1.25 |
| S2-03 | Loot/Rewards 数据模型 | 55 | 5 chest tiers, difficulty scaling |
| S2-04 | Event System MVP | 53 | 7 node types, recruit/shop/rest/mystery |
| S2-05 | Run Map 生成器 | 27 | 16 层 StS 风格, 100-seed 验证 |
| S2-06 | RunManager 核心状态机 | 27 | 纯函数式, 集成全系统 |
| S2-07 | Integration + Simulation | 36 | 50 automated runs, 0 crashes |
| S2-08 | Run Loop 最小 UI | — | RunScreen, RunMapCanvas, 5 NodePanels, RunHUD, useRunLoop hook |
| S2-09 | Balance Report v2 | 11 | 6 scenarios, 500-trial stability, bond impact verified |

**Total: 10/10 complete (7 Must + 3 Should) | 760 tests passing**

## New Systems Created

| System | Directory | Files | Lines |
|--------|-----------|-------|-------|
| Loot/Rewards | `src/gameplay/loot/` | 4 | ~596 |
| Event System | `src/gameplay/event/` | 4 | ~911 |
| Run Map | `src/gameplay/run-map/` | 4 | ~615 |
| RunManager | `src/gameplay/run/` | 4 | ~525 |
| Run Loop UI | `src/ui/run/` | 5 | ~850 |

## Documentation Added

| Type | File | Topic |
|------|------|-------|
| ADR | `adr-005-keyword-status-trigger.md` | SKILL_STATUS_KEYWORDS 策略 |
| ADR | `adr-006-pure-functional-run-manager.md` | 纯函数式状态机 |
| ADR | `adr-007-retry-map-validation.md` | Retry-based 地图验证 |
| GDD | `run-manager.md` | RunManager 状态机设计 |
| GDD | `battle-system.md` | 战斗系统聚合设计 |

## Balance Changes (S2-02)

| Parameter | Before | After | Rationale |
|-----------|--------|-------|-----------|
| Soldier total stats | 39 | 78 | Was 30% of A-tier; now ~62% |
| LegionLeader total | 52 | 90 | B-tier equivalent |
| Lieutenant total | 54 | 92 | B-tier equivalent |
| Advisor total | 54 | 90 | B-tier equivalent |
| CavalryLeader total | 54 | 92 | B-tier equivalent |
| NAMELESS_SCALING_RATE | 0.10 | 0.15 | Steeper difficulty curve |
| ELITE_STAT_MULTIPLIER | N/A | 1.25 | New: elite encounters |

## Carryover to Sprint 3

- S2-10 历史事件原型（Named Three Kingdoms events）
- S2-11 多宝箱 Named drops 调优
