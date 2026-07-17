import { describe, it, expect } from 'vitest'
import { buildConnectionUrl, getDefaultPort, parseConnectionUrl } from '@/utils/connectionUrl'

describe('getDefaultPort', () => {
  it('返回常见方言的默认端口', () => {
    expect(getDefaultPort('postgresql')).toBe(5432)
    expect(getDefaultPort('postgres')).toBe(5432)
    expect(getDefaultPort('mysql')).toBe(3306)
    expect(getDefaultPort('mariadb')).toBe(3306)
    expect(getDefaultPort('mssql')).toBe(1433)
    expect(getDefaultPort('oracle')).toBe(1521)
  })

  it('sqlite 无默认端口', () => {
    expect(getDefaultPort('sqlite')).toBeUndefined()
  })

  it('未知方言返回 undefined', () => {
    expect(getDefaultPort('unknown')).toBeUndefined()
  })
})

describe('buildConnectionUrl', () => {
  it('组装 PostgreSQL 分字段 URL', () => {
    const url = buildConnectionUrl({
      dialect: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'erbeauti',
      username: 'user',
      password: 'pass',
    })
    expect(url).toBe('postgresql://user:pass@localhost:5432/erbeauti')
  })

  it('对用户名、密码、数据库名进行编码', () => {
    const url = buildConnectionUrl({
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'my db',
      username: 'user@domain',
      password: 'p@ss:w0rd',
    })
    expect(url).toBe('mysql+pymysql://user%40domain:p%40ss%3Aw0rd@localhost:3306/my+db')
  })

  it('无密码时仅使用用户名', () => {
    const url = buildConnectionUrl({
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'erp',
      username: 'root',
    })
    expect(url).toBe('mysql+pymysql://root@localhost:3306/erp')
  })

  it('无用户名和密码时省略认证段', () => {
    const url = buildConnectionUrl({
      dialect: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'erp',
    })
    expect(url).toBe('postgresql://localhost:5432/erp')
  })

  it('追加 options 参数', () => {
    const url = buildConnectionUrl({
      dialect: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'erp',
      options: 'sslmode=require',
    })
    expect(url).toBe('postgresql://localhost:5432/erp?sslmode=require')
  })

  it('SQLite 组装为文件路径形式', () => {
    const url = buildConnectionUrl({
      dialect: 'sqlite',
      database: '/path/to/db.sqlite',
    })
    expect(url).toBe('sqlite:////path/to/db.sqlite')
  })

  it('缺少方言时返回空字符串', () => {
    const url = buildConnectionUrl({ dialect: '' })
    expect(url).toBe('')
  })
})

describe('parseConnectionUrl', () => {
  it('解析标准 PostgreSQL URL', () => {
    const parsed = parseConnectionUrl('postgresql://user:pass@localhost:5432/erbeauti')
    expect(parsed).toEqual({
      dialect: 'postgresql',
      username: 'user',
      password: 'pass',
      host: 'localhost',
      port: 5432,
      database: 'erbeauti',
    })
  })

  it('解码 URL 编码的字段', () => {
    const parsed = parseConnectionUrl('mysql://user%40domain:p%40ss%3Aw0rd@localhost:3306/my+db')
    expect(parsed.username).toBe('user@domain')
    expect(parsed.password).toBe('p@ss:w0rd')
    expect(parsed.database).toBe('my db')
  })

  it('解析 options', () => {
    const parsed = parseConnectionUrl('postgresql://localhost:5432/erp?sslmode=require')
    expect(parsed.options).toBe('sslmode=require')
  })

  it('解析无认证段 URL', () => {
    const parsed = parseConnectionUrl('postgresql://localhost:5432/erp')
    expect(parsed).toMatchObject({
      dialect: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'erp',
    })
  })

  it('非法 URL 返回空对象', () => {
    const parsed = parseConnectionUrl('not a url')
    expect(parsed).toEqual({})
  })

  it('空字符串返回空对象', () => {
    const parsed = parseConnectionUrl('')
    expect(parsed).toEqual({})
  })
})
