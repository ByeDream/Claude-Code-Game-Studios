# ADR-006: Pure Functional RunManager

**Status**: Accepted
**Date**: 2026-04-01
**Context**: Sprint 1 — Roguelike run loop design

## Context

The roguelike run loop is a state machine: the player moves through a map,
interacts with nodes (battles, shops, recruit events, rest stops, mystery
events), accumulates resources, and either defeats the final boss or loses
all honor. We needed to decide how to model and mutate this run state.

Candidates included a class-based state machine with internal mutation, a
React context/reducer pattern, and a pure functional model.

## Decision

**Pure functional run state machine: `RunState` in → `RunState` out.**

All public functions in `runManager.ts` take the current `RunState` as their
first argument and return a new `RunState`. Nothing is mutated in place.

```typescript
startRun(config, mapConfig?, random?) → RunState
selectNode(state, nodeId) → RunState
resolveBattleNode(state, enemies, lootChoices?, random?) → RunState
resolveRecruitNode(state, heroPool, chosenIndex?, random?) → RunState
resolveShopNode(state, equipPool, purchaseIndices?, random?) → RunState
resolveRestNodeAction(state, choice, materialCost, goldCost) → RunState
resolveMysteryNodeAction(state, historicalEvents?, random?) → RunState
checkRunEnd(state) → RunState
```

`RunPhase` drives allowed transitions:

```
MapView → (selectNode) → NodeInteraction → (resolve*) → MapView
                                                       → Ended (victory / honor 0)
```

No global singleton holds the run. React component trees receive `RunState`
as a prop or store it in a `useReducer` / Zustand slice.

## Alternatives Considered

1. **Class-based RunManager with mutable state**: `runManager.resolveBattle()`
   mutates `this.state`. Simpler call sites but makes React integration awkward
   (mutable reference doesn't trigger re-renders), snapshot testing hard, and
   time-travel debugging impossible.

2. **XState finite state machine library**: Formal FSM with guarded transitions
   and side-effect actors. Powerful but adds a heavy dependency and a new mental
   model. Overkill for a game loop with ~8 transition types.

3. **Redux-style action/reducer**: `dispatch({ type: 'RESOLVE_BATTLE', payload })`
   pattern. More ceremony than needed for a single-player run; the pure function
   approach achieves the same goals with less boilerplate.

## Consequences

- **Easy testing**: Pass a constructed `RunState`, call a function, assert on
  the returned state — no mocks, no setup/teardown.
- **Time-travel debugging**: Any `RunState` snapshot can be replayed from that
  point by calling the appropriate resolver function.
- **React-friendly immutability**: Returning new objects means React's shallow
  equality checks work correctly for re-render triggering.
- **Injectable RNG**: All stochastic functions (`resolveBattleNode`,
  `resolveRecruitNode`, etc.) accept a `random: RandomFn` parameter, allowing
  deterministic test runs with a seeded PRNG.
- **One mutation exception**: The internal `completeNode` helper sets
  `node.completed = true` directly on the `MapNode` inside `RunMap`. This is
  a known pragmatic exception — `RunMap` is a tree-shaped object and
  deep-cloning it every node completion is expensive. The mutation is local and
  not observable outside the function call.
- **Coordinator pattern**: The caller (UI layer or a coordinator hook) is
  responsible for threading state between calls. Callers must not hold stale
  references to old `RunState` after a resolve call returns.

## Related

- `src/gameplay/run/runManager.ts` — all public run functions
- `src/gameplay/run/types.ts` — `RunState`, `RunPhase`, `RunEndReason`
- `src/gameplay/run/runConfig.ts` — `DEFAULT_STARTING_HONOR`, honor cost constants
- `design/gdd/run-manager.md` — full state machine specification
- ADR-002 (Immutable Economy) — same pattern applied to economy state
- ADR-004 (Pure Functional Battle) — same pattern applied to battle state
