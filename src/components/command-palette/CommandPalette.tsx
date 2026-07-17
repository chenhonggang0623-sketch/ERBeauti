import { useEffect, useState, useCallback, useMemo } from 'react'
import { Command } from 'cmdk'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search,
  Layout,
  Upload,
  Moon,
  Sun,
  Maximize,
  Sparkles,
  FileCode2,
  Image,
  Eye,
  Table2,
} from 'lucide-react'
import { useERStore } from '@/store/erStore'
import { useLayoutSchema } from '@/hooks/useLayoutSchema'
import { cn } from '@/utils/cn'
import { downloadBlob, downloadFile } from '@/utils/download'

interface PaletteCommand {
  id: string
  label: string
  icon: React.ElementType
  group: string
  shortcut?: string
  onSelect: () => void
}

/**
 * 命令面板：支持命令搜索与表/字段快速跳转。
 * 按 Ctrl+K 打开，Esc 关闭。
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const theme = useERStore((state) => state.theme)
  const toggleTheme = useERStore((state) => state.toggleTheme)
  const schema = useERStore((state) => state.schema)
  const setSelectedTableId = useERStore((state) => state.setSelectedTableId)
  const setImportDialogOpen = useERStore((state) => state.setImportDialogOpen)
  const undo = useERStore((state) => state.undo)
  const redo = useERStore((state) => state.redo)
  const highlightRelatedTables = useERStore((state) => state.highlightRelatedTables)
  const { reLayoutCurrentSchema } = useLayoutSchema()

  // 监听 Ctrl+K / Ctrl+Shift+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const isMeta = event.metaKey || event.ctrlKey
      if (isMeta && event.key === 'k') {
        event.preventDefault()
        if (event.shiftKey) {
          setOpen(false)
        } else {
          setOpen((prev) => !prev)
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleExportSQL = useCallback(() => {
    useERStore.getState().setExportDialogOpen(true)
  }, [])

  const handleExportSVG = useCallback(async () => {
    if (!document.querySelector('.react-flow')) return
    const store = useERStore.getState()
    store.setExporting(true)
    try {
      const { exportAsSvgXml } = await import('@/utils/svgExport')
      const svg = await exportAsSvgXml()
      downloadFile(svg, 'erbeauti_schema.svg', 'image/svg+xml')
    } catch {
      // silent
    } finally {
      store.setExporting(false)
    }
  }, [])

  const handleExportPNG = useCallback(async () => {
    if (!document.querySelector('.react-flow')) return
    const store = useERStore.getState()
    store.setExporting(true)
    try {
      const { exportAsPngBlob } = await import('@/utils/svgExport')
      const blob = await exportAsPngBlob()
      downloadBlob(blob, 'erbeauti_schema.png')
    } catch {
      // silent
    } finally {
      store.setExporting(false)
    }
  }, [])

  const baseCommands: PaletteCommand[] = useMemo(
    () => [
      {
        id: 'layout',
        label: '自动重新布局',
        icon: Layout,
        group: '布局',
        onSelect: () => reLayoutCurrentSchema(),
      },
      {
        id: 'fit-view',
        label: '适应画布',
        icon: Maximize,
        group: '视图',
        shortcut: 'Ctrl+Shift+F',
        onSelect: () => window.dispatchEvent(new CustomEvent('erbeauti:fit-view')),
      },
      {
        id: 'import-sql',
        label: '导入 SQL',
        icon: Upload,
        group: '导入',
        onSelect: () => setImportDialogOpen(true),
      },
      {
        id: 'import-dbml',
        label: '导入 DBML',
        icon: Upload,
        group: '导入',
        onSelect: () => setImportDialogOpen(true),
      },
      {
        id: 'export-sql',
        label: '导出 SQL',
        icon: FileCode2,
        group: '导出',
        onSelect: handleExportSQL,
      },
      {
        id: 'export-svg',
        label: '导出 SVG',
        icon: Eye,
        group: '导出',
        onSelect: handleExportSVG,
      },
      {
        id: 'export-png',
        label: '导出 PNG',
        icon: Image,
        group: '导出',
        onSelect: handleExportPNG,
      },
      {
        id: 'toggle-theme',
        label: theme === 'light' ? '切换深色模式' : '切换浅色模式',
        icon: theme === 'light' ? Moon : Sun,
        group: '视图',
        onSelect: toggleTheme,
      },
      {
        id: 'highlight-related',
        label: '高亮关联表',
        icon: Sparkles,
        group: '视图',
        onSelect: () => {
          const id = useERStore.getState().selectedTableId
          if (id) highlightRelatedTables(id)
        },
      },
      {
        id: 'undo',
        label: '撤销',
        icon: Layout,
        group: '编辑',
        shortcut: 'Ctrl+Z',
        onSelect: undo,
      },
      {
        id: 'redo',
        label: '重做',
        icon: Layout,
        group: '编辑',
        shortcut: 'Ctrl+Shift+Z',
        onSelect: redo,
      },
    ],
    [
      theme,
      reLayoutCurrentSchema,
      setImportDialogOpen,
      handleExportSQL,
      handleExportSVG,
      handleExportPNG,
      toggleTheme,
      highlightRelatedTables,
      undo,
      redo,
    ],
  )

  const tableCommands: PaletteCommand[] = useMemo(() => {
    if (!schema) return []
    const query = search.toLowerCase().trim()
    const commands: PaletteCommand[] = []
    const MAX_FIELD_COMMANDS = 50

    for (const table of schema.tables) {
      const tableMatch = !query || table.name.toLowerCase().includes(query)
      if (tableMatch) {
        commands.push({
          id: `table-${table.id}`,
          label: table.name,
          icon: Table2,
          group: '表',
          onSelect: () => {
            setSelectedTableId(table.id)
            highlightRelatedTables(table.id)
            window.dispatchEvent(new CustomEvent('erbeauti:focus-node', { detail: table.id }))
          },
        })
      }

      if (!query) continue
      if (commands.length - (tableMatch ? 1 : 0) >= MAX_FIELD_COMMANDS) continue

      for (const field of table.fields) {
        if (field.name.toLowerCase().includes(query)) {
          commands.push({
            id: `field-${table.id}-${field.id}`,
            label: `${table.name}.${field.name}`,
            icon: Table2,
            group: '字段',
            onSelect: () => {
              setSelectedTableId(table.id)
              window.dispatchEvent(new CustomEvent('erbeauti:focus-node', { detail: table.id }))
            },
          })
        }
      }
    }
    return commands
  }, [schema, setSelectedTableId, highlightRelatedTables, search])

  const allCommands = useMemo(
    () => [...baseCommands, ...tableCommands],
    [baseCommands, tableCommands],
  )

  const filteredCommands = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return allCommands
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.group.toLowerCase().includes(query),
    )
  }, [allCommands, search])

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>()
    for (const cmd of filteredCommands) {
      if (!map.has(cmd.group)) map.set(cmd.group, [])
      map.get(cmd.group)!.push(cmd)
    }
    return map
  }, [filteredCommands])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[15vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              label="命令面板"
              className="[&_[cmdk-input]]:outline-none"
              loop
            >
              <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
                <Search className="h-5 w-5 text-neutral-400" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="搜索命令、表名、字段名..."
                  className="flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100"
                />
                <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800">
                  ESC
                </kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-neutral-500">
                  未找到匹配结果
                </Command.Empty>
                {Array.from(grouped.entries()).map(([group, commands]) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="px-2 py-2 text-xs font-semibold uppercase text-neutral-500"
                  >
                    {commands.map((cmd) => (
                      <Command.Item
                        key={cmd.id}
                        value={cmd.id}
                        onSelect={() => {
                          cmd.onSelect()
                          setOpen(false)
                          setSearch('')
                        }}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-neutral-700 transition-colors',
                          'data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 dark:text-neutral-300 dark:data-[selected=true]:bg-blue-900/30 dark:data-[selected=true]:text-blue-300',
                        )}
                      >
                        <cmd.icon className="h-4 w-4 opacity-70" />
                        <span className="flex-1">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

