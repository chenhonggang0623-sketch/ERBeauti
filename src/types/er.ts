/**
 * ERBeauti 统一数据模型
 * 所有输入适配器（SQL / DBML / Prisma）最终都转换为此模型。
 */

export interface ERSchema {
  id: string
  name: string
  tables: ERTable[]
  relationships: ERRelationship[]
  enums?: EREnum[]
  diagramStyle?: ERDiagramStyle
  /** 数据库类型（方言），如 'mysql' | 'postgresql' | 'sqlite' 等。空字符串表示未指定 */
  databaseType?: string
  /** 来源于哪个数据源的名称（如 "Chinook"），空白画布则为空 */
  sourceName?: string
}

export interface CanvaNode {
  id: string
  name: string
  parentId: string | null
  type: 'folder' | 'canvas'
  schemaData: string | null
  position: number
  createdAt: number
  updatedAt: number
}

export interface ERTable {
  id: string
  name: string
  comment?: string
  fields: ERField[]
  position?: { x: number; y: number }
  group?: string
  /** 表头颜色主题，格式为 Tailwind 色系名，如 'blue' | 'amber' | 'emerald' | 'violet' | 'rose' | 'cyan' | 'slate' */
  color?: TableColor
  /** 来源于哪个数据源的名称 */
  dataSourceName?: string
  /** 是否为示例/样本数据（只读） */
  isSample?: boolean
}

/** 可用的表颜色主题 */
export type TableColor = 'blue' | 'amber' | 'emerald' | 'violet' | 'rose' | 'cyan' | 'slate' | 'orange' | 'teal' | 'pink'

/** 颜色主题配置映射 */
export const TABLE_COLORS: Record<TableColor, {
  light: { headerFrom: string; headerTo: string; border: string; ring: string }
  dark: { headerFrom: string; headerTo: string; border: string; ring: string }
}> = {
  blue: {
    light: { headerFrom: 'from-blue-50', headerTo: 'to-blue-100/50', border: 'border-blue-500', ring: 'ring-blue-500/30' },
    dark: { headerFrom: 'dark:from-blue-900/30', headerTo: 'dark:to-blue-800/20', border: 'dark:border-blue-500', ring: 'dark:ring-blue-500/30' },
  },
  amber: {
    light: { headerFrom: 'from-amber-50', headerTo: 'to-amber-100/50', border: 'border-amber-500', ring: 'ring-amber-500/30' },
    dark: { headerFrom: 'dark:from-amber-900/30', headerTo: 'dark:to-amber-800/20', border: 'dark:border-amber-500', ring: 'dark:ring-amber-500/30' },
  },
  emerald: {
    light: { headerFrom: 'from-emerald-50', headerTo: 'to-emerald-100/50', border: 'border-emerald-500', ring: 'ring-emerald-500/30' },
    dark: { headerFrom: 'dark:from-emerald-900/30', headerTo: 'dark:to-emerald-800/20', border: 'dark:border-emerald-500', ring: 'dark:ring-emerald-500/30' },
  },
  violet: {
    light: { headerFrom: 'from-violet-50', headerTo: 'to-violet-100/50', border: 'border-violet-500', ring: 'ring-violet-500/30' },
    dark: { headerFrom: 'dark:from-violet-900/30', headerTo: 'dark:to-violet-800/20', border: 'dark:border-violet-500', ring: 'dark:ring-violet-500/30' },
  },
  rose: {
    light: { headerFrom: 'from-rose-50', headerTo: 'to-rose-100/50', border: 'border-rose-500', ring: 'ring-rose-500/30' },
    dark: { headerFrom: 'dark:from-rose-900/30', headerTo: 'dark:to-rose-800/20', border: 'dark:border-rose-500', ring: 'dark:ring-rose-500/30' },
  },
  cyan: {
    light: { headerFrom: 'from-cyan-50', headerTo: 'to-cyan-100/50', border: 'border-cyan-500', ring: 'ring-cyan-500/30' },
    dark: { headerFrom: 'dark:from-cyan-900/30', headerTo: 'dark:to-cyan-800/20', border: 'dark:border-cyan-500', ring: 'dark:ring-cyan-500/30' },
  },
  slate: {
    light: { headerFrom: 'from-neutral-100', headerTo: 'to-neutral-50', border: 'border-neutral-500', ring: 'ring-neutral-500/30' },
    dark: { headerFrom: 'dark:from-neutral-800', headerTo: 'dark:to-neutral-800/50', border: 'dark:border-neutral-500', ring: 'dark:ring-neutral-500/30' },
  },
  orange: {
    light: { headerFrom: 'from-orange-50', headerTo: 'to-orange-100/50', border: 'border-orange-500', ring: 'ring-orange-500/30' },
    dark: { headerFrom: 'dark:from-orange-900/30', headerTo: 'dark:to-orange-800/20', border: 'dark:border-orange-500', ring: 'dark:ring-orange-500/30' },
  },
  teal: {
    light: { headerFrom: 'from-teal-50', headerTo: 'to-teal-100/50', border: 'border-teal-500', ring: 'ring-teal-500/30' },
    dark: { headerFrom: 'dark:from-teal-900/30', headerTo: 'dark:to-teal-800/20', border: 'dark:border-teal-500', ring: 'dark:ring-teal-500/30' },
  },
  pink: {
    light: { headerFrom: 'from-pink-50', headerTo: 'to-pink-100/50', border: 'border-pink-500', ring: 'ring-pink-500/30' },
    dark: { headerFrom: 'dark:from-pink-900/30', headerTo: 'dark:to-pink-800/20', border: 'dark:border-pink-500', ring: 'dark:ring-pink-500/30' },
  },
}

