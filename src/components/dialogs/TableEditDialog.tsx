import { useState, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Plus, Trash2, Save, Palette, Lock } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useERStore } from '@/store/erStore'
import { cn } from '@/utils/cn'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ERField, TableColor } from '@/types/er'
import { TABLE_COLORS, TABLE_COLOR_HEX } from '@/types/er'
import { isReadOnlyTable } from '@/utils/isSample'
import { getFieldTypes, parseFieldType, getDefaultParams, getFieldBases } from '@/utils/fieldTypes'
import { toast } from 'sonner'

/**
 * 表编辑对话框：支持修改表名、注释，以及字段的增删改。
 * 示例数据库的表只读，不可编辑。
 */
export function TableEditDialog() {
  const {
    tableEditDialogOpen,
    editingTableId,
    pendingNewTable,
    setTableEditDialogOpen,
    setEditingTableId,
    setPendingNewTable,
  } = useERStore(
    useShallow((state) => ({
      tableEditDialogOpen: state.tableEditDialogOpen,
      editingTableId: state.editingTableId,
      pendingNewTable: state.pendingNewTable,
      setTableEditDialogOpen: state.setTableEditDialogOpen,
      setEditingTableId: state.setEditingTableId,
      setPendingNewTable: state.setPendingNewTable,
    })),
  )

  const schema = useERStore((state) => state.schema)
  const updateTable = useERStore((state) => state.updateTable)
  const addTable = useERStore((state) => state.addTable)
  const addField = useERStore((state) => state.addField)
  const removeField = useERStore((state) => state.removeField)

  const isNewTable = !!(pendingNewTable && editingTableId && !schema?.tables.find((t) => t.id === editingTableId))
  const existingTable = schema?.tables.find((t) => t.id === editingTableId)
  const table = existingTable ?? null
  const readOnly = table ? isReadOnlyTable(table) : false
  const availableFieldTypes = useMemo(() => getFieldTypes(schema?.databaseType), [schema?.databaseType])
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [color, setColor] = useState<TableColor | undefined>(undefined)
  const [newFields, setNewFields] = useState<ERField[]>([])

  useEffect(() => {
    if (table) {
      setName(table.name)
      setComment(table.comment || '')
      setColor(table.color)
      setNewFields([])
    } else if (isNewTable) {
      setName('')
      setComment('')
      setColor(undefined)
      setNewFields([])
    }
  }, [table, isNewTable])

  const handleClose = useCallback(() => {
    setTableEditDialogOpen(false)
    setEditingTableId(null)
    setPendingNewTable(null)
  }, [setTableEditDialogOpen, setEditingTableId, setPendingNewTable])

  const handleSave = () => {
    if (isNewTable && editingTableId && pendingNewTable) {
      if (!name.trim()) {
        toast.error('请输入表名')
        return
      }
      const tableId = editingTableId
      const pkType = schema?.databaseType === 'postgresql' || schema?.databaseType === 'postgres' ? 'SERIAL' : 'INT'
      const defaultField: ERField = {
        id: `${tableId}.id`,
        name: 'id',
        type: pkType,
        nullable: false,
        isPrimaryKey: true,
        isForeignKey: false,
        isUnique: false,
        isAutoIncrement: true,
      }
      const fields = newFields.length > 0 ? newFields : [defaultField]
      addTable(
        {
          id: tableId,
          name: name.trim(),
          comment: comment || undefined,
          fields,
          color,
        },
        {
          id: tableId,
          type: pendingNewTable.nodeType as any,
          position: { x: pendingNewTable.x, y: pendingNewTable.y },
          data: { table: { id: tableId, name: name.trim(), comment: comment || undefined, fields, color } },
          width: 220,
          height: pendingNewTable.nodeType === 'chen-entity' ? 40 : 64,
        },
      )
      toast.success('已新建表')
      handleClose()
      return
    }
    if (!table) return
    updateTable(table.id, (t) => {
      t.name = name
      t.comment = comment || undefined
      t.color = color
    })
    handleClose()
  }

  const handleAddField = () => {
    if (isNewTable) {
      const firstType = availableFieldTypes[0] ?? 'VARCHAR(255)'
      const newField: ERField = {
        id: `new_field_${Date.now()}`,
        name: 'new_field',
        type: firstType,
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
        isUnique: false,
        isAutoIncrement: false,
      }
      setNewFields((prev) => [...prev, newField])
      return
    }
    if (!table) return
    const firstType = availableFieldTypes[0] ?? 'VARCHAR(255)'
    const newField: ERField = {
      id: `${table.id}.new_field_${Date.now()}`,
      name: 'new_field',
      type: firstType,
      nullable: true,
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
      isAutoIncrement: false,
    }
    addField(table.id, newField)
  }

  const handleUpdateField = (fieldId: string, updates: Partial<ERField>) => {
    if (isNewTable) {
      setNewFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)))
      return
    }
    if (!table) return
    updateTable(table.id, (t) => {
      const field = t.fields.find((f) => f.id === fieldId)
      if (field) {
        Object.assign(field, updates)
      }
    })
  }

  const handleRemoveField = (fieldId: string) => {
    if (isNewTable) {
      setNewFields((prev) => prev.filter((f) => f.id !== fieldId))
      return
    }
    if (!table) return
    removeField(table.id, fieldId)
  }

  const fieldLabels: Record<string, string> = {
    isPrimaryKey: '主键',
    isForeignKey: '外键',
    isUnique: '唯一',
    isAutoIncrement: '自增',
    nullable: '可空',
  }

  if (!tableEditDialogOpen || (!table && !isNewTable)) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{isNewTable ? '新建表' : '编辑表'}</h2>
            {readOnly && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <Lock className="h-3 w-3" /> 只读
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 表信息 */}
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">表名</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="表名" disabled={readOnly} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500">注释</label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="注释（可选）" disabled={readOnly} />
          </div>

          {/* 颜色主题选择 */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
              <Palette className="h-3.5 w-3.5" />
              表头颜色主题
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TABLE_COLORS).map(([key]) => {
                const colorKey = key as TableColor
                const isActive = color === colorKey
                return (
                  <button
                    key={key}
                    onClick={() => { if (!readOnly) setColor(isActive ? undefined : colorKey) }}
                    disabled={readOnly}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all',
                      isActive && 'ring-2 ring-offset-1 ring-blue-500',
                    )}
                    style={{
                      backgroundColor: TABLE_COLOR_HEX[colorKey],
                    }}
                    title={colorKey}
                  />
                )
              })}
              {color && (
                <button
                  onClick={() => { if (!readOnly) setColor(undefined) }}
                  disabled={readOnly}
                  className="flex h-7 items-center rounded-md border border-neutral-300 px-2 text-[10px] text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 字段列表 */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">字段</h3>
            <Button variant="secondary" size="sm" onClick={handleAddField} disabled={readOnly}>
              <Plus className="h-3.5 w-3.5" />
              添加字段
            </Button>
          </div>
          <div className="space-y-2">
            {(isNewTable ? newFields : table?.fields ?? []).map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-700"
              >
                <Input
                  value={field.name}
                  onChange={(e) => handleUpdateField(field.id, { name: e.target.value })}
                  className="h-8 flex-1 text-xs"
                  placeholder="字段名"
                  disabled={readOnly}
                />
                <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">类型:</span>
                {(() => {
                  const bases = getFieldBases(schema?.databaseType)
                  const currentBase = parseFieldType(field.type).base
                  const allBases = bases.includes(currentBase) ? bases : [currentBase, ...bases]
                  return (
                    <select
                      value={currentBase}
                      onChange={(e) => {
                        const base = e.target.value
                        const params = getDefaultParams(base)
                        handleUpdateField(field.id, { type: base + params })
                      }}
                      className="h-8 min-w-[130px] flex-1 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      disabled={readOnly}
                    >
                      {allBases.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  )
                })()}
                {(() => {
                  const { base, params } = parseFieldType(field.type)
                  const hasParams = !!params
                  const canHaveParams = !!getDefaultParams(base)
                  const inner = hasParams ? params.slice(1, -1) : ''
                  return (
                    <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                      长度:
                      <input
                        value={inner}
                        onChange={(e) => {
                          const v = e.target.value
                          handleUpdateField(field.id, { type: v ? `${base}(${v})` : base })
                        }}
                        className="h-8 w-16 rounded border border-neutral-300 bg-white px-1 text-center text-xs font-mono text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                        disabled={readOnly || !canHaveParams}
                        placeholder={canHaveParams ? (hasParams ? undefined : '留空即无参') : '—'}
                      />
                    </span>
                  )
                })()}
                <div className="flex shrink-0 items-center gap-1">
                  {(['isPrimaryKey', 'isForeignKey', 'isUnique', 'isAutoIncrement', 'nullable'] as const).map(
                    (key) => (
                      <Tooltip key={key} content={fieldLabels[key]} side="bottom">
                        <button
                          onClick={() => handleUpdateField(field.id, { [key]: !field[key] })}
                          disabled={readOnly}
                          className={cn(
                            'rounded px-1.5 py-1 text-[10px] font-medium transition-colors',
                            field[key]
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
                            readOnly && 'cursor-default opacity-60',
                          )}
                        >
                          {key.replace('is', '').slice(0, 2).toUpperCase()}
                        </button>
                      </Tooltip>
                    ),
                  )}
                </div>
                {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => handleRemoveField(field.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            取消
          </Button>
          {!readOnly && (
            <Button variant="primary" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4" />
              {isNewTable ? '创建' : '保存'}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
