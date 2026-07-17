# ERBeauti

> 粘贴 SQL，3 秒出美图 — 现代化 ER 图绘制工具

ERBeauti 是一个开源 ER 图绘制工具，支持从 SQL DDL、DBML、Prisma Schema 直接生成美观的实体关系图，也支持从 PostgreSQL、MySQL、SQLite、SQL Server、Oracle 等数据库反向工程生成 ER 图。

## 功能特性

- **一键导入** — 粘贴 SQL DDL、DBML、Prisma Schema，自动解析生成 ER 图
- **数据库反向工程** — 连接已有数据库，自动提取 Schema 生成 ER 图
- **智能布局** — 基于 ELK 自动布局，支持手动拖拽微调
- **多种表示法** — 支持表样式和 Chen 实体关系表示法
- **导出** — 导出为 SVG、PNG 等格式
- **命令面板** — `Cmd+K` 快速操作
- **数据源管理** — 保存和管理多个数据库连接
- **关系推断** — 物理外键缺失时根据命名约定自动推断关系
- **交互设计** — 画布树管理多个图表，数据源完整增删改查

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite, Tailwind CSS |
| 图表 | @xyflow/react (React Flow) |
| 布局 | ELK (Eclipse Layout Kernel) |
| 后端 | Python 3.14+, FastAPI, SQLAlchemy |
| 解析器 | SQL (node-sql-parser), DBML (@dbml/core), Prisma |
| 状态管理 | Zustand + Immer |
| 加密 | Fernet (cryptography) |

## 快速开始

### 前置依赖

