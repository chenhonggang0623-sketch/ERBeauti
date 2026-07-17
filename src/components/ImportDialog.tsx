import { useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Sparkles, Database, FileCode2, Boxes, Server, ArrowRight, Folder, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useERStore } from '@/store/erStore'
import { useLayoutSchema } from '@/hooks/useLayoutSchema'
import type { ImportFormat } from '@/types/er'
import { SAMPLE_SQL } from '@/sample/sampleSql'
import { SAMPLE_100_SQL } from '@/sample/sample100'
import { SAMPLE_DBML, SAMPLE_DBML_COMPLEX, SAMPLE_PRISMA, SAMPLE_SQL_UNIVERSITY } from '@/sample/sampleData'
import { cn } from '@/utils/cn'
import { FALLBACK_DIALECTS } from '@/utils/fieldTypes'

const tabs: Array<{ id: ImportFormat; label: string; icon: React.ElementType; placeholder: string }> = [
  {
    id: 'sql',
    label: 'SQL DDL',
    icon: Database,
    placeholder: `CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(100)\n);`,
  },
  {
    id: 'dbml',
    label: 'DBML',
    icon: FileCode2,
    placeholder: `Table users {\n  id int [pk]\n  name varchar\n}\n\nRef: posts.user_id > users.id`,
  },
  {
    id: 'prisma',
    label: 'Prisma',
    icon: Boxes,
    placeholder: `model User {\n  id    Int     @id @default(autoincrement())\n  name  String\n  posts Post[]\n}\n\nmodel Post {\n  id       Int    @id @default(autoincrement())\n  author   User   @relation(fields: [authorId], references: [id])\n  authorId Int\n}`,
  },
  {
    id: 'database',
    label: '数据库连接',
    icon: Server,
    placeholder: '',
  },
]

/**
 * 多格式导入弹窗：支持 SQL / DBML / Prisma。
 */
