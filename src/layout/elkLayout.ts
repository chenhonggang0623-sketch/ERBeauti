import type { Node, Edge } from '@xyflow/react'
import type { ERSchema, RFTableNodeData, RFRelationshipEdgeData } from '@/types/er'

let workerPromise: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise<Worker>((resolve, reject) => {
      try {
        console.log('[Worker] Creating worker...')
        const w = new Worker(new URL('../workers/elk.worker.ts', import.meta.url), { type: 'module' })
        console.log('[Worker] Worker created successfully')
        w.addEventListener('error', (e) => {
          console.error('[Worker] Init error:', e)
          reject(new Error(e.message || 'Worker init failed'))
        })
        resolve(w)
      } catch (err) {
        console.error('[Worker] Construction error:', err)
        reject(err)
      }
    })
  }
  return workerPromise
}

/**
 * 使用 Web Worker 异步执行 elkjs 布局，避免阻塞主线程 UI。
 * @param schema 统一 ER 模型
 * @param options 可选的 elkjs 布局参数覆盖
 * @returns Promise<{ nodes, edges }>
 */
export async function layoutSchema(
  schema: ERSchema,
  options?: Record<string, string>,
): Promise<{ nodes: Node<RFTableNodeData>[]; edges: Edge<RFRelationshipEdgeData>[] }> {
  const w = await getWorker()

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      w.removeEventListener('message', handleMessage)
      if (event.data?.error) {
        reject(new Error(event.data.error))
      } else {
        resolve(event.data)
      }
    }

    const handleError = (error: ErrorEvent) => {
      w.removeEventListener('error', handleError)
      reject(new Error(error.message || 'elkjs Worker 布局失败'))
    }

    w.addEventListener('message', handleMessage, { once: true })
    w.addEventListener('error', handleError, { once: true })
    w.postMessage({ schema, options })
  })
}
