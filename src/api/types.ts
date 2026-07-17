import type { ERSchema } from '@/types/er'

/**
 * 数据库连接分字段信息。
 * 注意：password 仅在请求内存中存在，不持久化到本地存储。
 */
export interface ConnectionFields {
  dialect: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  options?: string
}

export interface TestConnectionRequest {
  connection_url?: string
  connection_fields?: ConnectionFields
}

export interface ReverseEngineerRequest extends TestConnectionRequest {
  schema_name?: string
  table_names?: string[]
  infer_relationships?: boolean
}

export interface TableInfo {
  name: string
  column_count?: number
}

export interface ListTablesRequest {
  connection_url?: string
  connection_fields?: ConnectionFields
  schema_name?: string
}

export interface ListTablesResponse {
  success: boolean
  tables: TableInfo[]
}

export interface ApiError {
  code: string
  message: string
  detail?: string
  retryable?: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface DialectsResponse {
  success: boolean
  supported_dialects: string[]
}

export interface TestConnectionResponse {
  success: boolean
  elapsed_ms?: number
  dialect?: string
  server_version?: string
}

export interface ReverseEngineerResponse {
  success: boolean
  schema: ERSchema
}
