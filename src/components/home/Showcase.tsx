import { useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { ArrowLeftRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'
import rawSamples from '@/data/samples.generated.json'

const samples = rawSamples.filter((s) => s.id !== 'erbeauti_sample')

const gradients = [
  'from-blue-900/30 to-indigo-900/30',
  'from-violet-900/30 to-purple-900/30',
  'from-emerald-900/30 to-teal-900/30',
  'from-amber-900/30 to-orange-900/30',
]

const tableColors = [
  'border-indigo-500/30 bg-indigo-500/10',
  'border-violet-500/30 bg-violet-500/10',
  'border-cyan-500/30 bg-cyan-500/10',
  'border-emerald-500/30 bg-emerald-500/10',
  'border-amber-500/30 bg-amber-500/10',
  'border-rose-500/30 bg-rose-500/10',
]

export function Showcase() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [sliderPos, setSliderPos] = useState(50)
  const navigate = useNavigate()

  const handleSlider = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    setSliderPos(Math.max(0, Math.min(100, (x / rect.width) * 100)))
  }

  return (
    <section ref={ref} className="relative bg-[#0a0a0b] px-6 py-32">
      <div className="absolute left-1/2 top-0 h-px w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

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
            className="relative col-span-3 overflow-hidden rounded-2xl border border-white/[0.08]"
          >
            <div
              className="relative h-80 cursor-ew-resize select-none overflow-hidden"
              onPointerMove={handleSlider}
              onPointerDown={handleSlider}
            >
              {/* Before (SQL) */}
              <div className="absolute inset-0 bg-[#1a1a2e] p-6 font-mono text-sm leading-relaxed text-neutral-500">
                <div className="mb-3 flex items-center gap-2 text-[11px] text-neutral-600">
                  <span className="h-3 w-3 rounded bg-red-500/50" />
                  <span className="h-3 w-3 rounded bg-yellow-500/50" />
                  <span className="h-3 w-3 rounded bg-green-500/50" />
                  <span className="ml-2 text-neutral-700">raw.sql</span>
                </div>
                <div className="space-y-1">
                  <div><span className="text-blue-400">CREATE TABLE</span> <span className="text-amber-400">users</span> (</div>
                  <div className="ml-4"><span className="text-red-400">id</span> <span className="text-purple-400">INT</span> <span className="text-emerald-400">PRIMARY KEY</span>,</div>
                  <div className="ml-4"><span className="text-red-400">name</span> <span className="text-purple-400">VARCHAR</span>(<span className="text-yellow-400">100</span>),</div>
                  <div className="ml-4"><span className="text-red-400">email</span> <span className="text-purple-400">VARCHAR</span>(<span className="text-yellow-400">255</span>)</div>
                  <div>);</div>
                  <div className="mt-3"><span className="text-blue-400">CREATE TABLE</span> <span className="text-amber-400">orders</span> (</div>
                  <div className="ml-4"><span className="text-red-400">id</span> <span className="text-purple-400">INT</span> <span className="text-emerald-400">PRIMARY KEY</span>,</div>
                  <div className="ml-4"><span className="text-red-400">user_id</span> <span className="text-purple-400">INT</span> <span className="text-blue-400">REFERENCES</span> <span className="text-amber-400">users</span>(<span className="text-red-400">id</span>),</div>
                  <div className="ml-4"><span className="text-red-400">total</span> <span className="text-purple-400">DECIMAL</span>(<span className="text-yellow-400">10</span>,<span className="text-yellow-400">2</span>)</div>
                  <div>);</div>
                </div>
              </div>

              {/* After (ER diagram via clip) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPos}%` }}
              >
                <div className="h-full bg-gradient-to-br from-[#0f0a1e] via-[#1a0a2e] to-[#0a1628] p-6">
                  <div className="mb-3 flex items-center gap-2 text-[11px]">
                    <span className="h-3 w-3 rounded bg-indigo-500/50" />
                    <span className="h-3 w-3 rounded bg-violet-500/50" />
                    <span className="h-3 w-3 rounded bg-cyan-500/50" />
                    <span className="ml-2 text-indigo-400">ERBeauti</span>
                  </div>
                  <div className="flex h-[calc(100%-2rem)] items-center justify-center gap-9">
                    {/* users table mock */}
                    <motion.div
                      className="rounded-xl border border-indigo-500/40 bg-indigo-500/[0.08] p-4 backdrop-blur-sm shadow-lg shadow-indigo-500/10"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <div className="mb-2 text-xs font-semibold tracking-wide text-indigo-300">📦 users</div>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-400" /><span className="text-neutral-400">id</span> <span className="text-amber-400">PK</span></div>
                        <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-neutral-600" /><span className="text-neutral-400">name</span></div>
                        <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-neutral-600" /><span className="text-neutral-400">email</span></div>
                      </div>
                    </motion.div>

                    {/* Connection line */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-px w-6 bg-gradient-to-r from-indigo-500/0 via-indigo-500/60 to-indigo-500/0" />
                      <motion.div
                        className="h-2 w-2 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50"
                        animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <div className="h-px w-6 bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0" />
                    </div>

                    {/* orders table mock */}
                    <motion.div
                      className="rounded-xl border border-violet-500/40 bg-violet-500/[0.08] p-4 backdrop-blur-sm shadow-lg shadow-violet-500/10"
                      animate={{ y: [0, 4, 0] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <div className="mb-2 text-xs font-semibold tracking-wide text-violet-300">📋 orders</div>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-amber-400" /><span className="text-neutral-400">id</span> <span className="text-amber-400">PK</span></div>
                        <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-cyan-400" /><span className="text-neutral-400">user_id</span> <span className="text-cyan-400">FK</span></div>
                        <div className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-neutral-600" /><span className="text-neutral-400">total</span></div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Slider handle */}
              <div
                className="absolute top-0 h-full w-0.5 shadow-2xl"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="h-full w-full bg-gradient-to-b from-indigo-500/80 via-violet-500/80 to-cyan-500/80" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 shadow-xl">
                  <ArrowLeftRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
            <div className="flex justify-between border-t border-white/[0.06] px-6 py-3 text-sm">
              <span className="text-neutral-500">原始 SQL</span>
              <motion.span
                className="text-indigo-400"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ERBeauti 美化
              </motion.span>
            </div>
          </motion.div>

          {/* Gallery — 2 cols */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="col-span-2 flex flex-col gap-4"
          >
            {samples.map((item, i) => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => navigate('/editor', {
                  state: { sampleSql: item.ddl, sampleId: item.id },
                })}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-white/[0.08] p-5 cursor-pointer',
                  'bg-gradient-to-br transition-all duration-500',
                  'hover:border-white/[0.15] hover:shadow-[0_0_40px_rgba(99,102,241,0.1)]',
                  gradients[i % gradients.length],
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">{item.name}</h3>
                    <p className="text-xs text-neutral-500">{item.summary}</p>
                  </div>
                  <motion.div
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-neutral-500"
                    whileHover={{ scale: 1.05 }}
                  >
                    → 查看
                  </motion.div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.tables.slice(0, 8).map((t) => (
                    <div
                      key={t.name}
                      className={cn(
                        'rounded-md border px-2 py-1 backdrop-blur-sm',
                        tableColors[(i + item.tables.indexOf(t)) % tableColors.length],
                      )}
                    >
                      <div className="text-[10px] font-medium text-white/70">{t.name}</div>
                      <div className="text-[9px] text-neutral-500">{t.fields} 字段</div>
                    </div>
                  ))}
                  {item.tables.length > 8 && (
                    <div className="flex items-center text-[10px] text-neutral-600">
                      +{item.tables.length - 8}
                    </div>
                  )}
                </div>
                {/* Hover glow */}
                <div className="pointer-events-none absolute -inset-20 rounded-full bg-indigo-500/5 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
