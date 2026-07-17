import type { Edge, Node } from '@xyflow/react'
import type { ElkPoint, ElkSection, EdgeLaneInfo, RFRelationshipEdgeData, RFTableNodeData } from '@/types/er'
import { Position } from '@xyflow/react'

export interface RoutingPoint {
  x: number
  y: number
}

export interface OrthogonalPath {
  path: string
  labelX: number
  labelY: number
  /** 标签在边上"锚定"的位置（label 实际归属的边的最近点），用于绘制 leader line */
  anchorX: number
  anchorY: number
}

export function computeOrthogonalPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
): OrthogonalPath {
  const points: RoutingPoint[] = [{ x: sourceX, y: sourceY }]
  const dx = targetX - sourceX
  const dy = targetY - sourceY

  const midX = sourceX + dx / 2
  const midY = sourceY + dy / 2

  if (sourcePosition === Position.Right && targetPosition === Position.Left) {
    points.push({ x: midX, y: sourceY })
    points.push({ x: midX, y: targetY })
  } else if (sourcePosition === Position.Left && targetPosition === Position.Right) {
    points.push({ x: midX, y: sourceY })
    points.push({ x: midX, y: targetY })
  } else if (sourcePosition === Position.Top && targetPosition === Position.Bottom) {
    points.push({ x: sourceX, y: midY })
    points.push({ x: targetX, y: midY })
  } else if (sourcePosition === Position.Bottom && targetPosition === Position.Top) {
    points.push({ x: sourceX, y: midY })
    points.push({ x: targetX, y: midY })
  } else {
    const useHorizontal = Math.abs(dx) > Math.abs(dy)
    if (useHorizontal) {
      points.push({ x: midX, y: sourceY })
      points.push({ x: midX, y: targetY })
    } else {
      points.push({ x: sourceX, y: midY })
      points.push({ x: targetX, y: midY })
    }
  }

  points.push({ x: targetX, y: targetY })

  const path = buildSmoothPath(points)
  const labelPoint = points.length > 2 ? points[Math.floor(points.length / 2)] : { x: midX, y: midY }

  return {
    path,
    labelX: labelPoint.x,
    labelY: labelPoint.y,
    anchorX: labelPoint.x,
    anchorY: labelPoint.y,
  }
}

function buildSmoothPath(points: RoutingPoint[]): string {
  if (points.length < 2) return ''

  let d = `M ${points[0].x} ${points[0].y}`

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cornerRadius = 12

    if (prev.x !== curr.x && prev.y !== curr.y) {
      const dx = Math.sign(curr.x - prev.x) * Math.min(cornerRadius, Math.abs(curr.x - prev.x) / 2)
      const dy = Math.sign(curr.y - prev.y) * Math.min(cornerRadius, Math.abs(curr.y - prev.y) / 2)

      d += ` L ${curr.x - dx} ${prev.y}`
      d += ` Q ${curr.x} ${prev.y} ${curr.x} ${prev.y + dy}`
    }

    d += ` L ${curr.x} ${curr.y}`
  }

  return d
}

function polylineLength(points: ElkPoint[]): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

/**
 * 根据节点位移（源端/目标端）对 ELK sections 的每个点做线性插值平移，
 * 保证边端点始终贴合当前节点 handle 位置。
 */
export function interpolateSectionsWithNodeDeltas(
  sections: ElkSection[],
  sourceDelta: ElkPoint,
  targetDelta: ElkPoint,
): ElkSection[] {
  return sections.map((section) => {
    const points: ElkPoint[] = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ]

    const total = polylineLength(points)
    let cum = 0
    const translated: ElkPoint[] = points.map((p, i) => {
      if (i > 0) {
        const dx = p.x - points[i - 1].x
        const dy = p.y - points[i - 1].y
        cum += Math.sqrt(dx * dx + dy * dy)
      }
      const t = total === 0 ? 0 : cum / total
      const dx = (1 - t) * sourceDelta.x + t * targetDelta.x
      const dy = (1 - t) * sourceDelta.y + t * targetDelta.y
      return { x: p.x + dx, y: p.y + dy }
    })

    const [start, ...rest] = translated
    const end = rest.pop()!
    return {
      ...section,
      startPoint: start,
      endPoint: end,
      bendPoints: rest,
    }
  })
}

