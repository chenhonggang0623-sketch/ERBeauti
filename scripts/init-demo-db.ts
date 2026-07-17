import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'fs'
import { resolve } from 'path'

const DATA_DIR = resolve('data')

function dbPath(name: string) {
  return resolve(DATA_DIR, name)
}

function initDatabase(name: string, execSql: (db: Database.Database) => void) {
  const path = dbPath(name)
  if (existsSync(path)) {
    console.log(`${path} already exists, skipping`)
    return
  }
  const db = new Database(path)
  execSql(db)
  db.close()
  console.log(`Created ${path}`)
}

// ========== 博客平台 blog.db ==========
initDatabase('blog.db', (db) => {
  db.exec(`
    CREATE TABLE blog_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      published_at TEXT,
      FOREIGN KEY (user_id) REFERENCES blog_users(id)
    );

    CREATE TABLE blog_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES blog_posts(id),
      FOREIGN KEY (user_id) REFERENCES blog_users(id)
    );

    CREATE INDEX idx_blog_posts_user_id ON blog_posts(user_id);
    CREATE INDEX idx_blog_comments_post_id ON blog_comments(post_id);
    CREATE INDEX idx_blog_comments_user_id ON blog_comments(user_id);
  `)

  db.prepare('INSERT OR IGNORE INTO blog_users (id, username, email) VALUES (?, ?, ?)').run(1, 'alice', 'alice@example.com')
  db.prepare('INSERT OR IGNORE INTO blog_users (id, username, email) VALUES (?, ?, ?)').run(2, 'bob', 'bob@example.com')
  db.prepare('INSERT OR IGNORE INTO blog_users (id, username, email) VALUES (?, ?, ?)').run(3, 'carol', 'carol@example.com')

  db.prepare('INSERT OR IGNORE INTO blog_posts (id, user_id, title, content, published_at) VALUES (?, ?, ?, ?, ?)').run(1, 1, 'Hello ERBeauti', 'This is a sample post.', '2026-07-01 10:00:00')
  db.prepare('INSERT OR IGNORE INTO blog_posts (id, user_id, title, content, published_at) VALUES (?, ?, ?, ?, ?)').run(2, 1, 'Database Design Tips', 'Normalize your schema.', '2026-07-02 14:30:00')
  db.prepare('INSERT OR IGNORE INTO blog_posts (id, user_id, title, content, published_at) VALUES (?, ?, ?, ?, ?)').run(3, 2, 'My First Post', 'Just getting started.', '2026-07-03 09:15:00')

  db.prepare('INSERT OR IGNORE INTO blog_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)').run(1, 1, 2, 'Great tool!')
  db.prepare('INSERT OR IGNORE INTO blog_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)').run(2, 1, 3, 'Thanks for sharing.')
  db.prepare('INSERT OR IGNORE INTO blog_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)').run(3, 2, 2, 'Very helpful.')
})

