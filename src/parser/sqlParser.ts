import { Parser } from 'node-sql-parser'
import type { ERSchema, ERTable, ERField, ERRelationship } from '@/types/er'
import { inferForeignKeysByNaming } from './infer-relations'
import { detectDatabaseType } from '@/utils/fieldTypes'

const parser = new Parser()

// node-sql-parser AST 最小类型接口
interface ColumnDef {
  resource?: string
  column?: { column?: string; expr?: { type: string; value: string } }
  definition?: {
    dataType?: { dataType?: string }
    length?: number
    scale?: number
    parentheses?: boolean
    options?: Array<{
      type: string
      value?: { value?: string } | string
    }>
  }
  primary_key?: string | boolean
  unique?: string | boolean
  auto_increment?: string | boolean
  nullable?: { type: string }
}

interface ConstraintDef {
  resource?: string
  constraint_type?: string
  definition?: Array<{ column?: string } | string>
  reference_definition?: {
    table?: Array<{ table?: string }> | { table?: string }
    definition?: Array<{ column?: string } | string>
  }
  reference?: {
    table?: Array<{ table?: string }> | { table?: string }
    definition?: Array<{ column?: string } | string>
  }
}

interface CreateTableStmt {
  type: 'create'
  keyword: 'table'
  table?: Array<{ table: string; comment?: string | { value: string } }>
  create_definitions?: (ColumnDef | ConstraintDef)[]
  table_options?: Array<{ value?: { value: string } }>
}

/**
 * 解析 SQL DDL 为统一 ERSchema。
 * @param sql SQL DDL 字符串，可包含多条 CREATE TABLE 语句
 * @returns 解析后的 ERSchema
 * @throws 解析失败时抛出错误
 */
export function parseSQLToERSchema(sql: string): ERSchema {
  const normalizedSql = normalizeSQL(sql)
  const ast = parser.astify(normalizedSql, { database: 'mysql' })

  // node-sql-parser 可能返回对象或数组
  const statements = (Array.isArray(ast) ? ast : [ast]) as CreateTableStmt[]

  const tables: ERTable[] = []
  const relationships: ERRelationship[] = []

  for (const stmt of statements) {
    if (stmt.type === 'create' && stmt.keyword === 'table') {
      const table = parseCreateTable(stmt)
      tables.push(table)
    }
  }

  // 第一轮：显式外键
  for (const stmt of statements) {
    if (stmt.type === 'create' && stmt.keyword === 'table') {
      const tableName = String(stmt.table?.[0]?.table || '')
      const table = tables.find((t) => t.name === tableName)
      if (!table) continue

      const refs = extractForeignKeys(stmt, table, tables)
      relationships.push(...refs)
    }
  }

  // 第二轮：通过字段名 + 目标表主键推断隐式外键
  const inferred = inferForeignKeysByNaming(tables)
  // 去重：避免与显式外键重复
  const existingKeys = new Set(
    relationships.map((r) =>
      `${r.sourceTableId}.${r.sourceFieldId}->${r.targetTableId}.${r.targetFieldId}`,
    ),
  )
  for (const rel of inferred) {
    const key = `${rel.sourceTableId}.${rel.sourceFieldId}->${rel.targetTableId}.${rel.targetFieldId}`
    if (!existingKeys.has(key)) {
      relationships.push(rel)
      existingKeys.add(key)
    }
  }

  // 第三轮：根据外键关系补全字段上的 isForeignKey 标记
  for (const rel of relationships) {
    const sourceTable = tables.find((t) => t.id === rel.sourceTableId)
    const sourceField = sourceTable?.fields.find((f) => f.id === rel.sourceFieldId)
    if (sourceField) sourceField.isForeignKey = true
  }

  const databaseType = detectDatabaseType(sql)

  return {
    id: generateId('schema'),
    name: 'Imported Schema',
    tables,
    relationships,
    databaseType,
  }
}

/**
 * 对 SQL 做简单预处理：
 * 1. 去掉行尾注释；
 * 2. 多个 CREATE TABLE 之间没有分号时补充分号，便于 parser 切分。
 */
function normalizeSQL(sql: string): string {
  return sql
    .replace(/--[^\n]*\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\)\s*CREATE\s+TABLE\b/g, ');\nCREATE TABLE')
}

/**
 * 解析单条 CREATE TABLE 语句。
 */
