import { memo } from 'react'
import { Upload, Layout, Download, Moon, Sun, FileCode2, Command, ChevronDown, Eye, Image, Database, Server, Box, Diamond, Save } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown'
import { useERStore } from '@/store/erStore'
import { useLayoutSchema } from '@/hooks/useLayoutSchema'
import type { ImportFormat } from '@/types/er'
import { toast } from 'sonner'
import { downloadBlob, downloadFile } from '@/utils/download'

/**
 * 顶栏组件：包含导入、布局、导出、主题切换等核心操作入口。
 */
export const Header = memo(function Header() {
  const {
    setImportDialogOpen,
    setImportDialogFormat,
    setDataSourceDialogOpen,
    setDataSourceDialogMode,
    layoutLoading,
    theme,
    toggleTheme,
    schema,
    diagramStyle,
    setDiagramStyle,
    setExportDialogOpen,
    currentCanvasId,
    saveCurrentCanvas,
  } = useERStore(
    useShallow((state) => ({
      setImportDialogOpen: state.setImportDialogOpen,
      setImportDialogFormat: state.setImportDialogFormat,
      setDataSourceDialogOpen: state.setDataSourceDialogOpen,
      setDataSourceDialogMode: state.setDataSourceDialogMode,
      layoutLoading: state.layoutLoading,
      theme: state.theme,
      toggleTheme: state.toggleTheme,
      schema: state.schema,
      diagramStyle: state.diagramStyle,
      setDiagramStyle: state.setDiagramStyle,
      setExportDialogOpen: state.setExportDialogOpen,
      currentCanvasId: state.currentCanvasId,
      saveCurrentCanvas: state.saveCurrentCanvas,
    })),
  )

  const openImportDialog = (format: ImportFormat) => {
    setImportDialogFormat(format)
    setImportDialogOpen(true)
  }

  const openDataSourceImport = () => {
    setDataSourceDialogMode('import')
    setDataSourceDialogOpen(true)
  }

  const openDataSourceManage = () => {
    setDataSourceDialogMode('list')
    setDataSourceDialogOpen(true)
  }

  const { reLayoutCurrentSchema } = useLayoutSchema()

  const handleExportSQL = () => {
    if (!schema) return
    setExportDialogOpen(true)
  }

  const handleExportSVG = async () => {
    if (!document.querySelector('.react-flow')) return
    const store = useERStore.getState()
    store.setExporting(true)
    try {
      const { exportAsSvgXml } = await import('@/utils/svgExport')
      const svg = await exportAsSvgXml()
      downloadFile(svg, 'erbeauti_schema.svg', 'image/svg+xml')
      toast.success('已导出 SVG')
    } catch {
      toast.error('SVG 导出失败')
    } finally {
      store.setExporting(false)
    }
  }

  const handleExportPNG = async () => {
    if (!document.querySelector('.react-flow')) return
    const store = useERStore.getState()
    store.setExporting(true)
    try {
      const { exportAsPngBlob } = await import('@/utils/svgExport')
      const blob = await exportAsPngBlob()
      downloadBlob(blob, 'erbeauti_schema.png')
      toast.success('已导出 PNG')
    } catch {
      toast.error('PNG 导出失败')
    } finally {
      store.setExporting(false)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
          <FileCode2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-none">ERBeauti</h1>
          <p className="text-[10px] text-neutral-500">粘贴 SQL，3 秒出美图</p>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Dropdown
          trigger={
            <Button variant="secondary" size="sm">
              <Upload className="h-4 w-4" />
              导入
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          }
        >
          <DropdownItem onClick={() => openImportDialog('sql')}>导入 SQL</DropdownItem>
          <DropdownItem onClick={() => openImportDialog('dbml')}>导入 DBML</DropdownItem>
          <DropdownItem onClick={() => openImportDialog('prisma')}>导入 Prisma</DropdownItem>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          <DropdownItem onClick={openDataSourceImport}>
            <Database className="h-4 w-4" />
            从数据库连接导入
          </DropdownItem>
          <DropdownItem onClick={openDataSourceManage}>
            <Server className="h-4 w-4" />
            管理数据源
          </DropdownItem>
        </Dropdown>

        <Button
          variant="primary"
          size="sm"
          disabled={layoutLoading || !schema}
          onClick={reLayoutCurrentSchema}
        >
          <Layout className="h-4 w-4" />
          {layoutLoading ? '布局中...' : '重新布局'}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={!schema || !currentCanvasId}
          onClick={async () => {
            await saveCurrentCanvas()
            toast.success('已保存')
          }}
          title="保存当前画布"
        >
          <Save className="h-4 w-4" />
          保存
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={!schema}
          onClick={() => setDiagramStyle(diagramStyle === 'table' ? 'chen' : 'table')}
          title={diagramStyle === 'table' ? '切换到实体关系式 ER 图' : '切换到表样式'}
        >
          {diagramStyle === 'table' ? (
            <Box className="h-4 w-4" />
          ) : (
            <Diamond className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {diagramStyle === 'table' ? '实体关系式' : '表样式'}
          </span>
        </Button>

        <Dropdown
          trigger={
            <Button variant="secondary" size="sm" disabled={!schema}>
              <Download className="h-4 w-4" />
              导出
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          }
        >
          <DropdownItem onClick={handleExportSQL}>
            <FileCode2 className="h-4 w-4" />
            导出 SQL
          </DropdownItem>
          <DropdownItem onClick={handleExportSVG}>
            <Eye className="h-4 w-4" />
            导出 SVG
          </DropdownItem>
          <DropdownItem onClick={handleExportPNG}>
            <Image className="h-4 w-4" />
            导出 PNG
          </DropdownItem>
        </Dropdown>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          title={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <div className="hidden items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 sm:flex">
          <Command className="h-3 w-3" />
          <span>Ctrl K</span>
        </div>
      </div>
    </header>
  )
})