- **Node.js** >= 20
- **Python** >= 3.14
- **npm** 或 **pnpm**
- [uv](https://docs.astral.sh/uv/)（推荐 Python 包管理）

### 安装

```bash
# 安装前端依赖
npm install

# 安装 Python 后端
cd python_part
uv sync --all-extras --dev
cd ..
```

### 启动

```bash
# Linux / macOS
bash scripts/start.sh

# Windows
scripts\start.bat
```

启动后：
- **后端** (FastAPI) 运行于 http://localhost:8000
- **前端** (Vite) 运行于 http://localhost:5173

### 停止

```bash
# Linux / macOS
bash scripts/end.sh

# Windows
scripts\end.bat
```

## 手动启动

```bash
# 终端 1：后端
cd python_part
uv run uvicorn erbeauti.api:app --reload --port 8000

# 终端 2：前端
npm run dev
```

## 项目结构

```
ERBeauti/
├── src/                        # React 前端
│   ├── components/             # UI 组件
│   │   ├── canvas/             # 画布渲染（TableNode、RelationshipEdge、Chen 节点）
│   │   ├── command-palette/    # Cmd+K 命令面板
│   │   ├── common/             # 共享 UI 基础组件
│   │   ├── dialogs/            # 导入、导出、设置对话框
│   │   ├── home/               # 首页组件
│   │   └── ui/                 # 底层 UI 组件
│   ├── pages/                  # HomePage、EditorPage
│   ├── parser/                 # SQL / DBML / Prisma 解析器
│   ├── layout/                 # ELK 布局引擎 + 路径路由
│   ├── store/                  # Zustand 状态管理
│   ├── api/                    # 后端 API 客户端函数
│   ├── types/                  # TypeScript 类型定义（ERSchema）
│   ├── hooks/                  # 自定义 React Hooks
│   ├── workers/                # Web Workers
│   └── data/                   # 示例数据 / 常量
├── python_part/                # Python 后端
│   ├── erbeauti/
│   │   ├── api.py              # FastAPI 服务（REST 端点）
│   │   ├── cli.py              # 命令行工具（erbeauti-cli）
│   │   ├── extract.py          # 原始元数据 → ERSchema 归一化
│   │   ├── models.py           # Pydantic ERSchema 模型
│   │   ├── api_models.py       # 请求/响应模型
│   │   ├── config.py           # 基于环境变量的配置
│   │   ├── crypto.py           # Fernet 密码加密
│   │   ├── system_db.py        # SQLite 应用状态持久化
│   │   ├── exceptions.py       # 领域异常层次结构
│   │   └── db/                 # 数据库方言适配器
│   │       ├── base.py         # 抽象方言基类
│   │       ├── factory.py      # URL → 方言解析
│   │       ├── sqlite.py       # SQLite 适配器
│   │       ├── postgres.py     # PostgreSQL 适配器
│   │       ├── mysql.py        # MySQL 适配器
│   │       ├── sqlserver.py    # SQL Server 适配器
│   │       └── oracle.py       # Oracle 适配器
│   ├── tests/                  # 后端测试套件
│   └── pyproject.toml
├── scripts/                    # 启动/停止脚本
│   ├── start.sh                # Linux / macOS
│   ├── end.sh
│   ├── start.bat               # Windows
│   ├── end.bat
│   ├── init-demo-db.ts         # 示例数据库初始化脚本
│   └── extract-samples.ts      # 示例数据生成器
├── data/                       # 运行时数据
│   ├── system.db               # 应用状态（数据源、画布树）
│   ├── secret.key              # 加密密钥（自动生成）
│   ├── blog.db                 # 示例数据库：博客平台
│   ├── demo.db                 # 示例数据库：产品展示
│   ├── ecommerce.db            # 示例数据库：电商系统
│   └── logs/                   # 服务日志
└── docs/                       # 文档资源
```

## 输入格式

ERBeauti 支持从以下格式生成图表：

| 格式 | 示例 |
|------|------|
| **SQL DDL** | `CREATE TABLE users (id INT PRIMARY KEY, name TEXT);` |
| **DBML** | `Table users { id int [pk] name varchar }` |
| **Prisma Schema** | `model User { id Int @id @default(autoincrement()) }` |
| **数据库 URL** | `postgresql://user:pass@host/db`（反向工程） |

## 导入方式

1. **直接粘贴** — 点击导入按钮或使用 `Cmd+K` → "Import SQL/DBML"
2. **连接数据库** — 输入连接 URL 或填写连接字段，反向工程已有数据库
3. **示例数据库** — 预置的示例数据库（博客、电商、产品展示），方便快速试用

## 数据库反向工程

| 数据库 | 连接 URL 示例 |
|--------|--------------|
| PostgreSQL | `postgresql://user:pass@localhost:5432/dbname` |
| MySQL | `mysql+pymysql://user:pass@localhost:3306/dbname` |
| SQLite | `sqlite:///path/to/db.sqlite` |
| SQL Server | `mssql+pyodbc://user:pass@dsn` |
| Oracle | `oracle+oracledb://user:pass@localhost:1521/FREEPDB1` |

## API 端点

后端提供以下 REST 端点：

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/dialects` | 列出支持的数据库方言 |
| GET | `/sample-databases` | 列出示例 SQLite 数据库 |
| POST | `/test-connection` | 测试数据库连接 |
| POST | `/tables` | 列出数据库中的表 |
| POST | `/reverse-engineer` | 提取完整数据库 Schema |
| GET | `/datasources` | 列出已保存的数据源 |
| POST | `/datasources` | 保存新数据源 |
| GET | `/datasources/{id}` | 获取数据源详情 |
| PUT | `/datasources/{id}` | 更新数据源 |
| DELETE | `/datasources/{id}` | 删除数据源 |
| GET | `/canva-tree` | 列出画布树节点 |
| POST | `/canva-tree` | 创建画布/文件夹节点 |
| PUT | `/canva-tree/{id}` | 更新画布/文件夹节点 |
| DELETE | `/canva-tree/{id}` | 删除画布/文件夹节点 |

详细 API 文档（含错误码和配置参考）请参见 `python_part/README.zh.md`。

## 开发

```bash
# 前端开发服务器
npm run dev

# 后端开发服务器（热重载）
cd python_part
uv run uvicorn erbeauti.api:app --reload --port 8000

# 运行测试
npm test                          # 前端 (Vitest)
cd python_part && uv run pytest   # 后端 (pytest)

# 代码检查
npm run lint                      # 前端 (oxlint)
cd python_part && uv run ruff check  # 后端 (ruff)

# 类型检查
cd python_part && uv run mypy erbeauti  # 后端 (mypy)

# 构建
npm run build
```

## 配置

关键环境变量（在项目根目录 `.env` 或 `python_part/.env` 中设置）：

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `ERBEAUTI_API_HOST` | `0.0.0.0` | API 服务绑定地址 |
| `ERBEAUTI_API_PORT` | `8000` | API 服务端口 |
| `ERBEAUTI_DATA_DIR` | `./data` | 系统数据目录 |
| `ERBEAUTI_ALLOW_PRIVATE_NETWORKS` | `true` | 是否允许私有 IP 连接（生产环境设为 `false`） |
| `ERBEAUTI_SECRET_KEY` | 自动生成 | Fernet 加密密钥（32 字节 base64） |

## 安全

- **SSRF 防护**：生产环境中阻止连接私有/保留 IP 范围
- **SQLite 路径验证**：防止目录遍历攻击
- **密码脱敏**：密码永不记录日志或返回 API 响应
- **加密存储**：数据源密码使用 Fernet 加密存储
- 尽量使用只读的数据库用户并授予最小权限

## License

MIT
