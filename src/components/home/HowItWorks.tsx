import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { Terminal, Sparkles, Share2 } from 'lucide-react'
import { cn } from '@/utils/cn'

const steps = [
  { icon: Terminal, title: '输入', desc: '粘贴 SQL / 导入文件 / 连接数据库', num: '01' },
  { icon: Sparkles, title: '美化', desc: 'AI 自动布局，拖拽微调', num: '02' },
  { icon: Share2, title: '分享', desc: '导出 SVG/PNG，嵌入文档', num: '03' },
]

function FlowLine({ x1, x2, delay = 0, inView }: { x1: number; x2: number; delay?: number; inView: boolean }) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.8, delay: delay * 0.3 + 0.4 }}
    >
      <line
        x1={x1} y1="10"
        x2={x2} y2="10"
        stroke="url(#flowGrad)"
        strokeWidth="0.5"
        strokeLinecap="round"
        opacity={0.5}
      />
      <line
        x1={x1} y1="10"
        x2={x2} y2="10"
        stroke="url(#flowGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="6 12"
        opacity={0.9}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-36"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </line>
    </motion.g>
  )
}

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const x1 = 15
  const x2 = 50
  const x3 = 85

  return (
    <section className="relative bg-[#0a0a0b] px-6 py-32">
      <div className="absolute left-1/2 top-0 h-px w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

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
          <svg
            className="pointer-events-none absolute left-0 right-0 top-10 h-20 w-full overflow-visible"
            viewBox="0 0 100 20"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="40%" stopColor="#a855f7" stopOpacity={1} />
                <stop offset="70%" stopColor="#06b6d4" stopOpacity={1} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <FlowLine x1={x1} x2={x2} delay={0} inView={inView} />
            <FlowLine x1={x2} x2={x3} delay={1} inView={inView} />
          </svg>

          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 40, scale: 0.85 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{
                duration: 0.7,
                delay: 0.2 + 0.25 * i,
                ease: [0.25, 0.25, 0, 1],
              }}
              className="group relative flex flex-col items-center text-center"
              style={{ width: '30%' }}
            >
              <div className="relative z-10 mb-5">
                <motion.span
                  className="absolute -inset-3 rounded-full border border-violet-500/30"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: i * 0.6,
                    ease: 'easeInOut',
                  }}
                />
                <motion.span
                  className="absolute -inset-5 rounded-full border border-indigo-500/20"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 0, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.6 + 0.3,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  animate={inView ? {
                    y: [0, -6, 0],
                  } : {}}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.4,
                  }}
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-2xl',
                    'border border-white/[0.12] bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-xl',
                    'shadow-lg shadow-black/20',
                    'transition-all duration-500',
                    'group-hover:border-indigo-500/40 group-hover:shadow-[0_0_60px_rgba(99,102,241,0.3)]',
                    'group-hover:scale-110 group-hover:-rotate-3',
                  )}
                >
                  <motion.div
                    animate={inView ? {
                      rotate: [0, 5, 0, -5, 0],
                    } : {}}
                    transition={{
                      duration: 4 + i * 0.6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.5,
                    }}
                  >
                    <s.icon className="h-8 w-8 text-indigo-400 transition-transform duration-500 group-hover:scale-110" />
                  </motion.div>
                </motion.div>
              </div>

              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.35 + 0.25 * i }}
                className="mb-1.5 text-[11px] font-mono font-semibold tracking-[0.2em] text-neutral-600"
              >
                {s.num}
              </motion.span>

              <h3 className="mb-2 text-lg font-semibold text-white">{s.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
