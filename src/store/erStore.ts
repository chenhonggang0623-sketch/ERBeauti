import { useMemo } from 'react'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

enableMapSet()
import { applyNodeChanges, type Node, type Edge, type NodeChange } from '@xyflow/react'
import { generateId } from '@/utils/id'
import type { ERSchema, ERTable, ERField, ERRelationship, RFTableNodeData, ImportFormat, DataSourceConfig, DataSourceFormState, ERDiagramStyle } from '@/types/er'
import { calcNodeHeight } from '@/utils/nodeMetrics'
import { buildChenLayout } from '@/utils/chenLayout'
import { listDataSources, createDataSource, updateDataSourceApi, deleteDataSourceApi } from '@/api/datasource'
import type { CanvaNode } from '@/types/er'
import { listCanvaTree, createCanvaNode, updateCanvaNode, deleteCanvaNode } from '@/api/canvaTree'

export interface ContextMenuState {
  x: number
  y: number
  type: 'node' | 'pane'
  targetId?: string
}

interface HistorySnapshot {
  schema: ERSchema | null
  nodes: Node<RFTableNodeData>[]
  edges: Edge[]
}

const MAX_HISTORY = 25

interface ERState extends HistorySnapshot {
  /** 搜索关键词 */
  searchQuery: string
  /** 当前选中的表 ID */
  selectedTableId: string | null
  /** 是否显示导入弹窗 */
  importDialogOpen: boolean
  /** 导入弹窗默认选中的格式 */
  importDialogFormat: ImportFormat | null
  /** 是否显示导出弹窗 */
  exportDialogOpen: boolean
  /** 是否正在导出（SVG/PNG 进度指示） */
  exporting: boolean
  /** 是否显示关系编辑弹窗 */
  relationshipDialogOpen: boolean
  /** 是否显示表编辑弹窗 */
  tableEditDialogOpen: boolean
  /** 当前编辑的表 ID */
  editingTableId: string | null
  /** 布局是否计算中 */
  layoutLoading: boolean
  /** 主题 */
  theme: 'light' | 'dark'
  /** ER 图样式 */
  diagramStyle: ERDiagramStyle
  /** 当前画布缩放比例 */
  zoom: number
  /** 右键菜单状态 */
  contextMenu: ContextMenuState | null
  /** 当前 hover 的边 ID */
  hoveredEdgeId: string | null
  /** 关系链高亮：节点 */
  highlightedChainNodeIds: Set<string>
  /** 关系链高亮：边 */
  highlightedChainEdgeIds: Set<string>
  /** 隐藏的表 ID 集合 */
  hiddenTableIds: Set<string>
  /** 当前选中的关系 ID */
  selectedRelationshipId: string | null
  /** 已保存的数据源配置列表（不含密码） */
  dataSources: DataSourceConfig[]
  dataSourcesLoading: boolean
  dataSourcesError: string | null
  /** 数据源管理弹窗是否打开 */
  dataSourceDialogOpen: boolean
  /** 数据源弹窗当前视图 */
  dataSourceDialogMode: 'list' | 'form' | 'import'
  /** 当前正在编辑的数据源 ID */
  editingDataSourceId: string | null
  /** 当前选中的数据源 ID */
  selectedDataSourceId: string | null
  /** 高亮显示的关联字段（选中关系时设置） */
  highlightedFields: {
    sourceFieldId: string
    targetFieldId: string
    sourceTableId: string
    targetTableId: string
  } | null
  /** hover 的关联字段（hover 关系时设置） */
  hoveredFields: {
    sourceFieldId: string
    targetFieldId: string
    sourceTableId: string
    targetTableId: string
  } | null
  /** 悬停字段时，连向该字段的边 ID 集合 */
  hoveredFieldEdgeIds: Set<string>
  /** 点击字段，记录被点击字段（用于条件展示关系卡片） */
  clickedField: { tableId: string; fieldId: string } | null
  /** 关联表高亮搜索深度 */
  relationshipChainDepth: number
  /** 邻接表缓存（加速关系链 BFS） */
  _adjacencyCache: Map<string, string[]>
  /** 来自首页的样本 SQL（跳转编辑器时预填） */
  sampleSql: string | null

  /** 待创建的新表位置（右键菜单新建表用） */
  pendingNewTable: { x: number; y: number; nodeType: string } | null

  /** 画布树节点列表 */
  canvaTree: CanvaNode[]
  /** 画布树加载中 */
  canvaTreeLoading: boolean
  /** 当前画布 ID */
  currentCanvasId: string | null
  /** 画布树错误信息 */
  canvaTreeError: string | null

  /** 导入目标父节点 ID（文件夹），默认为根节点 */
  importTargetParentId: string

  /** 历史记录 */
  history: HistorySnapshot[]
  /** 当前历史索引 */
  historyIndex: number
  /** 是否正在从历史恢复（避免重复入栈） */
  _restoringFromHistory: boolean

