import { describe, it, expect } from 'vitest'
import { parseSQLToERSchema } from '@/parser/sqlParser'
import { postProcessLayout } from '@/layout/postProcess'
import type { ERSchema, RFTableNodeData } from '@/types/er'
import type { Node } from '@xyflow/react'

/**
 * 生成 N 张表的 SQL DDL，结构类似电商系统：
 * - 5 张核心表 (users, products, categories, orders, reviews)
 * - 其余为扩展表，通过外键关联到核心表
 * - 每张表包含 6~12 个字段
 * - 生成约 N*0.8 条关系
 */
function generateLargeSQL(tableCount: number): string {
  const coreTables = [
    {
      name: 'users',
      fields: [
        'id INT PRIMARY KEY AUTO_INCREMENT',
        'email VARCHAR(255) NOT NULL UNIQUE',
        'password_hash VARCHAR(255) NOT NULL',
        'display_name VARCHAR(100)',
        'avatar_url VARCHAR(500)',
        'phone VARCHAR(20)',
        'status TINYINT DEFAULT 1',
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
        'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP',
      ],
    },
    {
      name: 'products',
      fields: [
        'id INT PRIMARY KEY AUTO_INCREMENT',
        'category_id INT NOT NULL',
        'name VARCHAR(200) NOT NULL',
        'description TEXT',
        'price DECIMAL(10,2) NOT NULL',
        'stock INT DEFAULT 0',
        'sku VARCHAR(100) UNIQUE',
        'image_url VARCHAR(500)',
        'weight DECIMAL(8,2)',
        'is_active TINYINT DEFAULT 1',
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
      ],
    },
    {
      name: 'categories',
      fields: [
        'id INT PRIMARY KEY AUTO_INCREMENT',
        'parent_id INT',
        'name VARCHAR(100) NOT NULL',
        'slug VARCHAR(100) UNIQUE',
        'description TEXT',
        'sort_order INT DEFAULT 0',
        'is_active TINYINT DEFAULT 1',
      ],
    },
    {
      name: 'orders',
      fields: [
        'id INT PRIMARY KEY AUTO_INCREMENT',
        'user_id INT NOT NULL',
        'order_number VARCHAR(50) UNIQUE NOT NULL',
        'status VARCHAR(20) DEFAULT \'pending\'',
        'total_amount DECIMAL(12,2) NOT NULL',
        'shipping_address TEXT',
        'payment_method VARCHAR(50)',
        'paid_at DATETIME',
        'shipped_at DATETIME',
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
      ],
    },
    {
      name: 'reviews',
      fields: [
        'id INT PRIMARY KEY AUTO_INCREMENT',
        'user_id INT NOT NULL',
        'product_id INT NOT NULL',
        'rating TINYINT NOT NULL',
        'title VARCHAR(200)',
        'content TEXT',
        'is_verified TINYINT DEFAULT 0',
        'created_at DATETIME DEFAULT CURRENT_TIMESTAMP',
      ],
    },
  ]

  const lines: string[] = []

  for (const t of coreTables) {
    lines.push(`CREATE TABLE ${t.name} (\n  ${t.fields.join(',\n  ')}\n);`)
  }

  for (let i = 0; i < tableCount - coreTables.length; i++) {
    const idx = String(i + 1).padStart(3, '0')
    const refTable = coreTables[i % coreTables.length].name
    const extraFields = [
      `id INT PRIMARY KEY AUTO_INCREMENT`,
      `${refTable}_id INT NOT NULL`,
      `name VARCHAR(100) NOT NULL`,
      `value TEXT`,
      `type VARCHAR(50) DEFAULT 'default'`,
      `status TINYINT DEFAULT 1`,
      `sort_order INT DEFAULT 0`,
      `metadata JSON`,
      `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
      `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    ]
    lines.push(`CREATE TABLE ext_data_${idx} (\n  ${extraFields.join(',\n  ')}\n);`)
  }

  for (let i = 0; i < tableCount - coreTables.length; i++) {
    const idx = String(i + 1).padStart(3, '0')
    const refTable = coreTables[i % coreTables.length].name
    lines.push(`ALTER TABLE ext_data_${idx} ADD FOREIGN KEY (${refTable}_id) REFERENCES ${refTable}(id);`)
  }

  lines.push('ALTER TABLE products ADD FOREIGN KEY (category_id) REFERENCES categories(id);')
  lines.push('ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users(id);')
  lines.push('ALTER TABLE reviews ADD FOREIGN KEY (user_id) REFERENCES users(id);')
  lines.push('ALTER TABLE reviews ADD FOREIGN KEY (product_id) REFERENCES products(id);')

  return lines.join('\n\n')
}

function checkNoOverlaps(nodes: Node<RFTableNodeData>[], padding = 32): string[] {
  const errors: string[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const wA = a.width ?? 220, hA = a.height ?? 100
      const wB = b.width ?? 220, hB = b.height ?? 100
      const aL = a.position.x, aR = a.position.x + wA
      const aT = a.position.y, aB = a.position.y + hA
      const bL = b.position.x, bR = b.position.x + wB
      const bT = b.position.y, bB = b.position.y + hB
      if (aL < bR + padding && aR > bL - padding && aT < bB + padding && aB > bT - padding) {
        errors.push(`${a.id} ↔ ${b.id}: overlap at (${a.position.x},${a.position.y}) vs (${b.position.x},${b.position.y})`)
      }
    }
  }
  return errors
}

const TABLE_SIZES = [50, 80, 100]

