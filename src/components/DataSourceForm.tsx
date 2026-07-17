import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, Plug } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { listDialects } from '@/api/datasource'
import { buildConnectionUrl, getDefaultPort, parseConnectionUrl } from '@/utils/connectionUrl'
import type { DataSourceFormState } from '@/types/er'
import { cn } from '@/utils/cn'
import { FALLBACK_DIALECTS } from '@/utils/fieldTypes'

export type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface DataSourceFormProps {
  value: DataSourceFormState
  onChange: (value: DataSourceFormState) => void
  onTest: () => void
  onSave: () => void
  testStatus?: TestStatus
  error?: string | null
  saveDisabled?: boolean
  saveLabel?: string
}

const TEST_STATUS_TEXT: Record<TestStatus, string> = {
  idle: '测试连接',
  testing: '连接中...',
  success: '连接成功',
  error: '连接失败',
}

export function DataSourceForm({
  value,
  onChange,
  onTest,
  onSave,
  testStatus = 'idle',
  error,
  saveDisabled = false,
  saveLabel = '保存',
}: DataSourceFormProps) {
  const [dialects, setDialects] = useState<string[]>([])
  const [dialectsLoading, setDialectsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    setDialectsLoading(true)
    listDialects()
      .then((res) => {
        if (!cancelled) setDialects(res.supported_dialects)
      })
      .catch(() => {
        if (!cancelled) setDialects(FALLBACK_DIALECTS)
      })
      .finally(() => {
        if (!cancelled) setDialectsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isSQLite = useMemo(
    () => value.dialect === 'sqlite' || value.dialect === 'sqlite+pysqlite',
    [value.dialect],
  )

  const showSchemaField = useMemo(() => {
    return (
      value.dialect === 'postgresql' ||
      value.dialect === 'postgres' ||
      value.dialect === 'mssql' ||
      value.dialect === 'mssql+pyodbc' ||
      value.dialect === 'oracle' ||
      value.dialect === 'oracle+oracledb'
    )
  }, [value.dialect])

  const schemaDisabled = useMemo(
    () => value.dialect === 'mysql' || value.dialect === 'mariadb',
    [value.dialect],
  )

  const previewUrl = useMemo(() => {
    if (value.inputMode === 'url') return value.connectionUrl ?? ''
    return buildConnectionUrl({
      dialect: value.dialect,
      host: value.host,
      port: value.port,
      database: value.database,
      username: value.username,
      password: value.password,
    })
  }, [value])

  const maskedPreviewUrl = useMemo(() => {
    if (!previewUrl) return ''
    return previewUrl.replace(/:[^:@]+@/, ':***@')
  }, [previewUrl])

  const updateFields = (patch: Partial<DataSourceFormState>) => {
    onChange({ ...value, ...patch })
  }

  const handleDialectChange = (dialect: string) => {
    const defaultPort = getDefaultPort(dialect)
    const currentDefaultPort = getDefaultPort(value.dialect)
    const shouldUpdatePort = !value.port || value.port === currentDefaultPort
    updateFields({
      dialect,
      port: shouldUpdatePort ? defaultPort : value.port,
    })
  }

  const handleInputModeChange = (inputMode: DataSourceFormState['inputMode']) => {
    if (inputMode === value.inputMode) return

    if (inputMode === 'url') {
      const url = buildConnectionUrl({
        dialect: value.dialect,
        host: value.host,
        port: value.port,
        database: value.database,
        username: value.username,
        password: value.password,
      })
      onChange({ ...value, inputMode, connectionUrl: url })
    } else {
      const parsed = parseConnectionUrl(value.connectionUrl ?? '')
      onChange({
        ...value,
        inputMode,
        host: parsed.host ?? value.host ?? '',
        port: parsed.port ?? value.port,
        username: parsed.username ?? value.username ?? '',
        password: parsed.password ?? value.password,
        database: parsed.database ?? value.database ?? '',
        connectionUrl: undefined,
      })
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!value.name.trim()) errors.name = '请输入连接名称'
    if (!value.dialect) errors.dialect = '请选择数据库方言'

    if (value.inputMode === 'url') {
      if (!(value.connectionUrl ?? '').trim()) errors.connectionUrl = '请输入连接 URL'
    } else {
      if (!isSQLite && !(value.host ?? '').trim()) errors.host = '请输入主机地址'
      if (!isSQLite) {
        if (!value.port) errors.port = '请输入端口'
        else if (value.port < 1 || value.port > 65535) errors.port = '端口范围 1-65535'
      }
      if (!(value.database ?? '').trim()) errors.database = '请输入数据库名'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleTest = () => {
    if (!validate()) return
    onTest()
  }

  const handleSave = () => {
    if (!validate()) return
    onSave()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          连接名称 <span className="text-red-500">*</span>
        </label>
        <Input
          value={value.name}
          onChange={(e) => updateFields({ name: e.target.value })}
          placeholder="例如：本地 PostgreSQL"
          aria-invalid={!!fieldErrors.name}
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          数据库方言 <span className="text-red-500">*</span>
        </label>
        <select
          value={value.dialect}
          onChange={(e) => handleDialectChange(e.target.value)}
          disabled={dialectsLoading}
          className={cn(
            'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
            dialectsLoading && 'opacity-60',
          )}
        >
          <option value="">{dialectsLoading ? '加载中...' : '请选择方言'}</option>
          {dialects.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {fieldErrors.dialect && <p className="mt-1 text-xs text-red-600">{fieldErrors.dialect}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          连接方式
        </label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-1 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => handleInputModeChange('fields')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              value.inputMode === 'fields'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
            )}
          >
            分字段输入
          </button>
          <button
            type="button"
            onClick={() => handleInputModeChange('url')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              value.inputMode === 'url'
                ? 'bg-blue-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800',
            )}
          >
            完整 URL
          </button>
        </div>
      </div>

      {value.inputMode === 'url' ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            连接 URL <span className="text-red-500">*</span>
          </label>
          <Input
            type={showPassword ? 'text' : 'password'}
            value={value.connectionUrl ?? ''}
            onChange={(e) => updateFields({ connectionUrl: e.target.value })}
            placeholder="postgresql://user:pass@localhost:5432/db"
            autoComplete="new-password"
            spellCheck={false}
            aria-invalid={!!fieldErrors.connectionUrl}
          />
          {fieldErrors.connectionUrl && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.connectionUrl}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {!isSQLite && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  主机 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={value.host ?? ''}
                  onChange={(e) => updateFields({ host: e.target.value })}
                  placeholder="localhost"
                  aria-invalid={!!fieldErrors.host}
                />
                {fieldErrors.host && <p className="mt-1 text-xs text-red-600">{fieldErrors.host}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  端口 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={value.port ?? ''}
                  onChange={(e) => updateFields({ port: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="5432"
                  min={1}
                  max={65535}
                  aria-invalid={!!fieldErrors.port}
                />
                {fieldErrors.port && <p className="mt-1 text-xs text-red-600">{fieldErrors.port}</p>}
              </div>
            </div>
          )}

          {!isSQLite && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                用户名
              </label>
              <Input
                value={value.username ?? ''}
                onChange={(e) => updateFields({ username: e.target.value })}
                placeholder="user"
              />
            </div>
          )}

          {!isSQLite && (
            <div className="relative">
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                密码
              </label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={value.password}
                onChange={(e) => updateFields({ password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
                spellCheck={false}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-[30px] text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {isSQLite ? '数据库文件路径' : '数据库名'} <span className="text-red-500">*</span>
            </label>
            <Input
              value={value.database ?? ''}
              onChange={(e) => updateFields({ database: e.target.value })}
              placeholder={isSQLite ? '/path/to/db.sqlite' : 'db'}
              aria-invalid={!!fieldErrors.database}
            />
            {fieldErrors.database && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.database}</p>
            )}
          </div>

          {showSchemaField && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Schema {schemaDisabled && <span className="text-neutral-400">（等同于数据库名）</span>}
              </label>
              <Input
                value={value.schema ?? ''}
                onChange={(e) => updateFields({ schema: e.target.value })}
                placeholder={schemaDisabled ? value.database ?? '' : 'public'}
                disabled={schemaDisabled}
                className={cn(schemaDisabled && 'opacity-60')}
              />
            </div>
          )}
        </div>
      )}

      {value.inputMode === 'fields' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-500 dark:text-neutral-400">
            连接 URL 预览
          </label>
          <div className="break-all rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {maskedPreviewUrl || '请填写连接信息'}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <span className="mt-0.5 text-red-500">!</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleTest}
          disabled={testStatus === 'testing'}
        >
          {testStatus === 'testing' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          {TEST_STATUS_TEXT[testStatus]}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saveDisabled}>
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}
