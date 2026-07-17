/** 表节点宽度（px），与 ELK Worker 保持一致 */
export const NODE_WIDTH = 220

/** 表头估算高度（px） */
export const NODE_HEADER_HEIGHT = 36

/** 表字段行估算高度（px） */
export const NODE_ROW_HEIGHT = 28

/**
 * 根据字段数量计算表节点总高度。
 * 该值用于 ELK 布局以及 React Flow 渲染，确保碰撞检测与实际 DOM 尺寸一致。
 */
export function calcNodeHeight(fieldCount: number): number {
  return NODE_HEADER_HEIGHT + Math.max(fieldCount, 1) * NODE_ROW_HEIGHT + 8
}
