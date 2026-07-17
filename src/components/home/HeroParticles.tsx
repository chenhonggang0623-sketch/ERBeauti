import { useRef } from 'react'
import { useDataParticles } from '@/hooks/useDataParticles'

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useDataParticles(canvasRef)

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
