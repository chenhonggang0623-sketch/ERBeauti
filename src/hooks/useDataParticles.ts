import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  radius: number
  baseRadius: number
  color: string
  glowColor: string
  phase: number
  isStar: boolean
}

const COLORS = [
  { main: '#6366f1', glow: 'rgba(99,102,241,' },
  { main: '#a855f7', glow: 'rgba(168,85,247,' },
  { main: '#06b6d4', glow: 'rgba(6,182,212,' },
  { main: '#f59e0b', glow: 'rgba(245,158,11,' },
]
const PARTICLE_COUNT = 150
const CONNECTION_DIST = 200
const MOUSE_RADIUS = 250

export function useDataParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const timeRef = useRef(0)

  const initParticles = useCallback((w: number, h: number) => {
    const c = COLORS
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const color = c[i % c.length]
      const isStar = i < 8
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: isStar ? Math.random() * 3 + 3 : Math.random() * 2 + 1.5,
        baseRadius: isStar ? Math.random() * 3 + 3 : Math.random() * 2 + 1.5,
        color: color.main,
        glowColor: color.glow,
        phase: Math.random() * Math.PI * 2,
        isStar,
      }
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let disposed = false

    const resize = () => {
      if (disposed) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
      initParticles(window.innerWidth, window.innerHeight)
    }

    const onMouse = (e: MouseEvent) => {
      if (disposed) return
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseLeave = () => {
      if (disposed) return
      mouseRef.current = { x: -1000, y: -1000 }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouse, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave)

    const animate = (time: number) => {
      if (disposed) return
      try {
        timeRef.current = time
        const w = window.innerWidth
        const h = window.innerHeight
        ctx.clearRect(0, 0, w, h)

        const particles = particlesRef.current
        const mouse = mouseRef.current

        for (const p of particles) {
        p.x += p.vx + Math.sin(time * 0.0008 + p.phase) * 0.2
        p.y += p.vy + Math.cos(time * 0.0008 + p.phase) * 0.2

        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const mouseInfluence = Math.max(0, 1 - dist / MOUSE_RADIUS)
        if (mouseInfluence > 0) {
          p.x -= dx * mouseInfluence * 0.03
          p.y -= dy * mouseInfluence * 0.03
        }

        if (p.isStar) {
          p.radius = p.baseRadius + Math.sin(time * 0.003 + p.phase) * 1.5
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.25
            ctx.strokeStyle = `rgba(99,102,241,${alpha})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const glow = Math.max(1, 1 + (1 - Math.min(1, dist / MOUSE_RADIUS)) * 2.5)

        if (p.isStar) {
          ctx.beginPath()
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * glow * 3)
          grd.addColorStop(0, p.color)
          grd.addColorStop(0.3, `${p.glowColor}0.4)`)
          grd.addColorStop(1, `${p.glowColor}0)`)
          ctx.fillStyle = grd
          ctx.arc(p.x, p.y, p.radius * glow * 3, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * glow, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }

      } catch {
        // silent: skip frame on canvas error
      }
      if (!disposed) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      disposed = true
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [canvasRef, initParticles])

  return particlesRef
}
