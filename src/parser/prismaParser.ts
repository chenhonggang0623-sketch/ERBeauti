import type { ERSchema, ERTable, ERRelationship } from '@/types/er'
import { generateId } from '@/utils/id'

interface PrismaModel {
  name: string
  fields: PrismaField[]
}

interface PrismaField {
  name: string
  type: string
  required: boolean
  isId: boolean
  isUnique: boolean
  isAutoIncrement: boolean
  defaultValue?: string
  comment?: string
  relation?: {
    name?: string
    fields?: string[]
    references?: string[]
  }
}

/**
 * 轻量解析 Prisma Schema 为统一 ERSchema。
 * 支持 model、基本字段类型、@id、@unique、@default、@relation。
 */
export function parsePrismaToERSchema(schema: string): ERSchema {
  const models = parseModels(schema)

  const tables: ERTable[] = models.map((model) => ({
    id: model.name,
    name: model.name,
    fields: model.fields.map((field) => ({
      id: `${model.name}.${field.name}`,
      name: field.name,
      type: field.type,
      nullable: !field.required,
      isPrimaryKey: field.isId,
      isForeignKey: false,
      isUnique: field.isUnique,
      isAutoIncrement: field.isAutoIncrement,
      defaultValue: field.defaultValue,
      comment: field.comment,
    })),
  }))

  const relationships = parseRelations(models)

  for (const rel of relationships) {
    const table = tables.find((t) => t.id === rel.sourceTableId)
    const field = table?.fields.find((f) => f.id === rel.sourceFieldId)
    if (field) field.isForeignKey = true
  }

  return {
    id: `schema_${generateId()}`,
    name: 'Prisma Schema',
    tables,
    relationships,
  }
}

function parseModels(schema: string): PrismaModel[] {
  const models: PrismaModel[] = []
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = modelRegex.exec(schema)) !== null) {
    const name = match[1]
    const body = match[2]
    models.push({ name, fields: parseFields(body) })
  }
  return models
}

function parseFields(body: string): PrismaField[] {
  const fields: PrismaField[] = []
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//')) continue

    const match = trimmed.match(/^(\w+)\s+([\w?]+)(.*)$/)
    if (!match) continue

    const name = match[1]
    const typeWithOptional = match[2]
    const attrs = match[3]

    const required = !typeWithOptional.endsWith('?')
    const type = typeWithOptional.replace(/\?$/, '')

    const isId = /@id/.test(attrs)
    const isUnique = /@unique/.test(attrs)
    const isAutoIncrement = /@default\(autoincrement\(\)\)/.test(attrs)

    const defaultMatch = attrs.match(/@default\(([^)]*)\)/)
    const defaultValue = defaultMatch ? defaultMatch[1] : undefined

    const relationMatch = attrs.match(/@relation\(([^)]*)\)/)
    const relation = relationMatch ? parseRelationArgs(relationMatch[1]) : undefined

    fields.push({
      name,
      type,
      required,
      isId,
      isUnique,
      isAutoIncrement,
      defaultValue,
      relation,
    })
  }
  return fields
}

function parseRelationArgs(args: string): PrismaField['relation'] {
  const fieldsMatch = args.match(/fields:\s*\[([^\]]*)\]/)
  const referencesMatch = args.match(/references:\s*\[([^\]]*)\]/)
  const nameMatch = args.match(/name:\s*"([^"]*)"/)
  return {
    name: nameMatch?.[1],
    fields: fieldsMatch?.[1].split(',').map((s) => s.trim()),
    references: referencesMatch?.[1].split(',').map((s) => s.trim()),
  }
}

function parseRelations(models: PrismaModel[]): ERRelationship[] {
  const relationships: ERRelationship[] = []
  for (const model of models) {
    for (const field of model.fields) {
      if (!field.relation?.fields || !field.relation.references) continue

      const targetType = field.type.replace(/\?$/, '')
      const targetModel = models.find((m) => m.name === targetType)
      if (!targetModel) continue

      for (let i = 0; i < field.relation.fields.length; i++) {
        const sourceFieldName = field.relation.fields[i]
        const targetFieldName = field.relation.references[i] || field.relation.references[0]
        relationships.push({
          id: `rel_${generateId()}`,
          sourceTableId: model.name,
          sourceFieldId: `${model.name}.${sourceFieldName}`,
          targetTableId: targetModel.name,
          targetFieldId: `${targetModel.name}.${targetFieldName}`,
          type: 'N:1',
        })
      }
    }
  }
  return relationships
}


