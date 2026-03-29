# ADR-004: Pure Functional Battle Engine

**Status**: Accepted
**Date**: 2026-03-29
**Context**: Sprint 1 — S1-09

## Context

The battle engine runs auto-combat: 5v5 heroes fighting automatically over
multiple rounds until one side is eliminated or MAX_ROUNDS is reached. We
needed to decide whether to use a stateful simulation or a pure functional approach.

## Decision

**Pure functional with injectable RNG:**
- `initBattle(heroes, enemies) → BattleState`
- `executeTurn(state, cooldowns, random) → BattleState`
- `runBattle(heroes, enemies, random) → BattleResult`
- All functions return new state objects (shallow-cloned units per round)
- RNG is injected via `RandomFn = () => number` parameter

## Alternatives Considered

1. **Mutable simulation object**: `battle.nextTurn()` mutates internal state.
   Simpler for sequential execution but harder to test, replay, and parallelize.

2. **Event-sourced battle**: Record actions as events, replay for state. Good
   for replays but overkill for MVP — we already capture a log.

## Consequences

- Deterministic: same seed → same battle result. Critical for balance testing
  (the balance report runs 200 seeded trials)
- Easy to test: create a state, call executeTurn, assert on the result
- Easy to replay: store initial state + seed, re-run for identical result
- Cooldown map is the one mutable piece (passed by reference for efficiency)
- BattleUnit arrays are shallow-cloned each round (HP/KO state changes)

## Related

- `src/gameplay/battle/battleEngine.ts` — core simulation loop
- `src/gameplay/battle/battleAI.ts` — action decision logic
- `scripts/balance-report.ts` — uses seeded RNG for reproducible simulations
