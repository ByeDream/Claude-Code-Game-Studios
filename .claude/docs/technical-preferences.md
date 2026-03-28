# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Web (React 19 + HTML Canvas)
- **Language**: TypeScript (strict mode)
- **Rendering**: HTML Canvas (棋盘/战斗场景) + React DOM (UI 面板/菜单)
- **Framework**: React 19 + Vite
- **Physics**: N/A (卡牌/自走棋游戏，无物理引擎需求)

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
- [Additional libraries to be approved as needed]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]
