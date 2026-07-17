# ER 图布局与连线可视化优化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化 ER 图画布上表的排布，让关系连线清晰显示外键映射，一眼看出表之间的关系

**Architecture:** 增强 elkjs 后处理布局算法 + 增强 RelationshipEdge 组件显示字段映射 + 点击连线高亮字段和编辑

**Tech Stack:** React 19 + TypeScript + @xyflow/react + elkjs + zustand

## Global Constraints
- 保持 elkjs 分层布局作为基础，只增强后处理
- 不改动现有数据模型（ERSchema、ERField、ERRelationship）
- 不改动现有解析器逻辑
- 所有变更必须通过 `npm run build`（tsc 类型检查）
- 遵循现有代码风格（memo、useCallback、cn 工具类）

---

## Files Overview

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/layout/postProcess.ts` | 重写 | 自适应核心向心 + 方向聚类 + 碰撞检测 |
| `src/store/erStore.ts` | 修改 | 新增 selectedRelationshipId、highlightedFields 状态 |
| `src/components/canvas/MarkerDefs.tsx` | 修改 | 支持动态颜色（不再用 Tailwind 固定类，改为 props 传色） |
| `src/components/RelationshipEdge.tsx` | 重写 | 两行标签（类型+字段映射）、悬停高亮字段、点击事件 |
| `src/components/TableNode.tsx` | 修改 | 字段行根据 highlightedFields 高亮 |
| `src/components/ERFlow.tsx` | 修改 | 注册 onEdgeClick 处理 |
| `src/components/dialogs/RelationshipDialog.tsx` | 修改 | 支持编辑模式（预填现有关系数据） |

---

### Task 1: 增强后处理布局算法

**Files:**
- Modify: `src/layout/postProcess.ts`

**Interfaces:**
- Produces: `postProcessLayout(schema, nodes, options?)` — 与现有签名一致，options 新增 `collisionPadding` (default 30)

- [ ] **Step 1: 重写核心表向心力为自适应强度**

```typescript
// postProcess.ts 中替换核心表向心逻辑
const totalTables = nodes.length
const coreRefRatio = maxRefs / totalTables
let adaptiveStrength = centerPullStrength
if (coreRefRatio > 0.3) adaptiveStrength = 0.6
else if (coreRefRatio > 0.15) adaptiveStrength = 0.35
else adaptiveStrength = 0.12
```

- [ ] **Step 2: 新增方向感知聚类（替代无向聚类）**

```typescript
// 对每条关系：
// source 表往 target 表方向移动，力度 clusterStrength
// target 表往 source 表方向移动，力度 clusterStrength * 0.5（避免拉扯太远）
for (const rel of schema.relationships) {
  const source = processed.find(n => n.id === rel.sourceTableId)
  const target = processed.find(n => n.id === rel.targetTableId)
  if (!source || !target) continue
  const dx = target.position.x - source.position.x
  const dy = target.position.y - source.position.y
  source.position.x += dx * clusterStrength * 0.8
  source.position.y += dy * clusterStrength * 0.8
  target.position.x -= dx * clusterStrength * 0.4
  target.position.y -= dy * clusterStrength * 0.4
}
```

- [ ] **Step 3: 新增碰撞检测迭代分离**

```typescript
// 迭代最多 10 轮
for (let iteration = 0; iteration < 10; iteration++) {
  let hasCollision = false
  const nodeRects = processed.map(n => ({
    id: n.id,
    left: n.position.x,
    right: n.position.x + (n.width ?? 220),
    top: n.position.y,
    bottom: n.position.y + (n.height ?? 100),
  }))
  for (let i = 0; i < nodeRects.length; i++) {
    for (let j = i + 1; j < nodeRects.length; j++) {
      const a = nodeRects[i], b = nodeRects[j]
      const gapX = Math.max(a.left, b.left) - Math.min(a.right, b.right)
      const gapY = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)
      if (gapX < 30 && gapY < 30) {
        hasCollision = true
        const overlapX = 30 - gapX, overlapY = 30 - gapY
        if (overlapX < overlapY) {
          const sign = a.left < b.left ? -1 : 1
          processed.find(n => n.id === a.id)!.position.x += sign * overlapX * 0.5
          processed.find(n => n.id === b.id)!.position.x -= sign * overlapX * 0.5
        } else {
          const sign = a.top < b.top ? -1 : 1
          processed.find(n => n.id === a.id)!.position.y += sign * overlapY * 0.5
          processed.find(n => n.id === b.id)!.position.y -= sign * overlapY * 0.5
        }
      }
    }
  }
  if (!hasCollision) break
}
```

- [ ] **Step 4: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 2: Store 新增选中关系和字段高亮状态

**Files:**
- Modify: `src/store/erStore.ts`

**Interfaces:**
- Consumes: `ERRelationship` (from `@/types/er`)
- Produces: `selectedRelationshipId`, `highlightedFields`, `setSelectedRelationshipId`, `clearSelectedRelationship`

- [ ] **Step 1: 在 ERState interface 新增状态**

```typescript
// erStore.ts interface ERState 中新增
selectedRelationshipId: string | null
highlightedFields: {
  sourceFieldId: string
  targetFieldId: string
  sourceTableId: string
  targetTableId: string
} | null
```

- [ ] **Step 2: 在 store 初始值中新增**

```typescript
// create(...) 内部初始状态
selectedRelationshipId: null,
highlightedFields: null,
```

- [ ] **Step 3: 新增 setter 方法**

```typescript
setSelectedRelationshipId: (relId: string | null) =>
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
```

- [ ] **Step 4: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 3: MarkerDefs 动态颜色支持

**Files:**
- Modify: `src/components/canvas/MarkerDefs.tsx`

- [ ] **Step 1: 改写 MarkerDefs 接收 color prop**

```typescript
interface MarkerDefsProps {
  color?: string
}

