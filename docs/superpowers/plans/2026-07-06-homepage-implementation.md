# Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-themed premium homepage with ER-particle animation background, feature showcase, before/after demo, and CTA — routed at `/` with existing editor at `/editor`.

**Architecture:** SPA with `react-router-dom` v7. Homepage uses `motion` for scroll-triggered animations and a `<canvas>`-based particle system for the hero background. All new code under `src/pages/` and `src/components/home/`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 3, motion (framer-motion), react-router-dom 7, lucide-react.

## Global Constraints

- Dark theme only for homepage (`bg-[#0a0a0b]` base, no theme toggle needed on homepage)
- All homepage components use `cn()` from `@/utils/cn`
- Particle canvas: pure 2D Canvas API, no WebGL libs
- Link to editor: `<Link to="/editor">`
- No `TBD` or `TODO` in final code

---

### Task 1: Install Dependency & Setup Routing

**Files:**
- Modify: `package.json`
- Create: `src/pages/EditorPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: existing App content (to be moved into EditorPage)
- Produces: routing shell with `"/"` → HomePage, `"/editor"` → EditorPage

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

- [ ] **Step 2: Create EditorPage.tsx**

Move entire current App.tsx content into EditorPage.

```tsx
import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { StatusBar } from '@/components/StatusBar'
import { ImportDialog } from '@/components/ImportDialog'
import { DataSourceDialog } from '@/components/DataSourceDialog'
import { ExportDialog } from '@/components/export/ExportDialog'
import { TableEditDialog } from '@/components/dialogs/TableEditDialog'
import { RelationshipDialog } from '@/components/dialogs/RelationshipDialog'
import { ERFlow } from '@/components/ERFlow'
import { Toaster } from '@/components/ui/Toaster'
import { ContextMenu } from '@/components/common/ContextMenu'
import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useERStore } from '@/store/erStore'

export default function EditorPage() {
  const theme = useERStore((state) => state.theme)

  useKeyboardShortcuts()

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="relative flex flex-1 flex-col overflow-hidden">
            <ERFlow />
            <StatusBar />
          </main>
        </div>
        <ImportDialog />
        <DataSourceDialog />
        <ExportDialog />
        <TableEditDialog />
        <RelationshipDialog />
        <ContextMenu />
        <CommandPalette />
        <Toaster />
      </div>
    </ReactFlowProvider>
  )
}
```

- [ ] **Step 3: Convert App.tsx to router shell**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from '@/pages/HomePage'
import EditorPage from '@/pages/EditorPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Simplify main.tsx**

Remove `enableMapSet` import since it's only needed by editor (EditorPage handles it).

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Note: `enableMapSet()` is called inside `erStore.ts`'s zustand store setup, so EditorPage will still work. No need to keep it in main.tsx.

- [ ] **Step 5: Verify routing works**

```bash
npm run dev
```

Open http://localhost:5173 — should show blank homepage (HomePage not yet built). Navigate to http://localhost:5173/editor — should show the existing editor.

---

### Task 2: Create Particle System Hook (`useDataParticles`)

**Files:**
- Create: `src/hooks/useDataParticles.ts`

**Interfaces:**
- Consumes: `canvasRef: RefObject<HTMLCanvasElement | null>`
- Produces: particle animation on canvas, mouse interaction

- [ ] **Step 1: Create the hook**

```tsx
import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number; y: number
  vx: number; vy: number
  radius: number
  color: string
  phase: number
}

const COLORS = ['#6366f1', '#a855f7', '#06b6d4']
const PARTICLE_COUNT = 80
const CONNECTION_DIST = 150
const MOUSE_RADIUS = 200

