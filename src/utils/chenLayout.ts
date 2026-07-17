import type { Node, Edge } from '@xyflow/react'
import type { RFTableNodeData } from '@/types/er'

export function buildChenLayout(sourceNodes: Node[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const node of sourceNodes) {
    const table = (node.data as RFTableNodeData)?.table
    const entityW = Math.max(100, (table?.name.length ?? 4) * 9 + 32)
    nodes.push({
      ...node,
      type: 'chen-entity' as const,
      width: entityW,
      height: 40,
    })
    if (!table || table.fields.length === 0) continue

    const cx = (node.position?.x ?? 0) + entityW / 2
    const cy = (node.position?.y ?? 0) + 20
    const total = table.fields.length
    const radius = Math.max(100, 60 + total * 8)

    table.fields.forEach((field, i) => {
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2
      const attrText = field.isPrimaryKey ? `(${field.name})` : field.name
      const attrW = Math.max(70, attrText.length * 7 + 24)
      const ax = cx + radius * Math.cos(angle) - attrW / 2
      const ay = cy + radius * Math.sin(angle) - 14

      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      const srcHandle =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0 ? 'attr-src-r' : 'attr-src-l'
          : dy > 0 ? 'attr-src-b' : 'attr-src-t'
      const tgtHandle =
        Math.abs(dx) > Math.abs(dy)
          ? dx < 0 ? 'attr-tgt-r' : 'attr-tgt-l'
          : dy < 0 ? 'attr-tgt-b' : 'attr-tgt-t'

      nodes.push({
        id: `attr-${field.id}`,
        type: 'chen-attribute' as const,
        position: { x: ax, y: ay },
        data: { field, tableId: table.id },
        width: attrW,
        height: 28,
      })
      edges.push({
        id: `attr-edge-${field.id}`,
        source: table.id,
        sourceHandle: srcHandle,
        target: `attr-${field.id}`,
        targetHandle: tgtHandle,
        type: 'chen-attribute-edge' as const,
      })
    })
  }
  return { nodes, edges }
}
