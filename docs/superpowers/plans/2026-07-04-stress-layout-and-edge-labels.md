# Stress Layout & Edge Label Collision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adaptive ELK algorithm (layered for <50 tables, stress for ≥50) + edge label collision resolution.

**Architecture:** Algorithm selection happens in the ELK Web Worker based on `schema.tables.length`. Label collision runs in the worker post-edge-processing, storing adjusted positions in edge data. `RelationshipEdge.tsx` reads adjusted positions if available.

**Tech Stack:** ELKjs (stress/layered), Web Worker, React Flow, zustand

## Global Constraints

- Existing 59 tests must pass after every task
- TypeScript compilation must pass after every task
- vite build must succeed

---

### Task 1: Update edge data type with adjusted label positions

**Files:**
- Modify: `src/types/er.ts:164-170`

**Interfaces:**
- Produces: `RFRelationshipEdgeData` gains `adjustedLabelX?: number`, `adjustedLabelY?: number`

- [ ] **Add adjusted label fields to RFRelationshipEdgeData**

```typescript
export interface RFRelationshipEdgeData extends Record<string, unknown> {
  relationship: ERRelationship
  sections?: ElkSection[]
  lane?: EdgeLaneInfo
  adjustedLabelX?: number
  adjustedLabelY?: number
}
```

- [ ] **Verify compilation**

Run: `npx tsc --noEmit`
Expected: no output (clean)

---

### Task 2: Fix lane offset missing from label position

**Files:**
- Modify: `src/layout/path-routing.ts:196-204`

- [ ] **Add `+ offset` to labelY in `buildPathFromSections`**

```typescript
  const offset = lane ? (lane.laneIndex - (lane.laneCount - 1) / 2) * LANE_SPACING : 0

  // ... path building ...

  // 取路径中点作为标签位置
  let labelX = (section.startPoint.x + section.endPoint.x) / 2
  let labelY = (section.startPoint.y + section.endPoint.y) / 2 + offset
  if (section.bendPoints && section.bendPoints.length > 0) {
    const mid = section.bendPoints[Math.floor(section.bendPoints.length / 2)]
    labelX = mid.x
    labelY = mid.y + offset
  }
```

- [ ] **Run tests**

Run: `npx vitest run`
Expected: 59 passed

---

### Task 3: Add label collision resolution function

**Files:**
- Modify: `src/layout/path-routing.ts` — add `resolveLabelCollisions()` at end of file

**Interfaces:**
- Consumes: `ElkPoint`, `ElkSection`, `RFRelationshipEdgeData` (types already imported)
- Produces: `resolveLabelCollisions(edges, labelPositions) => Map<edgeId, {labelX, labelY}>`

- [ ] **Add `resolveLabelCollisions` function**

```typescript
const LABEL_MIN_DISTANCE = 60
const CELL_SIZE = 80

interface LabelEntry {
  edgeId: string
  x: number
  y: number
  sectionStart: ElkPoint
  sectionEnd: ElkPoint
}

/**
 * 检测并解决边标签之间的视觉重叠。
 * 对碰撞组沿垂直于边方向的方向推离。
 */
export function resolveLabelCollisions(
  edges: {
    id: string
    sections: ElkSection[]
    lane?: EdgeLaneInfo
  }[],
): Map<string, { labelX: number; labelY: number }> {
  const entries: LabelEntry[] = []
  for (const edge of edges) {
    const section = edge.sections[0]
    if (!section) continue

    const offset = edge.lane
      ? (edge.lane.laneIndex - (edge.lane.laneCount - 1) / 2) * 8
      : 0

    let labelX: number
    let labelY: number
    if (section.bendPoints && section.bendPoints.length > 0) {
      const mid = section.bendPoints[Math.floor(section.bendPoints.length / 2)]
      labelX = mid.x
      labelY = mid.y + offset
    } else {
      labelX = (section.startPoint.x + section.endPoint.x) / 2
      labelY = (section.startPoint.y + section.endPoint.y) / 2 + offset
    }

    entries.push({
      edgeId: edge.id,
      x: labelX,
      y: labelY,
      sectionStart: section.startPoint,
      sectionEnd: section.endPoint,
    })
  }

  // Build spatial hash grid
  const grid = new Map<string, LabelEntry[]>()
  function cellKey(x: number, y: number): string {
    return `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`
  }
  for (const entry of entries) {
    const key = cellKey(entry.x, entry.y)
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(entry)
  }

  // Detect collisions and push apart
  const result = new Map<string, { labelX: number; labelY: number }>()
  const pushed = new Set<string>()

  for (let i = 0; i < entries.length; i++) {
    if (pushed.has(entries[i].edgeId)) continue

    const a = entries[i]
    const aKey = cellKey(a.x, a.y)
    const neighbours: LabelEntry[] = []

    // Check 3x3 neighborhood
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const parts = aKey.split(',')
        const nk = `${Number(parts[0]) + dx},${Number(parts[1]) + dy}`
        const cell = grid.get(nk)
        if (cell) neighbours.push(...cell)
      }
    }

    // Find colliding group
    const group: LabelEntry[] = [a]
    for (const b of neighbours) {
      if (b.edgeId === a.edgeId) continue
      const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
      if (d < LABEL_MIN_DISTANCE) {
        group.push(b)
        pushed.add(b.edgeId)
      }
    }

    if (group.length === 1) {
      result.set(a.edgeId, { labelX: a.x, labelY: a.y })
      continue
    }

    // Spread group along perpendicular direction to each edge
    const midX = group.reduce((s, e) => s + e.x, 0) / group.length
    const midY = group.reduce((s, e) => s + e.y, 0) / group.length

    for (let j = 0; j < group.length; j++) {
      const entry = group[j]
      const angle = (j / group.length) * Math.PI * 2
      const radius = 30 + j * 15
      result.set(entry.edgeId, {
        labelX: midX + Math.cos(angle) * radius,
        labelY: midY + Math.sin(angle) * radius,
      })
    }
  }

  return result
}
```

