import { describe, it, expect } from 'vitest'
import { parseSQLToERSchema } from '@/parser/sqlParser'
import { parseDBMLToERSchema } from '@/parser/dbmlParser'
import { parsePrismaToERSchema } from '@/parser/prismaParser'
import { inferForeignKeysByNaming } from '@/parser/infer-relations'
import { postProcessLayout } from '@/layout/postProcess'
import type { ERSchema, ERTable } from '@/types/er'

describe('SQL 解析器', () => {
  it('解析单表并识别主键', () => {
    const sql = `CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL);`
    const schema = parseSQLToERSchema(sql)
    expect(schema.tables).toHaveLength(1)
    expect(schema.tables[0].name).toBe('users')
    const idField = schema.tables[0].fields.find((f) => f.name === 'id')!
    expect(idField.isPrimaryKey).toBe(true)
    expect(idField.isAutoIncrement).toBe(true)
    expect(schema.tables[0].fields.find((f) => f.name === 'name')!.nullable).toBe(false)
  })

  it('解析显式外键', () => {
    const sql = `CREATE TABLE posts (id INT PRIMARY KEY, user_id INT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id)); CREATE TABLE users (id INT PRIMARY KEY);`
    const schema = parseSQLToERSchema(sql)
    expect(schema.relationships).toHaveLength(1)
    expect(schema.relationships[0].sourceTableId).toBe('posts')
    expect(schema.relationships[0].targetTableId).toBe('users')
  })

  it('通过字段名推断隐式外键', () => {
    const sql = `CREATE TABLE orders (id INT PRIMARY KEY, user_id INT NOT NULL); CREATE TABLE users (id INT PRIMARY KEY);`
    const schema = parseSQLToERSchema(sql)
    expect(schema.relationships).toHaveLength(1)
    expect(schema.relationships[0].sourceTableId).toBe('orders')
    expect(schema.relationships[0].targetTableId).toBe('users')
  })

  it('解析复合主键', () => {
    const sql = `CREATE TABLE order_items (order_id INT, product_id INT, quantity INT, PRIMARY KEY (order_id, product_id));`
    const schema = parseSQLToERSchema(sql)
    expect(schema.tables[0].fields.find((f) => f.name === 'order_id')!.isPrimaryKey).toBe(true)
    expect(schema.tables[0].fields.find((f) => f.name === 'product_id')!.isPrimaryKey).toBe(true)
  })

  it('解析唯一约束', () => {
    const sql = `CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(200) UNIQUE);`
    const schema = parseSQLToERSchema(sql)
    expect(schema.tables[0].fields.find((f) => f.name === 'email')!.isUnique).toBe(true)
  })

  it('遇到语法错误时应抛出异常', () => {
    expect(() => parseSQLToERSchema('NOT A SQL')).toThrow()
  })
})

describe('DBML 解析器', () => {
  it('解析单表及主键', () => {
    const dbml = 'Table users {\n  id int [pk]\n  name varchar\n}'
    const schema = parseDBMLToERSchema(dbml)
    expect(schema.tables).toHaveLength(1)
    expect(schema.tables[0].name).toBe('users')
    const idField = schema.tables[0].fields.find((f) => f.name === 'id')!
    expect(idField.isPrimaryKey).toBe(true)
  })

  it('解析外键关系', () => {
    const dbml = 'Table users {\n  id int [pk]\n}\n\nTable posts {\n  id int [pk]\n  user_id int\n}\n\nRef: posts.user_id > users.id'
    const schema = parseDBMLToERSchema(dbml)
    expect(schema.relationships).toHaveLength(1)
    expect(schema.relationships[0].sourceTableId).toBe('posts')
    expect(schema.relationships[0].targetTableId).toBe('users')
  })

  it('解析一对多关系', () => {
    const dbml = 'Table users {\n  id int [pk]\n}\n\nTable posts {\n  id int [pk]\n  user_id int\n}\n\nRef: posts.user_id > users.id'
    const schema = parseDBMLToERSchema(dbml)
    const rel = schema.relationships[0]
    expect(rel.type).toBe('N:1')
  })

  it('标记外键字段', () => {
    const dbml = 'Table users {\n  id int [pk]\n}\n\nTable posts {\n  id int [pk]\n  user_id int\n}\n\nRef: posts.user_id > users.id'
    const schema = parseDBMLToERSchema(dbml)
    const posts = schema.tables.find((t) => t.name === 'posts')!
    expect(posts.fields.find((f) => f.name === 'user_id')!.isForeignKey).toBe(true)
  })

  it('遇到空输入时返回空 schema', () => {
    expect(() => parseDBMLToERSchema('')).not.toThrow()
    const schema = parseDBMLToERSchema('')
    expect(schema.tables).toHaveLength(0)
  })
})