/**
 * 为边分配 lane，按 (sourceTableId, targetTableId) 分组为 bundle：
 * - 同一对表之间的所有边共享同一个 lane 池，无论目标字段是否相同，
 *   避免不同字段的多条边因 lanes 独立而堆叠在同一路径上。
 * - 在 bundle 内先按目标字段分桶，再按源字段分桶，保证 lane 顺序稳定。
 */
export function assignEdgeLanes(
  edges: Edge<RFRelationshipEdgeData>[],
): Map<string, EdgeLaneInfo> {
  const result = new Map<string, EdgeLaneInfo>()

  // 第一层：按 (sourceTableId, targetTableId) 分组为 bundle
  const bundles = new Map<string, Edge<RFRelationshipEdgeData>[]>()
  for (const edge of edges) {
    const bKey = `${edge.source}::${edge.target}`
    if (!bundles.has(bKey)) bundles.set(bKey, [])
    bundles.get(bKey)!.push(edge)
  }

  for (const [, bundle] of bundles) {
    // 第二层：在 bundle 内按目标字段分组
    const targetGroups = new Map<string, Edge<RFRelationshipEdgeData>[]>()
    for (const edge of bundle) {
      const tf = edge.data?.relationship?.targetFieldId ?? ''
      const tKey = `${edge.target}::${tf}`
      if (!targetGroups.has(tKey)) targetGroups.set(tKey, [])
      targetGroups.get(tKey)!.push(edge)
    }

    // 每个目标组内再按源字段分桶，保持顺序稳定
    const flatOrdered: Edge<RFRelationshipEdgeData>[] = []
    const sortedTKeys = Array.from(targetGroups.keys()).sort()
    for (const tKey of sortedTKeys) {
      const group = targetGroups.get(tKey)!
      const sourceBuckets = new Map<string, Edge<RFRelationshipEdgeData>[]>()
      for (const edge of group) {
        const sf = edge.data?.relationship?.sourceFieldId ?? ''
        const sKey = `${edge.source}::${sf}`
        if (!sourceBuckets.has(sKey)) sourceBuckets.set(sKey, [])
        sourceBuckets.get(sKey)!.push(edge)
      }
      const sortedBuckets = Array.from(sourceBuckets.values()).sort((a, b) => {
        const aId = a[0]?.id ?? ''
        const bId = b[0]?.id ?? ''
        return aId.localeCompare(bId)
      })
      for (const bucket of sortedBuckets) {
        flatOrdered.push(...bucket)
      }
    }

    // 在 bundle 级别统一分配 lane index，确保所有边都能错开
    const count = flatOrdered.length
    flatOrdered.forEach((edge, index) => {
      result.set(edge.id, { laneIndex: index, laneCount: count })
    })
  }

  return result
}

/**
 * lane 间距：在法向错开同表对之间多条边的路径。
 * 对 n 条边，总 spread = (n-1) * LANE_SPACING。
 * 只需要刚好错开让路径可辨即可，过大会造成与其他边的交叉。
 */
const LANE_SPACING = 50

/**
 * lane 偏移在 EDGE 方向上的额外延伸量：让长边上不同 lane 沿连线方向错开，
 * 避免两条近平行边的标签投影到同一像素上。
 */
const LANE_ALONG_EDGE = 16

/**
 * 把 ELK section 转换成 SVG path，并支持 lane 偏移（垂直 + 沿线方向）。
 * 垂直偏移让多 lane 在法向错开，沿线偏移让长边上的不同 lane 在切向也错开，
 * 避免两条近平行边投影到同一像素造成的标签堆叠。
 */
