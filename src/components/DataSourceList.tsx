import { useState } from 'react'
import {
  Database,
  Pencil,
  Trash2,
  Plug,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DataSourceConfig } from '@/types/er'
import type { TestStatus } from './DataSourceForm'
import { cn } from '@/utils/cn'

interface DataSourceListProps {
  dataSources: DataSourceConfig[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onTest?: (id: string) => void
  onGenerate?: (id: string) => void
  onAdd: () => void
  testStatusMap?: Record<string, TestStatus>
  mode?: 'manage' | 'import'
}

/**
 * 生成脱敏后的连接摘要，用于列表展示。
 */
function getDesensitizedSummary(config: DataSourceConfig): string {
  if (config.inputMode === 'url' && config.connectionUrl) {
    try {
      const url = new URL(config.connectionUrl)
      if (url.password) {
        url.password = '***'
      }
      return url.toString()
    } catch {
      return config.connectionUrl
    }
  }

  const parts: string[] = []
  if (config.username) parts.push(config.username)
  if (config.host) {
    const hostPort = config.port ? `${config.host}:${config.port}` : config.host
    parts.push(parts.length > 0 ? `@${hostPort}` : hostPort)
  }
  if (config.database) parts.push(`/${config.database}`)
  return parts.join('') || '未配置连接信息'
}

function StatusBadge({ status }: { status?: TestStatus }) {
  if (!status || status === 'idle') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-neutral-400">
        <Circle className="h-3 w-3" />
        未测试
      </span>
    )
  }
  if (status === 'testing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
        <Loader2 className="h-3 w-3 animate-spin" />
        连接中...
      </span>
    )
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
        <CheckCircle2 className="h-3 w-3" />
        连接成功
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-500">
      <XCircle className="h-3 w-3" />
      连接失败
    </span>
  )
}

/**
 * 数据源列表组件：展示、编辑、删除、测试、生成 ER 图。
 */
export function DataSourceList({
  dataSources,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onTest,
  onGenerate,
  onAdd,
  testStatusMap,
  mode = 'manage',
}: DataSourceListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const confirmDelete = (id: string) => {
    setDeletingId(id)
  }

  const handleDelete = () => {
    if (deletingId) {
      onDelete(deletingId)
      setDeletingId(null)
    }
  }

  if (dataSources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 dark:border-neutral-700 dark:bg-neutral-900/50">
        <Database className="h-10 w-10 text-neutral-300 dark:text-neutral-600" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无数据源</p>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          新建数据源
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {dataSources.map((config) => {
        const status = testStatusMap?.[config.id]
        return (
          <div
            key={config.id}
            onClick={() => onSelect?.(config.id)}
            className={cn(
              'group relative rounded-xl border p-4 transition-colors',
              selectedId === config.id
                ? 'border-blue-500/30 bg-blue-50/50 ring-1 ring-blue-500/30 dark:border-blue-500/30 dark:bg-blue-900/20'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800/60',
              onSelect && 'cursor-pointer',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Database className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {config.name}
                  </h3>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">
                      {config.dialect}
                    </span>
                    <span className="truncate font-mono">{getDesensitizedSummary(config)}</span>
                    <StatusBadge status={status} />
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                {onTest && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTest(config.id)
                    }}
                    title="测试连接"
                  >
                    <Plug className="h-3.5 w-3.5" />
                  </Button>
                )}
                {mode === 'import' && onGenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      onGenerate(config.id)
                    }}
                    title="生成 ER 图"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(config.id)
                  }}
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmDelete(config.id)
                  }}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )
      })}

      {deletingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">删除数据源</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              确定要删除「{dataSources.find((d) => d.id === deletingId)?.name}」吗？此操作不可撤销。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingId(null)}>
                取消
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
