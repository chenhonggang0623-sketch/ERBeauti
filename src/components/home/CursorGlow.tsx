import { useEffect, useRef } from 'react'

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed left-0 top-0 z-[9999] hidden h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.04] blur-[100px] sm:block"
      style={{
        background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)',
        transition: 'transform 0.15s ease-out',
      }}
      aria-hidden="true"
    />
  )
}