// ========== 产品展示库 demo.db ==========
initDatabase('demo.db', (db) => {
  db.exec(`
    CREATE TABLE showcase_categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      parent_id   INTEGER REFERENCES showcase_categories(id),
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE showcase_users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      avatar_url  TEXT,
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','banned')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE showcase_products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL CHECK(price >= 0),
      stock       INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER REFERENCES showcase_categories(id),
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','draft','archived')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE showcase_orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES showcase_users(id),
      status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled')),
      total       REAL NOT NULL DEFAULT 0,
      note        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE showcase_order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES showcase_orders(id),
      product_id  INTEGER NOT NULL REFERENCES showcase_products(id),
      quantity    INTEGER NOT NULL CHECK(quantity > 0),
      price       REAL NOT NULL CHECK(price >= 0)
    );

    CREATE TABLE showcase_reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  INTEGER NOT NULL REFERENCES showcase_products(id),
      user_id     INTEGER NOT NULL REFERENCES showcase_users(id),
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      content     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 数据库建模模式演示
    CREATE TABLE feature_polymorphic (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type   TEXT NOT NULL,
      item_id     INTEGER NOT NULL,
      key         TEXT NOT NULL,
      value       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE feature_junction (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      left_id     INTEGER NOT NULL,
      right_id    INTEGER NOT NULL,
      role        TEXT,
      weight      REAL NOT NULL DEFAULT 1.0,
      UNIQUE(left_id, right_id, role)
    );

    CREATE TABLE feature_enum (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      priority    TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      label       TEXT
    );

    CREATE TABLE feature_audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name  TEXT NOT NULL,
      record_id   INTEGER NOT NULL,
      action      TEXT NOT NULL CHECK(action IN ('INSERT','UPDATE','DELETE')),
      old_value   TEXT,
      new_value   TEXT,
      changed_by  TEXT,
      changed_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE feature_tree (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      parent_id   INTEGER REFERENCES feature_tree(id),
      sort_order  INTEGER NOT NULL DEFAULT 0,
      depth       INTEGER NOT NULL DEFAULT 0
    );
  `)

  // Seed showcase_categories
  const insCat = db.prepare('INSERT INTO showcase_categories (name, parent_id, sort_order) VALUES (?, ?, ?)')
  insCat.run('电子产品', null, 1)
  insCat.run('服装鞋帽', null, 2)
  insCat.run('手机', 1, 1)
  insCat.run('电脑', 1, 2)
  insCat.run('男装', 2, 1)
  insCat.run('女装', 2, 2)

  // Seed showcase_users
  const insUser = db.prepare('INSERT INTO showcase_users (name, email, status) VALUES (?, ?, ?)')
  insUser.run('张三', 'zhangsan@example.com', 'active')
  insUser.run('李四', 'lisi@example.com', 'active')
  insUser.run('王五', 'wangwu@example.com', 'inactive')

  // Seed showcase_products
  const insProduct = db.prepare('INSERT INTO showcase_products (name, description, price, stock, category_id, status) VALUES (?, ?, ?, ?, ?, ?)')
  insProduct.run('iPhone 15', '最新款智能手机', 6999, 100, 3, 'active')
  insProduct.run('MacBook Pro', 'M3 芯片 14 英寸', 14999, 50, 4, 'active')
  insProduct.run('T恤', '纯棉圆领', 99, 500, 5, 'active')
  insProduct.run('连衣裙', '夏季新款', 299, 200, 6, 'active')
  insProduct.run('AirPods Pro', '降噪耳机', 1999, 300, 3, 'active')

  // Seed showcase_orders
  const insOrder = db.prepare('INSERT INTO showcase_orders (user_id, status, total) VALUES (?, ?, ?)')
  insOrder.run(1, 'delivered', 7198)
  insOrder.run(1, 'paid', 14999)
  insOrder.run(2, 'shipped', 299)
  insOrder.run(3, 'cancelled', 99)

  // Seed order_items
  const insItem = db.prepare('INSERT INTO showcase_order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)')
  insItem.run(1, 1, 1, 6999)
  insItem.run(1, 5, 1, 1999)
  insItem.run(2, 2, 1, 14999)
  insItem.run(3, 4, 1, 299)
  insItem.run(4, 3, 1, 99)

  // Seed showcase_reviews
  const insReview = db.prepare('INSERT INTO showcase_reviews (product_id, user_id, rating, content) VALUES (?, ?, ?, ?)')
  insReview.run(1, 1, 5, '非常好用，推荐！')
  insReview.run(1, 2, 4, '整体不错，续航再长点就好了')
  insReview.run(2, 1, 5, '性能强劲，编译速度快了不止一倍')
  insReview.run(3, 3, 3, '一般般，面料有点薄')

  // Seed feature_polymorphic
  const insPoly = db.prepare('INSERT INTO feature_polymorphic (item_type, item_id, key, value) VALUES (?, ?, ?, ?)')
  insPoly.run('comment', 1, 'author_ip', '192.168.1.1')
  insPoly.run('comment', 1, 'user_agent', 'Mozilla/5.0')
  insPoly.run('review', 3, 'platform', 'iOS')
  insPoly.run('review', 3, 'verified_purchase', 'true')

  // Seed feature_junction
  const insJun = db.prepare('INSERT INTO feature_junction (left_id, right_id, role, weight) VALUES (?, ?, ?, ?)')
  insJun.run(1, 2, 'friend', 0.8)
  insJun.run(1, 3, 'blocked', 0)
  insJun.run(2, 3, 'friend', 0.6)

  // Seed feature_enum
  const insEnum = db.prepare('INSERT INTO feature_enum (status, priority, label) VALUES (?, ?, ?)')
  insEnum.run('pending', 'high', '紧急待处理')
  insEnum.run('approved', 'normal', '已通过申请')
  insEnum.run('rejected', 'low', '不符合条件')

  // Seed feature_audit_log
  const insAudit = db.prepare('INSERT INTO feature_audit_log (table_name, record_id, action, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)')
  insAudit.run('showcase_products', 1, 'UPDATE', '{"price": 6999}', '{"price": 6599}', 'admin')
  insAudit.run('showcase_orders', 2, 'UPDATE', '{"status": "paid"}', '{"status": "shipped"}', 'system')
  insAudit.run('showcase_users', 1, 'UPDATE', '{"status": "active"}', '{"status": "active"}', 'admin')

  // Seed feature_tree
  const insTree = db.prepare('INSERT INTO feature_tree (name, parent_id, sort_order, depth) VALUES (?, ?, ?, ?)')
  insTree.run('根节点', null, 0, 0)
  insTree.run('分类 A', 1, 1, 1)
  insTree.run('分类 B', 1, 2, 1)
  insTree.run('子分类 A1', 2, 1, 2)
  insTree.run('子分类 A2', 2, 2, 2)
  insTree.run('子分类 B1', 3, 1, 2)
})

