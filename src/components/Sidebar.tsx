import { useState, useRef, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Search, ChevronLeft, ChevronRight, Table2, Columns3 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useERStore } from '@/store/erStore'
import { cn } from '@/utils/cn'
import type { TableColor } from '@/types/er'
import { TABLE_COLOR_HEX } from '@/types/er'

const ITEM_HEIGHT = 40
const OVERSCAN = 8

/**
 * 左侧边栏组件：包含表搜索、表列表和选中表属性面板。
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const { schema, searchQuery, setSearchQuery, selectedTableId, setSelectedTableId } = useERStore(
    useShallow((state) => ({
      schema: state.schema,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      selectedTableId: state.selectedTableId,
      setSelectedTableId: state.setSelectedTableId,
    })),
  )

  const filteredTables = useMemo(
    () =>
      schema?.tables.filter((table) => {
        const query = searchQuery.toLowerCase()
        if (!query) return true
        return table.name.toLowerCase().includes(query)
      }) ?? [],
    [schema, searchQuery],
  )

  const selectedTable = schema?.tables.find((t) => t.id === selectedTableId)

  const totalHeight = filteredTables.length * ITEM_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(filteredTables.length, Math.ceil((scrollTop + (listRef.current?.clientHeight ?? 400)) / ITEM_HEIGHT) + OVERSCAN)
  const visibleItems = filteredTables.slice(startIndex, endIndex)
  const offsetY = startIndex * ITEM_HEIGHT

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 48 : 288 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* 折叠按钮 */}
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

      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-1 flex-col items-center gap-3 pt-4"
          >
            <Table2 className="h-5 w-5 text-neutral-400" />
            <Columns3 className="h-5 w-5 text-neutral-400" />
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/* 搜索 */}
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

            {/* 表列表（虚拟滚动） */}
            <div className="flex-1 overflow-y-auto px-3 pb-3" ref={listRef} onScroll={handleScroll}>
              <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                表 ({filteredTables.length})
              </h3>
              <div style={{ height: totalHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                  {visibleItems.map((table) => (
                    <div
                      key={table.id}
                      className={cn(
                        'relative cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors',
                        selectedTableId === table.id
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      )}
                      onClick={() => setSelectedTableId(table.id)}
                      style={{ height: ITEM_HEIGHT }}
                    >
                      {selectedTableId === table.id && (
                        <span className="absolute left-0 top-1.5 h-5 w-0.5 rounded-r-full bg-blue-500" />
                      )}
                      <div className="flex items-center gap-2">
                        {table.color ? (
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: TABLE_COLOR_HEX[table.color as TableColor] ?? '#64748b',
                            }}
                          />
                        ) : (
                          <Table2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                        )}
                        <span className="truncate" title={table.name}>
                          {table.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {filteredTables.length === 0 && (
                <div className="py-4 text-center text-xs text-neutral-400">无匹配结果</div>
              )}
            </div>

            {/* 属性面板 */}
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
