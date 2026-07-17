import type { ApiError } from './types'

const DEFAULT_BASE_URL = 'http://localhost:8000'
const DEFAULT_TIMEOUT = 30000

function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && typeof envUrl === 'string') return envUrl.replace(/\/$/, '')
  return DEFAULT_BASE_URL
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeout?: number
  signal?: AbortSignal | null
}

function mergeSignals(timeout: number, userSignal?: AbortSignal | null): AbortSignal {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), timeout)

  if (userSignal) {
    userSignal.addEventListener('abort', () => {
      clearTimeout(timer)
      timeoutController.abort()
    }, { once: true })
  }

  return timeoutController.signal
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, signal: userSignal, ...init } = options
  const baseUrl = getBaseUrl()
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  const signal = mergeSignals(timeout, userSignal)

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...init.headers,
      },
      signal,
    })

    if (!response.ok) {
      let errorBody: Partial<ApiError> = {}
      try {
        errorBody = await response.json()
      } catch {
        // 忽略非 JSON 响应体
      }

      const apiError: ApiError = {
        code: errorBody.code ?? `HTTP_${response.status}`,
        message: errorBody.message ?? `请求失败（HTTP ${response.status}）`,
        detail: errorBody.detail,
        retryable: errorBody.retryable ?? (response.status >= 500 || response.status === 408),
      }
      throw apiError
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error as ApiError
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        const timeoutError: ApiError = {
          code: 'CONNECTION_TIMEOUT',
          message: '连接超时，请检查网络或数据库是否可达',
          retryable: true,
        }
        throw timeoutError
      }

      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        const networkError: ApiError = {
          code: 'BACKEND_UNAVAILABLE',
          message: '无法连接到 ERBeauti 后端服务，请确认服务已启动',
          retryable: true,
        }
        throw networkError
      }

      const genericError: ApiError = {
        code: 'NETWORK_ERROR',
        message: '网络请求失败，请检查网络连接',
        detail: error.message,
        retryable: true,
      }
      throw genericError
    }

    throw error
  }
}

export async function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiPut<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function apiDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'DELETE' })
}
