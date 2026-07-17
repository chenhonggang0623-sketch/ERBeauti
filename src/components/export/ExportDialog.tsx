import { useState, useCallback, useEffect, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, FileCode2, Eye, Image, Copy, Download, Check, Terminal, Loader2, AlertCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { useERStore } from '@/store/erStore'
import { toast } from 'sonner'
import { downloadBlob, downloadFile } from '@/utils/download'

type ExportTab = 'sql' | 'svg' | 'png'

export function ExportDialog() {
  const { exportDialogOpen, setExportDialogOpen, setExporting, schema } = useERStore(
    useShallow((state) => ({
      exportDialogOpen: state.exportDialogOpen,
      setExportDialogOpen: state.setExportDialogOpen,
      setExporting: state.setExporting,
      schema: state.schema,
    })),
  )

  const [activeTab, setActiveTab] = useState<ExportTab>('sql')
  const [sqlContent, setSqlContent] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [pngBlobUrl, setPngBlobUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const svgBlobUrlRef = useRef<string | null>(null)
  const pngBlobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (exportDialogOpen && schema) {
      generateSQL().then(setSqlContent)
    }
    setCopied(false)
    setSvgContent(null)
    setPngBlobUrl(null)
    setImageError(null)
    return () => {
      if (svgBlobUrlRef.current) URL.revokeObjectURL(svgBlobUrlRef.current)
      if (pngBlobUrlRef.current) URL.revokeObjectURL(pngBlobUrlRef.current)
    }
  }, [exportDialogOpen, schema])

  const generateSQL = useCallback(async () => {
    if (!schema) return ''
    const { exportAsSQL } = await import('@/utils/export')
    return exportAsSQL(schema)
  }, [schema])

  const handleCopySQL = useCallback(async () => {
    const sql = sqlContent || await generateSQL()
    if (!sql) {
      toast.error('无 SQL 内容')
      return
    }
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    toast.success('已复制 SQL')
    setTimeout(() => setCopied(false), 2000)
  }, [sqlContent, generateSQL])

  const handleDownloadSQL = useCallback(async () => {
    const sql = sqlContent || await generateSQL()
    if (!sql) {
      toast.error('无 SQL 内容')
      return
    }
    downloadFile(sql, 'erbeauti_schema.sql', 'text/sql')
    toast.success('已导出 SQL 文件')
  }, [sqlContent, generateSQL])

  const generateSvgPreview = useCallback(async () => {
    if (!document.querySelector('.react-flow')) {
      setImageError('未找到画布')
      return
    }
    setExporting(true)
    setImageLoading(true)
    setImageError(null)
    try {
      const { exportAsSvgXml } = await import('@/utils/svgExport')
      const svg = await exportAsSvgXml()
      setSvgContent(svg)
    } catch {
      setImageError('SVG 生成失败')
    } finally {
      setImageLoading(false)
      setExporting(false)
    }
  }, [setExporting])

  const generatePngPreview = useCallback(async () => {
    if (!document.querySelector('.react-flow')) {
      setImageError('未找到画布')
      return
    }
    setExporting(true)
    setImageLoading(true)
    setImageError(null)
    try {
      const { exportAsPngBlob } = await import('@/utils/svgExport')
      const blob = await exportAsPngBlob()
      if (pngBlobUrlRef.current) URL.revokeObjectURL(pngBlobUrlRef.current)
      const url = URL.createObjectURL(blob)
      pngBlobUrlRef.current = url
      setPngBlobUrl(url)
    } catch {
      setImageError('PNG 生成失败')
    } finally {
      setImageLoading(false)
      setExporting(false)
    }
  }, [setExporting])

  const handleDownloadSvg = useCallback(async () => {
    if (!document.querySelector('.react-flow')) {
      toast.error('未找到画布')
      return
    }
    setExporting(true)
    try {
      if (svgContent) {
        downloadFile(svgContent, 'erbeauti_schema.svg', 'image/svg+xml')
      } else {
        const { exportAsSvgXml } = await import('@/utils/svgExport')
        const svg = await exportAsSvgXml()
        downloadFile(svg, 'erbeauti_schema.svg', 'image/svg+xml')
      }
      toast.success('已导出 SVG')
    } catch {
      toast.error('SVG 导出失败')
    } finally {
      setExporting(false)
    }
  }, [svgContent, setExporting])

  const handleDownloadPng = useCallback(async () => {
    if (!document.querySelector('.react-flow')) {
      toast.error('未找到画布')
      return
    }
    setExporting(true)
    try {
      if (pngBlobUrl) {
        const blob = await fetch(pngBlobUrl).then(r => r.blob())
        downloadBlob(blob, 'erbeauti_schema.png')
      } else {
        const { exportAsPngBlob } = await import('@/utils/svgExport')
        const blob = await exportAsPngBlob()
        downloadBlob(blob, 'erbeauti_schema.png')
      }
      toast.success('已导出 PNG')
    } catch {
      toast.error('PNG 导出失败')
    } finally {
      setExporting(false)
    }
  }, [pngBlobUrl, setExporting])

  const handleTabChange = useCallback(async (tab: ExportTab) => {
    setActiveTab(tab)
    setImageError(null)
    if (tab === 'sql') {
      generateSQL().then(setSqlContent)
    } else if (tab === 'svg' && !svgContent && !imageLoading) {
      generateSvgPreview()
    } else if (tab === 'png' && !pngBlobUrl && !imageLoading) {
      generatePngPreview()
    }
  }, [generateSQL, generateSvgPreview, generatePngPreview, svgContent, pngBlobUrl, imageLoading])

  if (!exportDialogOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex w-full max-w-2xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-700">
          <h2 className="text-lg font-semibold">导出</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExportDialogOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 border-b border-neutral-200 px-5 dark:border-neutral-700">
          {([{ key: 'sql' as const, label: 'SQL', icon: Terminal },
            { key: 'svg' as const, label: 'SVG', icon: Eye },
            { key: 'png' as const, label: 'PNG', icon: Image },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:hover:border-neutral-600 dark:hover:text-neutral-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="relative">
                <pre className="max-h-80 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-relaxed dark:border-neutral-700 dark:bg-neutral-900/50">
                  <code>{sqlContent || '正在生成 SQL...'}</code>
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySQL}
                  className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? '已复制' : '复制 SQL'}
                </button>
                <button
                  onClick={handleDownloadSQL}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  导出文件
                </button>
              </div>
            </div>
          )}

          {activeTab === 'svg' && (
            <div className="space-y-3">
              {imageLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">正在生成 SVG 预览...</span>
                </div>
              )}
              {imageError && !imageLoading && (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-400">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-400">{imageError}</p>
                </div>
              )}
              {svgContent && !imageLoading && (
                <>
                  <div className="overflow-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
                    <object
                      data={`data:image/svg+xml,${encodeURIComponent(svgContent)}`}
                      type="image/svg+xml"
                      className="max-h-80 w-full"
                      aria-label="SVG 预览"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadSvg}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      下载 SVG
                    </button>
                  </div>
                </>
              )}
              {!svgContent && !imageLoading && !imageError && (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-400">
                  <FileCode2 className="h-8 w-8" />
                  <p className="text-sm">点击标签生成预览</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'png' && (
            <div className="space-y-3">
              {imageLoading && (
                <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">正在生成 PNG 预览...</span>
                </div>
              )}
              {imageError && !imageLoading && (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-400">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-400">{imageError}</p>
                </div>
              )}
              {pngBlobUrl && !imageLoading && (
                <>
                  <div className="overflow-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
                    <img
                      src={pngBlobUrl}
                      alt="PNG 预览"
                      className="max-h-80 w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadPng}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      下载 PNG
                    </button>
                  </div>
                </>
              )}
              {!pngBlobUrl && !imageLoading && !imageError && (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-400">
                  <Image className="h-8 w-8" />
                  <p className="text-sm">点击标签生成预览</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
