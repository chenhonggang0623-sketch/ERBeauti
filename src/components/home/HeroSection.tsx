import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { HeroParticles } from './HeroParticles'
import { TypewriterText } from './TypewriterText'

const TYPEWRITER_TEXTS = [
  '粘贴 SQL · 导入 DBML · 连接数据库 → 一键美化',
]

const floatingNodes = [
  { label: 'users', fields: ['id PK', 'name', 'email'], x: '15%', y: '20%', color: 'indigo', delay: 0 },
  { label: 'orders', fields: ['id PK', 'user_id FK', 'total'], x: '78%', y: '15%', color: 'violet', delay: 2 },
  { label: 'products', fields: ['id PK', 'name', 'price'], x: '10%', y: '65%', color: 'cyan', delay: 4 },
  { label: 'reviews', fields: ['id PK', 'rating', 'content'], x: '82%', y: '70%', color: 'amber', delay: 1 },
]

const nodeColorMap: Record<string, { border: string; bg: string; text: string }> = {
  indigo: { border: 'border-indigo-500/40', bg: 'bg-indigo-500/8', text: 'text-indigo-300' },
  violet: { border: 'border-violet-500/40', bg: 'bg-violet-500/8', text: 'text-violet-300' },
  cyan: { border: 'border-cyan-500/40', bg: 'bg-cyan-500/8', text: 'text-cyan-300' },
  amber: { border: 'border-amber-500/40', bg: 'bg-amber-500/8', text: 'text-amber-300' },
}

function FloatingNode({ node }: { node: typeof floatingNodes[number] }) {
  const c = nodeColorMap[node.color]
  return (
    <motion.div
      className={cn(
        'pointer-events-none absolute hidden rounded-xl border bg-black/20 p-3 backdrop-blur-md sm:block',
        c.border, c.bg,
      )}
      style={{ left: node.x, top: node.y }}
      animate={{
        y: [0, -12, 0],
        x: [0, 6, 0],
        opacity: [0.4, 0.7, 0.4],
      }}
      transition={{
        duration: 6 + node.delay,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: node.delay,
      }}
    >
      <div className={cn('mb-1 text-[11px] font-semibold tracking-wide', c.text)}>
        {node.label}
      </div>
      <div className="space-y-0.5 text-[9px] text-neutral-500">
        {node.fields.map((f) => (
          <div key={f}>{f}</div>
        ))}
      </div>
    </motion.div>
  )
}

export function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <section
      ref={ref}
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#0a0a0b]"
    >
      <HeroParticles />

      {/* Animated gradient orb */}
      <motion.div
        className="pointer-events-none absolute h-[600px] w-[600px] rounded-full opacity-40 blur-[120px] sm:h-[800px] sm:w-[800px]"
        style={{
          background:
            'conic-gradient(from 0deg, #6366f1, #a855f7, #06b6d4, #6366f1)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="pointer-events-none absolute h-[400px] w-[400px] rounded-full opacity-30 blur-[100px] sm:h-[500px] sm:w-[500px]"
        style={{
          background:
            'radial-gradient(circle, #a855f7 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0b]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />

      {/* Floating ER nodes */}
      {floatingNodes.map((node) => (
        <FloatingNode key={node.label} node={node} />
      ))}

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
<motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mb-2 bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl"
        >
          从 SQL 到美图
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mb-6"
        >
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-6xl font-bold tracking-tight text-transparent sm:text-7xl">
            3 秒
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mb-10 text-lg text-neutral-400 sm:text-xl"
        >
          <TypewriterText texts={TYPEWRITER_TEXTS} />
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          className="relative inline-flex"
        >
          {/* Glow ring behind button */}
          <motion.span
            className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-indigo-600/40 via-violet-600/40 to-cyan-600/40 blur-xl"
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Link
            to="/editor"
            className={cn(
              'group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl',
              'bg-gradient-to-r from-indigo-600 to-violet-600 px-12 py-5',
              'text-xl font-semibold text-white',
              'shadow-2xl shadow-indigo-600/30',
              'transition-all duration-300 hover:shadow-indigo-600/50 hover:shadow-2xl',
              'hover:scale-105 active:scale-[1.02]',
            )}
          >
            {/* Shine sweep */}
            <span className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            开始美化
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
