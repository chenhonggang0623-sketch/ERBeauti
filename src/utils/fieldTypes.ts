export const FALLBACK_DIALECTS = [
  'postgresql', 'postgres', 'mysql', 'mariadb', 'sqlite', 'sqlite+pysqlite',
  'mssql', 'mssql+pyodbc', 'oracle', 'oracle+oracledb',
]

export const FIELD_TYPES: Record<string, string[]> = {
  generic: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
    'VARCHAR(255)', 'CHAR', 'TEXT', 'BOOLEAN',
    'FLOAT', 'DOUBLE', 'DECIMAL(10,2)',
    'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
    'BLOB', 'JSON',
  ],
  mysql: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
    'VARCHAR(255)', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'BOOLEAN', 'BIT',
    'FLOAT', 'DOUBLE', 'DECIMAL(10,2)',
    'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
    'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'JSON', 'ENUM', 'SET',
    'BINARY', 'VARBINARY',
  ],
  postgresql: [
    'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
    'VARCHAR(255)', 'CHAR', 'TEXT',
    'BOOLEAN',
    'REAL', 'DOUBLE PRECISION', 'NUMERIC(10,2)', 'MONEY',
    'DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIME', 'TIMETZ', 'INTERVAL',
    'UUID', 'JSON', 'JSONB', 'XML', 'BYTEA',
    'INET', 'CIDR', 'MACADDR', 'ARRAY',
    'TSVECTOR', 'TSQUERY',
    'OID', 'CID', 'XID',
  ],
  postgres: [
    'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
    'VARCHAR(255)', 'CHAR', 'TEXT',
    'BOOLEAN',
    'REAL', 'DOUBLE PRECISION', 'NUMERIC(10,2)', 'MONEY',
    'DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIME', 'TIMETZ', 'INTERVAL',
    'UUID', 'JSON', 'JSONB', 'XML', 'BYTEA',
    'INET', 'CIDR', 'MACADDR', 'ARRAY',
    'TSVECTOR', 'TSQUERY',
    'OID', 'CID', 'XID',
  ],
  sqlite: [
    'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
    'VARCHAR(255)', 'CHAR', 'TEXT', 'CLOB',
    'BOOLEAN',
    'REAL', 'FLOAT', 'DOUBLE', 'NUMERIC', 'DECIMAL(10,2)',
    'DATE', 'DATETIME', 'TIMESTAMP',
    'BLOB', 'NONE',
  ],
  mariadb: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
    'VARCHAR(255)', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT',
    'BOOLEAN', 'BIT',
    'FLOAT', 'DOUBLE', 'DECIMAL(10,2)',
    'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
    'BLOB', 'TINYBLOB', 'MEDIUMBLOB', 'LONGBLOB',
    'JSON', 'ENUM', 'SET',
    'BINARY', 'VARBINARY',
  ],
  mssql: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT',
    'VARCHAR(255)', 'NVARCHAR(255)', 'CHAR', 'NCHAR', 'TEXT', 'NTEXT',
    'BOOLEAN',
    'FLOAT', 'REAL', 'DECIMAL(10,2)', 'NUMERIC(10,2)', 'MONEY', 'SMALLMONEY',
    'DATE', 'DATETIME', 'DATETIME2', 'SMALLDATETIME', 'TIME', 'TIMESTAMP',
    'UNIQUEIDENTIFIER', 'XML', 'JSON',
    'BINARY', 'VARBINARY', 'IMAGE',
    'ROWVERSION', 'HIERARCHYID', 'SQL_VARIANT',
    'GEOGRAPHY', 'GEOMETRY',
  ],
  oracle: [
    'NUMBER(10)', 'NUMBER', 'BINARY_FLOAT', 'BINARY_DOUBLE',
    'FLOAT', 'REAL',
    'VARCHAR2(255)', 'NVARCHAR2(255)', 'CHAR', 'NCHAR', 'CLOB', 'NCLOB', 'LONG',
    'DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITH LOCAL TIME ZONE', 'INTERVAL YEAR TO MONTH', 'INTERVAL DAY TO SECOND',
    'BLOB', 'BFILE', 'RAW', 'LONG RAW',
    'ROWID', 'UROWID',
    'XMLTYPE', 'JSON',
  ],
}

