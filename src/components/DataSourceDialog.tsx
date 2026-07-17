import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { X, ArrowLeft, Server, Plus, Sparkles, Database } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { useERStore } from '@/store/erStore'
import { useLayoutSchema } from '@/hooks/useLayoutSchema'
import { testConnection, reverseEngineer, listTables, getDataSourceDetail, listSampleDatabases } from '@/api/datasource'
import type { SampleDatabase } from '@/api/datasource'
import type { DataSourceConfig, DataSourceFormState } from '@/types/er'
import type { ApiError, TableInfo } from '@/api/types'
import { DataSourceForm, type TestStatus } from './DataSourceForm'
import { DataSourceList } from './DataSourceList'
import { TableSelectionDialog } from './TableSelectionDialog'
import { toast } from 'sonner'
import { generateId } from '@/utils/id'

function createEmptyForm(): DataSourceFormState {
  return {
    id: generateId(),
    name: '',
    dialect: '',
    inputMode: 'fields',
    host: '',
    port: undefined,
    username: '',
    password: '',
    database: '',
    schema: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function configToForm(config: DataSourceConfig): DataSourceFormState {
  return { ...config, password: '' }
}

function buildRequest(form: DataSourceFormState) {
  if (form.inputMode === 'url') {
    return {
      connection_url: form.connectionUrl ?? '',
      schema_name: form.schema || undefined,
    }
  }

  return {
    connection_fields: {
      dialect: form.dialect,
      host: form.host,
      port: form.port,
      database: form.database,
      username: form.username,
      password: form.password,
    },
    schema_name: form.schema || undefined,
  }
}

function mapApiErrorMessage(err: ApiError): string {
  switch (err.code) {
    case 'AUTHENTICATION_FAILED':
      return '数据库用户名或密码错误'
    case 'DATABASE_NOT_FOUND':
      return '数据库不存在，请检查数据库名'
    case 'CONNECTION_TIMEOUT':
      return '连接超时，请检查网络或数据库是否可达'
    case 'UPSTREAM_CONNECTION_ERROR':
      return '无法连接到数据库服务器，请检查地址和端口'
    case 'INSUFFICIENT_PRIVILEGES':
      return '当前账号权限不足，无法读取数据字典'
    case 'UNSUPPORTED_DIALECT':
      return `当前后端不支持该数据库方言：${err.detail ?? ''}`
    case 'INVALID_CONNECTION_URL':
    case 'VALIDATION_ERROR':
      return `连接信息格式错误：${err.message}`
    case 'BACKEND_UNAVAILABLE':
      return '无法连接到 ERBeauti 后端服务，请确认服务已启动'
    default:
      return err.message || '操作失败，请稍后重试'
  }
}

/**
 * 数据源管理弹窗：支持列表、表单、导入三种视图。
 */
export function DataSourceDialog() {
  const {
    dataSources,
    dataSourceDialogOpen,
    dataSourceDialogMode,
    editingDataSourceId,
    selectedDataSourceId,
    setDataSourceDialogOpen,
    setDataSourceDialogMode,
    setEditingDataSourceId,
    setSelectedDataSourceId,
    addDataSource,
    updateDataSource,
    removeDataSource,
  } = useERStore(
    useShallow((state) => ({
      dataSources: state.dataSources,
      dataSourceDialogOpen: state.dataSourceDialogOpen,
      dataSourceDialogMode: state.dataSourceDialogMode,
      editingDataSourceId: state.editingDataSourceId,
      selectedDataSourceId: state.selectedDataSourceId,
      setDataSourceDialogOpen: state.setDataSourceDialogOpen,
      setDataSourceDialogMode: state.setDataSourceDialogMode,
      setEditingDataSourceId: state.setEditingDataSourceId,
      setSelectedDataSourceId: state.setSelectedDataSourceId,
      addDataSource: state.addDataSource,
      updateDataSource: state.updateDataSource,
      removeDataSource: state.removeDataSource,
    })),
  )

  const { layoutFromSchema } = useLayoutSchema()
  const setDatabaseType = useERStore((state) => state.setDatabaseType)
  const [form, setForm] = useState<DataSourceFormState>(createEmptyForm())
  const [testStatusMap, setTestStatusMap] = useState<Record<string, TestStatus>>({})
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [tableSelectionOpen, setTableSelectionOpen] = useState(false)
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [tableSelectionLoading, setTableSelectionLoading] = useState(false)
  const [tableSelectionError, setTableSelectionError] = useState<string | null>(null)
  const [pendingFormForGeneration, setPendingFormForGeneration] = useState<DataSourceFormState | null>(null)

  const [seedDialogOpen, setSeedDialogOpen] = useState(false)
  const [availableDatabases, setAvailableDatabases] = useState<SampleDatabase[]>([])
  const [seedLoading, setSeedLoading] = useState(false)
  const [selectedSeedIds, setSelectedSeedIds] = useState<Set<string>>(new Set())

  const fetchDataSources = useERStore((state) => state.fetchDataSources)

  useEffect(() => {
    if (!dataSourceDialogOpen) {
      setForm(createEmptyForm())
      setError(null)
      setTestStatusMap({})
      setGenerating(false)
      setTableSelectionOpen(false)
      setAvailableTables([])
      setTableSelectionError(null)
      setPendingFormForGeneration(null)
      setSeedDialogOpen(false)
      setAvailableDatabases([])
      setSelectedSeedIds(new Set())
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      return
    }

    fetchDataSources()

    if (dataSourceDialogMode === 'form') {
      const config = dataSources.find((ds) => ds.id === editingDataSourceId)
      setForm(config ? configToForm(config) : createEmptyForm())
      if (editingDataSourceId) {
        getDataSourceDetail(editingDataSourceId)
          .then(({ data }) => {
            if (data.password) setForm((prev) => ({ ...prev, password: data.password }))
          })
          .catch(() => {})
      }
    } else if (dataSourceDialogMode === 'import') {
      const config = dataSources.find((ds) => ds.id === selectedDataSourceId)
      setForm(config ? configToForm(config) : createEmptyForm())
      if (selectedDataSourceId) {
        getDataSourceDetail(selectedDataSourceId)
          .then(({ data }) => {
            if (data.password) setForm((prev) => ({ ...prev, password: data.password }))
          })
          .catch(() => {})
      }
    } else {
      setForm(createEmptyForm())
    }
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSourceDialogOpen, dataSourceDialogMode, editingDataSourceId, selectedDataSourceId])

  const title = useMemo(() => {
    switch (dataSourceDialogMode) {
      case 'list':
        return '数据源配置'
      case 'form':
        return editingDataSourceId ? '编辑数据源' : '新建数据源'
      case 'import':
        return '从数据库导入'
      default:
        return '数据源配置'
    }
  }, [dataSourceDialogMode, editingDataSourceId])

  const handleClose = () => {
    setDataSourceDialogOpen(false)
    setDataSourceDialogMode('list')
    setEditingDataSourceId(null)
    setSelectedDataSourceId(null)
    setForm((prev) => ({ ...prev, password: '' }))
  }

  const switchToList = () => {
    setDataSourceDialogMode('list')
    setEditingDataSourceId(null)
    setSelectedDataSourceId(null)
    setError(null)
  }

  const switchToForm = (id?: string) => {
    setEditingDataSourceId(id ?? null)
    setDataSourceDialogMode('form')
    setError(null)
  }

  const handleSave = async () => {
    if (!validate()) return
    try {
      if (editingDataSourceId) {
        const patch: Record<string, unknown> = { ...form }
        if (!patch.password) {
          patch.password = undefined
        }
        await updateDataSource(editingDataSourceId, patch as Partial<DataSourceFormState>)
        toast.success('已保存数据源')
      } else {
        await addDataSource(form)
        toast.success('已创建数据源')
      }
      setForm((prev) => ({ ...prev, password: '' }))
      switchToList()
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : '保存失败，请检查后端服务'
      toast.error(message)
    }
  }

  const runTest = async (targetForm: DataSourceFormState) => {
    const id = targetForm.id
    setTestStatusMap((prev) => ({ ...prev, [id]: 'testing' }))
    setError(null)

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await testConnection(buildRequest(targetForm), controller.signal)
      setTestStatusMap((prev) => ({ ...prev, [id]: 'success' }))
      toast.success('连接成功')
      setTimeout(() => {
        setTestStatusMap((prev) => ({ ...prev, [id]: 'idle' }))
      }, 2000)
    } catch (err) {
      const apiErr = err as ApiError
      const message = mapApiErrorMessage(apiErr)
      setError(message)
      setTestStatusMap((prev) => ({ ...prev, [id]: 'error' }))
      toast.error(message)
    } finally {
      abortControllerRef.current = null
    }
  }

  const handleFormTest = () => {
    runTest(form)
  }

  const handleListTest = async (id: string) => {
    const config = dataSources.find((ds) => ds.id === id)
    if (!config) return
    try {
      const { data } = await getDataSourceDetail(id)
      runTest({ ...configToForm(config), password: data.password })
    } catch {
      toast.error('无法获取数据源密码信息')
    }
  }

  const needsPassword = (dialect: string) => {
    return dialect !== 'sqlite' && dialect !== 'sqlite+pysqlite'
  }

  const validate = (): boolean => {
    if (!form.name.trim()) {
      setError('请输入连接名称')
      return false
    }
    if (!form.dialect) {
      setError('请选择数据库方言')
      return false
    }
    setError(null)
    return true
  }

  const startTableSelectionFlow = async (targetForm: DataSourceFormState) => {
    setTableSelectionLoading(true)
    setTableSelectionError(null)
    setPendingFormForGeneration(targetForm)

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await listTables(buildRequest(targetForm), controller.signal)
      if (res.tables.length === 0) {
        const message = '该数据库中没有找到数据表'
        setTableSelectionError(message)
        toast.error(message)
        return
      }
      setAvailableTables(res.tables)
      setTableSelectionOpen(true)
    } catch (err) {
      const apiErr = err as ApiError
      const message = mapApiErrorMessage(apiErr)
      setTableSelectionError(message)
      toast.error(message)
    } finally {
      setTableSelectionLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleGenerate = async (id: string) => {
    try {
      const { data } = await getDataSourceDetail(id)
      if (needsPassword(data.dialect) && !data.password) {
        setSelectedDataSourceId(id)
        setForm({ ...(data as DataSourceConfig), password: '' })
        setDataSourceDialogMode('import')
        setError('请填写该数据源的密码后再生成 ER 图')
        return
      }
      await startTableSelectionFlow({ ...(data as DataSourceConfig), password: data.password })
    } catch {
      toast.error('无法获取数据源信息')
    }
  }

  const handleImportGenerate = async () => {
    await startTableSelectionFlow(form)
  }

  const handleSeedSample = async () => {
    setSeedLoading(true)
    try {
      const dbs = await listSampleDatabases()
      setAvailableDatabases(dbs)
      const existingNames = new Set(dataSources.map((ds) => ds.name))
      const preSelected = new Set(
        dbs.filter((db) => !existingNames.has(db.name)).map((db) => db.id),
      )
      setSelectedSeedIds(preSelected)
      setSeedDialogOpen(true)
    } catch {
      toast.error('无法获取示例数据库列表')
    } finally {
      setSeedLoading(false)
    }
  }

  const toggleSeedDb = (id: string) => {
    setSelectedSeedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirmSeed = async () => {
    const toAdd = availableDatabases.filter((db) => selectedSeedIds.has(db.id))
    if (toAdd.length === 0) {
      setSeedDialogOpen(false)
      return
    }
    for (const db of toAdd) {
      const form: DataSourceFormState = {
        id: db.id,
        name: db.name,
        dialect: 'sqlite',
        inputMode: 'url',
        connectionUrl: `sqlite://${db.filename}`,
        database: db.filename,
        host: '',
        port: undefined,
        username: '',
        password: '',
        schema: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      try {
        await addDataSource(form)
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? (err as { message: string }).message
            : `添加「${db.name}」失败`
        toast.error(message)
      }
    }
    setSeedDialogOpen(false)
    toast.success(`已添加 ${toAdd.length} 个示例数据库`)
  }

  const handleConfirmGeneration = async (selectedTables: string[], dataSourceName?: string) => {
    if (!pendingFormForGeneration) return

    setTableSelectionOpen(false)
    setGenerating(true)
    setError(null)

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const request = buildRequest(pendingFormForGeneration)
      const res = await reverseEngineer(
        { ...request, infer_relationships: true, table_names: selectedTables },
        controller.signal,
      )
      if (dataSourceName) {
        const isSample = selectedDataSourceId?.startsWith('sample-') ?? false
        res.schema.sourceName = dataSourceName
        for (const table of res.schema.tables) {
          table.dataSourceName = dataSourceName
          table.isSample = isSample
        }
      }
      res.schema.databaseType = pendingFormForGeneration.dialect
      setDatabaseType(pendingFormForGeneration.dialect)
      await layoutFromSchema(res.schema)
      handleClose()
      toast.success(`已生成 ER 图，共 ${res.schema.tables.length} 张表`)
    } catch (err) {
      const apiErr = err as ApiError
      const message = mapApiErrorMessage(apiErr)
      setError(message)
      toast.error(message)
    } finally {
      setGenerating(false)
      abortControllerRef.current = null
      setPendingFormForGeneration(null)
      setForm((prev) => ({ ...prev, password: '' }))
    }
  }

  const handleDataSourceChangeForTableSelection = async (newId: string) => {
    const config = dataSources.find((ds) => ds.id === newId)
    if (!config) return
    setSelectedDataSourceId(newId)
    try {
      const { data } = await getDataSourceDetail(newId)
      const targetForm = { ...configToForm(config), password: data.password || '' }
      setForm(targetForm)
      await startTableSelectionFlow(targetForm)
    } catch {
      toast.error('无法获取数据源密码信息')
    }
  }

  if (!dataSourceDialogOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            {dataSourceDialogMode !== 'list' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={switchToList}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Server className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleClose}
            disabled={generating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {dataSourceDialogMode === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <DataSourceList
                  dataSources={dataSources}
                  onEdit={switchToForm}
                  onDelete={removeDataSource}
                  onTest={handleListTest}
                  onAdd={() => switchToForm()}
                  testStatusMap={testStatusMap}
                  mode="manage"
                />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={handleSeedSample} disabled={seedLoading}>
                    <Sparkles className="h-4 w-4" />
                    {seedLoading ? '加载中...' : '添加内置示例'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => switchToForm()}>
                    <Plus className="h-4 w-4" />
                    新建数据源
                  </Button>
                </div>
                {seedDialogOpen && (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/50">
                    <h4 className="mb-3 text-sm font-semibold">选择要导入的示例数据库</h4>
                    <div className="space-y-2">
                      {availableDatabases.map((db) => (
                        <label
                          key={db.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700/50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSeedIds.has(db.id)}
                            onChange={() => toggleSeedDb(db.id)}
                            className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Database className="h-4 w-4 text-neutral-500" />
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {db.name}
                          </span>
                          <span className="ml-auto text-xs text-neutral-400 font-mono">{db.filename}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setSeedDialogOpen(false)}>
                        取消
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleConfirmSeed}>
                        确认添加
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {dataSourceDialogMode === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <DataSourceForm
                  value={form}
                  onChange={setForm}
                  onTest={handleFormTest}
                  onSave={handleSave}
                  testStatus={testStatusMap[form.id] ?? 'idle'}
                  error={error}
                />
              </motion.div>
            )}

            {dataSourceDialogMode === 'import' && (
              <motion.div
                key="import"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  选择已保存的数据源并填写密码，即可逆向生成 ER 图。
                </p>
                <DataSourceList
                  dataSources={dataSources}
                  selectedId={selectedDataSourceId}
                  onSelect={(id) => {
                    setSelectedDataSourceId(id)
                    const config = dataSources.find((ds) => ds.id === id)
                    if (config) {
                      setForm(configToForm(config))
                      getDataSourceDetail(id)
                        .then(({ data }) => {
                          if (data.password) setForm((prev) => ({ ...prev, password: data.password }))
                        })
                        .catch(() => {})
                    }
                  }}
                  onEdit={switchToForm}
                  onDelete={removeDataSource}
                  onTest={handleListTest}
                  onGenerate={handleGenerate}
                  onAdd={() => switchToForm()}
                  testStatusMap={testStatusMap}
                  mode="import"
                />

                {selectedDataSourceId && (
                  <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                    <DataSourceForm
                      value={form}
                      onChange={setForm}
                      onTest={handleFormTest}
                      onSave={handleImportGenerate}
                      testStatus={testStatusMap[form.id] ?? 'idle'}
                      error={error}
                      saveDisabled={generating}
                      saveLabel="生成 ER 图"
                    />
                  </div>
                )}

                {dataSources.length === 0 && (
                  <div className="flex justify-center">
                    <Button variant="secondary" size="sm" onClick={() => switchToForm()}>
                      <Plus className="h-4 w-4" />
                      新建数据源
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end border-t border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={generating}>
            关闭
          </Button>
        </div>
      </motion.div>

      <TableSelectionDialog
        open={tableSelectionOpen}
        tables={availableTables}
        loading={tableSelectionLoading}
        error={tableSelectionError}
        dataSourceName={form.name || undefined}
        dataSourceId={selectedDataSourceId || form.id}
        dataSources={dataSources}
        onConfirm={handleConfirmGeneration}
        onDataSourceChange={handleDataSourceChangeForTableSelection}
        onCancel={() => {
          setTableSelectionOpen(false)
          setPendingFormForGeneration(null)
        }}
      />
    </div>
  )
}
