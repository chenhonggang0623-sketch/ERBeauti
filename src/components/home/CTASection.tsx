import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

export function CTASection() {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <section ref={ref} className="relative overflow-hidden px-6 py-40">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'linear-gradient(135deg, #0a0a0b 0%, #1a0a3e 30%, #0a1628 60%, #0a0a0b 100%)',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />

      {/* Glowing orbs */}
      <motion.div
        className="absolute -left-32 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full opacity-30 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-32 top-1/3 h-80 w-80 -translate-y-1/2 rounded-full opacity-30 blur-[100px]"
        style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-sm text-neutral-500 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            完全免费 · 无需注册
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          viewport={{ once: true }}
          className="mb-4 text-4xl font-bold text-white sm:text-5xl"
        >
          准备好美化你的数据了吗？
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
          className="mb-12 text-lg text-neutral-400"
        >
          粘贴即用，无需配置。从混乱 SQL 到优雅 ER 图，只需 3 秒。
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          viewport={{ once: true }}
          className="relative inline-flex"
        >
          {/* Glow ring */}
          <motion.span
            className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-indigo-600/30 via-violet-600/30 to-cyan-600/30 blur-2xl"
            animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Link
            to="/editor"
            className={cn(
              'group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl',
              'bg-gradient-to-r from-indigo-600 to-violet-600 px-14 py-5',
              'text-xl font-semibold text-white shadow-2xl shadow-indigo-600/30',
              'transition-all duration-300 hover:shadow-indigo-600/50 hover:shadow-2xl',
              'hover:scale-105 active:scale-[1.02]',
              'animate-pulse-glow',
            )}
          >
            <span className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <Sparkles className="h-5 w-5" />
            免费开始使用
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