describe('大规模数据导入性能测试', () => {
  for (const size of TABLE_SIZES) {
    describe(`${size} 张表`, () => {
      let sql = ''
      let schema: ERSchema
      let parseTime = 0

      it('生成 SQL', () => {
        sql = generateLargeSQL(size)
        const tableCount = (sql.match(/CREATE TABLE/g) || []).length
        expect(tableCount).toBe(size)
      })

      it('解析 SQL', () => {
        const start = performance.now()
        schema = parseSQLToERSchema(sql)
        parseTime = performance.now() - start
        expect(schema.tables).toHaveLength(size)
        console.log(`  [${size}张] SQL解析耗时: ${parseTime.toFixed(1)}ms (${(parseTime / size).toFixed(2)}ms/表)`)
      })

      it('验证 schema 完整性', () => {
        for (const table of schema.tables) {
          expect(table.fields.length).toBeGreaterThanOrEqual(6)
          expect(table.fields.some(f => f.isPrimaryKey)).toBe(true)
        }
        const fkCount = schema.relationships.filter(r => r.type === 'N:1' || r.type === '1:N').length
        expect(fkCount).toBeGreaterThanOrEqual(size * 0.5)
        console.log(`  [${size}张] 关系数: ${schema.relationships.length}`)
      })

      it('布局后处理 (postProcessLayout) — 重叠减少验证', () => {
        const nodes: Node<RFTableNodeData>[] = schema.tables.map((t, i) => ({
          id: t.id,
          type: 'table' as const,
          position: {
            x: (i % 10) * 380,
            y: Math.floor(i / 10) * 420,
          },
          data: { table: t },
          width: 220,
          height: 12 * 28 + 36,
        }))

        const baselineOverlaps = checkNoOverlaps(nodes, 32).length

        const start = performance.now()
        const result = postProcessLayout(schema, nodes, { clusterStrength: 0.005, collisionPadding: 32 })
        const layoutTime = performance.now() - start

        expect(result).toHaveLength(size)
        const overlaps = checkNoOverlaps(result, 32)
        const improved = baselineOverlaps - overlaps.length
        const ratio = baselineOverlaps > 0 ? (improved / baselineOverlaps * 100).toFixed(1) : 'N/A'
        const convergence = layoutTime < 200 ? 'fast' : layoutTime < 500 ? 'ok' : 'slow'

        console.log(`  [${size}张] 布局耗时: ${layoutTime.toFixed(1)}ms (${convergence})`)
        console.log(`  [${size}张] 基线重叠: ${baselineOverlaps}, 处理后重叠: ${overlaps.length}, 改善: ${ratio}%`)

        if (overlaps.length > 0 && overlaps.length <= 5) {
          console.log(`  [${size}张] 重叠详情:`, overlaps)
        }

        expect(overlaps.length).toBeLessThanOrEqual(baselineOverlaps)

        const pairCount = (size * (size - 1)) / 2
        const overlapRate = overlaps.length / pairCount
        expect(overlapRate).toBeLessThan(0.1)

        const expectedMs = size * 2
        expect(layoutTime).toBeLessThan(expectedMs)
      })
    })
  }
})

describe('性能基准对比', () => {
  const BENCHMARK_SIZES = [50, 80, 100]
  const results: Array<{ size: number; parseMs: number; layoutMs: number }> = []

  for (const size of BENCHMARK_SIZES) {
    it(`${size}张 - 10次运行取中位数`, () => {
      const parseTimes: number[] = []
      const layoutTimes: number[] = []

      for (let run = 0; run < 10; run++) {
        const sql = generateLargeSQL(size)
        const parseStart = performance.now()
        const schema = parseSQLToERSchema(sql)
        parseTimes.push(performance.now() - parseStart)

        const nodes: Node<RFTableNodeData>[] = schema.tables.map((t, i) => ({
          id: t.id,
          type: 'table' as const,
          position: { x: (i % 10) * 380, y: Math.floor(i / 10) * 420 },
          data: { table: t },
          width: 220,
          height: 12 * 28 + 36,
        }))
        const layoutStart = performance.now()
        postProcessLayout(schema, nodes, { clusterStrength: 0.005, collisionPadding: 32 })
        layoutTimes.push(performance.now() - layoutStart)
      }

      parseTimes.sort((a, b) => a - b)
      layoutTimes.sort((a, b) => a - b)
      const medianParse = parseTimes[Math.floor(parseTimes.length / 2)]
      const medianLayout = layoutTimes[Math.floor(layoutTimes.length / 2)]

      results.push({ size, parseMs: medianParse, layoutMs: medianLayout })
      console.log(`  [${size}张] 中位数: 解析=${medianParse.toFixed(1)}ms, 布局=${medianLayout.toFixed(1)}ms`)
    })
  }

  it('结果汇总', () => {
    console.log('\n========== 性能基准 ==========')
    console.log('表数量 | 解析(ms) | 布局(ms) | 布局/表(ms)')
    console.log('-------|----------|----------|------------')
    for (const r of results) {
      console.log(
        ` ${String(r.size).padStart(5)} | ${r.parseMs.toFixed(1).padStart(7)} | ${r.layoutMs.toFixed(1).padStart(7)} | ${(r.layoutMs / r.size).toFixed(3).padStart(9)}`
      )
    }

    expect(results.length).toBe(BENCHMARK_SIZES.length)
    for (const r of results) {
      expect(r.parseMs).toBeLessThan(2000)
      expect(r.layoutMs).toBeLessThan(3000)
    }
  })
})