export function buildPathFromSections(
  sections: ElkSection[],
  lane?: EdgeLaneInfo,
): OrthogonalPath {
  const section = sections[0]
  if (!section) {
    return { path: '', labelX: 0, labelY: 0, anchorX: 0, anchorY: 0 }
  }

  const offset = lane
    ? (lane.laneIndex - (lane.laneCount - 1) / 2) * LANE_SPACING
    : 0

  // 沿线方向偏移：奇数偶数 lane 互相错开，避免两条平行边投影到同一像素
  const alongOffset = lane
    ? (lane.laneIndex - (lane.laneCount - 1) / 2) * LANE_ALONG_EDGE
    : 0

  // 计算 section 主方向单位向量（沿线切向）
  const dx = section.endPoint.x - section.startPoint.x
  const dy = section.endPoint.y - section.startPoint.y
  const len = Math.hypot(dx, dy)
  const tx = len > 0.1 ? dx / len : 0
  const ty = len > 0.1 ? dy / len : 0

  const points: RoutingPoint[] = [{ x: section.startPoint.x, y: section.startPoint.y }]

  if (offset !== 0) {
    points.push({ x: section.startPoint.x, y: section.startPoint.y + offset })
  }

  for (const bend of section.bendPoints ?? []) {
    points.push({ x: bend.x, y: bend.y + offset })
  }

  if (offset !== 0) {
    points.push({ x: section.endPoint.x, y: section.endPoint.y + offset })
  }

  points.push({ x: section.endPoint.x, y: section.endPoint.y })

  const path = buildSmoothPath(points)

  // 取路径中点作为标签位置，并叠加 lane 沿线偏移（让 label 沿连线方向轻微滑开）
  // 锚点位置是 section 中点（不含 lane 偏移）—— 标签可以偏移到 lane 内，
  // 但引线应该连到边几何上最近的点，让用户能识别标签归属于哪条边。
  let labelX: number
  let labelY: number
  let anchorX: number
  let anchorY: number
  if (section.bendPoints && section.bendPoints.length > 0) {
    const mid = section.bendPoints[Math.floor(section.bendPoints.length / 2)]
    labelX = mid.x + tx * alongOffset
    labelY = mid.y + offset + ty * alongOffset
    anchorX = mid.x
    anchorY = mid.y
  } else {
    labelX = (section.startPoint.x + section.endPoint.x) / 2 + tx * alongOffset
    labelY = (section.startPoint.y + section.endPoint.y) / 2 + offset + ty * alongOffset
    anchorX = (section.startPoint.x + section.endPoint.x) / 2
    anchorY = (section.startPoint.y + section.endPoint.y) / 2
  }

  return { path, labelX, labelY, anchorX, anchorY }
}

const LABEL_ESTIMATED_WIDTH = 220
const LABEL_ESTIMATED_HEIGHT = 80
const LABEL_NODE_PADDING = 28
const LABEL_EXTRA_MARGIN = 16
const LABEL_LABEL_GAP = 20

function rectContainsLabel(
  nx: number,
  ny: number,
  nw: number,
  nh: number,
  x: number,
  y: number,
): boolean {
  const halfW = LABEL_ESTIMATED_WIDTH / 2 + LABEL_NODE_PADDING
  const halfH = LABEL_ESTIMATED_HEIGHT / 2 + LABEL_NODE_PADDING
  return x > nx - halfW && x < nx + nw + halfW && y > ny - halfH && y < ny + nh + halfH
}

function pushLabelOutOfNode(
  nx: number,
  ny: number,
  nw: number,
  nh: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const cx = nx + nw / 2
  const cy = ny + nh / 2
  const dx = x - cx
  const dy = y - cy
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  const halfW = LABEL_ESTIMATED_WIDTH / 2 + LABEL_NODE_PADDING + LABEL_EXTRA_MARGIN
  const halfH = LABEL_ESTIMATED_HEIGHT / 2 + LABEL_NODE_PADDING + LABEL_EXTRA_MARGIN
  const toRight = nw / 2 + halfW
  const toBottom = nh / 2 + halfH

  if (absDx < 0.1 && absDy < 0.1) {
    return { x: cx + toRight, y: cy }
  }

  if (absDx * nh > absDy * nw) {
    const sign = dx > 0 ? 1 : -1
    return {
      x: cx + sign * toRight,
      y: cy + (dy * sign * toRight) / absDx,
    }
  }

  const sign = dy > 0 ? 1 : -1
  return {
    x: cx + (dx * sign * toBottom) / absDy,
    y: cy + sign * toBottom,
  }
}

