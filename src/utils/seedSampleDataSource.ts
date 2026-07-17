import type { DataSourceConfig } from '@/types/er'

export function createSampleDataSources(): DataSourceConfig[] {
  const now = Date.now()
  return [
    {
      id: 'sample-demo',
      name: '产品展示库',
      dialect: 'sqlite',
      inputMode: 'url',
      connectionUrl: 'sqlite://demo.db',
      database: 'demo.db',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sample-100tables',
      name: '电商数据库',
      dialect: 'sqlite',
      inputMode: 'url',
      connectionUrl: 'sqlite://ecommerce.db',
      database: 'ecommerce.db',
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: 'sample-blog',
      name: '博客平台 (3表)',
      dialect: 'sqlite',
      inputMode: 'url',
      connectionUrl: 'sqlite://blog.db',
      database: 'blog.db',
      createdAt: now + 2,
      updatedAt: now + 2,
    },
  ]
}
