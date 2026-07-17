import type { Node } from '@xyflow/react'
import type { ERSchema, RFTableNodeData } from '@/types/er'

export interface PostProcessOptions {
  centerPullStrength?: number
  clusterStrength?: number
  collisionPadding?: number
}

function identifyCoreTable(schema: ERSchema): string | null {
  const degree = new Map<string, number>()
  for (const table of schema.tables) degree.set(table.id, 0)
  for (const rel of schema.relationships) {
    degree.set(rel.sourceTableId, (degree.get(rel.sourceTableId) || 0) + 1)
    degree.set(rel.targetTableId, (degree.get(rel.targetTableId) || 0) + 1)
  }

  let coreTableId: string | null = null
  let maxDegree = -1
  for (const [tableId, count] of degree.entries()) {
    if (count > maxDegree || (count === maxDegree && (coreTableId === null || tableId < coreTableId))) {
      maxDegree = count
      coreTableId = tableId
    }
  }
  return coreTableId
}

function applyDirectionalClustering(
  nodeMap: Map<string, Node<RFTableNodeData>>,
  schema: ERSchema,
  strength: number,
  minDesiredDist: number,
): void {
  // 按节点度数归一化，避免高度数节点被多条关系过度拉动
  const degree = new Map<string, number>()
  for (const rel of schema.relationships) {
    degree.set(rel.sourceTableId, (degree.get(rel.sourceTableId) || 0) + 1)
    degree.set(rel.targetTableId, (degree.get(rel.targetTableId) || 0) + 1)
  }

  for (const rel of schema.relationships) {
    const source = nodeMap.get(rel.sourceTableId)
    const target = nodeMap.get(rel.targetTableId)
    if (!source || !target) continue

    const dx = target.position.x - source.position.x
    const dy = target.position.y - source.position.y
    const dist = Math.hypot(dx, dy)
    if (dist === 0) continue

    if (dist < minDesiredDist) continue

    const factor = strength * Math.min(1, (dist - minDesiredDist) / 600)
    const sourceDegree = degree.get(rel.sourceTableId) || 1
    const targetDegree = degree.get(rel.targetTableId) || 1

    source.position.x += (dx / dist) * factor * 60 * (0.8 / sourceDegree)
    source.position.y += (dy / dist) * factor * 60 * (0.8 / sourceDegree)
    target.position.x -= (dx / dist) * factor * 60 * (0.4 / targetDegree)
    target.position.y -= (dy / dist) * factor * 60 * (0.4 / targetDegree)
  }
}

function centerOnCoreTable(
  nodeMap: Map<string, Node<RFTableNodeData>>,
  coreTableId: string | null,
): void {
  if (!coreTableId) return
  const coreNode = nodeMap.get(coreTableId)
  if (!coreNode) return

  const coreCx = coreNode.position.x + (coreNode.width ?? 220) / 2
  const coreCy = coreNode.position.y + (coreNode.height ?? 100) / 2
  for (const node of nodeMap.values()) {
    node.position.x -= coreCx
    node.position.y -= coreCy
  }
}

function resolveCollisions(
  nodes: Node<RFTableNodeData>[],
  gap: number,
  maxIterations: number,
): Node<RFTableNodeData>[] {
  const result = nodes.map((n) => ({
    ...n,
    position: { ...n.position },
  }))

  for (let iter = 0; iter < maxIterations; iter++) {
    const damping = Math.max(0.35, 1 - (iter / maxIterations) * 0.65)
    let totalOverlap = 0
    const shifts = result.map(() => ({ x: 0, y: 0 }))

    for (let i = 0; i < result.length; i++) {
      const a = result[i]
      const wA = a.width ?? 220
      const hA = a.height ?? 100
      const cxa = a.position.x + wA / 2
      const cya = a.position.y + hA / 2

      for (let j = i + 1; j < result.length; j++) {
        const b = result[j]
        const wB = b.width ?? 220
        const hB = b.height ?? 100
        const cxb = b.position.x + wB / 2
        const cyb = b.position.y + hB / 2

        const dx = Math.abs(cxa - cxb)
        const dy = Math.abs(cya - cyb)
        const minDistX = (wA + wB) / 2 + gap
        const minDistY = (hA + hB) / 2 + gap

        if (dx >= minDistX || dy >= minDistY) continue

        const overlapX = minDistX - dx
        const overlapY = minDistY - dy
        totalOverlap += Math.min(overlapX, overlapY)

        if (overlapX <= overlapY) {
          // 水平分离，额外加 1px 保证迭代收敛
          const shift = (overlapX / 2 + 1) * damping
          if (cxa < cxb) {
            shifts[i].x -= shift
            shifts[j].x += shift
          } else {
            shifts[i].x += shift
            shifts[j].x -= shift
          }
        } else {
          const shift = (overlapY / 2 + 1) * damping
          if (cya < cyb) {
            shifts[i].y -= shift
            shifts[j].y += shift
          } else {
            shifts[i].y += shift
            shifts[j].y -= shift
          }
        }
      }
    }

    if (totalOverlap === 0) break

    for (let i = 0; i < result.length; i++) {
      result[i].position.x += shifts[i].x
      result[i].position.y += shifts[i].y
    }

    // 若连续迭代未显著改善，提前退出
    if (iter > 10 && totalOverlap < 0.5) break
  }

  return result
}

export function postProcessLayout(
  schema: ERSchema,
  nodes: Node<RFTableNodeData>[],
  options: PostProcessOptions = {},
): Node<RFTableNodeData>[] {
  const { clusterStrength = 0.008, collisionPadding = 40 } = options

  if (nodes.length === 0) return nodes

  const nodeCount = nodes.length
  const coreTableId = identifyCoreTable(schema)

  const nodeMap = new Map<string, Node<RFTableNodeData>>()
  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, position: { ...node.position } })
  }

  // 表少时收紧间距，表多时放松
  const minDesiredDist = nodeCount <= 5 ? 140 : nodeCount <= 15 ? 180 : 260
  // 大规模图进一步降低聚类强度，避免过度拉扯导致重叠
  const adjustedClusterStrength = nodeCount >= 50 ? clusterStrength * 0.4 : clusterStrength
  applyDirectionalClustering(nodeMap, schema, adjustedClusterStrength, minDesiredDist)

  centerOnCoreTable(nodeMap, coreTableId)

  const gap = nodeCount <= 5 ? 20 : nodeCount <= 15 ? 28 : collisionPadding
  const maxIterations = nodeCount >= 100 ? 800 : nodeCount >= 50 ? 500 : 250

  return resolveCollisions(Array.from(nodeMap.values()), gap, maxIterations)
}
