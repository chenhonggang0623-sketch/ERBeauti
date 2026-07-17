import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useReactFlow } from '@xyflow/react'
import {
  Pencil,
  Copy,
  Trash2,
  Plus,
  Link2,
  Sparkles,
  FileCode2,
  Layout,
  Maximize,
  Upload,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { useERStore } from '@/store/erStore'
import { useLayoutSchema } from '@/hooks/useLayoutSchema'
import { cn } from '@/utils/cn'
import type { ERField } from '@/types/er'

interface MenuItem {
  label: string
  icon: React.ElementType
  onClick: () => void
  danger?: boolean
  shortcut?: string
}

/**
 * 右键上下文菜单。
 * 根据触发位置类型（节点/画布）渲染不同菜单项，并带弹簧缩放动画。
 */
export function ContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const contextMenu = useERStore((state) => state.contextMenu)
  const closeContextMenu = useERStore((state) => state.closeContextMenu)
  const schema = useERStore((state) => state.schema)
  const setSelectedTableId = useERStore((state) => state.setSelectedTableId)
  const setEditingTableId = useERStore((state) => state.setEditingTableId)
  const setTableEditDialogOpen = useERStore((state) => state.setTableEditDialogOpen)
  const setImportDialogOpen = useERStore((state) => state.setImportDialogOpen)
  const deleteTable = useERStore((state) => state.deleteTable)
  const duplicateTable = useERStore((state) => state.duplicateTable)
  const addField = useERStore((state) => state.addField)
  const setPendingNewTable = useERStore((state) => state.setPendingNewTable)
  const setRelationshipDialogOpen = useERStore((state) => state.setRelationshipDialogOpen)
  const toggleTableVisibility = useERStore((state) => state.toggleTableVisibility)
  const highlightRelatedTables = useERStore((state) => state.highlightRelatedTables)
  const { reLayoutCurrentSchema } = useLayoutSchema()

  const handleClose = useCallback(() => closeContextMenu(), [closeContextMenu])

  // 点击外部关闭
  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose()
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu, handleClose])

  if (!contextMenu) return null

  const handleEditTable = () => {
    const tableId = contextMenu.targetId
    if (!tableId) return
    setEditingTableId(tableId)
    setTableEditDialogOpen(true)
    handleClose()
  }

  const handleDuplicateTable = () => {
    const tableId = contextMenu.targetId
    if (!tableId) return
    const duplicated = duplicateTable(tableId, { offsetX: 260, offsetY: 20 })
    if (duplicated) {
      toast.success(`已复制表 ${duplicated.name}`)
    }
    handleClose()
  }

  const handleDeleteTable = () => {
    const tableId = contextMenu.targetId
    if (!tableId) return
    deleteTable(tableId)
    toast.success('已删除表', {
      action: {
        label: '撤销',
        onClick: () => useERStore.getState().undo(),
      },
    })
    handleClose()
  }

  const handleExportSQL = () => {
    if (!schema) return
    const setExportDialogOpen = useERStore.getState().setExportDialogOpen
    setExportDialogOpen(true)
    handleClose()
  }

  const handleAddField = () => {
    const tableId = contextMenu.targetId
    if (!tableId) return
    const table = schema?.tables.find((t) => t.id === tableId)
    if (!table) return
    const newField: ERField = {
      id: `${tableId}.new_field_${Date.now()}`,
      name: 'new_field',
      type: 'VARCHAR(255)',
      nullable: true,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
      isAutoIncrement: false,
    }
    addField(tableId, newField)
    toast.success('已添加字段')
    handleClose()
  }

  const handleAddRelationship = () => {
    setRelationshipDialogOpen(true)
    handleClose()
  }

  const handleHideTable = () => {
    const tableId = contextMenu.targetId
    if (!tableId) return
    toggleTableVisibility(tableId)
    toast.success('已隐藏表')
    handleClose()
  }

  const handleHighlightRelated = () => {
    const tableId = contextMenu.targetId
    if (!tableId) return
    setSelectedTableId(tableId)
    highlightRelatedTables(tableId)
    handleClose()
  }

  const handleNewTable = () => {
    if (!schema) return
    const diagramStyle = useERStore.getState().diagramStyle
    const position = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
    const nodeType = diagramStyle === 'chen' ? 'chen-entity' : 'table'
    setPendingNewTable({ x: position.x, y: position.y, nodeType })
    setEditingTableId(`new_table_${Date.now()}`)
    setTableEditDialogOpen(true)
    handleClose()
  }

  const handleReLayout = () => {
    reLayoutCurrentSchema()
    handleClose()
  }

  const handleFitView = () => {
    window.dispatchEvent(new CustomEvent('erbeauti:fit-view'))
    handleClose()
  }

  const handleImport = () => {
    setImportDialogOpen(true)
    handleClose()
  }

  const table = contextMenu.targetId ? schema?.tables.find((t) => t.id === contextMenu.targetId) : undefined
  const isReadOnly = table?.isSample ?? false

  const nodeItems: MenuItem[] = [
    ...(isReadOnly ? [] : [{ label: '编辑表', icon: Pencil, onClick: handleEditTable } as MenuItem]),
    ...(isReadOnly ? [] : [{ label: '复制表', icon: Copy, onClick: handleDuplicateTable } as MenuItem]),
    ...(isReadOnly ? [] : [{ label: '删除表', icon: Trash2, onClick: handleDeleteTable, danger: true, shortcut: 'Del' } as MenuItem]),
    ...(isReadOnly ? [] : [{ label: '添加字段', icon: Plus, onClick: handleAddField } as MenuItem]),
    { label: '添加关系', icon: Link2, onClick: handleAddRelationship },
    { label: '隐藏此表', icon: EyeOff, onClick: handleHideTable },
    { label: '高亮关联表', icon: Sparkles, onClick: handleHighlightRelated },
    { label: '导出为 SQL', icon: FileCode2, onClick: handleExportSQL },
  ]

  const paneItems: MenuItem[] = [
    { label: '新建表', icon: Plus, onClick: handleNewTable },
    { label: '自动重新布局', icon: Layout, onClick: handleReLayout },
    { label: '适应画布', icon: Maximize, onClick: handleFitView },
    { label: '导入 SQL/DBML', icon: Upload, onClick: handleImport },
  ]

  const items = contextMenu.type === 'node' ? nodeItems : paneItems

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        style={{ left: contextMenu.x, top: contextMenu.y }}
        className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        {items.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
              item.danger
                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
            )}
          >
            <item.icon className="h-4 w-4 opacity-70" />
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800">
                {item.shortcut}
              </kbd>
            )}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}


