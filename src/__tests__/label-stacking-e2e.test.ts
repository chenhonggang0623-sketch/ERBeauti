import { describe, it, expect } from 'vitest'
import { parseSQLToERSchema } from '@/parser/sqlParser'
import { resolveLabelCollisions, resolveLabelNodeOverlaps, assignEdgeLanes } from '@/layout/path-routing'
import type { ElkSection, RFRelationshipEdgeData, ERSchema } from '@/types/er'
import type { Edge, Node } from '@xyflow/react'
import type { RFTableNodeData } from '@/types/er'

/**
 * 模拟 ELK 后的 section：
 * - 源在表右边缘 (x=200, y=varies)，目标在表左边缘 (x=0, y=varies)
 * - 端点位置根据 field index 错开
 */
function buildSection(_relationshipIndex: number, sourceY: number, targetY: number): ElkSection {
  return {
    startPoint: { x: 200, y: sourceY },
    endPoint: { x: 0, y: targetY },
    bendPoints: [
      { x: 100, y: sourceY },
      { x: 100, y: targetY },
    ],
  }
}

function buildNodes(schema: ERSchema, tableCount: number): Node<RFTableNodeData>[] {
  // 简单网格布局：每行 4 张表
  return schema.tables.slice(0, tableCount).map((t, i) => ({
    id: t.id,
    type: 'table' as const,
    position: { x: (i % 4) * 320, y: Math.floor(i / 4) * 280 },
    data: { table: t },
    width: 220,
    height: 200,
  }))
}

describe('100 表场景标签布局验证', () => {
  it('从子集 SQL 构造多条边进入同一目标表，标签位置两两不重叠', () => {
    // 多个表都引用 users.id，模拟 shipping_001, shipping_002... 引用 orders.id 的场景
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT);
      CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
      CREATE TABLE orders_001 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
      CREATE TABLE orders_002 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
      CREATE TABLE orders_003 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
      CREATE TABLE orders_004 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
      CREATE TABLE orders_005 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
      CREATE TABLE orders_006 (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL REFERENCES users(id), total DECIMAL(10,2));
    `
    const schema = parseSQLToERSchema(sql)
    expect(schema.relationships.length).toBe(7)

    // 构造 edges，每条边都从各自 source 表出发，到 users.id
    const edges: Edge<RFRelationshipEdgeData>[] = schema.relationships.map((rel, i) => {
      const section = buildSection(i, 100 + i * 10, 50)
      return {
        id: rel.id,
        source: rel.sourceTableId,
        target: rel.targetTableId,
        type: 'relationship',
        data: { relationship: rel, sections: [section] },
      }
    })

    // 分配 lane
    const laneMap = assignEdgeLanes(edges)
    for (const edge of edges) {
      const lane = laneMap.get(edge.id)
      if (lane && edge.data) {
        edge.data = { ...edge.data, lane }
      }
    }

    // 构造 nodes
    const nodes = buildNodes(schema, 8)

    // 第一轮：先推离节点
    let positions = new Map(
      edges.map((e) => {
        const section = e.data!.sections![0]
        const offset = e.data?.lane
          ? (e.data.lane.laneIndex - (e.data.lane.laneCount - 1) / 2) * 80
          : 0
        const mid = section.bendPoints![Math.floor(section.bendPoints!.length / 2)]
        return [e.id, { labelX: mid.x, labelY: mid.y + offset, anchorX: mid.x, anchorY: mid.y + offset }] as const
      }),
    )
    positions = resolveLabelNodeOverlaps(positions, nodes)

    // 交替迭代：碰撞解决 ↔ 推离节点，与 elk.worker.ts 保持一致
    for (let iter = 0; iter < 4; iter++) {
      positions = resolveLabelCollisions(
        edges.map((e) => {
          const adj = positions.get(e.id)
          return {
            id: e.id,
            sections: e.data!.sections!,
            lane: e.data?.lane,
            labelX: adj?.labelX,
            labelY: adj?.labelY,
            anchorX: adj?.anchorX,
            anchorY: adj?.anchorY,
          }
        }),
      )
      positions = resolveLabelNodeOverlaps(positions, nodes)
    }

    // 验证：所有标签两两不重叠（基于 AABB 矩形）
    console.log('positions', Array.from(positions.entries()))
    const LABEL_W = 140
    const LABEL_H = 50
    const entries = Array.from(positions.entries()).map(([id, p]) => ({
      id,
      left: p.labelX - LABEL_W / 2,
      right: p.labelX + LABEL_W / 2,
      top: p.labelY - LABEL_H / 2,
      bottom: p.labelY + LABEL_H / 2,
    }))

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]
        const b = entries[j]
        const overlap =
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
        expect(overlap).toBe(false)
      }
    }
  })

  it('模拟 order_items 同时有 order_id 和 product_id 两条边进入不同目标', () => {
    const sql = `
      CREATE TABLE users (id INT PRIMARY KEY);
      CREATE TABLE orders (id INT PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id));
      CREATE TABLE products (id INT PRIMARY KEY);
      CREATE TABLE order_items (
        id INT PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id),
        product_id INT NOT NULL REFERENCES products(id),
        quantity INT
      );
    `
    const schema = parseSQLToERSchema(sql)
    expect(schema.relationships.length).toBe(3)

    const edges: Edge<RFRelationshipEdgeData>[] = schema.relationships.map((rel) => {
      const section: ElkSection = {
        startPoint: { x: 400, y: 200 },
        endPoint: { x: 0, y: 100 },
        bendPoints: [{ x: 200, y: 200 }, { x: 200, y: 100 }],
      }
      return {
        id: rel.id,
        source: rel.sourceTableId,
        target: rel.targetTableId,
        type: 'relationship',
        data: { relationship: rel, sections: [section] },
      }
    })

    let positions = new Map(
      edges.map((e) => {
        const section = e.data!.sections![0]
        const mid = section.bendPoints![Math.floor(section.bendPoints!.length / 2)]
        return [e.id, { labelX: mid.x, labelY: mid.y, anchorX: mid.x, anchorY: mid.y }] as const
      }),
    )
    positions = resolveLabelCollisions(
      edges.map((e) => {
        const adj = positions.get(e.id)
        return {
          id: e.id,
          sections: e.data!.sections!,
          labelX: adj?.labelX,
          labelY: adj?.labelY,
          anchorX: adj?.anchorX,
          anchorY: adj?.anchorY,
        }
      }),
    )

    // 验证：所有标签中心两两距离 >= 标签高度 + gap（法向错开后的最小不重叠距离）
    const arr = Array.from(positions.values())
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const d = Math.hypot(arr[i].labelX - arr[j].labelX, arr[i].labelY - arr[j].labelY)
        expect(d).toBeGreaterThanOrEqual(100)
      }
    }
  })
})
