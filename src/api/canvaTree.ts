import { apiGet, apiPost, apiPut, apiDelete } from './client'
import type { CanvaNode } from '@/types/er'

export interface ApiCanvaNode {
  id: string
  name: string
  parent_id: string | null
  type: string
  schema_data: string | null
  position: number
  created_at: number
  updated_at: number
}

interface ApiListResponse {
  success: boolean
  data: ApiCanvaNode[]
}

interface ApiDetailResponse {
  success: boolean
  data: ApiCanvaNode
}

function toCamel(api: ApiCanvaNode): CanvaNode {
  return {
    id: api.id,
    name: api.name,
    parentId: api.parent_id,
    type: api.type as 'folder' | 'canvas',
    schemaData: api.schema_data,
    position: api.position,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  }
}

export async function listCanvaTree(signal?: AbortSignal): Promise<CanvaNode[]> {
  const res = await apiGet<ApiListResponse>('/canva-tree', { signal, timeout: 10000 })
  return res.data.map(toCamel)
}

export async function createCanvaNode(
  payload: {
    id?: string
    name: string
    parent_id?: string | null
    type?: string
    schema_data?: string | null
    position?: number
  },
  signal?: AbortSignal,
): Promise<CanvaNode> {
  const res = await apiPost<ApiDetailResponse>('/canva-tree', payload, { signal, timeout: 10000 })
  return toCamel(res.data)
}

export async function updateCanvaNode(
  id: string,
  payload: {
    name?: string
    parent_id?: string | null
    schema_data?: string | null
    position?: number
  },
  signal?: AbortSignal,
): Promise<CanvaNode> {
  const res = await apiPut<ApiDetailResponse>(`/canva-tree/${id}`, payload, { signal, timeout: 10000 })
  return toCamel(res.data)
}

export async function deleteCanvaNode(id: string, signal?: AbortSignal): Promise<void> {
  await apiDelete(`/canva-tree/${id}`, { signal, timeout: 10000 })
}