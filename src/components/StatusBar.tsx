import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, Minus, Plus, Database } from 'lucide-react'
import { useERStore } from '@/store/erStore'
import { FALLBACK_DIALECTS } from '@/utils/fieldTypes'

/**
 * 底部状态栏：显示缩放、表数、关系数、关联深度控制等状态。
 */
export function StatusBar() {
  const { schema, layoutLoading, zoom, relationshipChainDepth, setRelationshipChainDepth } = useERStore(
    useShallow((state) => ({
      schema: state.schema,
      layoutLoading: state.layoutLoading,
      zoom: state.zoom,
      relationshipChainDepth: state.relationshipChainDepth,
      setRelationshipChainDepth: state.setRelationshipChainDepth,
    })),
  )
  const setDatabaseType = useERStore((state) => state.setDatabaseType)
  const [dbTypeOpen, setDbTypeOpen] = useState(false)

  const zoomPercent = Math.round(zoom * 100)
  const dbType = schema?.databaseType || ''

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-neutral-200/80 bg-white/80 px-3 text-[11px] text-neutral-600 backdrop-blur-sm dark:border-neutral-800/80 dark:bg-neutral-900/80 dark:text-neutral-400">
      <div className="flex items-center gap-4">
        <span className="font-medium text-neutral-700 dark:text-neutral-300">ERBeauti</span>
        {layoutLoading && (
          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="relative">
              智能布局中
              <span className="absolute ml-0.5 inline-flex animate-pulse">…</span>
            </span>
          </span>
        )}
        {schema && (
          <div className="relative">
            <button
              onClick={() => setDbTypeOpen(!dbTypeOpen)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="数据库类型，影响字段类型下拉选项"
            >
              <Database className="h-3 w-3" />
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {dbType || '通用'}
              </span>
            </button>
            {dbTypeOpen && (
              <div className="absolute bottom-full left-0 mb-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <button
                  onClick={() => { setDatabaseType(''); setDbTypeOpen(false) }}
                  className={`w-full whitespace-nowrap px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 ${!dbType ? 'text-blue-600' : 'text-neutral-700 dark:text-neutral-300'}`}
                >
                  通用
                </button>
                {FALLBACK_DIALECTS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDatabaseType(d); setDbTypeOpen(false) }}
                    className={`w-full whitespace-nowrap px-3 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 ${dbType === d ? 'text-blue-600' : 'text-neutral-700 dark:text-neutral-300'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 font-mono tabular-nums">
        <span className="flex items-center gap-1 group relative">
          <span className="text-neutral-500 cursor-help" title="鼠标悬停关系线时，高亮关联表/关系的传播层级。0=仅当前关系两端表，1=延伸一级，以此类推。">关联深度</span>
          <button
            className="flex h-4 w-4 items-center justify-center rounded hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-neutral-700"
            onClick={() => setRelationshipChainDepth(relationshipChainDepth - 1)}
            disabled={relationshipChainDepth <= 0}
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span className="w-3 text-center text-neutral-700 dark:text-neutral-300">{relationshipChainDepth}</span>
          <button
            className="flex h-4 w-4 items-center justify-center rounded hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-neutral-700"
            onClick={() => setRelationshipChainDepth(relationshipChainDepth + 1)}
            disabled={relationshipChainDepth >= 5}
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </span>
        <span>
          缩放：<span className="text-neutral-700 dark:text-neutral-300">{zoomPercent}%</span>
        </span>
        <span>
          表：<span className="text-neutral-700 dark:text-neutral-300">{schema?.tables.length ?? 0}</span>
        </span>
        <span>
          关系：<span className="text-neutral-700 dark:text-neutral-300">{schema?.relationships.length ?? 0}</span>
        </span>
        <span className="hidden text-neutral-500 dark:text-neutral-500 sm:inline">elkjs + Worker</span>
      </div>
    </footer>
  )
}