export function ImportDialog() {
  const {
    importDialogOpen,
    importDialogFormat,
    setImportDialogOpen,
    setImportDialogFormat,
    setDataSourceDialogOpen,
    setDataSourceDialogMode,
    setSelectedDataSourceId,
    layoutLoading,
    canvaTree,
    importTargetParentId,
    setImportTargetParentId,
    currentCanvasId,
    schema,
  } = useERStore(
    useShallow((state) => ({
      importDialogOpen: state.importDialogOpen,
      importDialogFormat: state.importDialogFormat,
      setImportDialogOpen: state.setImportDialogOpen,
      setImportDialogFormat: state.setImportDialogFormat,
      setDataSourceDialogOpen: state.setDataSourceDialogOpen,
      setDataSourceDialogMode: state.setDataSourceDialogMode,
      setSelectedDataSourceId: state.setSelectedDataSourceId,
      layoutLoading: state.layoutLoading,
      canvaTree: state.canvaTree,
      importTargetParentId: state.importTargetParentId,
      setImportTargetParentId: state.setImportTargetParentId,
      currentCanvasId: state.currentCanvasId,
      schema: state.schema,
    })),
  )

  const hasSelectedCanvas = !!(currentCanvasId && schema)

  const { sampleSql, setSampleSql } = useERStore(
    useShallow((state) => ({
      sampleSql: state.sampleSql,
      setSampleSql: state.setSampleSql,
    })),
  )

  const { layoutFromSource } = useLayoutSchema()
  const setDatabaseType = useERStore((state) => state.setDatabaseType)
  const [activeTab, setActiveTab] = useState<ImportFormat>('sql')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [dbTypeOpen, setDbTypeOpen] = useState(false)

  useEffect(() => {
    if (importDialogOpen) {
      setError('')
      if (importDialogFormat) {
        setActiveTab(importDialogFormat)
      }
    }
  }, [importDialogOpen, importDialogFormat])

  useEffect(() => {
    if (sampleSql && importDialogOpen) {
      setSource(sampleSql)
      setActiveTab('sql')
      setImportDialogFormat('sql')
      setError('')
      setSampleSql(null)
    }
  }, [sampleSql, importDialogOpen])

  const handleTabChange = (format: ImportFormat) => {
    setActiveTab(format)
    setImportDialogFormat(format)
    setSource('')
  }

  const openDataSourceImport = () => {
    setImportDialogOpen(false)
    setDataSourceDialogMode('import')
    setDataSourceDialogOpen(true)
  }

  const openDataSourceManage = () => {
    setImportDialogOpen(false)
    setDataSourceDialogMode('list')
    setDataSourceDialogOpen(true)
  }

  const openDemoDataSource = () => {
    setImportDialogOpen(false)
    setSelectedDataSourceId('sample-demo')
    setDataSourceDialogMode('import')
    setDataSourceDialogOpen(true)
  }

  const handleImport = async () => {
    if (!source.trim()) {
      setError('请输入内容')
      return
    }
    setError('')
    try {
      await layoutFromSource(source, activeTab, importTargetParentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请检查语法')
    }
  }

  const handleLoadSample = (key?: string) => {
    const k = key || 'default'
    if (activeTab === 'sql') {
      if (k === '100') setSource(SAMPLE_100_SQL)
      else if (k === 'university') setSource(SAMPLE_SQL_UNIVERSITY)
      else setSource(SAMPLE_SQL)
    } else if (activeTab === 'dbml') {
      if (k === 'complex') setSource(SAMPLE_DBML_COMPLEX)
      else setSource(SAMPLE_DBML)
    } else {
      setSource(SAMPLE_PRISMA)
    }
    setError('')
  }

  if (!importDialogOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">导入 Schema</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setImportDialogOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-neutral-200 px-5 pt-3 dark:border-neutral-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-hidden p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'database' ? (
                <div className="flex flex-col gap-6 py-4">
                  {/* 一键导入产品展示库 */}
                  <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.04] to-violet-500/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                        <Database className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                          产品展示库
                        </h3>
                        <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                          内置 11 张示例表 · 电商模型 + 数据库建模模式演示
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={openDemoDataSource}
                          >
                            <Sparkles className="h-4 w-4" />
                            连接到示例
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 管理数据源 */}
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" onClick={openDataSourceManage}>
                      <Server className="h-4 w-4" />
                      管理数据源
                    </Button>
                    <Button variant="secondary" size="sm" onClick={openDataSourceImport}>
                      <ArrowRight className="h-4 w-4" />
                      从已有数据源导入
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                    粘贴 {tabs.find((t) => t.id === activeTab)?.label} 内容，ERBeauti 将自动解析并生成 ER 图。
                  </p>
                  <Textarea
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder={tabs.find((t) => t.id === activeTab)?.placeholder}
                    className="h-56 font-mono text-xs"
                  />
                  {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                  {hasSelectedCanvas ? (
                    <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
                      已选择画布，表将追加到当前画布中
                    </p>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <Folder className="h-4 w-4 shrink-0 text-neutral-400" />
                      <span className="text-xs text-neutral-500">放置到：</span>
                      <div className="relative flex-1">
                        <select
                          value={importTargetParentId}
                          onChange={(e) => setImportTargetParentId(e.target.value)}
                          className="w-full appearance-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 pr-6 text-xs text-neutral-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {canvaTree
                            .filter((n) => n.type === 'folder')
                            .map((folder) => (
                              <option key={folder.id} value={folder.id}>
                                {folder.name}
                              </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 数据库方言 */}
        {schema && (
          <div className="border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-3 text-xs">
              <Database className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-neutral-500">数据库方言：</span>
              {schema.sourceName ? (
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {schema.sourceName}
                  <span className="ml-1.5 text-neutral-400">({schema.databaseType})</span>
                </span>
              ) : schema.databaseType ? (
                <div className="relative">
                  <button
                    onClick={() => setDbTypeOpen(!dbTypeOpen)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    {schema.databaseType}
                    <ChevronDown className="h-3 w-3 text-neutral-400" />
                  </button>
                  {dbTypeOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      {FALLBACK_DIALECTS.map((d) => (
                        <button
                          key={d}
                          onClick={() => { setDatabaseType(d); setDbTypeOpen(false) }}
                          className={`w-full whitespace-nowrap px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 ${schema.databaseType === d ? 'text-blue-600' : 'text-neutral-700 dark:text-neutral-300'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setDbTypeOpen(!dbTypeOpen)}
                    className="flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-0.5 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-600 dark:hover:border-neutral-500 dark:hover:text-neutral-300"
                  >
                    未选择（通用）
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {dbTypeOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      <button
                        onClick={() => { setDatabaseType(''); setDbTypeOpen(false) }}
                        className="w-full whitespace-nowrap px-3 py-1 text-left text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        通用
                      </button>
                      {FALLBACK_DIALECTS.map((d) => (
                        <button
                          key={d}
                          onClick={() => { setDatabaseType(d); setDbTypeOpen(false) }}
                          className="w-full whitespace-nowrap px-3 py-1 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          {activeTab === 'database' ? (
            <div />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleLoadSample()}>
                <Sparkles className="h-4 w-4" />
                加载示例
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImportDialogOpen(false)}>
              关闭
            </Button>
            {activeTab !== 'database' && (
              <Button variant="primary" size="sm" disabled={layoutLoading} onClick={handleImport}>
                {layoutLoading ? '生成中...' : '生成 ER 图'}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}


