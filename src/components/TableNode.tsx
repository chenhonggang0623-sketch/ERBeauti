import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { motion, AnimatePresence } from 'motion/react'
import { Key, Link2, Hash, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'
import { calcNodeHeight } from '@/utils/nodeMetrics'
import type { RFTableNodeData, TableColor } from '@/types/er'
import { TABLE_COLORS } from '@/types/er'
import { useERStore, useHighlightedTableIds, useRelatedTableIds } from '@/store/erStore'
import { useViewportLOD } from '@/hooks/useViewportLOD'

/** 自定义表节点类型 */
type TableNodeType = Node<RFTableNodeData, 'table'>

/**
 * 表节点组件：渲染表名、注释以及字段列表。
 * 每个字段会创建 source/target handle，供关系边连接。
 * 支持选中/高亮动效、LOD 过渡、双击编辑。
 */
export const TableNode = memo(function TableNode(props: NodeProps<TableNodeType>) {
  const { id, data } = props
  const { table } = data

  const {
    selectedTableId, setSelectedTableId, setEditingTableId,
    setTableEditDialogOpen, setContextMenu,
    highlightedChainNodeIds, highlightedFields, hoveredFields,
    edges, setHoveredFieldEdgeIds, clickedField, setClickedField,
  } = useERStore(useShallow((state) => ({
    selectedTableId: state.selectedTableId,
    setSelectedTableId: state.setSelectedTableId,
    setEditingTableId: state.setEditingTableId,
    setTableEditDialogOpen: state.setTableEditDialogOpen,
    setContextMenu: state.setContextMenu,
    highlightedChainNodeIds: state.highlightedChainNodeIds,
    highlightedFields: state.highlightedFields,
    hoveredFields: state.hoveredFields,
    edges: state.edges,
    setHoveredFieldEdgeIds: state.setHoveredFieldEdgeIds,
    clickedField: state.clickedField,
    setClickedField: state.setClickedField,
  })))
  const highlightedIds = useHighlightedTableIds()
  const relatedIds = useRelatedTableIds()
  const lod = useViewportLOD()

  const isSelected = selectedTableId === id
  const isHighlighted = highlightedIds.has(id)
  const isRelated = relatedIds.has(id)
  const isDimmed = highlightedChainNodeIds.size > 0 && !highlightedChainNodeIds.has(id)

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectedTableId(id)
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        targetId: id,
      })
    },
    [id, setContextMenu, setSelectedTableId],
  )

  const handleDoubleClick = useCallback(() => {
    setEditingTableId(id)
    setTableEditDialogOpen(true)
  }, [id, setEditingTableId, setTableEditDialogOpen])

  const handleClick = useCallback(() => {
    setSelectedTableId(id)
  }, [id, setSelectedTableId])

  const handleFieldClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const fieldId = e.currentTarget.dataset.fieldId
    if (!fieldId) return
    const current = clickedField
    if (current?.tableId === id && current?.fieldId === fieldId) {
      setClickedField(null)
    } else {
      setClickedField({ tableId: id, fieldId })
    }
  }, [id, clickedField, setClickedField])

  const handleFieldMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const fieldId = e.currentTarget.dataset.fieldId
    if (!fieldId) return
    const connected = edges.filter(
      e => e.sourceHandle === fieldId || e.targetHandle === fieldId,
    )
    setHoveredFieldEdgeIds(new Set(connected.map(e => e.id)))
  }, [edges, setHoveredFieldEdgeIds])

  const handleFieldMouseLeave = useCallback(() => {
    setHoveredFieldEdgeIds(new Set())
  }, [setHoveredFieldEdgeIds])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: isDimmed ? 0.3 : 1,
        scale: isSelected ? 1.02 : 1,
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={lod === 'minimal' ? undefined : { height: calcNodeHeight(table.fields.length) }}
      className={cn(
        'overflow-hidden rounded-xl border bg-white shadow-md transition-shadow dark:bg-neutral-900',
        lod === 'minimal' ? 'h-8 w-16' : 'w-[220px]',
        isSelected
          ? 'border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30'
          : 'border-neutral-200 shadow-sm dark:border-neutral-700',
        isHighlighted && !isSelected && 'border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/30',
        isRelated && !isSelected && !isHighlighted && 'border-blue-300 shadow-md dark:border-blue-800',
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <AnimatePresence mode="wait" initial={false}>
        {lod === 'minimal' ? (
          <motion.div
            key="minimal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex h-full items-center justify-center px-2"
          >
            <span
              className="truncate text-[9px] font-semibold text-neutral-700 dark:text-neutral-300"
              title={table.name}
            >
              {table.name.slice(0, 4)}
            </span>
          </motion.div>
        ) : lod === 'header-only' ? (
          <motion.div
            key="header-only"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <TableHeader table={table} isSelected={isSelected} isHighlighted={isHighlighted} />
          </motion.div>
        ) : (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <TableHeader table={table} isSelected={isSelected} isHighlighted={isHighlighted} />
            <div className="flex flex-col">
              {table.fields.map((field, index) => {
                const isFieldSelected =
                  (highlightedFields?.sourceFieldId === field.id && highlightedFields?.sourceTableId === id) ||
                  (highlightedFields?.targetFieldId === field.id && highlightedFields?.targetTableId === id)
                const isFieldHovered =
                  (hoveredFields?.sourceFieldId === field.id && hoveredFields?.sourceTableId === id) ||
                  (hoveredFields?.targetFieldId === field.id && hoveredFields?.targetTableId === id)
                const isThisFieldClicked =
                  clickedField?.tableId === id && clickedField?.fieldId === field.id
                return (
                  <div
                    key={field.id}
                    data-field-id={field.id}
                    className={cn(
                      'group relative flex items-center gap-2 px-2.5 py-1 text-xs transition-colors duration-150',
                      index % 2 === 1 && 'bg-neutral-50/60 dark:bg-neutral-800/30',
                      index !== table.fields.length - 1 &&
                        'border-b border-neutral-100 dark:border-neutral-800',
                      field.isPrimaryKey && 'bg-amber-50/30 dark:bg-amber-900/15',
                      'hover:bg-neutral-100 dark:hover:bg-neutral-800/60',
                      isFieldSelected && 'bg-blue-50 ring-2 ring-blue-400 dark:bg-blue-900/20 dark:ring-blue-500 !z-10',
                      isFieldHovered && 'bg-blue-50/80 ring-2 ring-blue-300 dark:bg-blue-900/10 dark:ring-blue-400',
                      isThisFieldClicked && 'bg-blue-100 ring-2 ring-blue-500 dark:bg-blue-900/40 dark:ring-blue-400',
                    )}
                    title={field.comment}
                    onClick={handleFieldClick}
                    onMouseEnter={handleFieldMouseEnter}
                    onMouseLeave={handleFieldMouseLeave}
                  >
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={field.id}
                      className="!-right-1 !h-1.5 !w-1.5 !border-none !bg-blue-400/60 opacity-40 transition-all duration-200 group-hover:opacity-100 group-hover:!bg-blue-500"
                    />

                    <span className={cn(
                      'inline-flex items-center justify-center',
                      field.isPrimaryKey ? 'text-amber-500' :
                      field.isForeignKey ? 'text-blue-500' :
                      field.isUnique ? 'text-purple-500' :
                      field.isAutoIncrement ? 'text-emerald-500' : 'text-neutral-300',
                    )}>
                      {field.isPrimaryKey ? (
                        <Key className="h-3 w-3" />
                      ) : field.isForeignKey ? (
                        <Link2 className="h-3 w-3" />
                      ) : field.isUnique ? (
                        <Hash className="h-3 w-3" />
                      ) : field.isAutoIncrement ? (
                        <Sparkles className="h-3 w-3" />
                      ) : (
                        <span className="h-3 w-3" />
                      )}
                    </span>

                    <span
                      className={cn(
                        'flex-1 truncate',
                        field.isPrimaryKey && 'font-semibold text-neutral-900 dark:text-neutral-100',
                      )}
                    >
                      {field.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-neutral-400 dark:text-neutral-500">{field.type}</span>
                    {isFieldSelected && (
                      <span className="shrink-0 text-[10px] text-blue-500 dark:text-blue-400">◂</span>
                    )}

                    <Handle
                      type="target"
                      position={Position.Left}
                      id={field.id}
                      className="!-left-1 !h-1.5 !w-1.5 !border-none !bg-blue-400/60 opacity-40 transition-all duration-200 group-hover:opacity-100 group-hover:!bg-blue-500"
                    />
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {lod !== 'full' && <InvisibleHandles table={table} compact={lod === 'minimal'} />}
    </motion.div>
  )
})

/**
 * 在 minimal / header-only LOD 下渲染不可见的 source/target handle，
 * 保证 React Flow 在任意缩放级别都能找到 handle 并绘制关系连线。
 */
function InvisibleHandles({ table, compact }: { table: RFTableNodeData['table']; compact: boolean }) {
  const step = compact ? 3 : 6
  const maxTop = compact ? 28 : 220
  return (
    <>
      {table.fields.map((field, index) => (
        <Handle
          key={`invisible-source-${field.id}`}
          type="source"
          position={Position.Right}
          id={field.id}
          className="!absolute !right-0 !h-0.5 !w-0.5 !border-none !bg-transparent opacity-0"
          style={{ top: `${Math.min(maxTop, 4 + index * step)}px` }}
        />
      ))}
      {table.fields.map((field, index) => (
        <Handle
          key={`invisible-target-${field.id}`}
          type="target"
          position={Position.Left}
          id={field.id}
          className="!absolute !left-0 !h-0.5 !w-0.5 !border-none !bg-transparent opacity-0"
          style={{ top: `${Math.min(maxTop, 4 + index * step)}px` }}
        />
      ))}
    </>
  )
}

interface TableHeaderProps {
  table: RFTableNodeData['table']
  isSelected: boolean
  isHighlighted: boolean
}

function TableHeader({ table, isSelected, isHighlighted }: TableHeaderProps) {
  const color = table.color as TableColor | undefined
  const theme = TABLE_COLORS[color ?? 'slate']

  const headerClasses = useMemo(() => {
    if (isSelected) {
      return color && theme
        ? `bg-gradient-to-r ${theme.light.headerFrom} ${theme.light.headerTo} ${theme.dark.headerFrom} ${theme.dark.headerTo}`
        : 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20'
    }
    if (isHighlighted) {
      return 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20'
    }
    return color && theme
      ? `bg-gradient-to-r ${theme.light.headerFrom} ${theme.light.headerTo} ${theme.dark.headerFrom} ${theme.dark.headerTo}`
      : 'bg-gradient-to-r from-neutral-100 to-neutral-50 dark:from-neutral-800 dark:to-neutral-800/50'
  }, [isSelected, isHighlighted, color, theme])

  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-neutral-200 px-3 py-2 transition-colors dark:border-neutral-700',
        headerClasses,
      )}
    >
      <span
        className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100"
        title={table.name}
      >
        {table.name}
      </span>
      {table.comment && (
        <span
          className="truncate text-xs text-neutral-500"
          title={table.comment}
        >
          {table.comment.slice(0, 8)}
        </span>
      )}
      {table.dataSourceName && (
        <span
          className="ml-auto shrink-0 rounded bg-indigo-100/70 px-1 py-0.5 text-[9px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          title={`数据源: ${table.dataSourceName}`}
        >
          {table.dataSourceName}
        </span>
      )}
    </div>
  )
}