export function MarkerDefs({ color = '#a3a3a3' }: MarkerDefsProps) {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        <marker
          id="er-marker-one"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          <line
            x1="5"
            y1="1.5"
            x2="5"
            y2="8.5"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </marker>
        <marker
          id="er-marker-many"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          <path
            d="M2.5 1.5 L8.5 5 L2.5 8.5"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    </svg>
  )
}
```

- [ ] **Step 2: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 4: RelationshipEdge 字段映射标签 + 悬停高亮 + 点击

**Files:**
- Modify: `src/components/RelationshipEdge.tsx`

- [ ] **Step 1: 从 store 获取 schema 和关系数据，构建字段映射标签**

```typescript
const schema = useERStore((state) => state.schema)
const setSelectedRelationshipId = useERStore((state) => state.setSelectedRelationshipId)
const selectedRelationshipId = useERStore((state) => state.selectedRelationshipId)

// 查找字段名
const sourceField = useMemo(() => {
  if (!schema || !relationship) return null
  const table = schema.tables.find(t => t.id === relationship.sourceTableId)
  return table?.fields.find(f => f.id === relationship.sourceFieldId) ?? null
}, [schema, relationship])

const targetField = useMemo(() => {
  if (!schema || !relationship) return null
  const table = schema.tables.find(t => t.id === relationship.targetTableId)
  return table?.fields.find(f => f.id === relationship.targetFieldId) ?? null
}, [schema, relationship])
```

- [ ] **Step 2: 在 `isActive` 检测中加入 selectedRelationshipId**

```typescript
const isSelected_rel = selectedRelationshipId === id
const isActive = selected || isHovered || isInChain || isSelected_rel
```

- [ ] **Step 3: 标签组件改为两行（类型 + 字段映射）**

```typescript
<EdgeLabelRenderer>
  <div
    className="pointer-events-auto absolute flex flex-col items-center gap-0.5 rounded-md border border-neutral-200/80 bg-white/90 px-2 py-1 shadow-sm backdrop-blur-sm transition-opacity duration-200 dark:border-neutral-700/80 dark:bg-neutral-900/90"
    style={{
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      opacity: isDimmed ? 0.3 : 1,
    }}
  >
    <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-300">
      {label}
    </span>
    {sourceField && targetField && (
      <span className="font-mono text-[9px] leading-tight">
        <span className="text-blue-600 dark:text-blue-400">{sourceField.name}</span>
        <span className="mx-0.5 text-neutral-400">→</span>
        <span className="text-amber-600 dark:text-amber-400">{targetField.name}</span>
      </span>
    )}
  </div>
</EdgeLabelRenderer>
```

- [ ] **Step 4: 添加 onClick 处理**

```typescript
const handleClick = useCallback(() => {
  if (relationship) {
    setSelectedRelationshipId(id)
  }
}, [id, relationship, setSelectedRelationshipId])

// 在 <g> 元素上添加
onClick={handleClick}
style={{ cursor: 'pointer' }}
```

- [ ] **Step 5: 更新 MarkerDefs 颜色跟随**

```typescript
// 将 <MarkerDefs /> 颜色改为跟随边色
// 在 ERFlow 中传递 (见 Task 6)，但在 RelationshipEdge 中标记使用动态 id 方案
// 使用自定义 marker URL 带有边色参数，或用 CSS variables
// 简化方案：为每个 marker 创建两个实例（灰/蓝），在激活/非激活间切换

