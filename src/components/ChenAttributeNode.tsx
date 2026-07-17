import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { cn } from '@/utils/cn'
import type { ERField } from '@/types/er'

export interface RFAttributeNodeData extends Record<string, unknown> {
  field: ERField
  tableId: string
}

type ChenAttributeNodeType = Node<RFAttributeNodeData, 'chen-attribute'>

export const ChenAttributeNode = memo(function ChenAttributeNode(props: NodeProps<ChenAttributeNodeType>) {
  const { data } = props
  const { field } = data

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-[50%] border px-3 py-1 text-xs leading-tight transition-colors bg-white dark:bg-neutral-900 shadow-sm',
        field.isPrimaryKey
          ? 'border-amber-400 text-amber-800 dark:text-amber-200 underline decoration-amber-500 decoration-2 underline-offset-2'
          : field.isForeignKey
            ? 'border-blue-400 text-blue-800 dark:text-blue-200'
            : 'border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-300',
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="attr-tgt-l"
        className="!-left-1 !h-1.5 !w-1.5 !border-none !bg-blue-400/60"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="attr-tgt-r"
        className="!-right-1 !h-1.5 !w-1.5 !border-none !bg-blue-400/60"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="attr-tgt-t"
        className="!-top-1 !h-1.5 !w-1.5 !border-none !bg-blue-400/60"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="attr-tgt-b"
        className="!-bottom-1 !h-1.5 !w-1.5 !border-none !bg-blue-400/60"
      />
      {field.isPrimaryKey ? `(${field.name})` : field.name}
    </div>
  )
})
