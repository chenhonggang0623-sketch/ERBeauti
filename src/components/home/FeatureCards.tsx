import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { FileCode2, Wand2, Download } from 'lucide-react'
import { cn } from '@/utils/cn'

const features = [
  {
    icon: FileCode2,
    title: '多格式导入',
    description: 'SQL · DBML · Prisma',
    detail: '粘贴或导入任意格式，智能解析为结构化模型',
    gradient: 'from-indigo-500/20 to-indigo-500/5',
    borderGlow: 'group-hover:shadow-[0_0_60px_rgba(99,102,241,0.15)]',
  },
  {
    icon: Wand2,
    title: '一键美化',
    description: 'AI 布局 + 多风格',
    detail: '一键自动排列，支持表样式和 Chen 式 ER 图切换',
    gradient: 'from-violet-500/20 to-violet-500/5',
    borderGlow: 'group-hover:shadow-[0_0_60px_rgba(168,85,247,0.15)]',
  },
  {
    icon: Download,
    title: '多端导出',
    description: 'SVG · PNG · SQL',
    detail: '高清导出，嵌入文档、演示或直接分享',
    gradient: 'from-cyan-500/20 to-cyan-500/5',
    borderGlow: 'group-hover:shadow-[0_0_60px_rgba(6,182,212,0.15)]',
  },
]

export function FeatureCards() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className="relative bg-[#0a0a0b] px-6 py-32">
      {/* Section divider glow */}
      <div className="absolute left-1/2 top-0 h-px w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      <div className="mx-auto max-w-6xl" ref={ref}>
        <motion.div
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
                'border border-white/[0.08] bg-white/[0.02] p-8',
                'backdrop-blur-xl transition-all duration-500',
                'hover:border-white/[0.15] hover:bg-white/[0.04]',
                f.borderGlow,
              )}
            >
              <div
                className="pointer-events-none absolute -inset-[1px] animate-spin-slow rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    'conic-gradient(from var(--angle, 0deg), rgba(99,102,241,0.3), rgba(168,85,247,0.3), rgba(6,182,212,0.3), rgba(99,102,241,0.3))',
                  mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'xor',
                  padding: '1px',
                }}
              />

              {/* Icon with glow */}
              <div className="relative mb-6">
                <div
                  className={cn(
                    'absolute -inset-4 rounded-xl opacity-0 blur-2xl transition-opacity duration-500',
                    'group-hover:opacity-100',
                    i === 0 && 'bg-indigo-500/20',
                    i === 1 && 'bg-violet-500/20',
                    i === 2 && 'bg-cyan-500/20',
                  )}
                />
                <div className={cn(
                  'relative flex h-14 w-14 items-center justify-center rounded-2xl',
                  'bg-gradient-to-br ring-1 ring-white/[0.08]',
                  'transition-all duration-500 group-hover:scale-110 group-hover:ring-white/[0.15]',
                  f.gradient,
                )}
                >
                  <f.icon className="h-7 w-7 text-white/80 transition-all duration-500 group-hover:rotate-6 group-hover:text-white" />
                </div>
              </div>

              <h3 className="mb-2 text-xl font-semibold text-white">{f.title}</h3>
              <p className="mb-3 bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-sm font-medium text-transparent">
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
