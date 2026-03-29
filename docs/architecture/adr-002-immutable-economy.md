# ADR-002: Immutable Economy State Pattern

**Status**: Accepted
**Date**: 2026-03-29
**Context**: Sprint 1 — S1-04

## Context

The Economy system manages Gold and Material resources within a run. We needed
to decide whether to use mutable state objects or immutable value types.

## Decision

**Immutable Economy state with functional operations:**
- `Economy` is a readonly `{ gold: number, material: number }`
- `earn()` and `spend()` return NEW Economy objects; they never mutate
- `spend()` throws if insufficient resources (fail-fast, no silent partial spend)

## Alternatives Considered

1. **Mutable class with methods**: `economy.spend(10)` mutates in-place. Simpler
   API but makes undo/redo, time-travel debugging, and state snapshots harder.

2. **Event-sourced ledger**: Full transaction log. Overkill for a single-player
   roguelike run; valuable only if we need audit trails.

## Consequences

- Easy state snapshots (just copy the reference)
- Easy testing (no shared mutable state between tests)
- Atomic operations — if `spend` throws, economy is unchanged
- Slightly more verbose call sites: `economy = spend(economy, gold, material)`
- Hero Growth system (`levelUp`) follows same pattern: returns new Economy

## Related

- `src/gameplay/economy/economyManager.ts`
- `src/gameplay/hero-growth/growthManager.ts` — consumes economy via `spend`
