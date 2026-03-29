# ADR-003: Per-Stat Modifier System (Bond + Status)

**Status**: Accepted
**Date**: 2026-03-29
**Context**: Sprint 1 — S1-06 (Bond), S1-11 (Status)

## Context

The GDD final stat formula is:
```
finalStat = (baseStat + growthBonus + equipBonus) * (1 + bondModifier + statusModifier)
```

Initially `bondModifier` and `statusModifier` were single numbers applied to ALL
stats equally. The Bond System GDD then required per-stat bonuses (e.g., Shu
faction gives STR+10%, HP+8%), and the Status System requires per-stat debuffs
(e.g., `def_down` affects only DEF).

## Decision

**Both `bondModifier` and `statusModifier` are `BaseStats` (per-stat records):**
- `bondModifier: BaseStats` — each stat gets its own bond percentage
- `statusModifier: BaseStats` — each stat gets its own status percentage
- The formula becomes: `multiplier = 1 + hero.bondModifier[stat] + hero.statusModifier[stat]`

## Alternatives Considered

1. **Single global modifier per system**: Simpler but can't express "STR buffed
   but DEF debuffed" which is core to the status system design.

2. **Effect list resolved at query time**: Store raw effects, compute modifier
   on every stat read. More flexible but more expensive and harder to debug.

## Consequences

- Clean separation: Bond System writes `bondModifier`, Status System writes `statusModifier`
- No cross-system coupling — each system manages its own modifier independently
- Stat calculation remains a simple formula (no effect list traversal)
- Status system provides `getStatusModifier(appliedStatuses): BaseStats` pure function

## Related

- `src/gameplay/hero/types.ts` — `HeroInstance.bondModifier`, `HeroInstance.statusModifier`
- `src/gameplay/hero/statCalculation.ts` — `calculateFinalStat()`
- `src/gameplay/bond/bondManager.ts` — writes `bondModifier`
- `src/gameplay/status/statusManager.ts` — `getStatusModifier()`
