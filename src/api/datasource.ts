import { apiGet, apiPost, apiPut, apiDelete } from './client'
import type {
  ConnectionFields,
  DialectsResponse,
  ListTablesRequest,
  ListTablesResponse,
  ReverseEngineerRequest,
  ReverseEngineerResponse,
  TestConnectionRequest,
  TestConnectionResponse,
} from './types'
import type { DataSourceConfig, DataSourceFormState } from '@/types/er'

/* ---- API response types ---- */
interface ApiDataSource {
  id: string
  name: string
  dialect: string
  input_mode: string
  connection_url?: string
  host?: string
  port?: number
  username?: string
  database?: string
  schema_name?: string
  options?: string
  password_encrypted: string
  created_at: number
  updated_at: number
}

interface ApiListResponse {
  success: boolean
  data: ApiDataSource[]
}

interface ApiDetailResponse {
  success: boolean
  data: ApiDataSource
}

/* ---- Transform snake_case API → camelCase frontend ---- */
function apiToConfig(api: ApiDataSource): DataSourceConfig {
  return {
    id: api.id,
    name: api.name,
    dialect: api.dialect,
    inputMode: api.input_mode as 'url' | 'fields',
    connectionUrl: api.connection_url,
    host: api.host,
    port: api.port,
    username: api.username,
    database: api.database,
    schema: api.schema_name,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  }
}

/** Transform frontend form state → API snake_case body */
function formToApi(form: Partial<DataSourceFormState>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (form.name !== undefined) body.name = form.name
  if (form.dialect !== undefined) body.dialect = form.dialect
  if (form.inputMode !== undefined) body.input_mode = form.inputMode
  if (form.connectionUrl !== undefined) body.connection_url = form.connectionUrl
  if (form.host !== undefined) body.host = form.host
  if (form.port !== undefined) body.port = form.port
  if (form.username !== undefined) body.username = form.username
  if (form.password !== undefined) body.password = form.password
  if (form.database !== undefined) body.database = form.database
    if (form.schema !== undefined) body.schema_name = form.schema
  return body
}

/* ---- CRUD API functions ---- */

export async function listDataSources(
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig[] }> {
  const res = await apiGet<ApiListResponse>('/datasources', { signal, timeout: 10000 })
  return { data: res.data.map(apiToConfig) }
}

export async function getDataSourceDetail(
  id: string,
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig & { password: string } }> {
  const res = await apiGet<ApiDetailResponse>(`/datasources/${id}`, { signal, timeout: 10000 })
  return {
    data: {
      ...apiToConfig(res.data),
      password: res.data.password_encrypted === '__ENCRYPTED__' ? '' : res.data.password_encrypted,
    },
  }
}

export async function createDataSource(
  payload: DataSourceFormState,
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig }> {
  const body = formToApi(payload)
  const res = await apiPost<ApiDetailResponse>('/datasources', body, { signal, timeout: 10000 })
  return { data: apiToConfig(res.data) }
}

export async function updateDataSourceApi(
  id: string,
  payload: Partial<DataSourceFormState>,
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig }> {
  const body = formToApi(payload)
  const res = await apiPut<ApiDetailResponse>(`/datasources/${id}`, body, { signal, timeout: 10000 })
  return { data: apiToConfig(res.data) }
}

export async function deleteDataSourceApi(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiDelete(`/datasources/${id}`, { signal, timeout: 10000 })
}

export async function listDialects(signal?: AbortSignal): Promise<DialectsResponse> {
  return apiGet<DialectsResponse>('/dialects', { signal, timeout: 10000 })
}

export async function listTables(
  payload: ListTablesRequest,
  signal?: AbortSignal,
): Promise<ListTablesResponse> {
  return apiPost<ListTablesResponse>('/tables', payload, {
    signal,
    timeout: 30000,
  })
}

export async function testConnection(
  payload: TestConnectionRequest,
  signal?: AbortSignal,
): Promise<TestConnectionResponse> {
  return apiPost<TestConnectionResponse>('/test-connection', payload, {
    signal,
    timeout: 10000,
  })
}

export async function reverseEngineer(
  payload: ReverseEngineerRequest,
  signal?: AbortSignal,
): Promise<ReverseEngineerResponse> {
  return apiPost<ReverseEngineerResponse>('/reverse-engineer', payload, {
    signal,
    timeout: 60000,
  })
}

export interface SampleDatabase {
  id: string
  name: string
  filename: string
}

export async function listSampleDatabases(
  signal?: AbortSignal,
): Promise<SampleDatabase[]> {
  const res = await apiGet<{ success: boolean; databases: SampleDatabase[] }>(
    '/sample-databases',
    { signal, timeout: 10000 },
  )
  return res.databases
}

export type { ConnectionFields, DataSourceConfig, DataSourceFormState, ReverseEngineerRequest, TestConnectionRequest, ListTablesRequest }
