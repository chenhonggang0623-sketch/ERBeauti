import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useStore,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler, type EdgeMouseHandler,
} from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'

import { TableNode } from '@/components/TableNode'
import { ChenEntityNode } from '@/components/ChenEntityNode'
import { ChenAttributeNode } from '@/components/ChenAttributeNode'
import { RelationshipEdge } from '@/components/RelationshipEdge'
import { RelatedTablesOverlay } from '@/components/RelatedTablesOverlay'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { MarkerDefs } from '@/components/canvas/MarkerDefs'
import { useERStore } from '@/store/erStore'
import { cn } from '@/utils/cn'

const nodeTypes: NodeTypes = {
  table: TableNode,
  'chen-entity': ChenEntityNode,
  'chen-attribute': ChenAttributeNode,
}

const edgeTypes: EdgeTypes = {
  relationship: RelationshipEdge,
}

/**
 * 监听 React Flow 缩放并同步到全局 store。
 */
function ZoomListener({ onZoom }: { onZoom: (zoom: number) => void }) {
  const zoom = useStore((s) => s.transform[2])
  useEffect(() => {
    onZoom(zoom)
  }, [zoom, onZoom])
  return null
}

/**
 * ER 图画布组件。
 * 负责渲染 React Flow 节点/边，监听缩放、右键菜单、空格拖拽平移，并在 schema 变化时自动 fitView。
 */
export function ERFlow() {
  const { nodes, edges, selectedTableId, setSelectedTableId, layoutLoading, exporting, setZoom, setContextMenu, closeContextMenu, onNodesChange, clearSelectedRelationship, setSelectedRelationshipId, setRelationshipDialogOpen, setClickedField } = useERStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      selectedTableId: state.selectedTableId,
      setSelectedTableId: state.setSelectedTableId,
      layoutLoading: state.layoutLoading,
      exporting: state.exporting,
      setZoom: state.setZoom,
      setContextMenu: state.setContextMenu,
      closeContextMenu: state.closeContextMenu,
      onNodesChange: state.onNodesChange,
      clearSelectedRelationship: state.clearSelectedRelationship,
      setSelectedRelationshipId: state.setSelectedRelationshipId,
      setRelationshipDialogOpen: state.setRelationshipDialogOpen,
      setClickedField: state.setClickedField,
    })),
  )

  const { fitView, setCenter } = useReactFlow()
  const fitViewCalledRef = useRef(false)
  const [spacePressed, setSpacePressed] = useState(false)

  // 监听外部命令：适应画布、聚焦节点
  useEffect(() => {
    const handleFitView = () => fitView({ padding: 0.2, duration: 400 })
    const handleFitViewInstant = () => fitView({ padding: 0.2, duration: 0 })
    const handleFocusNode = (event: CustomEvent<string>) => {
      const node = nodes.find((n) => n.id === event.detail)
      if (node) {
        setCenter(node.position.x + (node.width ?? 220) / 2, node.position.y + (node.height ?? 100) / 2, {
          zoom: 1,
          duration: 400,
        })
      }
    }
    window.addEventListener('erbeauti:fit-view', handleFitView)
    window.addEventListener('erbeauti:fit-view-instant', handleFitViewInstant)
    window.addEventListener('erbeauti:focus-node', handleFocusNode as EventListener)
    return () => {
      window.removeEventListener('erbeauti:fit-view', handleFitView)
      window.removeEventListener('erbeauti:fit-view-instant', handleFitViewInstant)
      window.removeEventListener('erbeauti:focus-node', handleFocusNode as EventListener)
    }
  }, [fitView, setCenter, nodes])

  // 首次加载节点时适应视图，之后不再触发（避免新增边导致视口跳动）
  useEffect(() => {
    if (nodes.length > 0 && !fitViewCalledRef.current) {
      const timer = requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 400 })
      })
      fitViewCalledRef.current = true
      return () => cancelAnimationFrame(timer)
    }
    if (nodes.length === 0) {
      fitViewCalledRef.current = false
    }
  }, [nodes])

  // 空格键按下时切换画布为 grab 模式，提示用户可以拖拽平移
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !spacePressed) {
        event.preventDefault()
        setSpacePressed(true)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpacePressed(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [spacePressed])

  // 点击画布空白处取消选中并关闭右键菜单
  const handlePaneClick = useCallback(() => {
    setSelectedTableId(null)
    clearSelectedRelationship()
    closeContextMenu()
    setClickedField(null)
  }, [setSelectedTableId, clearSelectedRelationship, closeContextMenu, setClickedField])

  // 节点右键菜单
  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        targetId: node.id,
      })
    },
    [setContextMenu],
  )

  // 画布空白处右键菜单
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const clientX = 'clientX' in event ? event.clientX : 0
      const clientY = 'clientY' in event ? event.clientY : 0
      setContextMenu({
        x: clientX,
        y: clientY,
        type: 'pane',
      })
    },
    [setContextMenu],
  )

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      setSelectedRelationshipId(edge.id)
      setRelationshipDialogOpen(true)
    },
    [setSelectedRelationshipId, setRelationshipDialogOpen],
  )

  const nodeColor = useCallback(
    (node: Node) => {
      return node.id === selectedTableId ? '#3b82f6' : '#9ca3af'
    },
    [selectedTableId],
  )

  return (
    <div
      className={cn(
        'relative flex-1',
        spacePressed && 'cursor-grab active:cursor-grabbing',
        !spacePressed && 'cursor-default',
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        attributionPosition="bottom-right"
        onNodesChange={onNodesChange}
        onEdgesChange={useCallback(() => {}, [])}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onEdgeClick={handleEdgeClick}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements={nodes.length > 30 && !exporting}
        minZoom={0.1}
        maxZoom={2}
        panOnDrag={!spacePressed ? [1, 2] : [0, 1, 2]}
        selectionOnDrag={spacePressed ? false : true}
      >
        <Background
          gap={20}
          size={1}
          color="#d4d4d4"
          className="dark:bg-neutral-950"
        />
        <Controls className="dark:bg-neutral-800 dark:text-neutral-100" />
        <MiniMap
          className="!bottom-12 !right-4 !h-32 !w-48 rounded-md border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
          nodeColor={nodeColor}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <MarkerDefs />
        <ZoomListener onZoom={setZoom} />
        <RelatedTablesOverlay />
      </ReactFlow>
      <LoadingOverlay visible={layoutLoading} />
    </div>
  )
}

