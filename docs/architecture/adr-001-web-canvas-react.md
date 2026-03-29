# ADR-001: Web (Canvas + React) Rendering Architecture

**Status**: Accepted
**Date**: 2026-03-29
**Context**: Sprint 1 — S1-02

## Context

The game is a Three Kingdoms auto-chess with a 5v5 battle board. We needed to
decide how to render the game: pure Canvas, pure DOM/React, or a hybrid.

## Decision

**Hybrid Canvas + React DOM architecture:**
- **Canvas**: Battle board, combat animations, unit rendering (60fps game loop)
- **React DOM**: UI panels, menus, HUD overlays, dialogs

## Alternatives Considered

1. **Pure Canvas (Pixi.js/Konva)**: Better rendering control but loses React
   component ecosystem for UI. Text rendering, accessibility, and form handling
   become manual work.

2. **Pure React DOM**: Simpler architecture but DOM layout engine is wrong
   abstraction for a game board. CSS animations have limited control compared to
   `requestAnimationFrame`.

3. **WebGL (Three.js)**: Overkill for 2D card game. Unnecessary complexity.

## Consequences

- Canvas provides frame-budget-friendly rendering for battle animations
- React handles UI state management naturally (hero selection, inventory, menus)
- Two rendering systems means two mental models — team must know which to use when
- Future Tauri desktop shell wraps the same web code — zero migration cost

## Related

- `src/ui/canvas/` — Canvas rendering layer
- `src/ui/` — React component tree
