import { useState, useRef, useEffect, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface TooltipProps {
  children: ReactNode
  content: string
  side?: 'top' | 'bottom'
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 组件卸载时清除未执行的定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 300)
  }
  const handleMouseLeave = () => {
    clearTimeout(timerRef.current)
    setShow(false)
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {show && (
        <div
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-white shadow-lg dark:bg-neutral-200 dark:text-neutral-900',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
