import { exporter } from '@dbml/core'
import type { ERSchema, ERTable, ERField, ERRelationship } from '@/types/er'

// DBML JSON 结构接口
interface DBMLField {
  name: string
  type: { type_name: string; args?: string }
  pk?: boolean
  unique?: boolean
  not_null?: boolean
  increment?: boolean
  defaultValue?: string
  note?: string
}

interface DBMLTable {
  name: string
  fieldIds?: number[]
  note?: string
}

interface DBMLRelationship {
  endpointIds?: number[]
}

interface DBMLRefEndpoint {
  tableName: string
  fieldNames?: string[]
  relation: string
}

interface DBMLSchema {
  name?: string
  fields?: Record<string, DBMLField>
  tables?: Record<string, DBMLTable>
  refs?: Record<string, DBMLRelationship>
  endpoints?: Record<string, DBMLRefEndpoint>
}

type DBMLJson = DBMLSchema

export function parseDBMLToERSchema(dbml: string): ERSchema {
  const jsonStr = exporter.export(dbml, 'json', { isNormalized: false })
  const data: DBMLJson = JSON.parse(jsonStr)

  const fieldsMap: Record<string, DBMLField> = data.fields || {}
  const tablesMap: Record<string, DBMLTable> = data.tables || {}
  const refsMap: Record<string, DBMLRelationship> = data.refs || {}
  const endpointsMap: Record<string, DBMLRefEndpoint> = data.endpoints || {}

  const tables: ERTable[] = Object.values(tablesMap).map((table: DBMLTable) => {
    const fieldIds: number[] = table.fieldIds || []
    const fields: ERField[] = fieldIds.map((fid: number) => {
      const f = fieldsMap[String(fid)]
      if (!f) return null
      return {
        id: `${table.name}.${f.name}`,
        name: f.name,
        type: formatType(f.type),
        nullable: !f.not_null,
        isPrimaryKey: !!f.pk,
        isForeignKey: false,
        isUnique: !!f.unique,
        isAutoIncrement: !!f.increment,
        defaultValue: f.defaultValue,
        comment: f.note,
      }
    }).filter(Boolean) as ERField[]

    return {
      id: table.name,
      name: table.name,
      comment: table.note,
      fields,
    }
  })

  const relationships: ERRelationship[] = Object.values(refsMap).map((ref: DBMLRelationship, ri: number) => {
    const endpointIds: number[] = ref.endpointIds || []
    if (endpointIds.length < 2) return null

    const sourceEp = endpointsMap[String(endpointIds[0])]
    const targetEp = endpointsMap[String(endpointIds[1])]
    if (!sourceEp || !targetEp) return null

    return {
      id: `rel_${ri}_${Math.random().toString(36).slice(2, 9)}`,
      sourceTableId: sourceEp.tableName,
      sourceFieldId: `${sourceEp.tableName}.${sourceEp.fieldNames?.[0]}`,
      targetTableId: targetEp.tableName,
      targetFieldId: `${targetEp.tableName}.${targetEp.fieldNames?.[0]}`,
      type: inferRelationType(sourceEp.relation, targetEp.relation),
    }
  }).filter(Boolean) as ERRelationship[]

  for (const rel of relationships) {
    const table = tables.find((t) => t.id === rel.sourceTableId)
    const field = table?.fields.find((f) => f.id === rel.sourceFieldId)
    if (field) field.isForeignKey = true
  }

  return {
    id: `schema_${Math.random().toString(36).slice(2, 9)}`,
    name: data.name || 'DBML Schema',
    tables,
    relationships,
  }
}

function formatType(type: DBMLField['type']): string {
  if (!type) return 'unknown'
  const typeName = String(type.type_name || type).toUpperCase()
  if (type.args) {
    return `${typeName}(${type.args})`
  }
  return typeName
}

function inferRelationType(sourceRel: string, targetRel: string): '1:1' | '1:N' | 'N:1' | 'N:M' {
  if (sourceRel === '1' && targetRel === '1') return '1:1'
  if (sourceRel === '*' && targetRel === '1') return 'N:1'
  if (sourceRel === '1' && targetRel === '*') return '1:N'
  return 'N:M'
}