  /** 设置完整 schema 并重置选中状态 */
  setSchema: (schema: ERSchema) => void
  /** 应用节点变更（来自 React Flow 拖拽等） */
  onNodesChange: (changes: NodeChange[]) => void
  /** 设置节点和边 */
  setNodes: (nodes: Node<RFTableNodeData>[]) => void
  /** 设置边 */
  setEdges: (edges: Edge[]) => void
  /** 批量设置 schema + nodes + edges */
  setLayoutResult: (schema: ERSchema, nodes: Node<RFTableNodeData>[], edges: Edge[]) => void
  /** 搜索 */
  setSearchQuery: (query: string) => void
  /** 选中表 */
  setSelectedTableId: (id: string | null) => void
  /** 打开/关闭导入弹窗 */
  setImportDialogOpen: (open: boolean) => void
  /** 设置导入弹窗默认格式 */
  setImportDialogFormat: (format: ImportFormat | null) => void
  /** 设置导入目标父节点 ID */
  setImportTargetParentId: (id: string) => void
  /** 设置样本 SQL */
  setSampleSql: (sql: string | null) => void
  /** 设置当前 schema 的数据库类型 */
  setDatabaseType: (databaseType: string) => void
  /** 设置待创建的新表位置 */
  setPendingNewTable: (pos: { x: number; y: number; nodeType: string } | null) => void
  /** 打开/关闭导出弹窗 */
  setExportDialogOpen: (open: boolean) => void
  /** 设置导出进度状态 */
  setExporting: (exporting: boolean) => void
  /** 打开/关闭关系编辑弹窗 */
  setRelationshipDialogOpen: (open: boolean) => void
  /** 打开/关闭表编辑弹窗 */
  setTableEditDialogOpen: (open: boolean) => void
  /** 设置当前编辑的表 ID */
  setEditingTableId: (id: string | null) => void
  /** 设置布局加载状态 */
  setLayoutLoading: (loading: boolean) => void
  /** 切换主题 */
  toggleTheme: () => void
  /** 设置 ER 图样式 */
  setDiagramStyle: (style: ERDiagramStyle) => void
  /** 设置缩放 */
  setZoom: (zoom: number) => void
  /** 打开右键菜单 */
  setContextMenu: (menu: ContextMenuState | null) => void
  /** 关闭右键菜单 */
  closeContextMenu: () => void
  /** 设置 hover 边并计算关系链 */
  setHoveredEdgeId: (edgeId: string | null) => void
  /** 高亮指定表的所有关联表 */
  highlightRelatedTables: (tableId: string | null) => void

  /** 撤销 */
  undo: () => void
  /** 重做 */
  redo: () => void
  /** 是否可以撤销 */
  canUndo: () => boolean
  /** 是否可以重做 */
  canRedo: () => boolean

  /** 删除表 */
  deleteTable: (tableId: string) => void
  /** 复制表 */
  duplicateTable: (tableId: string, options?: { offsetX?: number; offsetY?: number }) => ERTable | null
  /** 添加新表 */
  addTable: (table: ERTable, node?: Node<RFTableNodeData>) => void
  /** 更新表 */
  updateTable: (tableId: string, updater: (table: ERTable) => void) => void
  /** 添加字段 */
  addField: (tableId: string, field: ERField) => void
  /** 更新字段 */
  updateField: (tableId: string, fieldId: string, updater: (field: ERField) => void) => void
  /** 删除字段 */
  removeField: (tableId: string, fieldId: string) => void
  /** 添加关系 */
  addRelationship: (rel: ERRelationship) => void
  /** 删除关系 */
  removeRelationship: (relId: string) => void
  /** 切换表的隐藏/显示 */
  toggleTableVisibility: (tableId: string) => void
  /** 设置选中的关系 ID */
  setSelectedRelationshipId: (relId: string | null) => void
  /** 清除选中的关系 */
  clearSelectedRelationship: () => void
  fetchDataSources: () => Promise<void>
  addDataSource: (config: DataSourceFormState) => Promise<void>
  updateDataSource: (id: string, formData: Partial<DataSourceFormState>) => Promise<void>
  removeDataSource: (id: string) => Promise<void>
  /** 打开/关闭数据源管理弹窗 */
  setDataSourceDialogOpen: (open: boolean) => void
  /** 设置数据源弹窗视图 */
  setDataSourceDialogMode: (mode: 'list' | 'form' | 'import') => void
  /** 设置当前编辑的数据源 ID */
  setEditingDataSourceId: (id: string | null) => void
  /** 设置当前选中的数据源 ID */
  setSelectedDataSourceId: (id: string | null) => void
  /** 设置 hover 的关联字段 */
  setHoveredFields: (fields: {
    sourceFieldId: string
    targetFieldId: string
    sourceTableId: string
    targetTableId: string
  } | null) => void
  /** 更新关系 */
  updateRelationship: (relId: string, updater: (rel: ERRelationship) => void) => void
  /** 设置关联表高亮深度 */
  setRelationshipChainDepth: (depth: number) => void
  /** 设置悬停字段关联的边 ID */
  setHoveredFieldEdgeIds: (ids: Set<string>) => void
  /** 点击字段，切换关系卡片的显示 */
  setClickedField: (field: { tableId: string; fieldId: string } | null) => void
  /** 重建邻接表缓存 */
  _rebuildAdjacency: () => void

