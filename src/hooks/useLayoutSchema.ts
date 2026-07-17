import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useERStore } from '@/store/erStore'
import { layoutSchema } from '@/layout/elkLayout'
import type { ERSchema, ImportFormat } from '@/types/er'

async function appendToCurrentCanvas(newSchema: ERSchema) {
  const store = useERStore.getState()
  const existingSchema = store.schema
  const canvasId = store.currentCanvasId
  if (!canvasId || !existingSchema) return

  const existingNames = new Set(existingSchema.tables.map(t => t.name))
  const tablesToAdd = newSchema.tables.filter(t => !existingNames.has(t.name))
  const addedIds = new Set(tablesToAdd.map(t => t.id))

  const relsToAdd = newSchema.relationships.filter(
    r => addedIds.has(r.sourceTableId) && addedIds.has(r.targetTableId)
  )

  const merged: ERSchema = {
    id: existingSchema.id,
    name: existingSchema.name,
    databaseType: newSchema.databaseType || existingSchema.databaseType,
    tables: [...existingSchema.tables, ...tablesToAdd],
    relationships: [...existingSchema.relationships, ...relsToAdd],
  }

  const { nodes, edges } = await layoutSchema(merged)
  store.setLayoutResult(merged, nodes, edges)
  await store.saveCurrentCanvas()
}

async function createCanvasFromSchema(schema: ERSchema, parentId: string | null) {
  const store = useERStore.getState()
  const { nodes, edges } = await layoutSchema(schema)
  const canvasName = schema.name || '导入的画布'
  const canvas = await store.createCanvaNode({ name: canvasName, parentId, type: 'canvas' })
  const serialized = JSON.stringify({ schema, nodes, edges, diagramStyle: store.diagramStyle, hiddenTableIds: [] })
  await store.updateCanvaNode(canvas.id, { schemaData: serialized })
  await store.switchCanvas(canvas.id)
}

const parsers: Record<ImportFormat, (input: string) => Promise<ERSchema>> = {
  sql: async (input) => {
    const { parseSQLToERSchema } = await import('@/parser/sqlParser')
    return parseSQLToERSchema(input)
  },
  dbml: async (input) => {
    const { parseDBMLToERSchema } = await import('@/parser/dbmlParser')
    return parseDBMLToERSchema(input)
  },
  prisma: async (input) => {
    const { parsePrismaToERSchema } = await import('@/parser/prismaParser')
    return parsePrismaToERSchema(input)
  },
  database: async () => {
    throw new Error('数据库连接导入请使用数据源管理弹窗')
  },
}

/**
 * 导入 + 布局的复合 Hook。
 * 将 SQL 解析为 ERSchema，调用 elkjs Worker 计算布局，并把结果写入全局 store。
 */
export function useLayoutSchema() {
  const setLayoutResultRef = useRef(useERStore.getState().setLayoutResult)
  const setLayoutLoadingRef = useRef(useERStore.getState().setLayoutLoading)
  const setImportDialogOpenRef = useRef(useERStore.getState().setImportDialogOpen)

  const reLayoutCurrentSchema = useCallback(async () => {
    const schema = useERStore.getState().schema
    if (!schema) return
    setLayoutLoadingRef.current(true)
    try {
      await runLayout(schema)
      toast.success('重新布局完成')
    } catch (error) {
      const message = error instanceof Error ? error.message : '布局失败'
      toast.error(message)
    } finally {
      setLayoutLoadingRef.current(false)
    }
  }, [])

  const layoutFromSchema = useCallback(async (schema: ERSchema) => {
    setLayoutLoadingRef.current(true)
    try {
      const store = useERStore.getState()
      if (store.currentCanvasId && store.schema) {
        await appendToCurrentCanvas(schema)
      } else {
        await createCanvasFromSchema(schema, 'local_root')
      }
      setImportDialogOpenRef.current(false)
      toast.success(`成功导入 ${schema.tables.length} 张表，${schema.relationships.length} 条关系`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败'
      toast.error(message)
      throw error
    } finally {
      setLayoutLoadingRef.current(false)
    }
  }, [])

  const layoutFromSource = useCallback(async (input: string, format: ImportFormat, parentId?: string) => {
    setLayoutLoadingRef.current(true)
    try {
      const schema = await parsers[format](input)
      const store = useERStore.getState()
      if (store.currentCanvasId && store.schema) {
        await appendToCurrentCanvas(schema)
      } else {
        const targetParentId = parentId || 'local_root'
        await createCanvasFromSchema(schema, targetParentId)
      }
      setImportDialogOpenRef.current(false)
      toast.success(`成功导入 ${schema.tables.length} 张表，${schema.relationships.length} 条关系`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '导入失败'
      toast.error(message)
      throw error
    } finally {
      setLayoutLoadingRef.current(false)
    }
  }, [])

  const runLayout = async (schema: ERSchema) => {
    const { nodes, edges } = await layoutSchema(schema)
    setLayoutResultRef.current(schema, nodes, edges)
  }

  return { reLayoutCurrentSchema, layoutFromSchema, layoutFromSource }
}