export function useDataParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)

  const initParticles = useCallback((w: number, h: number) => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2 + 1.5,
      color: COLORS[i % COLORS.length],
      phase: Math.random() * Math.PI * 2,
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
      initParticles(window.innerWidth, window.innerHeight)
    }

    const onMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouse)
    document.addEventListener('mouseleave', onMouseLeave)

    const animate = (time: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      const particles = particlesRef.current
      const mouse = mouseRef.current

      for (const p of particles) {
        p.x += p.vx + Math.sin(time * 0.001 + p.phase) * 0.1
        p.y += p.vy + Math.cos(time * 0.001 + p.phase) * 0.1

        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const mouseInfluence = Math.max(0, 1 - dist / MOUSE_RADIUS)
        if (mouseInfluence > 0) {
          p.x -= dx * mouseInfluence * 0.02
          p.y -= dy * mouseInfluence * 0.02
        }
      }

      ctx.beginPath()
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.3
            ctx.strokeStyle = `rgba(99,102,241,${alpha})`
            ctx.lineWidth = 0.5
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
        const glow = Math.max(1, 1 + (1 - Math.min(1, dist / MOUSE_RADIUS)) * 2)

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * glow, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [canvasRef, initParticles])

  return particlesRef
}
```

---

### Task 3: Create TypewriterText Component

**Files:**
- Create: `src/components/home/TypewriterText.tsx`

**Interfaces:**
- Consumes: `texts: string[]`
- Produces: `<span>` with typewriter animation cycling through texts

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from 'react'

interface TypewriterTextProps {
  texts: string[]
  className?: string
}

export function TypewriterText({ texts, className = '' }: TypewriterTextProps) {
  const [textIndex, setTextIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = texts[textIndex]
    let timeout: ReturnType<typeof setTimeout>

    if (!deleting && charIndex < current.length) {
      timeout = setTimeout(() => setCharIndex((c) => c + 1), 60)
    } else if (!deleting && charIndex === current.length) {
      timeout = setTimeout(() => setDeleting(true), 2000)
    } else if (deleting && charIndex > 0) {
      timeout = setTimeout(() => setCharIndex((c) => c - 1), 30)
    } else if (deleting && charIndex === 0) {
      setDeleting(false)
      setTextIndex((i) => (i + 1) % texts.length)
    }

    return () => clearTimeout(timeout)
  }, [charIndex, deleting, textIndex, texts])

  return (
    <span className={className}>
      {texts[textIndex].slice(0, charIndex)}
      <span className="animate-pulse text-indigo-400">|</span>
    </span>
  )
}
```

---

### Task 4: Create HeroSection (Canvas Particles + Overlay)

**Files:**
- Create: `src/components/home/HeroSection.tsx`
- Create: `src/components/home/HeroParticles.tsx`

**Interfaces:**
- Consumes: `useDataParticles` hook, `TypewriterText` component
- Produces: full-viewport hero with dark background, particle canvas, title, subtitle, CTA button

- [ ] **Step 1: Create HeroParticles.tsx**

```tsx
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
```

- [ ] **Step 2: Create HeroSection.tsx**

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { HeroParticles } from './HeroParticles'
import { TypewriterText } from './TypewriterText'

const TYPEWRITER_TEXTS = [
  '粘贴 SQL · 导入 DBML · 连接数据库 → 一键美化',
]

export function HeroSection() {
  return (
    <section className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0a0a0b]">
      <HeroParticles />

      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0b]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-neutral-400 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          AI-Powered ER Diagram Generator
        </div>

        <h1 className="mb-6 bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl">
          从 SQL 到美图
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            3 秒
          </span>
        </h1>

        <p className="mb-10 text-lg text-neutral-400 sm:text-xl">
          <TypewriterText texts={TYPEWRITER_TEXTS} />
        </p>

        <Link
          to="/editor"
          className={cn(
            'group inline-flex items-center gap-3 rounded-xl',
            'bg-gradient-to-r from-indigo-600 to-violet-600 px-10 py-4',
            'text-lg font-semibold text-white shadow-lg shadow-indigo-600/25',
            'transition-all duration-300 hover:shadow-indigo-600/40 hover:shadow-xl',
            'hover:scale-105 active:scale-[1.02]',
          )}
        >
          开始美化
          <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  )
}
```

---

### Task 5: Create FeatureCards Component

**Files:**
- Create: `src/components/home/FeatureCards.tsx`

**Interfaces:**
- Produces: 3 feature cards with staggered scroll animation, glassmorphism styling

- [ ] **Step 1: Create FeatureCards.tsx**

```tsx
import { useRef } from 'react'
import { motion, useInView } from 'motion'
import { FileCode2, Wand2, Download } from 'lucide-react'
import { cn } from '@/utils/cn'

const features = [
  {
    icon: FileCode2,
    title: '多格式导入',
    description: 'SQL · DBML · Prisma',
    detail: '粘贴或导入任意格式，智能解析为结构化模型',
  },
  {
    icon: Wand2,
    title: '一键美化',
    description: 'AI 布局 + 多风格',
    detail: '一键自动排列，支持表样式和 Chen 式 ER 图切换',
  },
  {
    icon: Download,
    title: '多端导出',
    description: 'SVG · PNG · SQL',
    detail: '高清导出，嵌入文档、演示或直接分享',
  },
]