describe('Prisma 解析器', () => {
  it('解析 model 及主键', () => {
    const prisma = `model User { id Int @id @default(autoincrement()) name String }`
    const schema = parsePrismaToERSchema(prisma)
    expect(schema.tables).toHaveLength(1)
    expect(schema.tables[0].name).toBe('User')
    const idField = schema.tables[0].fields.find((f) => f.name === 'id')!
    expect(idField.isPrimaryKey).toBe(true)
    expect(idField.isAutoIncrement).toBe(true)
  })

  it('解析 @relation 外键', () => {
    const prisma = [
      'model User {',
      '  id Int @id @default(autoincrement())',
      '  posts Post[]',
      '}',
      'model Post {',
      '  id Int @id @default(autoincrement())',
      '  author User @relation(fields: [authorId], references: [id])',
      '  authorId Int',
      '}',
    ].join('\n')
    const schema = parsePrismaToERSchema(prisma)
    expect(schema.relationships).toHaveLength(1)
    expect(schema.relationships[0].sourceTableId).toBe('Post')
    expect(schema.relationships[0].targetTableId).toBe('User')
  })

  it('解析可选字段 (nullable)', () => {
    const prisma = ['model User {', '  id Int @id', '  name String?', '}'].join('\n')
    const schema = parsePrismaToERSchema(prisma)
    expect(schema.tables[0].fields.find((f) => f.name === 'name')!.nullable).toBe(true)
    expect(schema.tables[0].fields.find((f) => f.name === 'id')!.nullable).toBe(false)
  })

  it('解析 @unique', () => {
    const prisma = ['model User {', '  id Int @id', '  email String @unique', '}'].join('\n')
    const schema = parsePrismaToERSchema(prisma)
    expect(schema.tables[0].fields.find((f) => f.name === 'email')!.isUnique).toBe(true)
  })
})

describe('智能外键推断 (infer-relations)', () => {
  function makeTable(name: string, fields: Array<{ name: string; pk?: boolean }>): ERTable {
    return {
      id: name,
      name,
      fields: fields.map((f) => ({
        id: `${name}.${f.name}`,
        name: f.name,
        type: 'INT',
        nullable: true,
        isPrimaryKey: f.pk ?? false,
        isForeignKey: false,
        isUnique: false,
        isAutoIncrement: false,
      })),
    }
  }

  it('从 xxx_id 推断 N:1 关系', () => {
    const tables = [
      makeTable('orders', [{ name: 'id', pk: true }, { name: 'user_id' }]),
      makeTable('users', [{ name: 'id', pk: true }]),
    ]
    const rels = inferForeignKeysByNaming(tables)
    expect(rels).toHaveLength(1)
    expect(rels[0].sourceTableId).toBe('orders')
    expect(rels[0].targetTableId).toBe('users')
  })

  it('忽略主键字段', () => {
    const tables = [
      makeTable('orders', [{ name: 'id', pk: true }]),
      makeTable('users', [{ name: 'id', pk: true }]),
    ]
    const rels = inferForeignKeysByNaming(tables)
    expect(rels).toHaveLength(0)
  })

  it('支持表名复数变体', () => {
    const tables = [
      makeTable('order_items', [{ name: 'id', pk: true }, { name: 'user_id' }]),
      makeTable('users', [{ name: 'id', pk: true }]),
    ]
    const rels = inferForeignKeysByNaming(tables)
    expect(rels).toHaveLength(1)
  })

  it('支持驼峰字段名 xxxId', () => {
    const tables = [
      makeTable('orders', [{ name: 'id', pk: true }, { name: 'userId' }]),
      makeTable('users', [{ name: 'id', pk: true }]),
    ]
    const rels = inferForeignKeysByNaming(tables)
    expect(rels).toHaveLength(1)
    expect(rels[0].sourceFieldId).toBe('orders.userId')
  })
})

describe('布局后处理 (postProcess)', () => {
  function makeSchema(relations: Array<{ source: string; target: string }>): ERSchema {
    return {
      id: 's1',
      name: 'test',
      tables: [
        { id: 'users', name: 'users', fields: [{ id: 'users.id', name: 'id', type: 'INT', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: false, isAutoIncrement: false }] },
        { id: 'orders', name: 'orders', fields: [{ id: 'orders.id', name: 'id', type: 'INT', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: false, isAutoIncrement: false }] },
        { id: 'products', name: 'products', fields: [{ id: 'products.id', name: 'id', type: 'INT', nullable: false, isPrimaryKey: true, isForeignKey: false, isUnique: false, isAutoIncrement: false }] },
      ],
      relationships: relations.map((r, i) => ({
        id: `r${i}`,
        sourceTableId: r.source,
        sourceFieldId: `${r.source}.id`,
        targetTableId: r.target,
        targetFieldId: `${r.target}.id`,
        type: 'N:1' as const,
      })),
    }
  }

  function makeNode(id: string, x: number, y: number) {
    return {
      id,
      type: 'table' as const,
      position: { x, y },
      data: { table: { id, name: id, fields: [] } as any },
    }
  }

  it('核心表被拉向质心', () => {
    const schema = makeSchema([{ source: 'orders', target: 'users' }, { source: 'products', target: 'users' }])
    const nodes = [makeNode('users', 800, 800), makeNode('orders', 100, 100), makeNode('products', 300, 100)]
    const result = postProcessLayout(schema, nodes, { centerPullStrength: 1, clusterStrength: 1 })
    expect(result.length).toBe(3)
    const usersNode = result.find((n) => n.id === 'users')!
    expect(usersNode.position.x).not.toBe(800)
    expect(usersNode.position.y).not.toBe(800)
  })

  it('零节点不崩溃', () => {
    const schema = makeSchema([])
    const result = postProcessLayout(schema, [])
    expect(result).toHaveLength(0)
  })

  it('单节点不崩溃', () => {
    const schema = makeSchema([])
    const nodes = [makeNode('users', 100, 100)]
    const result = postProcessLayout(schema, nodes)
    expect(result).toHaveLength(1)
    expect(result[0].position.x).toBe(100)
  })

  it('无关系时不移动节点', () => {
    const schema = makeSchema([])
    const nodes = [makeNode('users', 200, 300)]
    const result = postProcessLayout(schema, nodes)
    expect(result[0].position.x).toBe(200)
    expect(result[0].position.y).toBe(300)
  })
})
