# ADR-007: Retry-Based Map Validation

**Status**: Accepted
**Date**: 2026-04-01
**Context**: Sprint 1 — Run map generation algorithm

## Context

Map generation must satisfy several placement constraints simultaneously:

- No orphan nodes (every non-start node has ≥1 incoming connection)
- At least `MIN_INDEPENDENT_ROUTES` (2) distinct paths from start to final boss
- No mystery nodes on layer 0 or the layer immediately before a boss layer
- No consecutive same-type functional nodes between adjacent layers
- Layer before each boss must contain at least one functional node (Rest/Shop/Recruit)

These constraints can conflict after random node type assignment and random path
connection generation. For example, the "no consecutive functional nodes" rule
may overwrite a Rest node that the "boss-prep functional node" rule just placed.

We needed a generation strategy that reliably produces valid maps without
complex constraint-propagation logic.

## Decision

**Generate-then-validate with retry, up to `MAX_RETRIES = 10`.**

```
for attempt in 0..MAX_RETRIES:
    map = tryGenerateMap(config, random)
    if validateMap(map): return map

// Final fallback: generate once more and fix orphans imperatively
map = tryGenerateMap(config, random)
ensureNoOrphans(map)
return map
```

`tryGenerateMap` runs the full pipeline unconditionally (layer structure →
node types → connections). `validateMap` checks two binary conditions:
1. `checkNoOrphans` — every non-start node has at least one incoming connection
2. `checkMultipleRoutes` — the start node connects to ≥2 nodes in layer 1
   (simplified proxy for ≥2 independent routes)

If validation fails, the entire map is discarded and regenerated from scratch.
After `MAX_RETRIES` exhausted, `ensureNoOrphans` patches orphan nodes by
adding connections from the nearest node in the previous layer.

`enforceConstraints` runs as the last step of `assignNodeTypes` inside
`tryGenerateMap`, applying placement rules post-hoc (overwriting node types
that violate constraints). Constraint ordering matters: the boss-prep rule runs
last so it cannot be undone by the consecutive-type rule.

## Alternatives Considered

1. **Constraint-propagation (CSP) solver**: Track which nodes are already
   assigned and propagate constraints forward during assignment to prevent
   invalid states. Correct and efficient but significantly more complex to
   implement and debug for a map generator used a handful of times per run.

2. **Fixed template maps**: Define a small library of hand-crafted valid maps
   and select one randomly per run. Eliminates all generation bugs but removes
   the roguelike variety that makes each run feel different.

3. **Single-pass assignment with guaranteed rules**: Design the assignment
   algorithm so constraints are satisfied by construction (e.g., never assign
   Mystery to layer 0 in the first place). Requires interleaving spatial
   awareness into the type-pool shuffle, making the algorithm harder to follow.

## Consequences

- **Simple algorithm**: `tryGenerateMap` is a straightforward multi-step
  pipeline. No backtracking, no constraint queues. Easy to read and modify.
- **100% success in practice**: With `MAX_RETRIES = 10` and a 16-layer default
  map, validation failures are rare (constraint conflicts are uncommon with the
  current distribution weights). The fallback `ensureNoOrphans` provides a
  safety net.
- **Theoretical failure risk**: If all 10 attempts fail validation and
  `ensureNoOrphans` cannot fix the remaining issues (e.g., `checkMultipleRoutes`
  still fails), the returned map may have fewer than 2 independent routes. No
  error is thrown — the run proceeds with a suboptimal but playable map.
- **Retry cost**: Generating a 16-layer map is cheap (<1ms); 10 retries add
  negligible overhead. The performance budget for map generation is <100ms.
- **Constraint ordering sensitivity**: `enforceConstraints` runs multiple passes
  in a specific order. Reordering the constraints can reintroduce violations.
  This ordering is not formally documented in code — only in this ADR.

## Related

- `src/gameplay/run-map/mapGenerator.ts` — `generateMap`, `tryGenerateMap`,
  `validateMap`, `enforceConstraints`, `ensureNoOrphans`
- `src/gameplay/run-map/mapConfig.ts` — `MAX_RETRIES = 10`,
  `MIN_INDEPENDENT_ROUTES = 2`, `NODE_TYPE_TARGETS`
- `design/gdd/run-map.md` — placement constraint specification