/**
 * 标签位置信息：
 * - labelX/labelY: 标签中心点（可能被推开以避免碰撞）
 * - anchorX/anchorY: 标签在边几何上的"锚点"—— 边上的对应位置，用于绘制 leader line
 */
export interface LabelPosition {
  labelX: number
  labelY: number
  anchorX: number
  anchorY: number
}

/**
 * 将标签推到最近的表实体边界之外，避免标签与实体重叠。
 * 迭代多次，处理一次推开后再落入其它节点的情况。
 */
export function resolveLabelNodeOverlaps(
  labelPositions: Map<string, LabelPosition>,
  nodes: Node<RFTableNodeData>[],
): Map<string, LabelPosition> {
  const result = new Map<string, LabelPosition>()

  for (const [edgeId, pos] of labelPositions) {
    let { labelX: x, labelY: y } = pos
    const anchorX = pos.anchorX
    const anchorY = pos.anchorY

    for (let iter = 0; iter < 6; iter++) {
      let moved = false
      for (const node of nodes) {
        const nx = node.position.x
        const ny = node.position.y
        const nw = node.width ?? 220
        const nh = node.height ?? 100

        if (rectContainsLabel(nx, ny, nw, nh, x, y)) {
          const pushed = pushLabelOutOfNode(nx, ny, nw, nh, x, y)
          x = pushed.x
          y = pushed.y
          moved = true
        }
      }
      if (!moved) break
    }

    // 推离节点后仍要限制标签远离边锚点，避免 leader line 过长
    const ddx = x - anchorX
    const ddy = y - anchorY
    const dist = Math.hypot(ddx, ddy)
    if (dist > MAX_LABEL_DISPLACEMENT) {
      const scale = MAX_LABEL_DISPLACEMENT / dist
      x = anchorX + ddx * scale
      y = anchorY + ddy * scale
    }

    result.set(edgeId, { labelX: x, labelY: y, anchorX, anchorY })
  }

  return result
}

export function isEdgeHovered(
  edgeId: string,
  hoveredEdgeId: string | null,
  highlightedEdgeIds: Set<string>,
): { isHovered: boolean; isInChain: boolean; isDimmed: boolean } {
  const isHovered = hoveredEdgeId === edgeId
  const isInChain = highlightedEdgeIds.has(edgeId)
  const isDimmed = highlightedEdgeIds.size > 0 && !isInChain

  return { isHovered, isInChain, isDimmed }
}

interface LabelEntry {
  edgeId: string
  x: number
  y: number
  anchorX: number
  anchorY: number
  sectionStart: ElkPoint
  sectionEnd: ElkPoint
}

interface LabelRect {
  edgeId: string
  cx: number
  cy: number
  left: number
  right: number
  top: number
  bottom: number
  sectionStart: ElkPoint
  sectionEnd: ElkPoint
  /** 标签在边几何上的"锚点"—— 标签推离这个点的最大距离有限制，便于画 leader line */
  anchorX: number
  anchorY: number
}

function entryToRect(entry: LabelEntry): LabelRect {
  return {
    edgeId: entry.edgeId,
    cx: entry.x,
    cy: entry.y,
    left: entry.x - LABEL_ESTIMATED_WIDTH / 2,
    right: entry.x + LABEL_ESTIMATED_WIDTH / 2,
    top: entry.y - LABEL_ESTIMATED_HEIGHT / 2,
    bottom: entry.y + LABEL_ESTIMATED_HEIGHT / 2,
    sectionStart: entry.sectionStart,
    sectionEnd: entry.sectionEnd,
    anchorX: entry.anchorX,
    anchorY: entry.anchorY,
  }
}

