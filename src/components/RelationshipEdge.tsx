import { memo, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  BaseEdge,
  EdgeProps,
  Edge,
  getSmoothStepPath,
} from '@xyflow/react'
import type { RFRelationshipEdgeData, ElkPoint } from '@/types/er'
import { useERStore } from '@/store/erStore'
import { useViewportLOD } from '@/hooks/useViewportLOD'
import { buildPathFromSections, interpolateSectionsWithNodeDeltas } from '@/layout/path-routing'

/** 自定义关系边类型 */
type RelationshipEdgeType = Edge<RFRelationshipEdgeData, 'relationship'>

/**
 * 关系边组件：使用平滑正交路径，在线上显示关系类型，
 * 并在 hover 时高亮整条关系链，附带发光与流动动画。
 */
export const RelationshipEdge = memo(function RelationshipEdge(
  props: EdgeProps<RelationshipEdgeType>,
) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props

  const {
    hoveredEdgeId,
    highlightedChainEdgeIds,
    selectedRelationshipId,
    hoveredFieldEdgeIds,
    clickedField,
    schema,
    diagramStyle,
  } = useERStore(useShallow((state) => ({
    hoveredEdgeId: state.hoveredEdgeId,
    highlightedChainEdgeIds: state.highlightedChainEdgeIds,
    selectedRelationshipId: state.selectedRelationshipId,
    hoveredFieldEdgeIds: state.hoveredFieldEdgeIds,
    clickedField: state.clickedField,
    schema: state.schema,
    diagramStyle: state.diagramStyle,
  })))

  // Action functions via getState — stable refs, no subscription cost
  const { setHoveredEdgeId, setSelectedRelationshipId, setHoveredFields } = useERStore.getState()
  const lod = useViewportLOD()

  const { path: edgePath, centerX, centerY } = useMemo(() => {
    if (diagramStyle === 'chen') {
      const [path, cx, cy] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 8,
      })
      return { path, centerX: cx, centerY: cy }
    }
    if (data?.sections && data.sections.length > 0) {
      const first = data.sections[0]
      const last = data.sections[data.sections.length - 1]
      const sourceDelta: ElkPoint = {
        x: sourceX - first.startPoint.x,
        y: sourceY - first.startPoint.y,
      }
      const targetDelta: ElkPoint = {
        x: targetX - last.endPoint.x,
        y: targetY - last.endPoint.y,
      }
      if (Math.abs(sourceDelta.x) < 0.5 && Math.abs(sourceDelta.y) < 0.5 &&
          Math.abs(targetDelta.x) < 0.5 && Math.abs(targetDelta.y) < 0.5) {
        const p = buildPathFromSections(data.sections, data.lane)
        return { path: p.path, centerX: 0, centerY: 0 }
      }
      const interpolated = interpolateSectionsWithNodeDeltas(data.sections, sourceDelta, targetDelta)
      const p = buildPathFromSections(interpolated, data.lane)
      return { path: p.path, centerX: 0, centerY: 0 }
    }
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12,
    })
    return { path, centerX: 0, centerY: 0 }
  }, [diagramStyle, data, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition])

  const relationship = data?.relationship

  const diamondLabel = relationship?.name || relationship?.type || ''
  const diamondSize = useMemo(() => {
    if (!relationship) return 16
    const label = relationship.name || relationship.type
    const textWidth = label.length * 7
    return Math.max(16, Math.ceil(textWidth / 2 + 8))
  }, [relationship])

  const sourceTable = useMemo(() => {
    if (!schema || !relationship) return null
    return schema.tables.find(t => t.id === relationship.sourceTableId) ?? null
  }, [schema, relationship])

  const targetTable = useMemo(() => {
    if (!schema || !relationship) return null
    return schema.tables.find(t => t.id === relationship.targetTableId) ?? null
  }, [schema, relationship])

  const sourceField = useMemo(() => {
    if (!sourceTable) return null
    return sourceTable.fields.find(f => f.id === relationship?.sourceFieldId) ?? null
  }, [sourceTable, relationship])

  const targetField = useMemo(() => {
    if (!targetTable) return null
    return targetTable.fields.find(f => f.id === relationship?.targetFieldId) ?? null
  }, [targetTable, relationship])

  const isHovered = hoveredEdgeId === id
  const isInChain = highlightedChainEdgeIds.has(id)
  const isSelected_rel = selectedRelationshipId === id
  const isFieldLinked = hoveredFieldEdgeIds.has(id)
  const isFieldClicked = !!(
    clickedField && relationship &&
    ((clickedField.tableId === relationship.sourceTableId && clickedField.fieldId === relationship.sourceFieldId) ||
     (clickedField.tableId === relationship.targetTableId && clickedField.fieldId === relationship.targetFieldId))
  )

  let isActive: boolean
  let isDimmed: boolean
  if (clickedField) {
    isActive = isFieldClicked
    isDimmed = !isFieldClicked
  } else if (hoveredFieldEdgeIds.size > 0) {
    isActive = isFieldLinked
    isDimmed = !isFieldLinked
  } else {
    isActive = selected || isHovered || isInChain || isSelected_rel
    isDimmed = highlightedChainEdgeIds.size > 0 && !isInChain && !isSelected_rel
  }

  const { startMarker, endMarker } = useMemo(() => {
    const type = relationship?.type
    const suffix = isActive ? '-active' : ''
    if (type === '1:1') {
      return { startMarker: `url(#er-marker-one${suffix})`, endMarker: `url(#er-marker-one${suffix})` }
    }
    if (type === '1:N' || type === 'N:1') {
      const isSourceMany = type === 'N:1'
      return {
        startMarker: isSourceMany ? `url(#er-marker-many${suffix})` : `url(#er-marker-one${suffix})`,
        endMarker: isSourceMany ? `url(#er-marker-one${suffix})` : `url(#er-marker-many${suffix})`,
      }
    }
    return { startMarker: `url(#er-marker-many${suffix})`, endMarker: `url(#er-marker-many${suffix})` }
  }, [relationship?.type, isActive])

  const handleMouseEnter = useCallback(() => {
    setHoveredEdgeId(id)
    if (sourceField && targetField && relationship) {
      setHoveredFields({
        sourceFieldId: relationship.sourceFieldId,
        targetFieldId: relationship.targetFieldId,
        sourceTableId: relationship.sourceTableId,
        targetTableId: relationship.targetTableId,
      })
    }
  }, [id, setHoveredEdgeId, sourceField, targetField, relationship, setHoveredFields])

  const handleMouseLeave = useCallback(() => {
    setHoveredEdgeId(null)
    setHoveredFields(null)
  }, [setHoveredEdgeId, setHoveredFields])

  return (
    <g
      className="transition-opacity duration-200"
      style={{ opacity: isDimmed ? 0.2 : 1, cursor: 'pointer' }}
      onClick={() => setSelectedRelationshipId(id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isActive && lod === 'full' && (
        <path
          d={edgePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={3}
          strokeOpacity={0.12}
          className="pointer-events-none"
          style={{ filter: 'blur(2px)' }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={diagramStyle === 'chen' ? undefined : startMarker}
        markerEnd={diagramStyle === 'chen' ? undefined : endMarker}
        className={isActive ? 'er-edge-active' : ''}
        style={{
          strokeWidth: lod === 'minimal' ? 1 : isActive ? 2.5 : 2,
          stroke: isActive ? '#3b82f6' : lod === 'minimal' ? '#d4d4d4' : '#a3a3a3',
          transition: 'stroke 200ms ease, stroke-width 200ms ease',
        }}
      />

      {diagramStyle === 'chen' && relationship && (
        <g>
          <polygon
            points={`
              ${centerX},${centerY - diamondSize}
              ${centerX + diamondSize},${centerY}
              ${centerX},${centerY + diamondSize}
              ${centerX - diamondSize},${centerY}
            `}
            fill={isActive ? '#3b82f6' : '#ffffff'}
            stroke={isActive ? '#3b82f6' : '#a3a3a3'}
            strokeWidth={1.5}
            className="transition-colors duration-200"
          />
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="central"
            fill={isActive ? '#ffffff' : '#525252'}
            fontSize={Math.min(11, diamondSize - 4)}
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {diamondLabel}
          </text>
          {(() => {
            const dx = targetX - sourceX
            const dy = targetY - sourceY
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const perpX = -dy / len * 14
            const perpY = dx / len * 14
            const srcX = sourceX + dx * 0.15 + perpX
            const srcY = sourceY + dy * 0.15 + perpY
            const tgtX = targetX - dx * 0.15 + perpX
            const tgtY = targetY - dy * 0.15 + perpY
            const type = relationship.type
            const srcCard = type === '1:1' ? '1' : type === '1:N' ? '1' : type === 'N:1' ? 'N' : 'M'
            const tgtCard = type === '1:1' ? '1' : type === '1:N' ? 'N' : type === 'N:1' ? '1' : 'N'
            return (
              <>
                <text
                  x={srcX}
                  y={srcY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? '#3b82f6' : '#737373'}
                  fontSize={12}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {srcCard}
                </text>
                <text
                  x={tgtX}
                  y={tgtY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? '#3b82f6' : '#737373'}
                  fontSize={12}
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {tgtCard}
                </text>
              </>
            )
          })()}
        </g>
      )}
    </g>
  )
})
