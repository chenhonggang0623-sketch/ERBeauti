# ER 图布局与关系连线可视化优化设计

## 1. 布局算法增强

### 当前问题
- `postProcess.ts` 中核心表向心强度固定 0.16（低），邻居聚类强度 0.05（微乎其微）
- 没有考虑关系方向性（source→target 流向）
- 无碰撞检测，表可能重叠
- 核心表不一定在视觉中心

### 改进方案

**1.1 自适应核心向心力**
- 被引用比例 = `referenceCount / totalTables`
- >30% → 强度 0.5~0.8，<10% → 0.1~0.2
- X/Y 双轴拉动 `(center - position) * adaptiveStrength`
- 核心表双倍强度

**1.2 方向感知聚类**
- source 表往 target 表的负方向拉，target 往正方向拉
- 强化从左到右阅读流向
- 多关系加权（关系越多拉力越强）

**1.3 碰撞检测 + 迭代分离**
- 布局后检查所有节点边界间距
- <30px 时逐步推开（最多 10 轮迭代）
- 保持 elkjs 分层结构基本不变

**1.4 画布自动居中**
- 布局完成后计算整体包围盒
- 核心表置于视口中心
- 自动 fitView

### 变更文件
- `src/layout/postProcess.ts` — 重写核心逻辑

---

## 2. 关系连线字段映射可视化

### 当前问题
- 连线标签只显示 `1:N` 等类型名
- 看不清哪个字段连哪个字段
- 悬停时只高亮表，不高亮具体字段行
- SVG 箭头标记颜色和连线状态不同步

### 改进方案

**2.1 连线标签增强**
- 改为两行：上行关系类型 + 下行 `源字段 → 目标字段`
- 源字段蓝色（FK），目标字段琥珀色（PK），等宽字体
- 白色半透明背景，防遮挡

**2.2 悬停高亮关联字段行**
- 鼠标移上连线 → 源表的 sourceField 行蓝色左边框 + 背景高亮
- 目标表的 targetField 行琥珀色左边框 + 背景高亮
- 非高先行透明度降低
- 通过 `sourceHandle`/`targetHandle` 匹配到具体行

**2.3 箭头标记色跟随**
- 标记改为使用 `stroke` 而非 `currentColor`
- 激活时变蓝，失活时灰
- 添加中间方向小箭头

**2.4 方向指示器增强**
- 连线路径中间增加方向箭头，不只依赖端点标记
- 清晰指示 source→target 流向

### 变更文件
- `src/components/RelationshipEdge.tsx` — 标签改为两行，悬停事件
- `src/components/TableNode.tsx` — 字段行悬停高亮
- `src/components/canvas/MarkerDefs.tsx` — 标记色跟随
- `src/store/erStore.ts` — 新增高亮字段状态

---

## 3. 点击连线交互

### 当前问题
- 连线无点击处理
- `onEdgesChange` 为空函数
- 没有点击高亮字段或编辑关系的能力

### 改进方案

**3.1 点击高亮关联字段**
- 点击连线 → `selectedRelationshipId` 设入 store
- TableNode 读取对应关系，高亮 sourceField 和 targetField 行
- 持续高亮直到点击空白或其他元素取消
- 使用脉冲动画强调关联字段

**3.2 点击弹出编辑对话框**
- 复用 `RelationshipDialog` 新增 `editingRelationshipId` 模式
- 编辑模式：预填现有关系数据，可修改类型和字段映射
- 保存后实时更新 store 和连线显示

**3.3 Store 状态新增**
```
selectedRelationshipId: string | null
highlightedFields: { sourceFieldId, targetFieldId, sourceTableId, targetTableId } | null
```

### 变更文件
- `src/store/erStore.ts` — 新增状态和方法
- `src/components/ERFlow.tsx` — 注册 edge click 处理
- `src/components/RelationshipEdge.tsx` — onClick 处理
- `src/components/TableNode.tsx` — 字段行高亮逻辑
- `src/components/dialogs/RelationshipDialog.tsx` — 编辑模式支持
