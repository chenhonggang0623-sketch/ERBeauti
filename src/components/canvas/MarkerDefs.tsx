import { memo } from 'react'

export const MarkerDefs = memo(function MarkerDefs() {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        <marker
          id="er-marker-one"
          viewBox="0 0 10 10"
          refX="5"
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
            stroke="#a3a3a3"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </marker>

        <marker
          id="er-marker-many"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          <path
            d="M2.5 1.5 L8.5 5 L2.5 8.5"
            fill="none"
            stroke="#a3a3a3"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>

        <marker
          id="er-marker-one-active"
          viewBox="0 0 10 10"
          refX="5"
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
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </marker>

        <marker
          id="er-marker-many-active"
          viewBox="0 0 10 10"
          refX="8.5"
          refY="5"
          markerWidth="10"
          markerHeight="10"
          orient="auto-start-reverse"
        >
          <path
            d="M2.5 1.5 L8.5 5 L2.5 8.5"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    </svg>
  )
})