export function getFieldTypes(databaseType?: string): string[] {
  if (!databaseType) return FIELD_TYPES.generic
  const key = databaseType.toLowerCase().split(/[+]/)[0]
  return FIELD_TYPES[key] ?? FIELD_TYPES.generic
}

export function parseFieldType(type: string): { base: string; params: string } {
  const match = type.match(/^(\w[\w ]*)(\(.*\))?$/)
  if (match) {
    return { base: match[1], params: match[2] || '' }
  }
  return { base: type, params: '' }
}

export function getDefaultParams(base: string): string {
  const defaults: Record<string, string> = {
    VARCHAR: '(100)',
    NVARCHAR: '(100)',
    VARCHAR2: '(100)',
    NVARCHAR2: '(100)',
    DECIMAL: '(10,2)',
    NUMERIC: '(10,2)',
    NUMBER: '(10)',
    CHAR: '(1)',
    NCHAR: '(1)',
    BINARY: '(1)',
    VARBINARY: '(100)',
  }
  return defaults[base] || ''
}

export function getFieldBases(databaseType?: string): string[] {
  const types = getFieldTypes(databaseType)
  return [...new Set(types.map((t) => parseFieldType(t).base))]
}

export function detectDatabaseType(sql: string): string | undefined {
  const upper = sql.toUpperCase()

  const hasBacktick = /`[a-z_]+`/.test(sql)
  const hasAutoIncrement = /\bAUTO_INCREMENT\b/i.test(upper)
  const hasEngineInno = /\bENGINE\s*=\s*InnoDB\b/i.test(upper)
  const hasSerial = /\b(SERIAL|BIGSERIAL|SMALLSERIAL)\b/i.test(upper)
  const hasIdentity = /\bIDENTITY\s*\(/i.test(upper)
  const hasVarchar2 = /\bVARCHAR2\s*\(/i.test(upper)
  const hasNvarchar = /\bNVARCHAR\s*\(/i.test(upper)
  const hasDoubleQuote = /"[a-z_]+"/.test(sql)
  const hasTimestampTZ = /\bTIMESTAMPTZ\b/i.test(upper)
  const hasJsonb = /\bJSONB\b/i.test(upper)
  const hasNtext = /\bNTEXT\b/i.test(upper)
  const hasUniqueIdentifier = /\bUNIQUEIDENTIFIER\b/i.test(upper)
  const hasAutoIncrementPg = /\bAUTOINCREMENT\b/i.test(upper)

  const score: { dialect: string; score: number }[] = [
    { dialect: 'mysql', score: 0 },
    { dialect: 'mariadb', score: 0 },
    { dialect: 'postgresql', score: 0 },
    { dialect: 'mssql', score: 0 },
    { dialect: 'oracle', score: 0 },
    { dialect: 'sqlite', score: 0 },
  ]

  if (hasBacktick) {
    score[0].score += 3
    score[1].score += 3
  }
  if (hasAutoIncrement) {
    score[0].score += 2
    score[1].score += 2
  }
  if (hasEngineInno) {
    score[0].score += 2
    score[1].score += 2
  }
  if (hasNvarchar) {
    score[2].score -= 1
    score[0].score += 1
  }
  if (hasSerial) {
    score[2].score += 3
  }
  if (hasTimestampTZ || hasJsonb) {
    score[2].score += 2
  }
  if (hasDoubleQuote && !hasBacktick) {
    score[2].score += 1
  }
  if (hasIdentity) {
    score[3].score += 3
  }
  if (hasNtext || hasUniqueIdentifier) {
    score[3].score += 2
  }
  if (hasVarchar2) {
    score[4].score += 3
  }
  if (hasAutoIncrementPg) {
    score[5].score += 2
  }

  const best = score.reduce((a, b) => (b.score > a.score ? b : a), score[0])
  return best.score > 0 ? best.dialect : undefined
}
