import { useMemo, useState } from 'react'
import { X, Search, Loader2, Database, CheckSquare, Square, Server, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { TableInfo } from '@/api/types'
import type { DataSourceConfig } from '@/types/er'
import { cn } from '@/utils/cn'

type SelectionMode = 'all' | 'selected'

interface TableSelectionDialogProps {
  open: boolean
  tables: TableInfo[]
  loading?: boolean
  error?: string | null
  dataSourceName?: string
  dataSourceId?: string
  dataSources?: DataSourceConfig[]
  onConfirm: (selectedTables: string[], dataSourceName?: string) => void
  onDataSourceChange?: (id: string) => void
  onCancel: () => void
}

/**
 * 表选择对话框：支持全部导入或手动选择部分表生成 ER 图。
 */
export function TableSelectionDialog({
  open,
  tables,
  loading = false,
  error = null,
  dataSourceName,
  dataSourceId,
  dataSources = [],
  onConfirm,
  onDataSourceChange,
  onCancel,
}: TableSelectionDialogProps) {
  const [mode, setMode] = useState<SelectionMode>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filteredTables = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tables
    return tables.filter((t) => t.name.toLowerCase().includes(query))
  }, [tables, search])

  const visibleSelectedCount = useMemo(
    () => filteredTables.filter((t) => selected.has(t.name)).length,
    [filteredTables, selected],
  )

  const allVisibleSelected = filteredTables.length > 0 && visibleSelectedCount === filteredTables.length
  const someVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredTables.length

  const toggleTable = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const t of filteredTables) {
          next.delete(t.name)
        }
      } else {
        for (const t of filteredTables) {
          next.add(t.name)
        }
      }
      return next
    })
  }

  const [dataSourceDropdownOpen, setDataSourceDropdownOpen] = useState(false)

  const handleConfirm = () => {
    if (mode === 'all') {
      onConfirm(tables.map((t) => t.name), dataSourceName)
    } else {
      onConfirm(Array.from(selected), dataSourceName)
    }
  }

  const canConfirm = mode === 'all' || selected.size > 0

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">选择要导入的表</h2>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 内容 */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5">
          {/* 数据源选择 */}
          {dataSources.length > 0 && (
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                数据源
              </label>
              <button
                type="button"
                onClick={() => setDataSourceDropdownOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm transition-colors hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
              >
                <Server className="h-4 w-4 text-neutral-400" />
                <span className="flex-1 text-left font-medium text-neutral-900 dark:text-neutral-100">
                  {dataSourceName || '未选择'}
                </span>
                <ChevronDown className="h-4 w-4 text-neutral-400" />
              </button>
              <AnimatePresence>
                {dataSourceDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    {dataSources.map((ds) => (
                      <button
                        key={ds.id}
                        type="button"
                        onClick={() => {
                          setDataSourceDropdownOpen(false)
                          onDataSourceChange?.(ds.id)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800',
                          ds.id === dataSourceId && 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                        )}
                      >
                        <Server className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{ds.name}</span>
                        <span className="ml-auto shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          {ds.dialect}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {/* 导入模式 */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setMode('all')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              )}
            >
              全部导入
            </button>
            <button
              type="button"
              onClick={() => setMode('selected')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'selected'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
              )}
            >
              手动选择
            </button>
          </div>

          {mode === 'selected' && (
            <>
              {/* 搜索与全选 */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索表名..."
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleAllVisible}
                  disabled={filteredTables.length === 0}
                  className="shrink-0"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : someVisibleSelected ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-blue-600 bg-blue-600 text-white">
                      -
                    </span>
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {allVisibleSelected ? '取消全选' : '全选'}
                </Button>
              </div>

              {/* 已选计数 */}
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                已选择 {selected.size} 张表 / 共 {tables.length} 张表
              </p>

              {/* 表列表 */}
              <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">加载表列表...</p>
                  </div>
                ) : filteredTables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-neutral-500 dark:text-neutral-400">
                    <Database className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                    {search ? '没有匹配的表' : '暂无数据表'}
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredTables.map((table) => {
                      const isSelected = selected.has(table.name)
                      return (
                        <label
                          key={table.name}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
                            isSelected && 'bg-blue-50/50 dark:bg-blue-900/20',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTable(table.name)}
                            className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 dark:border-neutral-600"
                          />
                          <span className="flex-1 truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {table.name}
                          </span>
                          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                            {table.column_count ?? '-'} 字段
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'all' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 p-8 dark:border-neutral-700 dark:bg-neutral-900/50">
              <Database className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                将导入全部 {tables.length} 张表
              </p>
              {dataSourceName && (
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  来源: {dataSourceName}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={loading || !canConfirm}>
            {loading ? '生成中...' : '生成 ER 图'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