// ========== 电商核心表 ecommerce.db ==========
initDatabase('ecommerce.db', (db) => {
  db.exec(`
    CREATE TABLE users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      nickname    TEXT,
      avatar      TEXT,
      phone       TEXT,
      status      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id   INTEGER REFERENCES categories(id),
      name        TEXT NOT NULL,
      slug        TEXT UNIQUE,
      description TEXT,
      sort_order  INTEGER DEFAULT 0,
      is_active   INTEGER DEFAULT 1
    );

    CREATE TABLE products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL,
      stock       INTEGER DEFAULT 0,
      sku         TEXT UNIQUE,
      image_url   TEXT,
      weight      REAL,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      order_number    TEXT NOT NULL UNIQUE,
      status          TEXT DEFAULT 'pending',
      total_amount    REAL NOT NULL,
      shipping_addr   TEXT,
      payment_method  TEXT,
      paid_at         TEXT,
      shipped_at      TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      title       TEXT,
      content     TEXT,
      is_verified INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE order_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL DEFAULT 1,
      unit_price  REAL NOT NULL
    );

    CREATE TABLE carts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      product_id  INTEGER NOT NULL REFERENCES products(id),
      quantity    INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE addresses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      tag         TEXT DEFAULT 'default',
      receiver    TEXT NOT NULL,
      phone       TEXT NOT NULL,
      province    TEXT,
      city        TEXT,
      district    TEXT,
      detail      TEXT,
      is_default  INTEGER DEFAULT 0
    );

    CREATE TABLE payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id    INTEGER NOT NULL REFERENCES orders(id),
      method      TEXT NOT NULL,
      amount      REAL NOT NULL,
      status      TEXT DEFAULT 'pending',
      paid_at     TEXT,
      trade_no    TEXT
    );
  `)

  // Seed users
  db.prepare('INSERT OR IGNORE INTO users (id, email, password, nickname) VALUES (?, ?, ?, ?)').run(1, 'admin@test.com', 'hashed_pwd_1', 'Admin')
  db.prepare('INSERT OR IGNORE INTO users (id, email, password, nickname) VALUES (?, ?, ?, ?)').run(2, 'user@test.com', 'hashed_pwd_2', 'TestUser')

  // Seed categories
  db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, parent_id) VALUES (?, ?, ?, ?)').run(1, 'Electronics', 'electronics', null)
  db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, parent_id) VALUES (?, ?, ?, ?)').run(2, 'Clothing', 'clothing', null)
  db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, parent_id) VALUES (?, ?, ?, ?)').run(3, 'Phones', 'phones', 1)

  // Seed products
  db.prepare('INSERT OR IGNORE INTO products (id, category_id, name, price, stock, sku) VALUES (?, ?, ?, ?, ?, ?)').run(1, 1, 'Smartphone X', 5999.00, 100, 'PHN-X-001')
  db.prepare('INSERT OR IGNORE INTO products (id, category_id, name, price, stock, sku) VALUES (?, ?, ?, ?, ?, ?)').run(2, 2, 'T-Shirt Basic', 99.00, 500, 'TSH-B-001')

  // Seed orders
  db.prepare('INSERT OR IGNORE INTO orders (id, user_id, order_number, status, total_amount) VALUES (?, ?, ?, ?, ?)').run(1, 1, 'ORD-2024-0001', 'paid', 6098.00)

  // Seed order_items
  db.prepare('INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)').run(1, 1, 1, 1, 5999.00)
  db.prepare('INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)').run(2, 1, 2, 1, 99.00)

  // Seed reviews
  db.prepare('INSERT OR IGNORE INTO reviews (id, user_id, product_id, rating, title, content) VALUES (?, ?, ?, ?, ?, ?)').run(1, 2, 1, 5, 'Great phone!', 'Very satisfied with this purchase.')
})