function rectsOverlap(a: LabelRect, b: LabelRect): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  )
}

/**
 * 计算把 a 推出 b 所需的最小位移（仅当 rectsOverlap 时返回非零位移），
 * 沿重叠最小的轴推开，避免一次产生大跳动。
 */
function minPushApart(a: LabelRect, b: LabelRect): { dx: number; dy: number } {
  const overlapX1 = b.right - a.left
  const overlapX2 = a.right - b.left
  const overlapY1 = b.bottom - a.top
  const overlapY2 = a.bottom - b.top

  const minX = Math.min(overlapX1, overlapX2)
  const minY = Math.min(overlapY1, overlapY2)

  if (minX < minY) {
    return {
      dx: overlapX1 < overlapX2 ? -overlapX1 : overlapX2,
      dy: 0,
    }
  }
  return {
    dx: 0,
    dy: overlapY1 < overlapY2 ? -overlapY1 : overlapY2,
  }
}

/** 边的切向单位向量，用于判断两条边是否近平行 */
function edgeTangent(rect: LabelRect): { x: number; y: number } {
  const dx = rect.sectionEnd.x - rect.sectionStart.x
  const dy = rect.sectionEnd.y - rect.sectionStart.y
  const len = Math.hypot(dx, dy)
  if (len < 0.1) return { x: 0, y: 1 }
  return { x: dx / len, y: dy / len }
}

function recomputeRect(r: LabelRect): void {
  r.left = r.cx - LABEL_ESTIMATED_WIDTH / 2
  r.right = r.cx + LABEL_ESTIMATED_WIDTH / 2
  r.top = r.cy - LABEL_ESTIMATED_HEIGHT / 2
  r.bottom = r.cy + LABEL_ESTIMATED_HEIGHT / 2
}

/**
 * 标签允许推离其锚点（边上的中点位置）的最大距离。
 * 超过这个距离，标签会被"拉回"，避免标签散到画布上远离对应边。
 * 大图里节点会把标签挤到较远位置，需要给足空间让同簇标签充分错开。
 */
const MAX_LABEL_DISPLACEMENT = 1500

/**
 * 解决关系标签之间的碰撞：
 * - 用 AABB 矩形（基于真实标签尺寸）做碰撞检测
 * - 平行边（dot > 0.9）沿切向扇出，非平行边沿最小推开轴推开
 * - 多轮迭代至稳定
 * - 限制标签偏离其边锚点的最大距离，避免标签远离边
 */
