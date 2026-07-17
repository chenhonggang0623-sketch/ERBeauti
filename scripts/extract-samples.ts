import Database from 'better-sqlite3'
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

type SampleTable = { name: string; fields: number; fieldNames: string[]; rows: number }
type Sample = {
  id: string
  name: string
  summary: string
  ddl: string
  tables: SampleTable[]
  totalRelations: number
}

const DB_PATH = resolve('data/erbeauti.db')
const OUTPUT = resolve('src/data/samples.generated.json')

/** 将 SQLite DDL 转为 MySQL 兼容格式（匹配 node-sql-parser MySQL 方言） */
function toMySQLDDL(sql: string): string {
  return sql
    .replace(/\bINTEGER\b/g, 'INT')
    .replace(/\bAUTOINCREMENT\b/g, 'AUTO_INCREMENT')
    .replace(/\bREAL\b/g, 'DOUBLE')
    .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
}

function extractSample(
  db: Database.Database,
  id: string,
  name: string,
  tableFilter: (t: string) => boolean,
): Sample {
  const tables = db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all() as { name: string; sql: string | null }[]

  const filtered = tables.filter((t) => tableFilter(t.name))

  const sampleTables: SampleTable[] = []
  const ddlParts: string[] = []
  let totalRelations = 0

  for (const t of filtered) {
    const fields = db.pragma(`table_info(${JSON.stringify(t.name)})`)
    const rowCount = (
      db.prepare(`SELECT COUNT(*) as cnt FROM ${JSON.stringify(t.name)}`).get() as { cnt: number }
    ).cnt
    const fks = db.pragma(`foreign_key_list(${JSON.stringify(t.name)})`)
    totalRelations += fks.length

    sampleTables.push({
      name: t.name,
      fields: fields.length,
      fieldNames: (fields as { name: string }[]).slice(0, 5).map((f) => f.name),
      rows: rowCount,
    })
    if (t.sql) ddlParts.push(toMySQLDDL(t.sql.trimEnd()) + ';')
  }

  return {
    id,
    name,
    summary: `${filtered.length} 张表 · ${totalRelations} 个关系`,
    ddl: ddlParts.join('\n'),
    tables: sampleTables,
    totalRelations,
  }
}

if (!existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`)
  process.exit(1)
}

const db = new Database(DB_PATH)

const samples: Sample[] = [
  extractSample(db, 'erbeauti_100tables', '电商数据库', (name) =>
    !name.startsWith('blog_') && !name.startsWith('showcase_') && !name.startsWith('feature_'),
  ),
  extractSample(db, 'erbeauti_demo', '产品展示库', (name) =>
    name.startsWith('showcase_') || name.startsWith('feature_'),
  ),
  extractSample(db, 'erbeauti_sample', '博客平台', (name) => name.startsWith('blog_')),
]

db.close()

writeFileSync(OUTPUT, JSON.stringify(samples, null, 2))
console.log(`Done: ${samples.length} samples written to ${OUTPUT}`)