// 在 MarkerDefs.tsx 中，生成两种颜色变体的 marker
// 或在 RelationshipEdge 中动态设置 markerStart/markerEnd URL
```

**简化方案：MarkerDefs 提供两套标记（灰/蓝），边根据 isActive 切换**

```typescript
// MarkerDefs.tsx 新增蓝色 markers
<marker id="er-marker-one-active" ... stroke="#3b82f6" />
<marker id="er-marker-many-active" ... stroke="#3b82f6" />

// RelationshipEdge.tsx 中切换
const activeMarker = isActive ? 'active' : ''
const { startMarker, endMarker } = useMemo(() => {
  const type = relationship?.type
  const suffix = isActive ? '-active' : ''
  if (type === '1:1') {
    return {
      startMarker: `url(#er-marker-one${suffix})`,
      endMarker: `url(#er-marker-one${suffix})`,
    }
  }
  // ... 同理
}, [relationship?.type, isActive])
```

- [ ] **Step 6: 悬停时向父级传递高亮字段信息**

```typescript
// onMouseEnter 时除了 setHoveredEdgeId，还要通过 store 传递
// 但 setHoveredEdgeId 已经计算 highlightChain，不够精确
// 新增：setHoveredFieldIds(sourceFieldId, targetFieldId, sourceTableId, targetTableId)
// 

// 简单方案：store 新增 hoveredFields 状态
hoveredFields: { sourceFieldId: string; targetFieldId: string; sourceTableId: string; targetTableId: string } | null
setHoveredFields: (fields: typeof hoveredFields) => void // onMouseEnter 时设置
// onMouseLeave 时清空
// TableNode 读取 hoveredFields 来高亮对应字段行
```

- [ ] **Step 7: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 5: TableNode 字段行高亮

**Files:**
- Modify: `src/components/TableNode.tsx`

- [ ] **Step 1: 从 store 读取高亮字段状态**

```typescript
const selectedRelationshipId = useERStore((state) => state.selectedRelationshipId)
const highlightedFields = useERStore((state) => state.highlightedFields)
// 新增悬停字段状态
const hoveredFields = useERStore((state) => (state as any).hoveredFields)
```

- [ ] **Step 2: 在字段行渲染中检查是否需要高亮**

```typescript
// 在 table.fields.map 内：
const fieldId = field.id
const isFieldHighlighted =
  (highlightedFields?.sourceFieldId === fieldId && highlightedFields?.sourceTableId === id) ||
  (highlightedFields?.targetFieldId === fieldId && highlightedFields?.targetTableId === id)

const isFieldHovered =
  (hoveredFields?.sourceFieldId === fieldId && hoveredFields?.sourceTableId === id) ||
  (hoveredFields?.targetFieldId === fieldId && hoveredFields?.targetTableId === id)

// 在 field row div 的 className 中：
isFieldHighlighted && 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20',
isFieldHovered && 'ring-2 ring-blue-300 bg-blue-50/80 dark:bg-blue-900/10',
```

- [ ] **Step 3: 字段高亮时显示箭头指示**

```typescript
// 在字段行右侧添加一个小箭头图标（高亮时）
{
  isFieldHighlighted && (
    <span className="shrink-0 text-[10px] text-blue-500">
      ←
    </span>
  )
}
```

- [ ] **Step 4: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 6: ERFlow 边点击处理

**Files:**
- Modify: `src/components/ERFlow.tsx`

- [ ] **Step 1: 注册 onEdgeClick**

```typescript
// ERFlow.tsx 中新增
const setSelectedRelationshipId = useERStore((state) => state.setSelectedRelationshipId)
const clearSelectedRelationship = useERStore((state) => state.clearSelectedRelationship)

const handleEdgeClick = useCallback(
  (_: React.MouseEvent, edge: Edge) => {
    setSelectedRelationshipId(edge.id)
  },
  [setSelectedRelationshipId],
)

const handlePaneClick = useCallback(() => {
  setSelectedTableId(null)
  clearSelectedRelationship()
  closeContextMenu()
}, [setSelectedTableId, clearSelectedRelationship, closeContextMenu])
```

- [ ] **Step 2: 在 ReactFlow 上注册 onEdgeClick**

```typescript
<ReactFlow
  ...
  onEdgeClick={handleEdgeClick}
  onEdgesChange={useCallback(() => {}, [])}
>
```

- [ ] **Step 3: 更新 MarkerDefs 传入颜色**

```typescript
// 不需要传色了，采用两套 marker 方案（灰/蓝）
// 保持现有 <MarkerDefs /> 不变
```

- [ ] **Step 4: 更新 MarkerDefs 添加蓝色变体**

Update `MarkerDefs.tsx` to add `-active` suffixed versions of markers. This was described in Task 4 Step 5.

```typescript
// 在现有 marker 定义后追加
<marker
  id="er-marker-one-active"
  viewBox="0 0 10 10"
  refX="9"
  refY="5"
  markerWidth="10"
  markerHeight="10"
  orient="auto-start-reverse"
