import type { Node, Edge } from '@xyflow/react'
import type { ERSchema, RFTableNodeData, RFRelationshipEdgeData, ElkSection } from '@/types/er'
import { calcNodeHeight, NODE_WIDTH } from '../utils/nodeMetrics'
import { postProcessLayout } from '../layout/postProcess'
import {
  assignEdgeLanes,
  buildPathFromSections,
  interpolateSectionsWithNodeDeltas,
  resolveLabelCollisions,
  resolveLabelNodeOverlaps,
} from '../layout/path-routing'

let elk: any = null

async function getELK() {
  if (!elk) {
    const ELK = await import('elkjs/lib/elk-api')
    elk = new ELK.default({
      workerFactory: () =>
        new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url), { type: 'module' }),
    })
  }
  return elk
}

function makePortId(tableId: string, fieldId: string, kind: 'out' | 'in'): string {
  return `${tableId}::${fieldId}__${kind}`
}

function buildLayeredOptions(tableCount: number): Record<string, string> {
  const tight = tableCount <= 5
  const compact = tableCount <= 15
  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': tight ? '80' : compact ? '120' : '200',
    'elk.layered.spacing.nodeNodeBetweenLayers': tight ? '100' : compact ? '160' : '280',
    'elk.spacing.edgeEdge': tight ? '30' : compact ? '50' : '80',
    'elk.spacing.edgeNode': tight ? '40' : compact ? '60' : '100',
    'elk.layered.spacing.edgeNodeBetweenLayers': tight ? '40' : compact ? '60' : '100',
    'elk.spacing.componentComponent': tight ? '160' : compact ? '240' : '400',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.nodePlacement.favorStraightEdges': 'true',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.separateConnectedComponents': 'true',
  }
}

function buildStressOptions(tableCount: number): Record<string, string> {
  const tight = tableCount <= 5
  const compact = tableCount <= 15
  return {
    'elk.algorithm': 'stress',
    'elk.spacing.nodeNode': tight ? '60' : compact ? '80' : '120',
    'elk.spacing.edgeEdge': tight ? '20' : compact ? '30' : '50',
    'elk.spacing.edgeNode': tight ? '30' : compact ? '50' : '80',
    'elk.spacing.componentComponent': tight ? '120' : compact ? '180' : '300',
    'elk.stress.desiredLength': tight ? '120' : compact ? '160' : '220',
    'elk.stress.dimension': '2D',
    'elk.packing.compactness': '0.85',
    'elk.edgeRouting': 'POLYLINE',
    'elk.separateConnectedComponents': 'true',
  }
}

function buildLayoutOptions(tableCount: number): Record<string, string> {
  return tableCount >= 50 ? buildStressOptions(tableCount) : buildLayeredOptions(tableCount)
}

interface WorkerInput {
  schema: ERSchema
  options?: Record<string, string>
}

