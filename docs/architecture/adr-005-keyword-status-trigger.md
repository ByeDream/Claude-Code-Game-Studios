# ADR-005: Keyword-Matching Status Trigger Strategy

**Status**: Accepted
**Date**: 2026-04-01
**Context**: Sprint 1 — Status System integration with Battle Engine

## Context

The battle engine needs to apply status effects (stun, poison, atk_up, burn, etc.)
when skills fire. Skill definitions store their side-effects as free-text `description`
strings in Chinese (e.g., `"对目标造成眩晕"`, `"增攻3回合"`). There is no structured
`statusId` field on `SkillEffect` — the status intent lives in natural language.

We needed a bridge between the text-based skill data format and the typed
`StatusEffect` catalog in `statusConfig.ts`.

## Decision

**Keyword-map matching via `SKILL_STATUS_KEYWORDS` in `battleConfig.ts`:**

```typescript
export const SKILL_STATUS_KEYWORDS: Record<string, string> = {
  '增攻': 'atk_up',
  '减攻': 'atk_down',
  '增防': 'def_up',
  '减防': 'def_down',
  '加速': 'spd_up',
  '减速': 'spd_down',
  '中毒': 'poison',
  '燃烧': 'burn',
  '回复': 'regen',
  '眩晕': 'stun',
  '沉默': 'silence',
}
```

`extractStatusEffects(skill)` in `battleEngine.ts` iterates each `SkillEffect`
and checks whether the effect's `description` (or the skill's `name`) contains
a known keyword. On the first match per effect it looks up the `StatusEffect`
definition from `STATUS_EFFECTS`, overrides `duration` and `value` with the
skill's own values where provided, and returns the resulting list.

`applySkillStatuses()` calls `extractStatusEffects()` after each skill resolves
damage/healing, then passes each status to `applyStatus()` in the Status Manager.

## Alternatives Considered

1. **Typed `statusIds` field on `SkillEffect`**: Add an explicit `statusIds: string[]`
   field to the skill data schema. Precise and unambiguous, but requires
   migrating all existing skill data and makes authoring more verbose. Deferred
   until skill data stabilizes.

2. **Embedded status objects in skill data**: Skill JSON directly embeds the
   full `StatusEffect` definition. Flexible but duplicates configuration — the
   same "stun" has different durations per skill, leading to config drift.

3. **Effect-category enum (`damaging | controlling | buffing`)**: Tag each
   effect with a category and infer status from there. Loses specificity —
   multiple control statuses (stun vs. silence) can't be distinguished.

## Consequences

- **Flexible**: Adding a new status only requires adding one line to
  `SKILL_STATUS_KEYWORDS` and a definition in `STATUS_EFFECTS` — no skill data
  migration.
- **Imprecise matching risk**: A skill whose name or description contains a
  keyword incidentally (e.g., a skill named "眩晕之击" but intended to deal
  damage only) will trigger an unintended status. Authors must be aware of this.
- **One match per effect**: The loop breaks after the first keyword match per
  `SkillEffect` — a single effect cannot produce two statuses. Compound status
  skills require multiple effects.
- **Chinese-only**: The matching is entirely Unicode substring search; it works
  only with Chinese-language skill data. If skill text is ever localized or
  re-authored in English the map must be duplicated.
- **Duration/value override**: The engine respects the skill's own `duration`
  and `magnitude` fields when set, falling back to the `STATUS_EFFECTS` defaults.
  This prevents all stun skills from sharing a single duration.

## Related

- `src/gameplay/battle/battleConfig.ts` — `SKILL_STATUS_KEYWORDS` definition
- `src/gameplay/battle/battleEngine.ts` — `extractStatusEffects()`, `applySkillStatuses()`
- `src/gameplay/status/statusConfig.ts` — `STATUS_EFFECTS` catalog
- `src/gameplay/status/statusManager.ts` — `applyStatus()`
- `design/gdd/status-system.md` — Status effect categories and rules