function parseCreateTable(stmt: CreateTableStmt): ERTable {
  const tableName = String(stmt.table?.[0]?.table || '')
  const tableComment = extractString(stmt.table?.[0]?.comment)

  const fields: ERField[] = []

  for (const rawCol of stmt.create_definitions || []) {
    if (rawCol.resource !== 'column') continue
    const col = rawCol as ColumnDef

    const fieldName = String(col.column?.column || col.column || '')
    const dataType = formatDataType(col.definition)

    // 主键判断：node-sql-parser 返回 'primary key' 字符串或 true
    let isPrimaryKey =
      col.primary_key === 'primary key' ||
      col.primary_key === 'true' ||
      col.primary_key === true
    // 唯一判断
    let isUnique = col.unique === 'unique' || col.unique === true
    // 自增判断：node-sql-parser 返回 'auto_increment' 字符串或 true
    let isAutoIncrement =
      col.auto_increment === 'auto_increment' ||
      col.auto_increment === 'true' ||
      col.auto_increment === true
    // 默认值
    let defaultValue: string | undefined
    // 注释
    let comment: string | undefined
    // 可空
    let nullable = true

    if (col.nullable) {
      nullable = col.nullable.type !== 'not null'
    }

    for (const opt of col.definition?.options || []) {
      switch (opt.type) {
        case 'primary key':
          isPrimaryKey = true
          break
        case 'unique':
          isUnique = true
          break
        case 'auto_increment':
          isAutoIncrement = true
          break
        case 'default': {
          const optVal = opt.value
          defaultValue = typeof optVal === 'object' && optVal !== null
            ? String((optVal as { value?: string }).value ?? '')
            : String(optVal ?? '')
          break
        }
        case 'comment': {
          const commentVal = opt.value
          comment = typeof commentVal === 'object' && commentVal !== null
            ? String((commentVal as { value?: string }).value ?? '')
            : (typeof commentVal === 'string' ? commentVal : undefined)
          break
        }
        case 'null':
        case 'not null':
          nullable = opt.type === 'null'
          break
      }
    }

    fields.push({
      id: fieldId(tableName, fieldName),
      name: fieldName,
      type: dataType,
      nullable,
      isPrimaryKey,
      isForeignKey: false,
      isUnique,
      isAutoIncrement,
      defaultValue,
      comment,
    })
  }

  // 处理表级约束：复合主键 / 唯一
  for (const def of stmt.create_definitions || []) {
    const constraint = def as ConstraintDef
    if (constraint.resource === 'constraint') {
      const constraintType = String(constraint.constraint_type || '').toLowerCase()
      if (constraintType === 'primary key' && constraint.definition) {
        for (const col of constraint.definition) {
          const fieldName = String((col as { column?: string })?.column || col)
          const field = fields.find((f) => f.name === fieldName)
          if (field) field.isPrimaryKey = true
        }
      }
      if (constraintType === 'unique key' && constraint.definition) {
        for (const col of constraint.definition) {
          const fieldName = String((col as { column?: string })?.column || col)
          const field = fields.find((f) => f.name === fieldName)
          if (field) field.isUnique = true
        }
      }
    }
  }

  return {
    id: tableName,
    name: tableName,
    comment: tableComment,
    fields,
  }
}

/**
 * 从 CREATE TABLE 语句中提取显式外键引用。
 */
function extractForeignKeys(
  stmt: CreateTableStmt,
  sourceTable: ERTable,
  allTables: ERTable[],
): ERRelationship[] {
  const relationships: ERRelationship[] = []

  for (const rawDef of stmt.create_definitions || []) {
    const constraint = rawDef as ConstraintDef
    const constraintType = String(constraint.constraint_type || '').toLowerCase()
    if (constraint.resource !== 'constraint' || constraintType !== 'foreign key') continue

    const sourceColumns = (constraint.definition || []).map((c) => String((c as { column?: string })?.column || c))
    const reference = (constraint.reference_definition || constraint.reference) as
      | { table?: Array<{ table?: string }> | { table?: string }; definition?: Array<{ column?: string } | string> }
      | undefined
    const rawTable = reference?.table
    const targetTableName = String(
      Array.isArray(rawTable) ? rawTable[0]?.table ?? '' : (rawTable as { table?: string } | undefined)?.table ?? '',
    )
    const targetColumns = (reference?.definition || []).map((c) => String((c as { column?: string })?.column || c))
    const targetTable = allTables.find((t) => t.name === targetTableName)

    if (!targetTable || sourceColumns.length === 0 || targetColumns.length === 0) continue

    for (let i = 0; i < sourceColumns.length; i++) {
      const sourceFieldName = sourceColumns[i]
      const targetFieldName = targetColumns[i] || targetColumns[0]
      const sourceField = sourceTable.fields.find((f) => f.name === sourceFieldName)
      const targetField = targetTable.fields.find((f) => f.name === targetFieldName)

      if (sourceField && targetField) {
        relationships.push({
          id: generateId('rel'),
          sourceTableId: sourceTable.id,
          sourceFieldId: sourceField.id,
          targetTableId: targetTable.id,
          targetFieldId: targetField.id,
          type: 'N:1',
        })
      }
    }
  }

  return relationships
}



/**
 * 格式化数据类型字符串。
 */
function formatDataType(def: ColumnDef['definition']): string {
  if (!def || !def.dataType) return 'unknown'
  const dataType = String(def.dataType).toUpperCase()
  if (def.length) {
    return `${dataType}(${def.length}${def.scale !== undefined ? `,${def.scale}` : ''})`
  }
  if (def.parentheses) {
    return `${dataType}(...)`
  }
  return dataType
}

/**
 * 安全提取字符串字面量。
 */
function extractString(value: string | { value: string } | undefined): string | undefined {
  if (typeof value === 'string') return value
  if (value?.value) return String(value.value)
  return undefined
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function fieldId(tableName: string, fieldName: string): string {
  return `${tableName}.${fieldName}`
}
