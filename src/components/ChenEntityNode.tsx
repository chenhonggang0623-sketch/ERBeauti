import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { motion } from 'motion/react'
import { cn } from '@/utils/cn'
import type { RFTableNodeData } from '@/types/er'
import { useERStore } from '@/store/erStore'

type ChenEntityNodeType = Node<RFTableNodeData, 'chen-entity'>

export const ChenEntityNode = memo(function ChenEntityNode(props: NodeProps<ChenEntityNodeType>) {
  const { id, data } = props
  const { table } = data

  const selectedTableId = useERStore((state) => state.selectedTableId)
  const setSelectedTableId = useERStore((state) => state.setSelectedTableId)
  const setEditingTableId = useERStore((state) => state.setEditingTableId)
  const setTableEditDialogOpen = useERStore((state) => state.setTableEditDialogOpen)
  const setContextMenu = useERStore((state) => state.setContextMenu)

  const isSelected = selectedTableId === id

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectedTableId(id)
      setContextMenu({ x: event.clientX, y: event.clientY, type: 'node', targetId: id })
    },
    [id, setContextMenu, setSelectedTableId],
  )

  const handleDoubleClick = useCallback(() => {
    setEditingTableId(id)
    setTableEditDialogOpen(true)
  }, [id, setEditingTableId, setTableEditDialogOpen])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: isSelected ? 1.02 : 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex h-10 items-center justify-center border bg-white shadow-sm dark:bg-neutral-900',
        'min-w-[120px] px-4',
        isSelected
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-500/30'
          : 'border-neutral-400 dark:border-neutral-600',
      )}
      onClick={() => setSelectedTableId(id)}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
        {table.name}
      </span>

      {/* source handles per field — for relationship edges */}
      {table.fields.map((field) => (
        <Handle
          key={`s-${field.id}`}
          type="source"
          position={Position.Right}
          id={field.id}
          className="!invisible !absolute"
        />
      ))}
      {/* target handles per field — for relationship edges */}
      {table.fields.map((field) => (
        <Handle
          key={`t-${field.id}`}
          type="target"
          position={Position.Left}
          id={field.id}
          className="!invisible !absolute"
        />
      ))}

      {/* source handles for attribute edge connections — one per side */}
      <Handle type="source" position={Position.Top} id="attr-src-t" className="!invisible !absolute" />
      <Handle type="source" position={Position.Right} id="attr-src-r" className="!invisible !absolute" />
      <Handle type="source" position={Position.Bottom} id="attr-src-b" className="!invisible !absolute" />
      <Handle type="source" position={Position.Left} id="attr-src-l" className="!invisible !absolute" />
    </motion.div>
  )
})
