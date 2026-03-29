# Systems Index: 煮酒 (Heroes' Toast)

> **Status**: Draft
> **Created**: 2026-03-28
> **Last Updated**: 2026-03-28
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

煮酒是一款三国 roguelike 自走棋卡牌游戏，核心体验围绕「武将收集养成 + 阵容构筑 + 自动战斗」。
系统设计以**武将系统**为绝对基础，所有玩法系统都围绕武将数据展开。战斗层采用自走棋模式（站位+自动战斗+军师技干预），
进度层采用杀戮尖塔式节点地图，叙事层通过三国历史剧本驱动大事件节点。

四大设计支柱（收集之乐 / 构筑智慧 / 历史沉浸 / 养成爆发）约束所有系统设计决策。

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | Hero System (武将系统) | Core | MVP | Designed | design/gdd/hero-system.md | — |
| 2 | Economy (货币/资源系统) | Economy | MVP | Designed | design/gdd/economy.md | — |
| 3 | Equipment System (装备系统) | Gameplay | MVP | Designed | design/gdd/equipment-system.md | Hero System |
| 4 | Bond System (羁绊系统) | Gameplay | MVP | Designed | design/gdd/bond-system.md | Hero System |
| 5 | Hero Growth (武将养成系统) | Progression | MVP | Designed | design/gdd/hero-growth.md | Hero System, Equipment, Economy |
| 6 | Enemy System (敌军系统) | Gameplay | MVP | Designed | design/gdd/enemy-system.md | Hero System |
| 7 | Battle AI (战斗AI) | Gameplay | MVP | Designed | design/gdd/battle-ai.md | Hero System |
| 8 | Battle Engine (战斗系统) | Gameplay | MVP | Designed | design/gdd/battle-engine.md | Hero System, Bond System, Battle AI, Enemy System, Equipment |
| 9 | Loot/Rewards (战利品系统) | Economy | MVP | Designed | design/gdd/loot-rewards.md | Hero System, Equipment, Economy |
| 10 | Event System (事件系统) | Gameplay | MVP | Designed | design/gdd/event-system.md | Hero System, Battle Engine, Loot/Rewards, Hero Growth |
| 11 | Run Map (Run地图系统) | Gameplay | MVP | Designed | design/gdd/run-map.md | Event System |
| 12 | Battle UI (战斗UI) | UI | MVP | Designed | design/gdd/battle-ui.md | Battle Engine |
| 13 | Advisor Skills (军师技系统) | Gameplay | Vertical Slice | Not Started | — | Battle Engine |
| 14 | Shop (商店系统) | Economy | Vertical Slice | Not Started | — | Equipment, Economy |
| 15 | Campaign System (历史剧本系统) | Narrative | Vertical Slice | Not Started | — | Run Map, Event System, Enemy System |
| 16 | Hero Detail UI (武将详情UI) | UI | Vertical Slice | Not Started | — | Hero System, Equipment, Hero Growth, Bond System |
| 17 | Main UI (主界面/菜单UI) | UI | Vertical Slice | Not Started | — | Campaign System |
| 18 | Monarch System (君主系统) | Gameplay | Alpha | Not Started | — | Hero System, Advisor Skills |
| 19 | Meta Progression (跨Run进度系统) | Progression | Alpha | Not Started | — | Campaign System, Hero System |
| 20 | Save/Load (存档系统) | Persistence | Alpha | Not Started | — | All game state systems |
| 21 | Status System (状态系统) | Gameplay | MVP | Designed | design/gdd/status-system.md | Hero System, Battle Engine |

---

## Categories

| Category | Description | Systems |
|----------|-------------|---------|
| **Core** | Foundation data models everything depends on | Hero System |
| **Gameplay** | The systems that make the game fun | Equipment, Bond System, Enemy System, Battle AI, Battle Engine, Event System, Run Map, Advisor Skills, Monarch System |
| **Progression** | How the player grows over time | Hero Growth, Meta Progression |
| **Economy** | Resource creation and consumption | Economy, Loot/Rewards, Shop |
| **Narrative** | Story and event delivery | Campaign System |
| **UI** | Player-facing information displays | Battle UI, Hero Detail UI, Main UI |
| **Persistence** | Save state and continuity | Save/Load |

---

## Priority Tiers

| Tier | Definition | Systems Count | Target |
|------|------------|---------------|--------|
| **MVP** | Required for core loop to function: "Is the auto-battle + hero collection + bond loop fun?" | 12 | 4-6 weeks |
| **Vertical Slice** | Complete single-run experience with narrative, full UI, and advisor skills | 5 | 8-10 weeks |
| **Alpha** | Multiple monarchs, meta progression, persistence | 3 | 14-18 weeks |

---

## Dependency Map

### Foundation Layer (no dependencies)

1. **Hero System (武将系统)** — The absolute foundation. Defines hero data model (stats, skills, faction tags, tier, art references). 15 systems depend on it directly or indirectly.
2. **Economy (货币/资源系统)** — Defines resource types (gold, materials, etc.) and basic transaction rules. Required by growth, shop, and loot systems.

### Core Layer (depends on Foundation)

