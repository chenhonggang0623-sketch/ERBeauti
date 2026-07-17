import type { ERTable, ERRelationship } from '@/types/er'

export function inferForeignKeysByNaming(tables: ERTable[]): ERRelationship[] {
  const relationships: ERRelationship[] = []

  for (const sourceTable of tables) {
    for (const field of sourceTable.fields) {
      if (field.isPrimaryKey) continue

      const { baseTable, suffix } = parsePotentialFkField(field.name)
      if (!baseTable) continue

      const targetTable = findTableByPluralVariants(tables, baseTable)
      if (!targetTable) continue

      let targetField = targetTable.fields.find(
        (f) => f.isPrimaryKey && (f.name.toLowerCase() === 'id' || !suffix),
      )
      if (!targetField && suffix) {
        targetField = targetTable.fields.find(
          (f) => f.name.toLowerCase() === suffix.toLowerCase(),
        )
      }
      if (!targetField) {
        targetField = targetTable.fields.find((f) => f.isPrimaryKey)
      }
      if (!targetField) continue

      relationships.push({
        id: `rel_${Math.random().toString(36).slice(2, 9)}`,
        sourceTableId: sourceTable.id,
        sourceFieldId: field.id,
        targetTableId: targetTable.id,
        targetFieldId: targetField.id,
        type: 'N:1',
      })
    }
  }

  return relationships
}

function findTableByPluralVariants(tables: ERTable[], name: string): ERTable | undefined {
  const candidates = new Set([
    name,
    `${name}s`,
    `${name}es`,
    name.replace(/s$/, ''),
    name.replace(/es$/, ''),
    name.replace(/ies$/, 'y'),
    `${name.replace(/y$/, 'ie')}s`,
  ])

  return tables.find((t) => candidates.has(t.name.toLowerCase()))
}

function parsePotentialFkField(fieldName: string): { baseTable?: string; suffix?: string } {
  const lower = fieldName.toLowerCase()

  if (lower.endsWith('_id')) {
    return { baseTable: fieldName.slice(0, -3), suffix: 'id' }
  }

  if (lower.endsWith('id') && lower.length > 2) {
    const base = fieldName.slice(0, -2)
    const snakeBase = base
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
    return { baseTable: snakeBase, suffix: undefined }
  }

  return {}
}