/** 颜色主题十六进制色值映射 */
export const TABLE_COLOR_HEX: Record<TableColor, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  emerald: '#10b981',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  cyan: '#06b6d4',
  slate: '#64748b',
  orange: '#f97316',
  teal: '#14b8a6',
  pink: '#ec4899',
}

export interface ERField {
  id: string
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  isUnique: boolean
  isAutoIncrement: boolean
  defaultValue?: string
  comment?: string
}

export interface ERRelationship {
  id: string
  sourceTableId: string
  sourceFieldId: string
  targetTableId: string
  targetFieldId: string
  type: '1:1' | '1:N' | 'N:1' | 'N:M'
  /** 关系名称（语义化），如"上课"、"属于"等，用于 Chen 式菱形中展示 */
  name?: string
}

export interface EREnum {
  id: string
  name: string
  values: string[]
}

/** 支持的导入格式 */
export type ImportFormat = 'sql' | 'dbml' | 'prisma' | 'database'

/** ER 图样式 */
export type ERDiagramStyle = 'table' | 'chen'

/** 数据源输入模式 */
export type DataSourceInputMode = 'url' | 'fields'

/**
 * 已保存的数据源配置（不含密码）。
 * password 仅在内存表单中存在，禁止持久化到任何存储介质。
 */
export interface DataSourceConfig {
  id: string
  name: string
  dialect: string
  inputMode: DataSourceInputMode
  connectionUrl?: string
  host?: string
  port?: number
  username?: string
  database?: string
  schema?: string
  createdAt: number
  updatedAt: number
}

/**
 * 数据源表单状态，包含仅在内存中保存的 password。
 */
export interface DataSourceFormState extends DataSourceConfig {
  password: string
}

/**
 * React Flow 渲染使用的节点/边数据。
 * 添加 [key: string] 以兼容 @xyflow/react 的 Node<T> 约束。
 */
export interface RFTableNodeData extends Record<string, unknown> {
  table: ERTable
}

export interface ElkPoint {
  x: number
  y: number
}

export interface ElkSection {
  id?: string
  startPoint: ElkPoint
  endPoint: ElkPoint
  bendPoints?: ElkPoint[]
  incomingShape?: ElkSection
  outgoingShape?: ElkSection
}

export interface EdgeLaneInfo {
  /** 当前边在同组中的 lane 索引 */
  laneIndex: number
  /** 同组边的总数 */
  laneCount: number
}

export interface RFRelationshipEdgeData extends Record<string, unknown> {
  relationship: ERRelationship
  /** ELK 返回的正交路由段，优先用于绘制 */
  sections?: ElkSection[]
  /** 同 sourceHandle/targetHandle 的 lane 偏移信息 */
  lane?: EdgeLaneInfo
  adjustedLabelX?: number
  adjustedLabelY?: number
  /** 标签在边几何上的"锚点"，用于绘制 leader line 让用户识别标签归属于哪条边 */
  labelAnchorX?: number
  labelAnchorY?: number
}