1. **Equipment System (装备系统)** — depends on: Hero System
2. **Bond System (羁绊系统)** — depends on: Hero System
3. **Hero Growth (武将养成系统)** — depends on: Hero System, Equipment, Economy
4. **Enemy System (敌军系统)** — depends on: Hero System
5. **Battle AI (战斗AI)** — depends on: Hero System

### Feature Layer (depends on Core)

1. **Battle Engine (战斗系统)** — depends on: Hero System, Bond System, Battle AI, Enemy System, Equipment. *The core 30-second loop.*
2. **Loot/Rewards (战利品系统)** — depends on: Hero System, Equipment, Economy
3. **Event System (事件系统)** — depends on: Hero System, Battle Engine, Loot/Rewards, Hero Growth
4. **Run Map (Run地图系统)** — depends on: Event System
5. **Advisor Skills (军师技系统)** — depends on: Battle Engine
6. **Shop (商店系统)** — depends on: Equipment, Economy
7. **Campaign System (历史剧本系统)** — depends on: Run Map, Event System, Enemy System
8. **Monarch System (君主系统)** — depends on: Hero System, Advisor Skills

### Presentation Layer (depends on Features)

1. **Battle UI (战斗UI)** — depends on: Battle Engine, Advisor Skills (optional)
2. **Hero Detail UI (武将详情UI)** — depends on: Hero System, Equipment, Hero Growth, Bond System
3. **Main UI (主界面/菜单UI)** — depends on: Campaign System, Monarch System (optional)

### Polish Layer (depends on everything)

1. **Meta Progression (跨Run进度系统)** — depends on: Campaign System, Hero System, Monarch System
2. **Save/Load (存档系统)** — depends on: all game state systems

---

## Recommended Design Order

| Order | System | Priority | Layer | Est. Effort |
|-------|--------|----------|-------|-------------|
| 1 | Hero System (武将系统) | MVP | Foundation | L |
| 2 | Economy (货币/资源系统) | MVP | Foundation | S |
| 3 | Equipment System (装备系统) | MVP | Core | M |
| 4 | Bond System (羁绊系统) | MVP | Core | M |
| 5 | Hero Growth (武将养成系统) | MVP | Core | M |
| 6 | Enemy System (敌军系统) | MVP | Core | M |
| 7 | Battle AI (战斗AI) | MVP | Core | M |
| 8 | Battle Engine (战斗系统) | MVP | Feature | L |
| 9 | Loot/Rewards (战利品系统) | MVP | Feature | S |
| 10 | Event System (事件系统) | MVP | Feature | M |
| 11 | Run Map (Run地图系统) | MVP | Feature | M |
| 12 | Battle UI (战斗UI) | MVP | Presentation | M |
| 13 | Advisor Skills (军师技系统) | Vertical Slice | Feature | M |
| 14 | Shop (商店系统) | Vertical Slice | Feature | S |
| 15 | Campaign System (历史剧本系统) | Vertical Slice | Feature | L |
| 16 | Hero Detail UI (武将详情UI) | Vertical Slice | Presentation | S |
| 17 | Main UI (主界面/菜单UI) | Vertical Slice | Presentation | M |
| 18 | Monarch System (君主系统) | Alpha | Feature | M |
| 19 | Meta Progression (跨Run进度系统) | Alpha | Polish | M |
| 20 | Save/Load (存档系统) | Alpha | Polish | M |

Effort estimates: S = 1 session, M = 2-3 sessions, L = 4+ sessions.

---

## Circular Dependencies

- **None found.** Event System and Battle Engine have a bidirectional relationship
  (events trigger battles; battle results influence events), but this is resolved
  via a clean interface: Event System sends battle configuration → Battle Engine
  returns battle result. No code-level circular dependency.

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| Battle Engine | Design | Auto-battle might feel too passive — players may lack agency | Military advisor skills provide key decision points; prototype early and playtest |
| Bond System | Design | Combinatorial explosion may create dominant strategies, collapsing build diversity | Design multiple viable bond paths; use tier gates to prevent early super-combos |
| Hero System | Scope | Each hero needs: unique skills, stats, faction tags, lore, art — content scales linearly | MVP with 15-20 heroes; design a scalable hero template to streamline later additions |
| Battle AI | Technical | Target selection and skill priority must feel smart but not unfair | Start simple (nearest target, priority-based skills), iterate with playtesting |
| Campaign System | Scope | Historical narrative content is labor-intensive to write and branch | MVP without campaign narrative; add in Vertical Slice phase |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 21 |
| Design docs started | 13 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| MVP systems designed | 13/13 |
| Vertical Slice systems designed | 0/5 |
| Alpha systems designed | 0/3 |

---

## Next Steps

- [ ] Design MVP-tier systems (use `/design-system [system-name]`)
- [ ] Start with Hero System — the foundation everything depends on
- [ ] Run `/design-review` on each completed GDD
- [ ] Prototype Battle Engine early — highest design risk (`/prototype battle`)
- [ ] Run `/gate-check pre-production` when MVP systems are designed
- [ ] Plan first implementation sprint (`/sprint-plan new`)
