import type { ConnectionFields } from '@/api/types'

export interface ParsedConnectionUrl {
  dialect?: string
  username?: string
  password?: string
  host?: string
  port?: number
  database?: string
  options?: string
}

const DRIVER_MAP: Record<string, string> = {
  mysql: 'pymysql',
  mariadb: 'pymysql',
}

function schemeWithDriver(dialect: string): string {
  const driver = DRIVER_MAP[dialect]
  return driver ? `${dialect}+${driver}` : dialect
}

const DEFAULT_PORTS: Record<string, number | undefined> = {
  postgresql: 5432,
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  'mysql+pymysql': 3306,
  'mariadb+pymysql': 3306,
  mssql: 1433,
  'mssql+pyodbc': 1433,
  oracle: 1521,
  'oracle+oracledb': 1521,
  sqlite: undefined,
  'sqlite+pysqlite': undefined,
}

/**
 * 对 URL 组件进行编码，空格编码为 `+`，与 Python urllib.parse.quote_plus 行为一致。
 */
function encodeComponent(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+')
}

/**
 * 对 URL 组件进行解码，将 `+` 还原为空格。
 */
function decodeComponent(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '))
}

/**
 * 获取指定数据库方言的默认端口。
 */
export function getDefaultPort(dialect: string): number | undefined {
  return DEFAULT_PORTS[dialect]
}

/**
 * 根据分字段信息组装连接 URL（前端预览用）。
 * 注意：本函数在前端运行，仅用于预览；最终 URL 由后端组装。
 */
export function buildConnectionUrl(fields: ConnectionFields): string {
  const { dialect, database } = fields
  if (!dialect) return ''

  if (dialect === 'sqlite' || dialect === 'sqlite+pysqlite') {
    return `${dialect}:///${database ?? ''}`
  }

  const username = encodeComponent(fields.username ?? '')
  const password = fields.password ? encodeComponent(fields.password) : ''
  const host = fields.host ?? 'localhost'
  const port = fields.port
  const dbName = encodeComponent(database ?? '')
  const options = fields.options

  const hasPassword = fields.password !== undefined && fields.password !== ''
  let auth = ''
  if (username && hasPassword) {
    auth = `${username}:${password}@`
  } else if (username) {
    auth = `${username}@`
  }

  const portPart = port ? `:${port}` : ''
  const optionsPart = options ? `?${options}` : ''
  const scheme = schemeWithDriver(dialect)

  return `${scheme}://${auth}${host}${portPart}/${dbName}${optionsPart}`
}

/**
 * 将连接 URL 解析为分字段信息，用于模式切换时回填。
 * 解析失败时不抛出异常，返回尽力回填的对象。
 */
export function parseConnectionUrl(url: string): ParsedConnectionUrl {
  const result: ParsedConnectionUrl = {}
  if (!url) return result

  try {
    const parsed = new URL(url)
    const dialect = parsed.protocol.replace(/:$/, '')
    result.dialect = dialect || undefined
    result.username = parsed.username ? decodeComponent(parsed.username) : undefined
    result.password = parsed.password ? decodeComponent(parsed.password) : undefined
    result.host = parsed.hostname || undefined
    result.port = parsed.port ? Number(parsed.port) : undefined

    const pathname = parsed.pathname
    if (pathname && pathname !== '/') {
      result.database = decodeComponent(pathname.replace(/^\//, ''))
    }

    if (parsed.search && parsed.search.length > 1) {
      result.options = parsed.search.slice(1)
    }
  } catch {
    // 解析失败时返回空对象，不阻断用户操作
  }

  return result
}
