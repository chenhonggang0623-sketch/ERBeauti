import { useERStore } from '@/store/erStore'

export type LODLevel = 'full' | 'header-only' | 'minimal'

/**
 * 根据画布缩放比例和表数量，决定节点的细节级别（LOD）。
 * - full：正常显示表头和字段
 * - header-only：仅显示表头
 * - minimal：极简方块
 */
export function useViewportLOD(): LODLevel {
  const zoom = useERStore((state) => state.zoom)
  const nodeCount = useERStore((state) => state.nodes.length)

  if (nodeCount >= 100 && zoom < 0.4) return 'minimal'
  if (nodeCount >= 50 && zoom < 0.6) return 'header-only'
  return 'full'
}