>
  <line x1="5" y1="1.5" x2="5" y2="8.5" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
</marker>
<marker
  id="er-marker-many-active"
  viewBox="0 0 10 10"
  refX="9"
  refY="5"
  markerWidth="10"
  markerHeight="10"
  orient="auto-start-reverse"
>
  <path d="M2.5 1.5 L8.5 5 L2.5 8.5" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
</marker>
```

- [ ] **Step 5: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 7: RelationshipDialog 编辑模式

**Files:**
- Modify: `src/components/dialogs/RelationshipDialog.tsx`
- Modify: `src/store/erStore.ts`（新增 updateRelationship 方法）

- [ ] **Step 1: Store 新增 updateRelationship**

```typescript
// erStore.ts 中 ERState interface 新增
updateRelationship: (relId: string, updater: (rel: ERRelationship) => void) => void

// 实现
updateRelationship: (relId, updater) =>
  set((state) => {
    if (!state.schema) return
    const rel = state.schema.relationships.find(r => r.id === relId)
    if (!rel) return
    updater(rel)
    // 同步更新 edge
    const edge = state.edges.find(e => e.id === relId)
    if (edge) {
      edge.data = { relationship: { ...rel } }
      edge.sourceHandle = rel.sourceFieldId
      edge.targetHandle = rel.targetFieldId
    }
    saveHistoryState(state)
  }),
```

- [ ] **Step 2: RelationshipDialog 添加编辑模式**

```typescript
// 新增 props / store 读取
const selectedRelationshipId = useERStore((state) => state.selectedRelationshipId)
const updateRelationship = useERStore((state) => state.updateRelationship)

const editingRelationship = useMemo(() => {
  if (!selectedRelationshipId || !schema) return null
  return schema.relationships.find(r => r.id === selectedRelationshipId)
}, [selectedRelationshipId, schema])

// 对话框 title 根据编辑/新建切换
const isEditing = !!editingRelationship

useEffect(() => {
  if (!relationshipDialogOpen) return
  if (editingRelationship) {
    setSourceTableId(editingRelationship.sourceTableId)
    setSourceFieldId(editingRelationship.sourceFieldId)
    setTargetTableId(editingRelationship.targetTableId)
    setTargetFieldId(editingRelationship.targetFieldId)
    setRelationType(editingRelationship.type)
    return
  }
  // 现有初始化逻辑...
}, [relationshipDialogOpen, editingRelationship, schema])
```

- [ ] **Step 3: 保存按钮改为更新或新建**

```typescript
const handleSave = useCallback(() => {
  if (!sourceTableId || !sourceFieldId || !targetTableId || !targetFieldId) return
  if (isEditing && editingRelationship) {
    updateRelationship(editingRelationship.id, (rel) => {
      rel.sourceTableId = sourceTableId
      rel.sourceFieldId = sourceFieldId
      rel.targetTableId = targetTableId
      rel.targetFieldId = targetFieldId
      rel.type = relationType
    })
  } else {
    const rel: ERRelationship = {
      id: `rel_${Math.random().toString(36).slice(2, 9)}`,
      sourceTableId,
      sourceFieldId,
      targetTableId,
      targetFieldId,
      type: relationType,
    }
    addRelationship(rel)
  }
  setRelationshipDialogOpen(false)
  // 清除选中
  clearSelectedRelationship()
}, [/* deps */])
```

- [ ] **Step 4: 对话框标题动态**

```typescript
<h2 className="text-lg font-semibold">
  {isEditing ? '编辑关系' : '添加关系'}
</h2>
```

- [ ] **Step 5: 按钮文案动态**

```typescript
<Button variant="primary" size="sm" onClick={handleSave} disabled={!sourceFieldId || !targetFieldId}>
  <Link2 className="h-4 w-4" />
  {isEditing ? '保存修改' : '添加关系'}
</Button>
```

- [ ] **Step 6: 对话框关闭时清除选中关系**

```typescript
// 在 close handler 中
const handleClose = useCallback(() => {
  setRelationshipDialogOpen(false)
  clearSelectedRelationship()
}, [setRelationshipDialogOpen, clearSelectedRelationship])
```

- [ ] **Step 7: TypeScript 验证**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 8: 集成测试

- [ ] **Step 1: 运行完整构建**

```bash
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 2: 启动 dev server 做视觉验证**

```bash
npm run dev
```
Expected: Dev server starts, ER 图显示，布局更紧凑核心表居中，连线显示字段映射，点击连线高亮字段，双击连线弹出编辑对话框。