  /** 添加默认根节点（仅本地） */
  _addDefaultRoot: () => void
  /** 获取画布树 */
  fetchCanvaTree: () => Promise<void>
  /** 创建画布树节点 */
  createCanvaNode: (data: { name: string; parentId?: string | null; type?: 'folder' | 'canvas' }) => Promise<CanvaNode>
  /** 更新画布树节点 */
  updateCanvaNode: (id: string, data: { name?: string; schemaData?: string | null }) => Promise<CanvaNode | null>
  /** 删除画布树节点 */
  deleteCanvaNode: (id: string) => Promise<void>
  /** 切换到指定画布 */
  switchCanvas: (canvasId: string) => Promise<void>
  /** 保存当前画布 */
  saveCurrentCanvas: () => Promise<void>
  /** 序列化当前 schema/nodes/edges 为 JSON（含 diagramStyle） */
  serializeSchema: () => string
  /** 反序列化并加载画布 */
  loadSchemaFromData: (schemaData: string) => void
}



function buildAdjacency(edges: Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    for (const id of [edge.source, edge.target]) {
      if (!adj.has(id)) adj.set(id, [])
    }
    adj.get(edge.source)!.push(edge.target)
    adj.get(edge.target)!.push(edge.source)
  }
  return adj
}

function bfsTraversal(
  startNodes: Array<{ id: string; remainingDepth: number }>,
  edges: Edge[],
  adjacency: Map<string, string[]>,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const visited = new Set<string>()

  const edgeMap = new Map<string, string[]>()
  for (const e of edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, [])
    if (!edgeMap.has(e.target)) edgeMap.set(e.target, [])
    edgeMap.get(e.source)!.push(e.id)
    edgeMap.get(e.target)!.push(e.id)
  }

  for (const sn of startNodes) {
    visited.add(sn.id)
  }

  const queue = [...startNodes]
  let head = 0
  while (head < queue.length) {
    const { id: currentId, remainingDepth } = queue[head++]
    if (remainingDepth <= 0) continue
    const neighbors = adjacency.get(currentId)
    if (!neighbors) continue
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId)
        nodeIds.add(neighborId)
        queue.push({ id: neighborId, remainingDepth: remainingDepth - 1 })
        const connEdges = edgeMap.get(currentId) ?? []
        for (const eid of connEdges) {
          const e = edges.find(e => e.id === eid)
          if (e && ((e.source === currentId && e.target === neighborId) || (e.target === currentId && e.source === neighborId))) {
            edgeIds.add(eid)
          }
        }
      }
    }
  }
  return { nodeIds, edgeIds }
}

/* ---- localStorage fallback for canvas persistence ---- */

const LS_CANVA_TREE = 'erbeauti_canva_tree'
const LS_CANVAS_PREFIX = 'erbeauti_canvas_'

function _persistCanvaTree(tree: CanvaNode[]) {
  try {
    localStorage.setItem(LS_CANVA_TREE, JSON.stringify(tree))
  } catch { /* quota exceeded, ignore */ }
}

function _loadCanvaTree(): CanvaNode[] | null {
  try {
    const raw = localStorage.getItem(LS_CANVA_TREE)
    if (!raw) return null
    return JSON.parse(raw) as CanvaNode[]
  } catch { return null }
}

function _persistSchemaData(canvasId: string, data: string | null) {
  if (!data) return
  try {
    localStorage.setItem(LS_CANVAS_PREFIX + canvasId, data)
  } catch { /* quota exceeded, ignore */ }
}

function _loadSchemaData(canvasId: string): string | null {
  try {
    return localStorage.getItem(LS_CANVAS_PREFIX + canvasId)
  } catch { return null }
}

function isNameTaken(
  canvaTree: CanvaNode[],
  name: string,
  parentId: string | null | undefined,
  excludeId?: string,
): boolean {
  const targetParent = parentId ?? null
  return canvaTree.some(
    (n) => n.parentId === targetParent && n.name === name && n.id !== excludeId,
  )
}

