import { useState, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, Link2, ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useERStore } from '@/store/erStore'
import type { ERRelationship } from '@/types/er'

const RELATION_TYPES: Array<{ value: ERRelationship['type']; label: string }> = [
  { value: '1:1', label: '一对一 (1:1)' },
  { value: '1:N', label: '一对多 (1:N)' },
  { value: 'N:1', label: '多对一 (N:1)' },
  { value: 'N:M', label: '多对多 (N:M)' },
]

export function RelationshipDialog() {
  const {
    relationshipDialogOpen,
    setRelationshipDialogOpen,
    schema,
    addRelationship,
    selectedRelationshipId,
    clearSelectedRelationship,
    updateRelationship,
  } = useERStore(
    useShallow((state) => ({
      relationshipDialogOpen: state.relationshipDialogOpen,
      setRelationshipDialogOpen: state.setRelationshipDialogOpen,
      schema: state.schema,
      addRelationship: state.addRelationship,
      selectedRelationshipId: state.selectedRelationshipId,
      clearSelectedRelationship: state.clearSelectedRelationship,
      updateRelationship: state.updateRelationship,
    })),
  )

  const editingRelationship = useMemo(() => {
    if (!schema) return null
    return schema.relationships.find(r => r.id === selectedRelationshipId) ?? null
  }, [schema, selectedRelationshipId])

  const isEditing = !!editingRelationship

  const [sourceTableId, setSourceTableId] = useState('')
  const [sourceFieldId, setSourceFieldId] = useState('')
  const [targetTableId, setTargetTableId] = useState('')
  const [targetFieldId, setTargetFieldId] = useState('')
  const [relationType, setRelationType] = useState<ERRelationship['type']>('N:1')
  const [relationName, setRelationName] = useState('')

  useEffect(() => {
    if (!relationshipDialogOpen) return
    if (editingRelationship) {
      setSourceTableId(editingRelationship.sourceTableId)
      setSourceFieldId(editingRelationship.sourceFieldId)
      setTargetTableId(editingRelationship.targetTableId)
      setTargetFieldId(editingRelationship.targetFieldId)
      setRelationType(editingRelationship.type)
      setRelationName(editingRelationship.name ?? '')
      return
    }
    if (!schema || schema.tables.length === 0) return
    const firstTable = schema.tables[0]
    setSourceTableId(firstTable.id)
    setSourceFieldId(firstTable.fields[0]?.id ?? '')
    if (schema.tables.length > 1) {
      const secondTable = schema.tables[1]
      setTargetTableId(secondTable.id)
      setTargetFieldId(secondTable.fields[0]?.id ?? '')
    }
    setRelationName('')
  }, [relationshipDialogOpen, editingRelationship, schema])

  const sourceFields = useMemo(() => {
    const table = schema?.tables.find((t) => t.id === sourceTableId)
    return table?.fields ?? []
  }, [schema, sourceTableId])

  const targetFields = useMemo(() => {
    const table = schema?.tables.find((t) => t.id === targetTableId)
    return table?.fields ?? []
  }, [schema, targetTableId])

  const handleSave = useCallback(() => {
    if (!sourceTableId || !sourceFieldId || !targetTableId || !targetFieldId) return
    const name = relationName.trim() || undefined
    if (isEditing && editingRelationship) {
      updateRelationship(editingRelationship.id, (rel) => {
        rel.sourceTableId = sourceTableId
        rel.sourceFieldId = sourceFieldId
        rel.targetTableId = targetTableId
        rel.targetFieldId = targetFieldId
        rel.type = relationType
        rel.name = name
      })
    } else {
      const rel: ERRelationship = {
        id: `rel_${Math.random().toString(36).slice(2, 9)}`,
        sourceTableId,
        sourceFieldId,
        targetTableId,
        targetFieldId,
        type: relationType,
        name,
      }
      addRelationship(rel)
    }
    setRelationshipDialogOpen(false)
    clearSelectedRelationship()
  }, [
    sourceTableId, sourceFieldId, targetTableId, targetFieldId, relationType, relationName,
    isEditing, editingRelationship, updateRelationship, addRelationship,
    setRelationshipDialogOpen, clearSelectedRelationship,
  ])

  if (!relationshipDialogOpen || !schema) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => {
      setRelationshipDialogOpen(false)
      clearSelectedRelationship()
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">
              {isEditing ? '编辑关系' : '添加关系'}
            </h2>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
            setRelationshipDialogOpen(false)
            clearSelectedRelationship()
          }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500">源表</label>
                  <select
                    value={sourceTableId}
                    onChange={(e) => {
                      const tid = e.target.value
                      setSourceTableId(tid)
                      const table = schema.tables.find((t) => t.id === tid)
                      setSourceFieldId(table?.fields[0]?.id ?? '')
                    }}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {schema.tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <ArrowRight className="mt-6 h-5 w-5 text-neutral-400" />

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-500">目标表</label>
                  <select
                    value={targetTableId}
                    onChange={(e) => {
                      const tid = e.target.value
                      setTargetTableId(tid)
                      const table = schema.tables.find((t) => t.id === tid)
                      setTargetFieldId(table?.fields[0]?.id ?? '')
                    }}
                    className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {schema.tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-500">源字段</label>
              <select
                value={sourceFieldId}
                onChange={(e) => setSourceFieldId(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {sourceFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-500">目标字段</label>
              <select
                value={targetFieldId}
                onChange={(e) => setTargetFieldId(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {targetFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500">关系类型</label>
            <div className="flex gap-2">
              {RELATION_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setRelationType(rt.value)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    relationType === rt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-500">
              关系名称 <span className="text-neutral-400">（选填，用于 Chen 式菱形展示）</span>
            </label>
            <Input
              value={relationName}
              onChange={(e) => setRelationName(e.target.value)}
              placeholder="例如：上课、属于、管理..."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <Button variant="secondary" size="sm" onClick={() => setRelationshipDialogOpen(false)}>取消</Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!sourceFieldId || !targetFieldId}>
            <Link2 className="h-4 w-4" />
            {isEditing ? '保存修改' : '添加关系'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
