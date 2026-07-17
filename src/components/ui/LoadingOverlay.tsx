import { motion, AnimatePresence } from 'motion/react'
import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

/**
 * 居中加载遮罩，带淡入淡出动画与 subtle 网格背景。
 */
export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-white/50 backdrop-blur-md dark:bg-neutral-950/50"
        >
          {/* subtle 网格背景 */}
          <div
            className="absolute inset-0 opacity-30 dark:opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(#a3a3a3 1px, transparent 1px), linear-gradient(90deg, #a3a3a3 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)',
            }}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto relative flex flex-col items-center gap-3 rounded-xl border border-neutral-200/80 bg-white/90 px-6 py-5 shadow-xl backdrop-blur-sm dark:border-neutral-700/80 dark:bg-neutral-900/90"
          >
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {message || '正在计算布局...'}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