interface WorkerOutput {
  nodes: Node<RFTableNodeData>[]
  edges: Edge<RFRelationshipEdgeData>[]
}

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  try {
    const { schema, options = {} } = event.data

    const children = schema.tables.map((table) => {
      const fields = table.fields
      const outPorts = fields.map((f, i) => ({
        id: makePortId(table.id, f.id, 'out'),
        width: 1,
        height: 1,
        layoutOptions: {
          'elk.port.side': 'EAST',
          'elk.port.index': String(i),
        },
      }))
      const inPorts = fields.map((f, i) => ({
        id: makePortId(table.id, f.id, 'in'),
        width: 1,
        height: 1,
        layoutOptions: {
          'elk.port.side': 'WEST',
          'elk.port.index': String(i),
        },
      }))

      return {
        id: table.id,
        width: NODE_WIDTH,
        height: calcNodeHeight(fields.length),
        layoutOptions: {
          'elk.portConstraints': 'FIXED_ORDER',
        },
        ports: [...outPorts, ...inPorts],
      }
    })

    const elkEdges = schema.relationships.map((rel) => ({
      id: rel.id,
      sources: [makePortId(rel.sourceTableId, rel.sourceFieldId, 'out')],
      targets: [makePortId(rel.targetTableId, rel.targetFieldId, 'in')],
    }))

    const baseOptions = buildLayoutOptions(schema.tables.length)

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        ...baseOptions,
        ...options,
      },
      children,
      edges: elkEdges,
    }

    const elkInstance = await getELK()
    const layoutedGraph = await elkInstance.layout(elkGraph)

    const elkEdgeMap = new Map<string, any>()
    for (const e of layoutedGraph.edges ?? []) {
      elkEdgeMap.set(e.id, e)
    }

    const nodes: Node<RFTableNodeData>[] =
      layoutedGraph.children?.map((child: any) => {
        const table = schema.tables.find((t) => t.id === child.id)!
        return {
          id: child.id,
          type: 'table',
          position: {
            x: child.x ?? 0,
            y: child.y ?? 0,
          },
          data: { table },
          width: child.width,
          height: child.height,
        }
      }) ?? []

    const initialPositions = new Map<string, { x: number; y: number }>()
    for (const node of nodes) {
      initialPositions.set(node.id, { ...node.position })
    }

    const tc = schema.tables.length
    const padding = tc <= 5 ? 20 : tc <= 15 ? 28 : tc >= 100 ? 56 : tc >= 50 ? 48 : 40
    const cluster = tc >= 50 ? 0.0008 : tc <= 5 ? 0.006 : 0.002

    const processedNodes = postProcessLayout(schema, nodes, {
      clusterStrength: cluster,
      collisionPadding: padding,
    })

    const edges: Edge<RFRelationshipEdgeData>[] = schema.relationships.map((rel) => {
      const elkEdge = elkEdgeMap.get(rel.id)
      const sections: ElkSection[] | undefined = elkEdge?.sections
      return {
        id: rel.id,
        source: rel.sourceTableId,
        target: rel.targetTableId,
        sourceHandle: rel.sourceFieldId,
        targetHandle: rel.targetFieldId,
        type: 'relationship',
        data: { relationship: rel, sections },
      }
    })

    const laneMap = assignEdgeLanes(edges)
    for (const edge of edges) {
      const lane = laneMap.get(edge.id)
      if (lane && edge.data) {
        edge.data = { ...edge.data, lane }
      }
    }

    // 根据后处理导致的节点位移，校正边 sections，让端点始终贴合 handle
    for (const edge of edges) {
      if (!edge.data?.sections || edge.data.sections.length === 0) continue
      const sourceInit = initialPositions.get(edge.source)
      const targetInit = initialPositions.get(edge.target)
      if (!sourceInit || !targetInit) continue

      const sourceFinal = processedNodes.find((n) => n.id === edge.source)
      const targetFinal = processedNodes.find((n) => n.id === edge.target)
      if (!sourceFinal || !targetFinal) continue

      const sourceDelta = {
        x: sourceFinal.position.x - sourceInit.x,
        y: sourceFinal.position.y - sourceInit.y,
      }
      const targetDelta = {
        x: targetFinal.position.x - targetInit.x,
        y: targetFinal.position.y - targetInit.y,
      }

      edge.data.sections = interpolateSectionsWithNodeDeltas(
        edge.data.sections,
        sourceDelta,
        targetDelta,
      )
    }

    // 解决边标签重叠：交替运行"标签间碰撞解决"与"推离节点"，直到稳定
    // 这样可以避免单独调用某一步时把另一类问题又引入。
    const labelEdgeEntries = edges
      .filter((e) => e.data?.sections && e.data.sections.length > 0)
      .map((e) => {
        const path = buildPathFromSections(e.data!.sections!, e.data?.lane)
        return { id: e.id, path, sections: e.data!.sections!, lane: e.data?.lane }
      })

    let labelAdjustments = resolveLabelNodeOverlaps(
      new Map(
        labelEdgeEntries.map((e) => [
          e.id,
          {
            labelX: e.path.labelX,
            labelY: e.path.labelY,
            anchorX: e.path.anchorX,
            anchorY: e.path.anchorY,
          },
        ]),
      ),
      processedNodes,
    )

    const labelEdges = labelEdgeEntries.map((e) => ({
      id: e.id,
      sections: e.sections,
      lane: e.lane,
      anchorX: e.path.anchorX,
      anchorY: e.path.anchorY,
    }))

    // 交替迭代：标签间碰撞 → 推离节点 → 标签间碰撞 ... 直到稳定（无碰撞或达上限）
    const MAX_LABEL_ITER = 12
    for (let iter = 0; iter < MAX_LABEL_ITER; iter++) {
      const before = labelAdjustments
      const input = labelEdges.map((e) => {
        const adj = labelAdjustments.get(e.id)
        return {
          id: e.id,
          sections: e.sections,
          lane: e.lane,
          labelX: adj?.labelX,
          labelY: adj?.labelY,
          anchorX: e.anchorX,
          anchorY: e.anchorY,
        }
      })
      labelAdjustments = resolveLabelCollisions(input)
      labelAdjustments = resolveLabelNodeOverlaps(labelAdjustments, processedNodes)

      // 检查是否已稳定（所有标签位置与上一轮一致）
      let stable = true
      for (const [id, pos] of labelAdjustments) {
        const prev = before.get(id)
        if (!prev) {
          stable = false
          break
        }
        if (Math.abs(prev.labelX - pos.labelX) > 0.5 || Math.abs(prev.labelY - pos.labelY) > 0.5) {
          stable = false
          break
        }
      }
      if (stable) break
    }

    for (const edge of edges) {
      const adj = labelAdjustments.get(edge.id)
      if (adj && edge.data) {
        edge.data = {
          ...edge.data,
          adjustedLabelX: adj.labelX,
          adjustedLabelY: adj.labelY,
          labelAnchorX: adj.anchorX,
          labelAnchorY: adj.anchorY,
        }
      }
    }

    const output: WorkerOutput = { nodes: processedNodes, edges }
    self.postMessage(output)
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? `${error.message} | ${error.stack?.slice(0, 500)}` : 'Unknown error',
    })
  }
}
