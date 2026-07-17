# Stress Layout & Edge Label Collision Resolution

## Summary

Replace the single `layered` ELK algorithm with an **adaptive strategy** that picks `stress` for large schemas (≥50 tables) and `layered` for small ones. Add a label collision resolution pass to prevent overlapping relationship labels.

## Motivation

- `layered` + `RIGHT` direction produces wide columnar layout; 100 tables spread too thin
- Parallel edges between same table pair place labels at same midpoint, causing visual overlap

## Adaptive Algorithm Selection

### Decision Logic (in `elk.worker.ts`)

| Condition | Algorithm | Edge Routing |
|---|---|---|
| `schema.tables.length < 50` | `layered` | `ORTHOGONAL` (unchanged) |
| `schema.tables.length >= 50` | `stress` | `POLYLINE` |

### Stress Options (≥50 tables)

```typescript
const STRESS_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'stress',
  'elk.spacing.nodeNode': '60',
  'elk.spacing.edgeEdge': '24',
  'elk.spacing.edgeNode': '40',
  'elk.spacing.componentComponent': '180',
  'elk.stress.desiredLength': '150',
  'elk.packing.compactness': '0.8',
  'elk.edgeRouting': 'POLYLINE',
  'elk.separateConnectedComponents': 'true',
}
```

When switching to `stress`, omit all `layered`-specific keys (`elk.direction`, `elk.layered.*`).

### Layered Options (<50 tables)

Current `ELK_OPTIONS` unchanged, keep as-is.

### Port constraints

Both algorithms respect `elk.portConstraints: 'FIXED_ORDER'` with EAST/WEST port sides. No change to per-port/edge structure.

## Edge Label Collision

### Problem

`buildPathFromSections` places every label at the geometric midpoint of its bend points. Two edges between the same table pair → identical label position → overlap.

### Solution: `resolveLabelCollisions()`

New export in `src/layout/path-routing.ts`:

```typescript
export function resolveLabelCollisions(
  edges: { id: string; labelX: number; labelY: number; section: ElkSection }[]
): Map<string, { labelX: number; labelY: number }>
```

Algorithm:

1. Build spatial index (grid cell size = 80px, covering label bounds)
2. For each edge, find neighbours in same + adjacent cells
3. If distance between two label centers < 60px, mark as colliding group
4. Within each group, push labels apart along the **vector perpendicular to the edge direction** (the line from section startPoint to endPoint)
5. Push amount = `(60 - distance) / 2` per label, clamped to max 20px
6. Store adjusted positions in `Map<edgeId, {labelX, labelY}>`

### Integration

Called in `RelationshipEdge.tsx` after all edges are mounted:

- On mount / data update, collect all edge label renderer DOM positions (or use computed positions from section data)
- Pass to `resolveLabelCollisions()` to get adjusted positions
- Store in a `WeakMap<edgeId, adjustedPosition>` ref
- Render uses adjusted position if available, otherwise falls back to midpoint

### Alternative (fallback)

If per-edge data is insufficient, apply **lane-based label offset** as a simpler approach: multiply a small offset (`laneIndex * 6px`) perpendicular to edge direction.

## File Changes

| File | Change |
|---|---|
| `src/workers/elk.worker.ts` | Add adaptive algorithm selection; import `LAYERED_OPTIONS` / `STRESS_OPTIONS` |
| `src/layout/path-routing.ts` | Add `resolveLabelCollisions()` |
| `src/components/RelationshipEdge.tsx` | Integrate collision resolution; read adjusted label positions |
| `src/layout/elkLayout.ts` | Pass `schema.tables.length` or a `largeSchema` flag to worker |

## Testing

- Existing 59 tests unchanged
- 100-table stress test (`large-scale.test.ts`) will now use `stress` algorithm → verify no crash
- Visual: open app, import 100 tables, check label overlaps are resolved
