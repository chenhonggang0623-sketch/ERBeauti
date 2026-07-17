import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { RFRelationshipEdgeData, ElkSection } from '@/types/er'
import {
  assignEdgeLanes,
  buildPathFromSections,
  resolveLabelCollisions,
  resolveLabelNodeOverlaps,
} from '@/layout/path-routing'

/**
 * 构造一个最小化的 section，便于构造指定起点终点的边。
 */
function makeSection(start: { x: number; y: number }, end: { x: number; y: number }): ElkSection {
  return { startPoint: start, endPoint: end, bendPoints: [] }
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  section: ElkSection,
  laneIndex = 0,
  laneCount = 1,
): Edge<RFRelationshipEdgeData> {
  return {
    id,
    source,
    target,
    type: 'relationship',
    data: {
      relationship: {
        id,
        sourceTableId: source,
        sourceFieldId: 'f1',
        targetTableId: target,
        targetFieldId: 'f2',
        type: '1:N',
      },
      sections: [section],
      lane: { laneIndex, laneCount },
    },
  }
}

describe('assignEdgeLanes', () => {
  it('为同方向的边分到同一 group 并按索引分配 lane', () => {
    const section = makeSection({ x: 0, y: 0 }, { x: 100, y: 0 })
    const edges: Edge<RFRelationshipEdgeData>[] = [
      makeEdge('a', 't1', 't2', section),
      makeEdge('b', 't1', 't2', section),
      makeEdge('c', 't1', 't2', section),
    ]
    const map = assignEdgeLanes(edges)
    expect(map.get('a')?.laneIndex).toBe(0)
    expect(map.get('b')?.laneIndex).toBe(1)
    expect(map.get('c')?.laneIndex).toBe(2)
    for (const info of map.values()) {
      expect(info.laneCount).toBe(3)
    }
  })

  it('反向边不归并到同 group', () => {
    // 修复前的 bug：[edge.source, edge.target].sort() 会让 A→B 和 B→A 归到同一 group
    const section = makeSection({ x: 0, y: 0 }, { x: 100, y: 0 })
    const edges: Edge<RFRelationshipEdgeData>[] = [
      makeEdge('a', 't1', 't2', section),
      makeEdge('b', 't2', 't1', section),
    ]
    const map = assignEdgeLanes(edges)
    expect(map.get('a')?.laneCount).toBe(1)
    expect(map.get('b')?.laneCount).toBe(1)
    expect(map.get('a')?.laneIndex).toBe(0)
    expect(map.get('b')?.laneIndex).toBe(0)
  })

  it('不同表对的边互不影响', () => {
    const section = makeSection({ x: 0, y: 0 }, { x: 100, y: 0 })
    const edges: Edge<RFRelationshipEdgeData>[] = [
      makeEdge('a', 't1', 't2', section),
      makeEdge('b', 't1', 't2', section),
      makeEdge('c', 't2', 't3', section),
    ]
    const map = assignEdgeLanes(edges)
    expect(map.get('a')?.laneCount).toBe(2)
    expect(map.get('b')?.laneCount).toBe(2)
    expect(map.get('c')?.laneCount).toBe(1)
  })
})

describe('buildPathFromSections', () => {
  it('不同 lane 的标签中心点在垂直方向按 LANE_SPACING 错开', () => {
    // 模拟一个完全水平的边：start=(0,0) → end=(200,0)
    // laneCount=3: laneIndex=0 → offset = -80, laneIndex=1 → offset = 0, laneIndex=2 → offset = +80
    const section = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const lx0 = buildPathFromSections([section], { laneIndex: 0, laneCount: 3 })
    const lx1 = buildPathFromSections([section], { laneIndex: 1, laneCount: 3 })
    const lx2 = buildPathFromSections([section], { laneIndex: 2, laneCount: 3 })

    expect(lx1.labelY).toBeCloseTo(0, 1)
    expect(lx1.labelY - lx0.labelY).toBeGreaterThanOrEqual(50)
    expect(lx2.labelY - lx1.labelY).toBeGreaterThanOrEqual(50)
  })

  it('lane 标签沿连线方向也有偏移，避免同方向边投影到同一像素', () => {
    const section = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const lx0 = buildPathFromSections([section], { laneIndex: 0, laneCount: 3 })
    const lx1 = buildPathFromSections([section], { laneIndex: 1, laneCount: 3 })
    expect(lx1.labelX).not.toBe(lx0.labelX)
  })
})