export function resolveLabelCollisions(
  edges: {
    id: string
    sections?: ElkSection[]
    lane?: EdgeLaneInfo
    labelX?: number
    labelY?: number
    anchorX?: number
    anchorY?: number
  }[],
  maxIterations: number = 80,
): Map<string, LabelPosition> {
  // 计算每条边的初始位置（无 labelX/labelY 时从中点推算）
  const initial: LabelEntry[] = []
  for (const edge of edges) {
    let labelX = edge.labelX
    let labelY = edge.labelY

    if (labelX === undefined || labelY === undefined) {
      const section = edge.sections?.[0]
      if (!section) continue

      const offset = edge.lane
        ? (edge.lane.laneIndex - (edge.lane.laneCount - 1) / 2) * LANE_SPACING
        : 0

      if (section.bendPoints && section.bendPoints.length > 0) {
        const mid = section.bendPoints[Math.floor(section.bendPoints.length / 2)]
        labelX = mid.x
        labelY = mid.y + offset
      } else {
        labelX = (section.startPoint.x + section.endPoint.x) / 2
        labelY = (section.startPoint.y + section.endPoint.y) / 2 + offset
      }
    }

    const anchorX = edge.anchorX ?? labelX
    const anchorY = edge.anchorY ?? labelY
    initial.push({
      edgeId: edge.id,
      x: labelX,
      y: labelY,
      anchorX,
      anchorY,
      sectionStart: edge.sections?.[0]?.startPoint ?? { x: 0, y: 0 },
      sectionEnd: edge.sections?.[0]?.endPoint ?? { x: 0, y: 0 },
    })
  }

  if (initial.length < 1) {
    return new Map()
  }

  // 用 rect 表达当前位置，便于做 AABB 碰撞检测
  const rects: LabelRect[] = initial.map(entryToRect)

  // 记录每个 label 的"锚点"（边几何上的原始位置）—— 用于限制最大推开距离
  const anchors = new Map<string, { x: number; y: number }>()
  for (const r of rects) {
    anchors.set(r.edgeId, { x: r.anchorX, y: r.anchorY })
  }

  function clampToAnchor(r: LabelRect): void {
    const anchor = anchors.get(r.edgeId)
    if (!anchor) return
    const ddx = r.cx - anchor.x
    const ddy = r.cy - anchor.y
    const dist = Math.hypot(ddx, ddy)
    if (dist > MAX_LABEL_DISPLACEMENT) {
      const scale = MAX_LABEL_DISPLACEMENT / dist
      r.cx = anchor.x + ddx * scale
      r.cy = anchor.y + ddy * scale
    }
  }

  function areParallel(a: LabelRect, b: LabelRect): boolean {
    const ta = edgeTangent(a)
    const tb = edgeTangent(b)
    const dot = ta.x * tb.x + ta.y * tb.y
    return Math.abs(dot) > 0.9
  }

  /**
   * 对由 >=3 条近平行边组成的重叠簇做一次性整体分布：
   * 把所有标签沿公共法向排序后，按“最小不重叠距离”均匀排开，
   * 并以原始中位数为中心平移，避免两两推开时被锚点约束反复拉回。
   */
  function distributeParallelCluster(indices: number[], rects: LabelRect[]): boolean {
    if (indices.length < 2) return false
    const tangent = edgeTangent(rects[indices[0]])
    const nx = -tangent.y
    const ny = tangent.x
    const minGap =
      LABEL_ESTIMATED_WIDTH * Math.abs(nx) + LABEL_ESTIMATED_HEIGHT * Math.abs(ny) + LABEL_LABEL_GAP

    const items = indices
      .map((idx) => ({ idx, proj: rects[idx].cx * nx + rects[idx].cy * ny }))
      .sort((a, b) => a.proj - b.proj)

    const original = items.map((i) => i.proj)
    const placed: number[] = [...original]
    for (let i = 1; i < placed.length; i++) {
      if (placed[i] < placed[i - 1] + minGap) {
        placed[i] = placed[i - 1] + minGap
      }
    }

    const mid = Math.floor(placed.length / 2)
    const shift = original[mid] - placed[mid]
    for (let i = 0; i < placed.length; i++) {
      placed[i] += shift
    }

    let moved = false
    for (let i = 0; i < items.length; i++) {
      const idx = items[i].idx
      const r = rects[idx]
      const delta = placed[i] - (r.cx * nx + r.cy * ny)
      if (Math.abs(delta) > 0.5) moved = true
      r.cx += delta * nx
      r.cy += delta * ny
      recomputeRect(r)
    }
    return moved
  }

  function resolveParallelClusters(rects: LabelRect[]): boolean {
    const n = rects.length
    const visited = new Set<number>()
    const components: number[][] = []

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue
      const stack = [i]
      const comp: number[] = []
      visited.add(i)
      while (stack.length > 0) {
        const cur = stack.pop()!
        comp.push(cur)
        for (let j = 0; j < n; j++) {
          if (visited.has(j)) continue
          if (rectsOverlap(rects[cur], rects[j]) && areParallel(rects[cur], rects[j])) {
            visited.add(j)
            stack.push(j)
          }
        }
      }
      if (comp.length >= 2) {
        components.push(comp)
      }
    }

    let moved = false
    for (const comp of components) {
      if (distributeParallelCluster(comp, rects)) moved = true
    }
    return moved
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false

    // 对多条近平行边形成的重叠簇先做整体分布，避免两两推开时个别标签被锚点约束拉回。
    if (resolveParallelClusters(rects)) moved = true

    // 收集本轮所有重叠对的推开向量，统一应用，避免顺序处理导致震荡。
    const accDx = new Float64Array(rects.length)
    const accDy = new Float64Array(rects.length)

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        if (!rectsOverlap(a, b)) continue

        const ta = edgeTangent(a)
        const tb = edgeTangent(b)
        const dot = ta.x * tb.x + ta.y * tb.y
        const isParallel = Math.abs(dot) > 0.9

        let pushDx = 0
        let pushDy = 0
        if (isParallel) {
          // 平行边：沿法向错开，leader line 更短且归属清晰
          const normal = { x: -ta.y, y: ta.x }
          const spread = LABEL_ESTIMATED_HEIGHT + LABEL_LABEL_GAP
          const projA = a.cx * normal.x + a.cy * normal.y
          const projB = b.cx * normal.x + b.cy * normal.y
          const signA = projA >= projB ? 1 : -1
          pushDx = normal.x * spread * signA
          pushDy = normal.y * spread * signA
        } else {
          const push = minPushApart(a, b)
          const margin = 20
          const halfX = push.dx / 2 + Math.sign(push.dx) * margin
          const halfY = push.dy / 2 + Math.sign(push.dy) * margin
          pushDx = halfX
          pushDy = halfY
        }

        accDx[i] += pushDx
        accDy[i] += pushDy
        accDx[j] -= pushDx
        accDy[j] -= pushDy

        moved = true
      }
    }

    for (let i = 0; i < rects.length; i++) {
      if (accDx[i] !== 0 || accDy[i] !== 0) {
        rects[i].cx += accDx[i]
        rects[i].cy += accDy[i]
        recomputeRect(rects[i])
      }
    }

    // 限制每个标签偏离其锚点的最大距离
    for (const r of rects) {
      clampToAnchor(r)
      recomputeRect(r)
    }

    // clampToAnchor 可能把已分开的标签拉回到重叠区域，需二次检测残余重叠
    let residualOverlaps = 0
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (rectsOverlap(rects[i], rects[j])) {
          residualOverlaps++
        }
      }
    }

    if (residualOverlaps > 0) {
      // 残余重叠：用更大的推开力做一次强分布
      const acc2Dx = new Float64Array(rects.length)
      const acc2Dy = new Float64Array(rects.length)
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          if (!rectsOverlap(rects[i], rects[j])) continue
          const a = rects[i]
          const b = rects[j]
          const push = minPushApart(a, b)
          // 二次推开用更大裕量，确保 clamp 后仍不重叠
          const extraMargin = LABEL_LABEL_GAP
          const halfX = push.dx / 2 + Math.sign(push.dx) * extraMargin
          const halfY = push.dy / 2 + Math.sign(push.dy) * extraMargin
          acc2Dx[i] += halfX
          acc2Dy[i] += halfY
          acc2Dx[j] -= halfX
          acc2Dy[j] -= halfY
        }
      }
      for (let i = 0; i < rects.length; i++) {
        if (acc2Dx[i] !== 0 || acc2Dy[i] !== 0) {
          rects[i].cx += acc2Dx[i]
          rects[i].cy += acc2Dy[i]
          recomputeRect(rects[i])
        }
      }
      for (const r of rects) {
        clampToAnchor(r)
        recomputeRect(r)
      }
    }

    if (!moved) break
  }

  const result = new Map<string, { labelX: number; labelY: number; anchorX: number; anchorY: number }>()
  for (const r of rects) {
    result.set(r.edgeId, {
      labelX: r.cx,
      labelY: r.cy,
      anchorX: r.anchorX,
      anchorY: r.anchorY,
    })
  }
  return result
}