export const useERStore = create<ERState>()(
  immer((set, get) => ({
    schema: null,
    nodes: [],
    edges: [],
    searchQuery: '',
    selectedTableId: null,
    importDialogOpen: false,
    importDialogFormat: null,
    exportDialogOpen: false,
    exporting: false,
    relationshipDialogOpen: false,
    tableEditDialogOpen: false,
    editingTableId: null,
    layoutLoading: false,
    theme: 'light',
    diagramStyle: 'table',
    zoom: 1,
    contextMenu: null,
    hoveredEdgeId: null,
    highlightedChainNodeIds: new Set<string>(),
    highlightedChainEdgeIds: new Set<string>(),
    hiddenTableIds: new Set<string>(),
    selectedRelationshipId: null,
    dataSources: [],
    dataSourcesLoading: false,
    dataSourcesError: null,
    dataSourceDialogOpen: false,
    dataSourceDialogMode: 'list',
    editingDataSourceId: null,
    selectedDataSourceId: null,
    highlightedFields: null,
    hoveredFields: null,
    hoveredFieldEdgeIds: new Set<string>(),
    clickedField: null,
    relationshipChainDepth: 0,
    _adjacencyCache: new Map<string, string[]>(),
    sampleSql: null,

    pendingNewTable: null,

    canvaTree: [],
    canvaTreeLoading: false,
    currentCanvasId: null,
    canvaTreeError: null,

    importTargetParentId: 'local_root',

    history: [],
    historyIndex: -1,
    _restoringFromHistory: false,

    setSchema: (schema) =>
      set((state) => {
        state.schema = schema
        state.selectedTableId = null
        saveHistoryState(state)
      }),

    onNodesChange: (changes) =>
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as Node<RFTableNodeData>[]
        if (state.schema) {
          for (const change of changes) {
            if (change.type === 'position' && change.position) {
              const node = state.nodes.find((n) => n.id === change.id)
              if (node) {
                state.schema.tables = state.schema.tables.map((t) =>
                  t.id === change.id ? { ...t, position: { ...node.position } } : t,
                )
              }
            }
          }
        }
      }),

    setNodes: (nodes) =>
      set((state) => {
        state.nodes = nodes
        saveHistoryState(state)
      }),

    setEdges: (edges) =>
      set((state) => {
        state.edges = edges
        state._adjacencyCache = buildAdjacency(edges)
        saveHistoryState(state)
      }),

    setLayoutResult: (schema, nodes, edges) =>
      set((state) => {
        state.schema = schema
        state.nodes = nodes.filter((n) => !state.hiddenTableIds.has(n.id))
        state.edges = edges.filter(
          (e) => !state.hiddenTableIds.has(e.source) && !state.hiddenTableIds.has(e.target),
        )
        state._adjacencyCache = buildAdjacency(state.edges)
        state.selectedTableId = null
        saveHistoryState(state)
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query
      }),

    setSelectedTableId: (id) =>
      set((state) => {
        state.selectedTableId = id
      }),

    setImportDialogOpen: (open) =>
      set((state) => {
        state.importDialogOpen = open
      }),

    setImportDialogFormat: (format) =>
      set((state) => {
        state.importDialogFormat = format
      }),

    setImportTargetParentId: (id) =>
      set((state) => {
        state.importTargetParentId = id
      }),

    setSampleSql: (sql) =>
      set((state) => {
        state.sampleSql = sql
      }),

    setDatabaseType: (databaseType) =>
      set((state) => {
        if (state.schema) {
          state.schema.databaseType = databaseType
        }
      }),

    setPendingNewTable: (pos) =>
      set((state) => {
        state.pendingNewTable = pos
      }),

    setExportDialogOpen: (open) =>
      set((state) => {
        state.exportDialogOpen = open
      }),

    setExporting: (exporting) =>
      set((state) => {
        state.exporting = exporting
      }),

    setRelationshipDialogOpen: (open) =>
      set((state) => {
        state.relationshipDialogOpen = open
      }),

    setTableEditDialogOpen: (open) =>
      set((state) => {
        state.tableEditDialogOpen = open
      }),

    setEditingTableId: (id) =>
      set((state) => {
        state.editingTableId = id
      }),

    setLayoutLoading: (loading) =>
      set((state) => {
        state.layoutLoading = loading
      }),

    toggleTheme: () =>
      set((state) => {
        state.theme = state.theme === 'light' ? 'dark' : 'light'
      }),

    setDiagramStyle: (style) =>
      set((state) => {
        state.diagramStyle = style
        if (style === 'chen') {
          const { nodes: chenNodes, edges: chenEdges } = buildChenLayout(state.nodes as Node[])
          state.nodes = chenNodes as Node<RFTableNodeData>[]
          state.edges = [...state.edges, ...chenEdges]
          state._adjacencyCache = buildAdjacency(state.edges)
        } else {
          state.nodes = state.nodes
            .filter((n) => n.type !== 'chen-attribute')
            .map((n) => {
              const table = (n.data as RFTableNodeData)?.table
              return {
                ...n,
                type: 'table' as const,
                height: table ? calcNodeHeight(table.fields.length) : n.height,
              }
            })
          state.edges = state.edges.filter(
            (e) => !e.id.startsWith('attr-edge-'),
          )
          state._adjacencyCache = buildAdjacency(state.edges)
        }
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = zoom
      }),

    setContextMenu: (menu) =>
      set((state) => {
        state.contextMenu = menu
      }),

    closeContextMenu: () =>
      set((state) => {
        state.contextMenu = null
      }),

    setHoveredEdgeId: (edgeId) =>
      set((state) => {
        state.hoveredEdgeId = edgeId
        if (!edgeId) {
          state.highlightedChainNodeIds = new Set<string>()
          state.highlightedChainEdgeIds = new Set<string>()
          return
        }
        const edge = state.edges.find(e => e.id === edgeId)
        if (!edge) return
        const depth = state.relationshipChainDepth
        const { nodeIds, edgeIds } = bfsTraversal(
          [
            { id: edge.source, remainingDepth: depth },
            { id: edge.target, remainingDepth: depth },
          ],
          state.edges,
          state._adjacencyCache,
        )
        nodeIds.add(edge.source)
        nodeIds.add(edge.target)
        edgeIds.add(edgeId)
        state.highlightedChainNodeIds = nodeIds
        state.highlightedChainEdgeIds = edgeIds
      }),

    highlightRelatedTables: (tableId) =>
      set((state) => {
        if (!tableId) {
          state.highlightedChainNodeIds = new Set<string>()
          state.highlightedChainEdgeIds = new Set<string>()
          return
        }
        const depth = state.relationshipChainDepth || 1
        const { nodeIds, edgeIds } = bfsTraversal(
          [{ id: tableId, remainingDepth: depth }],
          state.edges,
          state._adjacencyCache,
        )
        nodeIds.add(tableId)
        state.highlightedChainNodeIds = nodeIds
        state.highlightedChainEdgeIds = edgeIds
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex <= 0) return
        state.historyIndex--
        const snapshot = state.history[state.historyIndex]
        state._restoringFromHistory = true
        state.schema = snapshot.schema
        state.nodes = snapshot.nodes
        state.edges = snapshot.edges
        state._adjacencyCache = buildAdjacency(state.edges)
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return
        state.historyIndex++
        const snapshot = state.history[state.historyIndex]
        state._restoringFromHistory = true
        state.schema = snapshot.schema
        state.nodes = snapshot.nodes
        state.edges = snapshot.edges
        state._adjacencyCache = buildAdjacency(state.edges)
      }),

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    deleteTable: (tableId) =>
      set((state) => {
        if (!state.schema) return
        state.schema.tables = state.schema.tables.filter((t) => t.id !== tableId)
        state.schema.relationships = state.schema.relationships.filter(
          (r) => r.sourceTableId !== tableId && r.targetTableId !== tableId,
        )
        state.nodes = state.nodes.filter((n) => n.id !== tableId)
        state.edges = state.edges.filter((e) => e.source !== tableId && e.target !== tableId)
        state._adjacencyCache = buildAdjacency(state.edges)
        if (state.selectedTableId === tableId) state.selectedTableId = null
        saveHistoryState(state)
      }),

    duplicateTable: (tableId, options = {}) => {
      let duplicated: ERTable | null = null
      set((state) => {
        if (!state.schema) return
        const sourceTable = state.schema.tables.find((t) => t.id === tableId)
        if (!sourceTable) return

        const newId = `${sourceTable.id}_copy_${generateId()}`
        duplicated = {
          ...sourceTable,
          id: newId,
          name: `${sourceTable.name}_copy`,
          fields: sourceTable.fields.map((field) => ({
            ...field,
            id: `${newId}.${field.name}`,
          })),
        }
        state.schema.tables.push(duplicated)

        const sourceNode = state.nodes.find((n) => n.id === tableId)
        const offsetX = options.offsetX ?? 260
        const offsetY = options.offsetY ?? 0
        state.nodes.push({
          id: duplicated.id,
          type: 'table',
          position: {
            x: (sourceNode?.position.x ?? 0) + offsetX,
            y: (sourceNode?.position.y ?? 0) + offsetY,
          },
          data: { table: duplicated },
          width: sourceNode?.width ?? 220,
          height: sourceNode?.height ?? 100,
        })

        state.selectedTableId = duplicated.id
        saveHistoryState(state)
      })
      return duplicated
    },

    addTable: (table, node) =>
      set((state) => {
        if (!state.schema) return
        state.schema.tables.push(table)
        state.nodes.push(
          node ?? {
            id: table.id,
            type: 'table',
            position: { x: 0, y: 0 },
            data: { table },
            width: 220,
            height: 100,
          },
        )
        state.selectedTableId = table.id
        saveHistoryState(state)
      }),

    updateTable: (tableId, updater) =>
      set((state) => {
        if (!state.schema) return
        const table = state.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        updater(table)
        const node = state.nodes.find((n) => n.id === tableId)
        if (node) {
          node.data = { table }
        }
        saveHistoryState(state)
      }),

    addField: (tableId, field) =>
      set((state) => {
        if (!state.schema) return
        const table = state.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        table.fields.push(field)
        const node = state.nodes.find((n) => n.id === tableId)
        if (node) {
          node.data = { table }
        }
        saveHistoryState(state)
      }),

    updateField: (tableId, fieldId, updater) =>
      set((state) => {
        if (!state.schema) return
        const table = state.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        const field = table.fields.find((f) => f.id === fieldId)
        if (!field) return
        updater(field)
        const node = state.nodes.find((n) => n.id === tableId)
        if (node) {
          node.data = { table }
        }
        saveHistoryState(state)
      }),

    removeField: (tableId, fieldId) =>
      set((state) => {
        if (!state.schema) return
        const table = state.schema.tables.find((t) => t.id === tableId)
        if (!table) return
        table.fields = table.fields.filter((f) => f.id !== fieldId)
        state.schema.relationships = state.schema.relationships.filter(
          (r) =>
            !(r.sourceTableId === tableId && r.sourceFieldId === fieldId) &&
            !(r.targetTableId === tableId && r.targetFieldId === fieldId),
        )
        state.edges = state.edges.filter(
          (e) =>
            !(e.source === tableId && e.sourceHandle === fieldId) &&
            !(e.target === tableId && e.targetHandle === fieldId),
        )
        state._adjacencyCache = buildAdjacency(state.edges)
        const node = state.nodes.find((n) => n.id === tableId)
        if (node) {
          node.data = { table }
        }
        saveHistoryState(state)
      }),

    addRelationship: (rel) =>
      set((state) => {
        if (!state.schema) return
        state.schema.relationships.push(rel)
        state.edges.push({
          id: rel.id,
          source: rel.sourceTableId,
          target: rel.targetTableId,
          sourceHandle: rel.sourceFieldId,
          targetHandle: rel.targetFieldId,
          type: 'relationship',
          data: { relationship: rel },
        })
        state._adjacencyCache = buildAdjacency(state.edges)
        saveHistoryState(state)
      }),

    removeRelationship: (relId) =>
      set((state) => {
        if (!state.schema) return
        state.schema.relationships = state.schema.relationships.filter((r) => r.id !== relId)
        state.edges = state.edges.filter((e) => e.id !== relId)
        state._adjacencyCache = buildAdjacency(state.edges)
        saveHistoryState(state)
      }),

    toggleTableVisibility: (tableId) =>
      set((state) => {
        const newSet = new Set(state.hiddenTableIds)
        if (newSet.has(tableId)) {
          newSet.delete(tableId)
        } else {
          newSet.add(tableId)
        }
        state.hiddenTableIds = newSet
        state.nodes = state.nodes.filter((n) => !newSet.has(n.id))
        state.edges = state.edges.filter(
          (e) => !newSet.has(e.source) && !newSet.has(e.target),
        )
        state._adjacencyCache = buildAdjacency(state.edges)
      }),

    setSelectedRelationshipId: (relId) =>
      set((state) => {
        state.selectedRelationshipId = relId
        if (!relId || !state.schema) {
          state.highlightedFields = null
          return
        }
        const rel = state.schema.relationships.find(r => r.id === relId)
        if (rel) {
          state.highlightedFields = {
            sourceFieldId: rel.sourceFieldId,
            targetFieldId: rel.targetFieldId,
            sourceTableId: rel.sourceTableId,
            targetTableId: rel.targetTableId,
          }
        } else {
          state.highlightedFields = null
        }
      }),

    clearSelectedRelationship: () =>
      set((state) => {
        state.selectedRelationshipId = null
        state.highlightedFields = null
      }),

    fetchDataSources: async () => {
      set({ dataSourcesLoading: true, dataSourcesError: null })
      try {
        const { data } = await listDataSources()
        set((state) => {
          state.dataSources = data
          state.dataSourcesLoading = false
        })
      } catch {
        set({ dataSourcesLoading: false, dataSourcesError: '无法加载数据源，请检查后端服务' })
      }
    },

    addDataSource: async (config) => {
      const state = get()
      if (state.dataSources.some((ds) => ds.name === config.name)) {
        throw new Error(`数据源名称 "${config.name}" 已存在`)
      }
      const { data } = await createDataSource(config)
      set((state) => {
        state.dataSources.push(data)
      })
    },

    updateDataSource: async (id, formData) => {
      const { data } = await updateDataSourceApi(id, formData)
      set((state) => {
        const idx = state.dataSources.findIndex((ds) => ds.id === id)
        if (idx !== -1) state.dataSources[idx] = data
      })
    },

    removeDataSource: async (id) => {
      await deleteDataSourceApi(id)
      set((state) => {
        state.dataSources = state.dataSources.filter((ds) => ds.id !== id)
        if (state.editingDataSourceId === id) {
          state.editingDataSourceId = null
        }
        if (state.selectedDataSourceId === id) {
          state.selectedDataSourceId = null
        }
      })
    },

    setDataSourceDialogOpen: (open) =>
      set((state) => {
        state.dataSourceDialogOpen = open
      }),

    setDataSourceDialogMode: (mode) =>
      set((state) => {
        state.dataSourceDialogMode = mode
      }),

    setEditingDataSourceId: (id) =>
      set((state) => {
        state.editingDataSourceId = id
      }),

    setSelectedDataSourceId: (id) =>
      set((state) => {
        state.selectedDataSourceId = id
      }),

    setHoveredFields: (fields) =>
      set((state) => {
        state.hoveredFields = fields
      }),

    setRelationshipChainDepth: (depth) =>
      set((state) => {
        state.relationshipChainDepth = Math.max(0, Math.min(5, depth))
      }),

    setHoveredFieldEdgeIds: (ids) =>
      set((state) => {
        state.hoveredFieldEdgeIds = ids
      }),

    setClickedField: (field) =>
      set((state) => {
        state.clickedField = field
      }),

    _rebuildAdjacency: () =>
      set((state) => {
        state._adjacencyCache = buildAdjacency(state.edges)
      }),

    updateRelationship: (relId, updater) =>
      set((state) => {
        if (!state.schema) return
        const rel = state.schema.relationships.find(r => r.id === relId)
        if (!rel) return
        updater(rel)
        const edge = state.edges.find(e => e.id === relId)
        if (edge) {
          edge.data = { relationship: { ...rel } }
          edge.sourceHandle = rel.sourceFieldId
          edge.targetHandle = rel.targetFieldId
        }
        saveHistoryState(state)
      }),

    /* ---- CanvaTree ---- */

    _addDefaultRoot: () => {
      const rootId = 'local_root'
      const now = Date.now()
      set((state) => {
        if (state.canvaTree.some((n) => n.id === rootId)) return
        state.canvaTree.push({
          id: rootId,
          name: '默认文件夹',
          parentId: null,
          type: 'folder',
          schemaData: null,
          position: 0,
          createdAt: now,
          updatedAt: now,
        })
      })
    },

    fetchCanvaTree: async () => {
      set({ canvaTreeLoading: true, canvaTreeError: null })
      try {
        const tree = await listCanvaTree()
        set((state) => {
          state.canvaTree = tree
          state.canvaTreeLoading = false
        })
        _persistCanvaTree(tree)
        if (tree.length === 0) {
          get()._addDefaultRoot()
        }
      } catch {
        const local = _loadCanvaTree()
        if (local && local.length > 0) {
          set((state) => {
            state.canvaTree = local
            state.canvaTreeLoading = false
          })
        } else {
          set({ canvaTreeLoading: false, canvaTreeError: null })
          get()._addDefaultRoot()
        }
      }
    },

    createCanvaNode: async (data) => {
      const state = get()
      if (isNameTaken(state.canvaTree, data.name, data.parentId)) {
        throw new Error(`名称 "${data.name}" 已被同级节点使用`)
      }
      try {
        const node = await createCanvaNode({
          name: data.name,
          parent_id: data.parentId ?? null,
          type: data.type ?? 'canvas',
        })
        set((state) => {
          state.canvaTree.push({ ...node })
          _persistCanvaTree(state.canvaTree)
        })
        return { ...node }
      } catch (err) {
        if (err instanceof Error && err.message.includes('已被同级节点使用')) throw err
        const localId = `local_${generateId()}`
        const now = Date.now()
        const node: CanvaNode = {
          id: localId,
          name: data.name,
          parentId: data.parentId ?? null,
          type: data.type === 'folder' ? 'folder' : 'canvas',
          schemaData: null,
          position: 0,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => {
          state.canvaTree.push({ ...node })
          _persistCanvaTree(state.canvaTree)
        })
        return { ...node }
      }
    },

    updateCanvaNode: async (id, data) => {
      if (data.name !== undefined) {
        const state = get()
        const node = state.canvaTree.find((n) => n.id === id)
        if (node && isNameTaken(state.canvaTree, data.name, node.parentId, id)) {
          throw new Error(`名称 "${data.name}" 已被同级节点使用`)
        }
      }
      try {
        const payload: Record<string, unknown> = {}
        if (data.name !== undefined) payload.name = data.name
        if (data.schemaData !== undefined) payload.schema_data = data.schemaData
        const updated = await updateCanvaNode(id, payload)
        if (!updated) return null
        set((state) => {
          const idx = state.canvaTree.findIndex((n) => n.id === id)
          if (idx !== -1) {
            state.canvaTree[idx] = { ...state.canvaTree[idx], ...updated }
          }
          _persistCanvaTree(state.canvaTree)
        })
        return { ...updated }
      } catch (err) {
        if (err instanceof Error && err.message.includes('已被同级节点使用')) throw err
        const localUpdate: Partial<CanvaNode> = {}
        if (data.name !== undefined) localUpdate.name = data.name
        if (data.schemaData !== undefined) localUpdate.schemaData = data.schemaData
        if (Object.keys(localUpdate).length > 0) {
          set((state) => {
            const idx = state.canvaTree.findIndex((n) => n.id === id)
            if (idx !== -1) {
              Object.assign(state.canvaTree[idx], localUpdate)
            }
            _persistCanvaTree(state.canvaTree)
          })
        }
        return null
      }
    },

    deleteCanvaNode: async (id) => {
      if (id === 'local_root') return
      try {
        await deleteCanvaNode(id)
      } catch {
        // local-only delete
      }
      set((state) => {
        const idsToRemove = new Set<string>([id])
        state.canvaTree
          .filter((n) => n.parentId === id)
          .forEach((n) => idsToRemove.add(n.id))
        state.canvaTree = state.canvaTree.filter((n) => !idsToRemove.has(n.id))
        _persistCanvaTree(state.canvaTree)
        if (state.currentCanvasId && idsToRemove.has(state.currentCanvasId)) {
          state.currentCanvasId = null
          state.schema = null
          state.nodes = []
          state.edges = []
          state._adjacencyCache = new Map()
        }
      })
    },

    switchCanvas: async (canvasId) => {
      const { canvaTree, currentCanvasId } = get()
      if (currentCanvasId && currentCanvasId !== canvasId) {
        await get().saveCurrentCanvas()
      }
      const node = canvaTree.find((n) => n.id === canvasId)
      if (!node || node.type !== 'canvas') {
        set((state) => {
          state.schema = null
          state.nodes = []
          state.edges = []
          state.currentCanvasId = null
          state.selectedTableId = null
          state._adjacencyCache = new Map()
        })
        return
      }
      const schemaData = node.schemaData || _loadSchemaData(canvasId)
      if (schemaData) {
        get().loadSchemaFromData(schemaData)
      } else {
        const newSchema: ERSchema = {
          id: canvasId,
          name: node.name,
          tables: [],
          relationships: [],
        }
        set((state) => {
          state.schema = newSchema
          state.nodes = []
          state.edges = []
          state.currentCanvasId = canvasId
          state.selectedTableId = null
          state._adjacencyCache = new Map()
          saveHistoryState(state)
        })
      }
      set((state) => { state.currentCanvasId = canvasId })
      // 空画布自动弹出导入弹窗
      const s = get().schema
      if (s && s.tables.length === 0) {
        get().setImportDialogOpen(true)
      }
    },

    serializeSchema: () => {
      const state = get()
      const data = {
        schema: state.schema,
        nodes: state.nodes,
        edges: state.edges,
        diagramStyle: state.diagramStyle,
        hiddenTableIds: [...state.hiddenTableIds],
      }
      return JSON.stringify(data)
    },

    loadSchemaFromData: (schemaData) => {
      try {
        const data = JSON.parse(schemaData)
        // Validate basic structure
        if (!data || typeof data !== 'object') {
          console.error('Invalid schema data format')
          return
        }
        if (data.schema && (!data.schema.tables || !Array.isArray(data.schema.tables))) {
          data.schema.tables = []
        }
        if (data.schema && (!data.schema.relationships || !Array.isArray(data.schema.relationships))) {
          data.schema.relationships = []
        }
        if (!Array.isArray(data.hiddenTableIds)) {
          data.hiddenTableIds = []
        }
        set((state) => {
          state.schema = data.schema ?? null
          state.nodes = Array.isArray(data.nodes) ? data.nodes : []
          state.edges = Array.isArray(data.edges) ? data.edges : []
          if (data.diagramStyle) state.diagramStyle = data.diagramStyle
          state.hiddenTableIds = new Set(data.hiddenTableIds)
          state._adjacencyCache = buildAdjacency(state.edges)
          state.selectedTableId = null
        })
      } catch (e) {
        console.error('Failed to load canvas data:', e)
      }
    },

    saveCurrentCanvas: async () => {
      const state = get()
      const canvasId = state.currentCanvasId
      if (!canvasId || !state.schema) return
      const serialized = state.serializeSchema()
      _persistSchemaData(canvasId, serialized)
      try {
        await get().updateCanvaNode(canvasId, { schemaData: serialized })
      } catch (e) {
        console.error('Failed to save canvas:', e)
      }
    },
  })),
)

