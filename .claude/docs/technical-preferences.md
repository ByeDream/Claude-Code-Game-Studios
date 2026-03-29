# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Web (React 19 + HTML Canvas)
- **Language**: TypeScript (strict mode)
- **Rendering**: HTML Canvas (棋盘/战斗场景) + React DOM (UI 面板/菜单)
- **Framework**: React 19 + Vite
- **Desktop Shell**: Tauri v2 (发布为独立桌面应用)
- **Physics**: N/A (卡牌/自走棋游戏，无物理引擎需求)

### Development vs Release Architecture

**开发时**：纯 Web 开发流程
```
[Vite Dev Server] → [浏览器] ← Agent 测试/截图/Playwright
                  → React + Canvas (游戏代码)
```
- `npm run dev` 启动，浏览器热更新
- Agent 可通过 Playwright/Puppeteer 自动化测试和视觉验证
- Vitest 运行单元/集成测试

**发布时**：Tauri 打包为独立桌面应用
```
[Tauri App Shell] → [系统 WebView] → React + Canvas (同一份游戏代码)
                  → [Rust 后端] → 文件系统（存档/配置）
```
- 游戏代码零改动，仅运行容器不同
- 打包产物 ~10-20MB（vs Electron ~150MB+）
- 无服务器依赖，离线可用
- Rust 后端用于文件 I/O（存档、配置持久化）

## Naming Conventions

- **Components**: PascalCase (e.g., `HeroCard`, `BattleBoard`)
- **Variables/Functions**: camelCase (e.g., `heroList`, `calculateDamage`)
- **Custom Hooks**: camelCase with `use` prefix (e.g., `useBattleState`)
- **Events/Callbacks**: camelCase with `on`/`handle` prefix (e.g., `onHeroSelect`, `handleDragEnd`)
- **Files (components)**: PascalCase matching component (e.g., `HeroCard.tsx`)
- **Files (utilities)**: camelCase (e.g., `battleEngine.ts`, `bondSystem.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_HEROES_ON_BOARD`, `BASE_ATTACK_SPEED`)
- **Types/Interfaces**: PascalCase with descriptive names (e.g., `HeroData`, `BattleState`)
- **Enums**: PascalCase name, PascalCase members (e.g., `Faction.Wei`, `HeroTier.S`)
- **Directories**: kebab-case (e.g., `battle-system/`, `hero-cards/`)

## Performance Budgets

- **Target Framerate**: 60fps (Canvas 战斗动画)
- **Frame Budget**: 16.6ms
- **Draw Calls**: N/A (Canvas 2D)
- **Memory Ceiling**: [TO BE CONFIGURED — profile after MVP]
- **Initial Load**: < 3s (code splitting, lazy loading)
- **Bundle Size**: < 500KB gzipped (excluding art assets)

## Testing

- **Framework**: Vitest + React Testing Library
- **Minimum Coverage**: [TO BE CONFIGURED — set after core systems stabilize]
- **Required Tests**: Balance formulas, battle engine logic, bond system calculations, hero stat calculations

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- **React 19** — UI framework
- **Vite** — Build tool
- **TypeScript** — Language (strict mode)
- **Tauri v2** — Desktop app shell (发布打包)
- **Playwright** — E2E testing & Agent 视觉验证
- [Additional libraries to be approved as needed]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]