export function FeatureCards() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className="relative bg-[#0a0a0b] px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold text-white">
            强大能力，极致简单
          </h2>
          <p className="text-lg text-neutral-400">
            从输入到输出，每一步都为你优化
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 * i }}
              className={cn(
                'group relative overflow-hidden rounded-2xl',
                'border border-white/10 bg-white/[0.03] p-8',
                'backdrop-blur-xl transition-all duration-500',
                'hover:border-white/20 hover:bg-white/[0.06]',
                'hover:shadow-[0_0_40px_rgba(99,102,241,0.1)]',
              )}
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 ring-1 ring-white/10 transition-all duration-500 group-hover:scale-110 group-hover:from-indigo-500/30 group-hover:to-violet-500/30">
                <f.icon className="h-6 w-6 text-indigo-400 transition-all duration-500 group-hover:rotate-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">{f.title}</h3>
              <p className="mb-3 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-sm font-medium text-transparent">
                {f.description}
              </p>
              <p className="text-sm leading-relaxed text-neutral-500">{f.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

---

### Task 6: Create HowItWorks Component

**Files:**
- Create: `src/components/home/HowItWorks.tsx`

**Interfaces:**
- Produces: 3 steps with connecting dotted line and animated flow dot

- [ ] **Step 1: Create HowItWorks.tsx**

```tsx
import { useRef, useEffect, useState } from 'react'
import { motion, useInView } from 'motion'
import { Terminal, Sparkles, Share2 } from 'lucide-react'
import { cn } from '@/utils/cn'

const steps = [
  { icon: Terminal, title: '输入', desc: '粘贴 SQL / 导入文件 / 连接数据库' },
  { icon: Sparkles, title: '美化', desc: 'AI 自动布局，拖拽微调' },
  { icon: Share2, title: '分享', desc: '导出 SVG/PNG，嵌入文档' },
]

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!inView) return
    let start: number | null = null
    const dur = 3000
    const loop = (t: number) => {
      if (!start) start = t
      setProgress(((t - start) % dur) / dur)
      raf = requestAnimationFrame(loop)
    }
    let raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [inView])

  return (
    <section className="relative bg-[#0a0a0b] px-6 py-32">
      <div className="mx-auto max-w-5xl" ref={ref}>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-20 text-center text-4xl font-bold text-white"
        >
          三步出图
        </motion.h2>

        <div className="relative flex items-start justify-between">
          {/* Connecting line */}
          <svg
            className="pointer-events-none absolute left-0 right-0 top-10 h-px"
            viewBox="0 0 100 1"
            preserveAspectRatio="none"
          >
            <line x1="0" y1="0.5" x2="100" y2="0.5" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx={progress * 100} cy="0.5" r="2" fill="#6366f1" />
          </svg>

          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 * i }}
              className="relative flex flex-col items-center text-center"
              style={{ width: '30%' }}
            >
              <div className="relative z-10 mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-500 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]">
                <s.icon className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{s.title}</h3>
              <p className="text-sm text-neutral-500">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

---

### Task 7: Create Showcase Component

**Files:**
- Create: `src/components/home/Showcase.tsx`

**Interfaces:**
- Produces: before/after comparison slider + image gallery

- [ ] **Step 1: Create Showcase.tsx**

```tsx
import { useRef, useState } from 'react'
import { motion, useInView } from 'motion'
import { ArrowLeftRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Showcase() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [sliderPos, setSliderPos] = useState(50)

  const handleSlider = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    setSliderPos(Math.max(0, Math.min(100, (x / rect.width) * 100)))
  }

  return (
    <section ref={ref} className="relative bg-[#0a0a0b] px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center text-4xl font-bold text-white"
        >
          看看效果
        </motion.h2>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Before/After slider — spans 3 cols */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative col-span-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
          >
            <div
              className="relative h-80 cursor-ew-resize select-none overflow-hidden"
              onPointerMove={handleSlider}
              onPointerDown={handleSlider}
            >
              {/* Before (SQL) */}
              <div className="absolute inset-0 bg-[#1e1e2e] p-6 font-mono text-sm leading-relaxed text-neutral-400">
                <div className="mb-2 text-xs text-neutral-600">-- raw.sql</div>
                {'CREATE TABLE users (\n  id INT PRIMARY KEY,\n  name VARCHAR(100),\n  email VARCHAR(255)\n);\n\nCREATE TABLE orders (\n  id INT PRIMARY KEY,\n  user_id INT REFERENCES users(id),\n  total DECIMAL(10,2)\n);'}
              </div>
              {/* After (ER diagram via clip) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPos}%` }}
              >
                <div className="h-full bg-gradient-to-br from-indigo-900/40 via-violet-900/40 to-cyan-900/40 p-6">
                  <div className="mb-2 text-xs text-indigo-400">-- ERBeauti</div>
                  <div className="flex h-full items-center justify-center gap-8">
                    {/* Mock ER diagram nodes */}
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 backdrop-blur-sm">
                      <div className="mb-2 text-xs font-semibold text-indigo-300">users</div>
                      <div className="space-y-1 text-[10px] text-neutral-400">
                        <div className="flex gap-2"><span className="w-1 rounded bg-amber-500" />id INT <span className="text-amber-500">PK</span></div>
                        <div>name VARCHAR</div>
                        <div>email VARCHAR</div>
                      </div>
                    </div>
                    <div className="text-indigo-500/50">───</div>
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 backdrop-blur-sm">
                      <div className="mb-2 text-xs font-semibold text-violet-300">orders</div>
                      <div className="space-y-1 text-[10px] text-neutral-400">
                        <div className="flex gap-2"><span className="w-1 rounded bg-amber-500" />id INT <span className="text-amber-500">PK</span></div>
                        <div className="flex gap-2"><span className="w-1 rounded bg-cyan-500" />user_id INT <span className="text-cyan-500">FK</span></div>
                        <div>total DECIMAL</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Slider handle */}
              <div
                className="absolute top-0 h-full w-0.5 bg-white/50 shadow-lg"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-600 p-2">
                  <ArrowLeftRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
            <div className="flex justify-between border-t border-white/10 px-6 py-3 text-sm">
              <span className="text-neutral-500">原始 SQL</span>
              <span className="text-indigo-400">ERBeauti 美化</span>
            </div>
          </motion.div>

          {/* Gallery — 2 cols */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="col-span-2 flex flex-col gap-4"
          >
            {[
              { label: '电商数据库', sub: '12 表 · 16 关系', gradient: 'from-blue-900/30 to-indigo-900/30' },
              { label: '社交平台', sub: '8 表 · 10 关系', gradient: 'from-violet-900/30 to-purple-900/30' },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex h-[9.5rem] flex-col justify-end rounded-2xl border border-white/10 p-6',
                  'bg-gradient-to-br transition-all duration-500',
                  'hover:border-white/20 hover:shadow-[0_0_40px_rgba(99,102,241,0.1)]',
                  item.gradient,
                )}
              >
                <h3 className="text-lg font-semibold text-white">{item.label}</h3>
                <p className="text-sm text-neutral-500">{item.sub}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
```

---

### Task 8: Create CTA Section + Footer

**Files:**
- Create: `src/components/home/CTASection.tsx`
- Create: `src/components/home/HomeFooter.tsx`

**Interfaces:**
- Produces: CTA section with pulse glow button, and footer

- [ ] **Step 1: Create CTASection.tsx**

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export function CTASection() {
  return (
    <section className="relative overflow-hidden px-6 py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-600/20 via-violet-600/20 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl">
          准备好美化你的数据了吗？
        </h2>
        <p className="mb-10 text-lg text-neutral-400">
          无需注册，粘贴即用
        </p>
        <Link
          to="/editor"
          className={cn(
            'group relative inline-flex items-center gap-3 rounded-xl',
            'bg-gradient-to-r from-indigo-600 to-violet-600 px-10 py-4',
            'text-lg font-semibold text-white',
            'shadow-lg shadow-indigo-600/25',
            'transition-all duration-300 hover:shadow-indigo-600/40 hover:shadow-xl',
            'hover:scale-105 active:scale-[1.02]',
            'animate-pulse-glow',
          )}
        >
          免费开始使用
          <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create HomeFooter.tsx**

```tsx
import { FileCode2, Github } from 'lucide-react'

export function HomeFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0a0b] px-6 py-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <FileCode2 className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold text-white">ERBeauti</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-neutral-500">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-neutral-300"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
          <span>&copy; {new Date().getFullYear()} ERBeauti</span>
        </div>
      </div>
    </footer>
  )
}
```

---

### Task 9: Compose HomePage

**Files:**
- Create: `src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: HeroSection, FeatureCards, HowItWorks, Showcase, CTASection, HomeFooter
- Produces: full homepage page

