import { useState, useRef, useMemo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Folder, FolderOpen, File, Plus, Trash2, Edit3,
  ChevronDown, Search, Table2
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useERStore } from '@/store/erStore'
import { cn } from '@/utils/cn'
import { toast } from 'sonner'
import type { CanvaNode, TableColor } from '@/types/er'
import { TABLE_COLOR_HEX } from '@/types/er'

/**
 * 左侧文件树组件：展示文件夹/画布树，支持创建画布/文件夹、重命名、删除。
 * 选中画布后切换当前画布，同时在下方显示画布内的表列表。
 */
export function FileTree() {
  const {
    canvaTree,
    canvaTreeLoading,
    currentCanvasId,
    schema,
    searchQuery,
    setSearchQuery,
    selectedTableId,
    setSelectedTableId,
    createCanvaNode,
    deleteCanvaNode: deleteNode,
    switchCanvas,
    updateCanvaNode,
    diagramStyle,
    setPendingNewTable,
    setEditingTableId,
    setTableEditDialogOpen,
    deleteTable,
  } = useERStore(
    useShallow((state) => ({
      canvaTree: state.canvaTree,
      canvaTreeLoading: state.canvaTreeLoading,
      currentCanvasId: state.currentCanvasId,
      schema: state.schema,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      selectedTableId: state.selectedTableId,
      setSelectedTableId: state.setSelectedTableId,
      createCanvaNode: state.createCanvaNode,
      deleteCanvaNode: state.deleteCanvaNode,
      switchCanvas: state.switchCanvas,
      updateCanvaNode: state.updateCanvaNode,
      diagramStyle: state.diagramStyle,
      setPendingNewTable: state.setPendingNewTable,
      setEditingTableId: state.setEditingTableId,
      setTableEditDialogOpen: state.setTableEditDialogOpen,
      deleteTable: state.deleteTable,
    })),
  )

  const [collapsed, setCollapsed] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  const treeMap = useMemo(() => {
    const roots: CanvaNode[] = []
    const children: Record<string, CanvaNode[]> = {}
    for (const node of canvaTree) {
      if (!node.parentId) {
        roots.push(node)
      } else {
        if (!children[node.parentId]) children[node.parentId] = []
        children[node.parentId].push(node)
      }
    }
    return { roots, children }
  }, [canvaTree])

  const filteredTables = useMemo(() => {
    if (!schema) return []
    const query = searchQuery.toLowerCase()
    if (!query) return schema.tables
    return schema.tables.filter((table) =>
      table.name.toLowerCase().includes(query),
    )
  }, [schema, searchQuery])

  const selectedTable = schema?.tables.find((t) => t.id === selectedTableId)

  const uniqueName = useCallback((baseName: string, parentId: string | null | undefined) => {
    const siblingNames = new Set(
      canvaTree.filter((n) => n.parentId === (parentId ?? null)).map((n) => n.name),
    )
    if (!siblingNames.has(baseName)) return baseName
    let i = 1
    while (siblingNames.has(`${baseName}${i}`)) i++
    return `${baseName}${i}`
  }, [canvaTree])

  const handleCreateFolder = async () => {
    try {
      await createCanvaNode({ name: uniqueName('新文件夹', null), type: 'folder' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleCreateCanvas = async (parentId?: string | null) => {
    try {
      const name = uniqueName('新画布', parentId)
      const node = await createCanvaNode({ name, parentId: parentId ?? null, type: 'canvas' })
      if (parentId) setExpandedFolders((prev) => new Set(prev).add(parentId))
      await switchCanvas(node.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleCreateSubFolder = async (parentId: string) => {
    try {
      await createCanvaNode({ name: uniqueName('新文件夹', parentId), parentId, type: 'folder' })
      setExpandedFolders((prev) => new Set(prev).add(parentId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleDelete = async (node: CanvaNode) => {
    try {
      await deleteNode(node.id)
    } catch { /* handled by store */ }
  }

  const handleRename = async (node: CanvaNode) => {
    setRenamingId(node.id)
    setRenameValue(node.name)
    setTimeout(() => renameRef.current?.focus(), 50)
  }

  const handleRenameSubmit = async (nodeId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null)
      return
    }
    try {
      await updateCanvaNode(nodeId, { name: renameValue.trim() })
      setRenamingId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重命名失败')
    }
  }

  const handleAddTable = useCallback(() => {
    if (!schema) return
    const nodeType = diagramStyle === 'chen' ? 'chen-entity' : 'table'
    setPendingNewTable({ x: 200, y: 100, nodeType })
    setEditingTableId(`new_table_${Date.now()}`)
    setTableEditDialogOpen(true)
  }, [schema, diagramStyle, setPendingNewTable, setEditingTableId, setTableEditDialogOpen])

  const handleEditTable = useCallback((tableId: string) => {
    setEditingTableId(tableId)
    setTableEditDialogOpen(true)
  }, [setEditingTableId, setTableEditDialogOpen])

  const handleDeleteTable = useCallback((tableId: string) => {
    deleteTable(tableId)
    toast.success('已删除表', {
      action: {
        label: '撤销',
        onClick: () => useERStore.getState().undo(),
      },
    })
  }, [deleteTable])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const renderTreeNode = (node: CanvaNode, depth: number = 0) => {
    const isFolder = node.type === 'folder'
    const isExpanded = expandedFolders.has(node.id)
    const isActiveCanvas = !isFolder && currentCanvasId === node.id
    const children = treeMap.children[node.id] ?? []

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
            depth > 0 && 'ml-4',
            isActiveCanvas
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
          )}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => {
            if (isFolder) toggleFolder(node.id)
            else switchCanvas(node.id)
          }}
        >
          {isFolder ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          ) : null}
          {isFolder ? (
            isExpanded ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" /> : <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <File className="h-4 w-4 shrink-0 text-blue-500" />
          )}
          {renamingId === node.id ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => handleRenameSubmit(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(node.id)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              className="flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-xs outline-none dark:border-blue-500 dark:bg-neutral-800"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate text-xs" title={node.name}>{node.name}</span>
          )}
          {renamingId !== node.id && (
            <span className="hidden gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
              {isFolder && (
                <>
                  {depth < 3 && (
                    <button
                      onClick={() => handleCreateSubFolder(node.id)}
                      className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700"
                      title="新建子文件夹"
                    >
                      <Folder className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleCreateCanvas(node.id)}
                    className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700"
                    title="新建画布"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </>
              )}
              <button
                onClick={() => handleRename(node)}
                className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700"
                title="重命名"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              {node.id !== 'local_root' && (
                <button
                  onClick={() => handleDelete(node)}
                  className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-red-500 dark:hover:bg-neutral-700"
                  title="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
        </div>
        {isFolder && isExpanded && (
          <div>
            {children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 48 : 288 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex h-10 items-center justify-end border-b border-neutral-200 px-2 dark:border-neutral-800">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? '展开侧栏' : '折叠侧栏'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!collapsed && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex shrink-0 items-center justify-between px-3 pt-2 pb-1">
              <h3 className="text-xs font-semibold uppercase text-neutral-500">画布</h3>
              <div className="flex gap-0.5">
                <button
                  onClick={handleCreateFolder}
                  className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                  title="新建文件夹"
                >
                  <Folder className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleCreateCanvas(null)}
                  className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                  title="新建画布"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="px-2 pb-2">
              {canvaTreeLoading ? (
                <div className="py-4 text-center text-xs text-neutral-400">加载中...</div>
              ) : canvaTree.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400">暂无画布</div>
              ) : (
                treeMap.roots.map((node) => renderTreeNode(node))
              )}
            </div>

            <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800">
              <div className="p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-4 w-4 text-neutral-400" />
                  <Input
                    placeholder="搜索表"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 transition-shadow focus:shadow-sm focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="px-3 pb-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase text-neutral-500">
                    表 ({filteredTables.length})
                  </h3>
                  <button
                    onClick={handleAddTable}
                    className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                    title="新建表"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {filteredTables.map((table) => (
                  <div
                    key={table.id}
                    className={cn(
                      'group relative cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors',
                      selectedTableId === table.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                    )}
                    onClick={() => setSelectedTableId(table.id)}
                  >
                    {selectedTableId === table.id && (
                      <span className="absolute left-0 top-1.5 h-5 w-0.5 rounded-r-full bg-blue-500" />
                    )}
                    <div className="flex items-center gap-2">
                      {table.color ? (
                        <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{
                          backgroundColor: TABLE_COLOR_HEX[table.color as TableColor] ?? '#64748b',
                        }} />
                      ) : (
                        <Table2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      )}
                      <span className="flex-1 truncate text-xs" title={table.name}>{table.name}</span>
                      <span className="hidden gap-0.5 group-hover:flex" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditTable(table.id)}
                          className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700"
                          title="编辑表"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(table.id)}
                          className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-red-500 dark:hover:bg-neutral-700"
                          title="删除表"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
                {filteredTables.length === 0 && (
                  <div className="py-4 text-center text-xs text-neutral-400">无匹配结果</div>
                )}
              </div>

              <AnimatePresence>
                {selectedTable && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="border-t border-neutral-200 p-3 dark:border-neutral-800"
                  >
                    <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">属性</h3>
                    <div className="space-y-2">
                      <div className="rounded-md bg-neutral-50 px-2 py-1.5 dark:bg-neutral-800/50">
                        <span className="block text-[10px] font-medium text-neutral-500">表名</span>
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{selectedTable.name}</p>
                      </div>
                      {selectedTable.comment && (
                        <div className="rounded-md bg-neutral-50 px-2 py-1.5 dark:bg-neutral-800/50">
                          <span className="block text-[10px] font-medium text-neutral-500">注释</span>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300">{selectedTable.comment}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-neutral-50 px-2 py-1.5 dark:bg-neutral-800/50">
                          <span className="block text-[10px] font-medium text-neutral-500">字段数</span>
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{selectedTable.fields.length}</p>
                        </div>
                        <div className="rounded-md bg-neutral-50 px-2 py-1.5 dark:bg-neutral-800/50">
                          <span className="block text-[10px] font-medium text-neutral-500">主键</span>
                          <p className="truncate text-xs text-neutral-700 dark:text-neutral-300">
                            {selectedTable.fields.filter((f) => f.isPrimaryKey).map((f) => f.name).join(', ') || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

function ChevronLeft({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
}

function ChevronRight({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
}