import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLocation } from 'react-router-dom'

import { Header } from '@/components/Header'
import { FileTree } from '@/components/FileTree'
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
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

export default function EditorPage() {
  const theme = useERStore((state) => state.theme)
  const setSampleSql = useERStore((state) => state.setSampleSql)
  const setImportDialogOpen = useERStore((state) => state.setImportDialogOpen)
  const fetchCanvaTree = useERStore((state) => state.fetchCanvaTree)
  const fetchDataSources = useERStore((state) => state.fetchDataSources)
  const canvaTree = useERStore((state) => state.canvaTree)
  const currentCanvasId = useERStore((state) => state.currentCanvasId)
  const switchCanvas = useERStore((state) => state.switchCanvas)
  const exporting = useERStore((state) => state.exporting)
  const location = useLocation()

  useKeyboardShortcuts()

  useEffect(() => {
    const state = location.state as { sampleSql?: string } | null
    if (state?.sampleSql) {
      setSampleSql(state.sampleSql)
      setImportDialogOpen(true)
      window.history.replaceState({}, document.title)
    }
  }, [])

  useEffect(() => {
    fetchCanvaTree()
    fetchDataSources()
  }, [fetchCanvaTree, fetchDataSources])

  useEffect(() => {
    if (!currentCanvasId && canvaTree.length > 0) {
      const firstCanvas = canvaTree.find((n) => n.type === 'canvas')
      if (firstCanvas) switchCanvas(firstCanvas.id)
    }
  }, [canvaTree, currentCanvasId, switchCanvas])

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
          <FileTree />
          <main className="relative flex flex-1 flex-col overflow-hidden">
            <ERFlow />
            <StatusBar />
            <LoadingOverlay visible={exporting} message="正在导出..." />
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