- [ ] **Step 1: Create HomePage.tsx**

```tsx
import { HeroSection } from '@/components/home/HeroSection'
import { FeatureCards } from '@/components/home/FeatureCards'
import { HowItWorks } from '@/components/home/HowItWorks'
import { Showcase } from '@/components/home/Showcase'
import { CTASection } from '@/components/home/CTASection'
import { HomeFooter } from '@/components/home/HomeFooter'

export default function HomePage() {
  return (
    <div className="bg-[#0a0a0b]">
      <HeroSection />
      <FeatureCards />
      <HowItWorks />
      <Showcase />
      <CTASection />
      <HomeFooter />
    </div>
  )
}
```

---

### Task 10: Add Pulse Glow Animation to index.css and Verify Build

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add pulse-glow keyframe to index.css**

```css
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(99,102,241,0.3), 0 0 40px rgba(99,102,241,0.1);
  }
  50% {
    box-shadow: 0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(99,102,241,0.2);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

Expected: TypeScript compiles with no errors, Vite bundles successfully.

```bash
npm run lint
```

Expected: oxlint passes with no errors.

- [ ] **Step 3: Start dev server and do a visual check

```bash
npm run dev
```

Open http://localhost:5173 — verify:
- Hero particles render and respond to mouse
- Typewriter text cycles
- Feature cards animate in on scroll
- How it works steps show with flowing dot
- Before/after slider works
- CTA button has pulse glow
- Footer renders
- Click "开始美化" → navigates to /editor