function saveHistoryState(state: ERState): void {
  if (state._restoringFromHistory) {
    state._restoringFromHistory = false
    return
  }
  const snapshot: HistorySnapshot = {
    schema: state.schema,
    nodes: state.nodes,
    edges: state.edges,
  }
  // 截断未来历史
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }
  state.history.push(snapshot)
  state.historyIndex++
  if (state.history.length > MAX_HISTORY) {
    state.history.shift()
    state.historyIndex--
  }
}

/**
 * 根据搜索词和选中状态，获取需要高亮的表 ID 集合。
 */
export function useHighlightedTableIds(): Set<string> {
  const schema = useERStore((state) => state.schema)
  const searchQuery = useERStore((state) => state.searchQuery)
  const selectedTableId = useERStore((state) => state.selectedTableId)

  return useMemo(() => {
    const highlighted = new Set<string>()
    if (!schema) return highlighted

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      for (const table of schema.tables) {
        if (table.name.toLowerCase().includes(query)) {
          highlighted.add(table.id)
        }
      }
    }

    if (selectedTableId) {
      highlighted.add(selectedTableId)
    }

    return highlighted
  }, [schema, searchQuery, selectedTableId])
}

/**
 * 获取与选中表存在关系的关联表 ID。
 */
export function useRelatedTableIds(): Set<string> {
  const schema = useERStore((state) => state.schema)
  const selectedTableId = useERStore((state) => state.selectedTableId)

  return useMemo(() => {
    const related = new Set<string>()
    if (!schema || !selectedTableId) return related

    for (const rel of schema.relationships) {
      if (rel.sourceTableId === selectedTableId) {
        related.add(rel.targetTableId)
      } else if (rel.targetTableId === selectedTableId) {
        related.add(rel.sourceTableId)
      }
    }

    return related
  }, [schema, selectedTableId])
}



let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// 仅在 schema 变化时自动保存
const _unsubscribeAutoSave = useERStore.subscribe((state, prevState) => {
  if (state.schema !== prevState.schema && state.currentCanvasId && state.schema) {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
    _autoSaveTimer = setTimeout(() => {
      useERStore.getState().saveCurrentCanvas()
    }, 800)
  }
})

// HMR 热更新时清理自动保存订阅和定时器
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
    _autoSaveTimer = null
    _unsubscribeAutoSave()
  })
}