describe('resolveLabelCollisions', () => {
  it('两个完全重叠的平行边标签在法向被推开', () => {
    // 两条完全平行的水平边，初始 label 中心点完全相同
    const section1 = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const section2 = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const result = resolveLabelCollisions([
      { id: 'a', sections: [section1] },
      { id: 'b', sections: [section2] },
    ])
    const a = result.get('a')!
    const b = result.get('b')!
    const dy = Math.abs(a.labelY - b.labelY)
    // 平行边沿法向错开，预期 |dy| ≥ 标签高度 + gap
    expect(dy).toBeGreaterThanOrEqual(100)
  })

  it('三对完全平行的边最终两两不重叠', () => {
    // 构造三条共享源/目标但 section 方向相同的边
    const section = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const result = resolveLabelCollisions([
      { id: 'a', sections: [section] },
      { id: 'b', sections: [section] },
      { id: 'c', sections: [section] },
    ])
    const positions = ['a', 'b', 'c'].map((id) => result.get(id)!)
    // 任意两 label 的中心点距离应 >= 标签高度 + gap（法向错开后的最小不重叠距离）
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = Math.hypot(
          positions[i].labelX - positions[j].labelX,
          positions[i].labelY - positions[j].labelY,
        )
        expect(d).toBeGreaterThanOrEqual(100)
      }
    }
  })

  it('垂直方向堆叠的两条边最终错开', () => {
    // 模拟同向水平边靠得很近的初始位置
    const section1 = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const section2 = makeSection({ x: 0, y: 5 }, { x: 200, y: 5 })
    const result = resolveLabelCollisions([
      { id: 'a', sections: [section1] },
      { id: 'b', sections: [section2] },
    ])
    const a = result.get('a')!
    const b = result.get('b')!
    // 两条边近乎共线，应被沿法向错开（距离 ≥ 标签高度 + 间隙）
    const d = Math.hypot(a.labelX - b.labelX, a.labelY - b.labelY)
    expect(d).toBeGreaterThanOrEqual(100)
  })

  it('互不重叠的两个标签位置基本保持不变', () => {
    // 两条相互远离的水平边，应保持初始位置
    const section1 = makeSection({ x: 0, y: 0 }, { x: 200, y: 0 })
    const section2 = makeSection({ x: 0, y: 500 }, { x: 200, y: 500 })
    const result = resolveLabelCollisions([
      { id: 'a', sections: [section1] },
      { id: 'b', sections: [section2] },
    ])
    expect(result.get('a')?.labelY).toBeCloseTo(0, 0)
    expect(result.get('b')?.labelY).toBeCloseTo(500, 0)
  })

  it('单条边（无碰撞）位置不变', () => {
    const section = makeSection({ x: 50, y: 50 }, { x: 250, y: 50 })
    const result = resolveLabelCollisions([{ id: 'a', sections: [section] }])
    expect(result.get('a')?.labelX).toBeCloseTo(150, 0)
    expect(result.get('a')?.labelY).toBeCloseTo(50, 0)
  })

  it('使用初始 labelX/labelY 时以该值参与碰撞检测', () => {
    // 两条不同的 section 给出明显不同的标签位置，最终应保持初始位置
    const section1 = makeSection({ x: 0, y: 0 }, { x: 100, y: 0 })
    const section2 = makeSection({ x: 0, y: 1000 }, { x: 100, y: 1000 })
    const result = resolveLabelCollisions([
      { id: 'a', sections: [section1], labelX: 50, labelY: 200 },
      { id: 'b', sections: [section2], labelX: 50, labelY: 800 },
    ])
    expect(result.get('a')?.labelY).toBeCloseTo(200, 0)
    expect(result.get('b')?.labelY).toBeCloseTo(800, 0)
  })
})

describe('resolveLabelNodeOverlaps', () => {
  it('将落在节点内的标签推到节点外', () => {
    // 节点 (0, 0, 220, 200)，中心 (110, 100)
    // 标签放在节点中心右内侧 (200, 100)，应被推到节点右侧外 (>220)
    const nodes = [
      {
        id: 't1',
        type: 'table' as const,
        position: { x: 0, y: 0 },
        width: 220,
        height: 200,
        data: { table: { id: 't1', name: 't1', fields: [] } },
      },
    ]
    const positions = new Map([
      ['a', { labelX: 200, labelY: 100, anchorX: 200, anchorY: 100 }],
    ])
    const result = resolveLabelNodeOverlaps(positions, nodes as any)
    const adj = result.get('a')!
    // 标签被推到节点右外侧
    expect(adj.labelX).toBeGreaterThan(220)
  })

  it('不与节点碰撞的标签位置不变', () => {
    const nodes = [
      {
        id: 't1',
        type: 'table' as const,
        position: { x: 0, y: 0 },
        width: 220,
        height: 200,
        data: { table: { id: 't1', name: 't1', fields: [] } },
      },
    ]
    const positions = new Map([
      ['a', { labelX: 500, labelY: 500, anchorX: 500, anchorY: 500 }],
    ])
    const result = resolveLabelNodeOverlaps(positions, nodes as any)
    expect(result.get('a')).toEqual({ labelX: 500, labelY: 500, anchorX: 500, anchorY: 500 })
  })
})
