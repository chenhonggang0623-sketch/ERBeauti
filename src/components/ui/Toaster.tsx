import { Toaster as SonnerToaster } from 'sonner'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'

/**
 * 全局 Toast 容器，适配明暗主题并带状态图标前缀。
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      expand
      gap={8}
      toastOptions={{
        className:
          'border-neutral-200 bg-white text-neutral-900 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
      }}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
        error: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
        warning: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
        info: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      }}
    />
  )
}