- [ ] **Verify compilation**

Run: `npx tsc --noEmit`
Expected: clean

---

### Task 4: Adaptive algorithm + label collision in ELK worker

**Files:**
- Modify: `src/workers/elk.worker.ts`

**Interfaces:**
- Consumes: `resolveLabelCollisions` from `path-routing.ts`
- Produces: edges with `adjustedLabelX`/`adjustedLabelY` in edge data (consumed by Task 5)

- [ ] **Replace single ELK_OPTIONS with two option sets**

```typescript
const LAYERED_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '140',
  'elk.spacing.edgeEdge': '24',
  'elk.spacing.edgeNode': '40',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  'elk.spacing.componentComponent': '180',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.nodePlacement.favorStraightEdges': 'true',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.separateConnectedComponents': 'true',
}

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

- [ ] **Add algorithm selection logic before building elkGraph**

```typescript
    const isLarge = schema.tables.length >= 50
    const baseOptions = isLarge ? STRESS_OPTIONS : LAYERED_OPTIONS

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        ...baseOptions,
        ...options,
      },
      children,
      edges: elkEdges,
    }
```

- [ ] **Add label collision after edge processing**

At end of the `self.onmessage` handler, after lane assignment and section interpolation:

```typescript
    // 解决边标签重叠
    const labelAdjustments = resolveLabelCollisions(
      edges.filter((e) => e.data?.sections && e.data.sections.length > 0),
    )
    for (const edge of edges) {
      const adj = labelAdjustments.get(edge.id)
      if (adj && edge.data) {
        edge.data = { ...edge.data, adjustedLabelX: adj.labelX, adjustedLabelY: adj.labelY }
      }
    }
```

- [ ] **Update import to include resolveLabelCollisions**

```typescript
import { assignEdgeLanes, interpolateSectionsWithNodeDeltas, resolveLabelCollisions } from '../layout/path-routing'
```

- [ ] **Verify compilation**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Run tests**

Run: `npx vitest run`
Expected: 59 passed

---

### Task 5: Read adjusted label positions in RelationshipEdge

**Files:**
- Modify: `src/components/RelationshipEdge.tsx`

- [ ] **Override labelX/labelY with adjusted positions from data**

After line 75 (the useMemo for path) and before the label rendering, add:

```typescript
  const finalLabelX = data?.adjustedLabelX ?? labelX
  const finalLabelY = data?.adjustedLabelY ?? labelY
```

- [ ] **Use finalLabelX/Y in render**

Change line 180 from:
```tsx
transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
```
to:
```tsx
transform: `translate(-50%, -50%) translate(${finalLabelX}px, ${finalLabelY}px)`,
```

- [ ] **Verify compilation**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Run all tests**

Run: `npx vitest run`
Expected: 59 passed

- [ ] **Verify build**

Run: `npx vite build`
Expected: builds in ~2s

---

### Verification

- [ ] **Run full suite**

```bash
npx tsc --noEmit && npx vitest run && npx vite build
```

Expected: clean compilation, 59 tests passed, production build succeeds
