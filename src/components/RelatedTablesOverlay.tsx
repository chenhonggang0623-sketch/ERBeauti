import { EdgeLabelRenderer } from '@xyflow/react'
import { useERStore } from '@/store/erStore'
import { NODE_WIDTH, NODE_HEADER_HEIGHT, NODE_ROW_HEIGHT } from '@/utils/nodeMetrics'

export function RelatedTablesOverlay() {
  const clickedField = useERStore((s) => s.clickedField)
  const nodes = useERStore((s) => s.nodes)
  const schema = useERStore((s) => s.schema)

  if (!clickedField || !schema) return null

  const table = schema.tables.find((t) => t.id === clickedField.tableId)
  const node = nodes.find((n) => n.id === clickedField.tableId)
  if (!table || !node) return null

  const fieldIndex = table.fields.findIndex((f) => f.id === clickedField.fieldId)
  if (fieldIndex < 0) return null

  const relationships = schema.relationships.filter(
    (r) =>
      (r.sourceTableId === clickedField.tableId && r.sourceFieldId === clickedField.fieldId) ||
      (r.targetTableId === clickedField.tableId && r.targetFieldId === clickedField.fieldId),
  )

  if (relationships.length === 0) return null

  const panelX = node.position.x + NODE_WIDTH + 16
  const panelY = node.position.y + NODE_HEADER_HEIGHT + fieldIndex * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2

  return (
    <EdgeLabelRenderer>
      <div
        className="absolute"
        style={{
          transform: `translate(${panelX}px, ${panelY}px)`,
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        <div className="flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 shadow-md dark:border-neutral-700 dark:bg-neutral-900">
          <span className="mb-0.5 text-[10px] font-medium text-neutral-500">关联表</span>
          {relationships.map((rel) => {
            const isSourceSide =
              rel.sourceTableId === clickedField.tableId && rel.sourceFieldId === clickedField.fieldId
            const otherTable = schema.tables.find((t) =>
              t.id === (isSourceSide ? rel.targetTableId : rel.sourceTableId),
            )
            const otherField = otherTable?.fields.find((f) =>
              f.id === (isSourceSide ? rel.targetFieldId : rel.sourceFieldId),
            )
            if (!otherTable || !otherField) return null
            return (
              <span
                key={rel.id}
                className="whitespace-nowrap font-mono text-[10px] leading-tight"
              >
                <span className="text-neutral-700 dark:text-neutral-300">{otherTable.name}</span>
                <span className="text-neutral-400">.</span>
                <span
                  className={
                    isSourceSide
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }
                >
                  {otherField.name}
                </span>
                <span className="ml-1 text-[9px] text-neutral-400">({rel.type})</span>
              </span>
            )
          })}
        </div>
      </div>
    </EdgeLabelRenderer>
  )
}
