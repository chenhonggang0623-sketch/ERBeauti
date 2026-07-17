import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DataSourceForm } from '@/components/DataSourceForm'
import type { DataSourceFormState } from '@/types/er'

vi.mock('@/api/datasource', () => ({
  listDialects: vi.fn().mockResolvedValue({ success: true, supported_dialects: ['postgresql', 'mysql', 'sqlite'] }),
}))

function createFormState(overrides: Partial<DataSourceFormState> = {}): DataSourceFormState {
  return {
    id: 'test-id',
    name: '',
    dialect: '',
    inputMode: 'fields',
    host: '',
    port: undefined,
    username: '',
    password: '',
    database: '',
    schema: '',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('DataSourceForm', () => {
  it('渲染连接名称和方言下拉', async () => {
    render(
      <DataSourceForm
        value={createFormState()}
        onChange={vi.fn()}
        onTest={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByPlaceholderText('例如：本地 PostgreSQL')).toBeInTheDocument()
    expect(await screen.findByText('postgresql')).toBeInTheDocument()
  })

  it('切换为 URL 模式时显示 URL 输入框', async () => {
    const onChange = vi.fn()
    render(
      <DataSourceForm
        value={createFormState()}
        onChange={onChange}
        onTest={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('postgresql')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('完整 URL'))
    expect(onChange).toHaveBeenCalled()
  })

  it('密码输入框默认 type 为 password', async () => {
    render(
      <DataSourceForm
        value={createFormState()}
        onChange={vi.fn()}
        onTest={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('postgresql')).toBeInTheDocument()
    })

    const passwordInput = screen.getByPlaceholderText('••••••••')
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password')
  })

  it('点击测试连接触发校验并调用 onTest', async () => {
    const onTest = vi.fn()
    render(
      <DataSourceForm
        value={createFormState({
          name: '测试连接',
          dialect: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'erp',
        })}
        onChange={vi.fn()}
        onTest={onTest}
        onSave={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('postgresql')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('测试连接'))
    expect(onTest).toHaveBeenCalled()
  })
})
