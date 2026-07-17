# ERBeauti 数据源配置 API 规范

> 版本：v1.0
> 日期：2026-07-03
> 状态：草案，待前后端评审

## 1. 设计目标

为 ERBeauti 新增“动态配置数据源”功能，统一前后端在数据库连接、方言选择、连接测试、逆向工程生成 ERSchema 过程中的数据契约、错误处理与配置方式。

本规范在兼容现有 `/reverse-engineer` 接口行为的前提下，新增 `/test-connection` 与分字段连接能力，并为未来支持连接保存、多数据源切换预留扩展点。

---

## 2. 关键决策结论

| 问题 | 决策 | 说明 |
|------|------|------|
| 1. 前端是否同时支持“完整 URL”与“分字段输入” | **是** | 默认展示分字段输入（对非技术用户友好），高级用户可切换为完整 URL 直接编辑 |
| 2. 是否新增 `/test-connection` | **是** | 单独接口，轻量、仅验证连通性，不执行昂贵的 schema 抽取 |
| 3. 后端是否新增按字段接收连接 | **是** | `/reverse-engineer` 与 `/test-connection` 均同时支持 `connection_url` 和 `connection_fields`，二者互斥 |
| 4. 错误码与错误信息 | 统一 `{ code, message, detail?, retryable? }` | 见第 4 节 |
| 5. CORS 配置 | 生产环境必须可配置，禁止默认 `*` | 见第 7 节 |
| 6. 前端 API 封装位置 | `src/api/` | 新增 `client.ts`、`datasource.ts`、`types.ts` |
| 7. 拦截器与统一错误处理 | **需要** | 请求拦截注入 baseURL/timeout，响应拦截统一转换错误码并 toast |
| 8. 后端服务地址配置 | `VITE_API_BASE_URL` 环境变量 / `.env` 文件 | 见第 7 节 |
| 9. URL 特殊字符处理 | 用户名/密码/数据库名必须 URL 编码 | 见第 3 节 |
| 10. 超时设置 | **需要** | `/test-connection` 10s，`/reverse-engineer` 60s，前端默认 30s |

---

## 3. API 接口列表

### 3.1 公共约定

- 基础路径：`{API_BASE_URL}`，默认本地开发为 `http://localhost:8000`
- 请求内容类型：`Content-Type: application/json`
- 响应内容类型：`application/json`
- 时间格式：ISO 8601（如有）

### 3.2 数据模型

#### ConnectionFields（分字段连接信息）

```json
{
  "dialect": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "erbeauti",
  "username": "dbuser",
  "password": "dbpass",
  "options": "sslmode=require&connect_timeout=10"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dialect | string | 是 | 数据库方言，枚举见 `/dialects` |
| host | string | 否 | 主机名或 IP；`sqlite` 可不填 |
| port | integer | 否 | 端口号；不填使用各方言默认值 |
| database | string | 否 | 数据库名 / SID / Service Name；`sqlite` 为文件路径 |
| username | string | 否 | 用户名 |
| password | string | 否 | 密码 |
| options | string | 否 | 附加连接参数，格式 `key1=value1&key2=value2` |

#### ApiError（统一错误响应）

```json
{
  "code": "DB_CONNECTION_FAILED",
  "message": "无法连接到数据库，请检查地址、端口或凭据。",
  "detail": "connection to server at \"192.168.1.100\", port 5432 failed: Connection refused",
  "retryable": true
}
```

### 3.3 `GET /health`

健康检查，保持不变。

**响应：**

```json
{
  "status": "ok"
}
```

### 3.4 `GET /dialects`

列出支持的数据库方言，保持不变。

**响应：**

```json
{
  "success": true,
  "supported_dialects": ["mariadb", "mssql", "mssql+pyodbc", "mysql", "oracle", "oracle+oracledb", "postgres", "postgresql", "sqlite", "sqlite+pysqlite"]
}
```

### 3.5 `POST /test-connection`

**功能**：验证数据库连接是否可用，不执行 schema 抽取。

**请求体：**

```json
{
  "connection_url": "postgresql://dbuser:dbpass@localhost:5432/erbeauti",
  "connection_fields": {
    "dialect": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "erbeauti",
    "username": "dbuser",
    "password": "dbpass"
  }
}
```

约束：
- `connection_url` 与 `connection_fields` 必须且只能提供一个。
- 若同时提供，返回 `400 VALIDATION_ERROR`。

**成功响应（200）：**

```json
{
  "success": true,
  "elapsed_ms": 42,
  "dialect": "postgresql",
  "server_version": "PostgreSQL 15.4"
}
```

**失败响应：** 统一 `ApiError` 结构，HTTP 状态码按错误类型返回。

### 3.6 `POST /reverse-engineer`

在现有接口基础上扩展，同时支持 `connection_url` 与 `connection_fields`。

**请求体：**

```json
{
  "connection_url": "postgresql://dbuser:dbpass@localhost:5432/erbeauti",
  "connection_fields": {
    "dialect": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "erbeauti",
    "username": "dbuser",
    "password": "dbpass"
  },
  "schema_name": "erbeauti",
  "infer_relationships": true
}
```

约束：
- `connection_url` 与 `connection_fields` 必须且只能提供一个。
- `schema_name` 与 `infer_relationships` 保持原有语义。

**成功响应（200）：**

```json
{
  "success": true,
  "schema": {
    "id": "...",
    "name": "erbeauti",
    "tables": [...],
    "relationships": [...],
    "enums": [...]
  }
}
```

注意：`schema` 是 `schema_data` 的序列化别名，前端接收字段为 `schema`。

**失败响应：** 统一 `ApiError` 结构。

---

## 4. 错误码设计

所有错误响应统一返回以下 JSON 结构：

```json
{
  "code": "ERROR_CODE",
  "message": "面向用户的简短错误说明",
  "detail": "可选的技术详情，仅开发环境返回",
  "retryable": true
}
```

### 4.1 错误码表

| HTTP 状态 | 错误码 | 含义 | 触发场景 | retryable |
|-----------|--------|------|----------|-----------|
| 400 | `VALIDATION_ERROR` | 请求参数校验失败 | 同时传了 url 和 fields、必填字段缺失、端口越界 | false |
| 400 | `UNSUPPORTED_DIALECT` | 不支持的方言 | dialect 不在 `/dialects` 列表中 | false |
| 400 | `INVALID_CONNECTION_URL` | 连接 URL 格式错误 | URL 缺少 scheme、无法解析 | false |
| 401 | `AUTHENTICATION_FAILED` | 身份验证失败 | 用户名/密码错误 | true |
| 403 | `INSUFFICIENT_PRIVILEGES` | 权限不足 | 无权限读取 information_schema / 系统表 | false |
| 404 | `DATABASE_NOT_FOUND` | 数据库不存在 | database 名错误 | false |
| 408 | `CONNECTION_TIMEOUT` | 连接超时 | 网络不可达、防火墙、数据库无响应 | true |
| 502 | `UPSTREAM_CONNECTION_ERROR` | 上游数据库连接失败 | DNS 失败、端口未监听 | true |
| 500 | `SCHEMA_EXTRACTION_FAILED` | Schema 抽取失败 | 方言适配器内部异常 | true |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 未预期的异常 | true |

### 4.2 前端错误处理建议

- `VALIDATION_ERROR` / `INVALID_CONNECTION_URL`：聚焦到对应表单项，显示具体字段错误。
- `AUTHENTICATION_FAILED`：提示重新输入用户名/密码。
- `CONNECTION_TIMEOUT` / `UPSTREAM_CONNECTION_ERROR`：提示检查网络、防火墙、地址端口，提供“重试”按钮。
- `INSUFFICIENT_PRIVILEGES`：提示需要更高权限账号。
- `SCHEMA_EXTRACTION_FAILED` / `INTERNAL_ERROR`：显示通用错误 + 错误码，建议用户查看日志或反馈。

---

## 5. 连接 URL 组装规则（分字段 → URL）

### 5.1 组装算法

后端或前端均可组装，建议**统一在后端组装**，避免前后端实现不一致。

伪代码：

```python
from urllib.parse import quote_plus

def build_connection_url(fields: ConnectionFields) -> str:
    dialect = fields.dialect
    if dialect == "sqlite":
        return f"{dialect}:///{fields.database}"

    username = quote_plus(fields.username or "")
    password = quote_plus(fields.password or "") if fields.password else ""
    host = fields.host or "localhost"
    port = f":{fields.port}" if fields.port else ""
    database = quote_plus(fields.database or "")

    auth = f"{username}:{password}@" if password else f"{username}@" if username else ""
    options = f"?{fields.options}" if fields.options else ""

    return f"{dialect}://{auth}{host}{port}/{database}{options}"
```

### 5.2 各方言默认端口

| 方言 | 默认端口 | 说明 |
|------|----------|------|
| postgresql / postgres | 5432 | |
| mysql / mariadb | 3306 | |
| mssql / mssql+pyodbc | 1433 | |
| oracle / oracle+oracledb | 1521 | |
| sqlite / sqlite+pysqlite | - | 文件路径 |

### 5.3 特殊字符处理

用户名、密码、数据库名中若包含 `@`、`:`、`/`、`?`、`#`、`&`、`=`、`%`、`空格` 等字符，必须使用 `urllib.parse.quote_plus`（后端）或 `encodeURIComponent`（前端预览）进行编码。

示例：

| 原始值 | 编码后 |
|--------|--------|
| `p@ss:w0rd` | `p%40ss%3Aw0rd` |
| `my db` | `my+db` |
| `user@domain` | `user%40domain` |

注意：
- 后端组装时，**不要对整个 URL 再次编码**，仅对用户名、密码、database 字段编码。
- 前端在“完整 URL”预览模式下，可实时展示组装后的 URL 供用户核对。

### 5.4 SQLite 特殊规则

- `dialect` 为 `sqlite` 时，`database` 字段表示文件路径。
- 路径支持绝对路径与相对路径。
- 内存数据库：`database` 填写 `:memory:`，生成 URL `sqlite:///:memory:`。
- 路径中的特殊字符按文件系统规则处理，不做 URL 编码。

### 5.5 Oracle 特殊规则

- `database` 字段可填写 SID（如 `ORCL`）或 Service Name（如 `//host/ORCL`）。
- 若填写 Service Name 且包含 `/`，按规则 5.3 进行编码，后端解码后再拼接。

---

## 6. 前端 API 封装层设计建议

### 6.1 目录结构

```
src/
  api/
    client.ts          # 通用 axios/fetch 客户端、拦截器、超时、baseURL
    datasource.ts      # 数据源相关接口：testConnection、reverseEngineer、listDialects
    types.ts           # API 相关 TS 类型（ApiError、ConnectionFields 等）
    index.ts           # 统一导出
  config/
    api.ts             # API 配置：baseURL、超时、环境判断
```

> 当前项目未引入 axios，依赖包较少。若为了保持轻量，可使用原生 `fetch` 封装；若需要更完善的拦截器、取消请求、上传进度等能力，可引入 `axios`。

### 6.2 类型定义（src/api/types.ts）

```typescript
export interface ConnectionFields {
  dialect: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  options?: string
}

export interface TestConnectionRequest {
  connection_url?: string
  connection_fields?: ConnectionFields
}

export interface ReverseEngineerRequest extends TestConnectionRequest {
  schema_name?: string
  infer_relationships?: boolean
}

export interface ApiError {
  code: string
  message: string
  detail?: string
  retryable?: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}
```

### 6.3 客户端封装（src/api/client.ts）

职责：
- 读取 `import.meta.env.VITE_API_BASE_URL` 作为 baseURL。
- 默认超时：GET 10s，POST 30s（`/reverse-engineer` 60s）。
- 请求拦截：注入 `Content-Type`、可选 Authorization。
- 响应拦截：非 2xx 统一抛出 `ApiError`。
- 超时错误统一转换为 `CONNECTION_TIMEOUT`。

### 6.4 数据源 API（src/api/datasource.ts）

```typescript
import { client } from './client'
import type {
  ConnectionFields,
  ReverseEngineerRequest,
  TestConnectionRequest,
  TestConnectionResponse,
  ReverseEngineerResponse,
  DialectsResponse,
} from './types'

export async function listDialects(): Promise<DialectsResponse> {
  return client.get('/dialects')
}

export async function testConnection(
  payload: TestConnectionRequest,
  signal?: AbortSignal,
): Promise<TestConnectionResponse> {
  return client.post('/test-connection', payload, {
    timeout: 10000,
    signal,
  })
}

export async function reverseEngineer(
  payload: ReverseEngineerRequest,
  signal?: AbortSignal,
): Promise<ReverseEngineerResponse> {
  return client.post('/reverse-engineer', payload, {
    timeout: 60000,
    signal,
  })
}
```

### 6.5 错误处理与 UI 反馈

- 统一在 `client.ts` 将 HTTP 错误与业务错误转换为 `ApiError`。
- 业务组件中调用 API 时捕获错误，使用 `sonner` toast 展示 `message`。
- 对于 `VALIDATION_ERROR`，将 `detail` 中的字段级错误映射到表单对应字段。

---

## 7. 环境变量与配置建议

### 7.1 前端配置

在项目根目录创建 `.env` 与 `.env.production`：

```bash
# .env（开发环境）
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
```

```bash
# .env.production（生产环境）
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT=30000
```

- `VITE_` 前缀确保 Vite 将变量暴露到前端代码中。
- 生产环境建议通过反向代理（Nginx / CDN）将 `/api` 转发到后端服务，避免直接暴露后端端口与跨域问题。

### 7.2 后端配置

新增 `python_part/erbeauti/config.py`，使用 `pydantic-settings` 管理：

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "ERBeauti Backend"
    cors_allow_origins: str = "*"          # 生产环境应配置为具体域名
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "*"
    cors_allow_headers: str = "*"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    test_connection_timeout: int = 10       # 秒
    reverse_engineer_timeout: int = 60      # 秒

    class Config:
        env_prefix = "ERBEAUTI_"
        env_file = ".env"
```

启动时注入：

```bash
ERBEAUTI_CORS_ALLOW_ORIGINS="https://erbeauti.example.com" \
ERBEAUTI_API_PORT=8000 \
uvicorn erbeauti.api:app --host 0.0.0.0 --port 8000
```

### 7.3 CORS 配置

当前 `allow_origins=["*"]` 仅适合本地开发。**生产环境必须关闭通配符**：

```python
origins = settings.cors_allow_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods.split(","),
    allow_headers=settings.cors_allow_headers.split(","),
)
```

注意：当 `allow_origins` 不为 `*` 且 `allow_credentials=True` 时，浏览器要求 `Access-Control-Allow-Origin` 不能为 `*`。

---

## 8. 后端需要做的改动清单

1. **新增配置模块**
   - 创建 `python_part/erbeauti/config.py`，使用 `pydantic-settings` 加载环境变量。
   - 支持 `ERBEAUTI_CORS_ALLOW_ORIGINS`、`ERBEAUTI_TEST_CONNECTION_TIMEOUT`、`ERBEAUTI_REVERSE_ENGINEER_TIMEOUT` 等。

2. **新增 Pydantic 模型**
   - 在 `python_part/erbeauti/models.py` 或新建 `python_part/erbeauti/api_models.py` 中新增：
     - `ConnectionFields`
     - `TestConnectionRequest`
     - `TestConnectionResponse`
     - `ApiError`
     - 更新 `ReverseEngineerRequest` 支持 `connection_fields`。

3. **新增 URL 组装工具**
   - 创建 `python_part/erbeauti/db/url_builder.py`，实现分字段 → SQLAlchemy URL 的组装与编码。
   - 处理 SQLite、Oracle 等特殊方言。

4. **新增连接测试能力**
   - 在 `python_part/erbeauti/db/base.py` 或各 dialect 中新增 `test_connection(url, timeout)` 方法。
   - 仅执行 `engine.connect()` 并获取服务器版本，不读取 schema。

5. **新增 `/test-connection` 接口**
   - 接收 `connection_url` 或 `connection_fields`。
   - 返回 `{ success, elapsed_ms, dialect, server_version }`。
   - 统一错误处理。

6. **改造 `/reverse-engineer` 接口**
   - 支持 `connection_fields`，并在内部组装为 URL。
   - 保持现有 `connection_url` 字段兼容性。
   - 增加 `connection_url` 与 `connection_fields` 互斥校验。

7. **统一异常处理**
   - 将现有 `ValueError → 400`、`Exception → 500` 的粗粒度处理细化。
   - 按异常类型映射到第 4 节的错误码表。
   - 使用 FastAPI 的 `HTTPException` 或自定义异常处理器返回统一 `ApiError`。

8. **CORS 改造**
   - 从硬编码 `allow_origins=["*"]` 改为读取配置。
   - 开发默认 `*`，生产要求显式配置域名。

9. **新增超时控制**
   - `/test-connection` 使用 `create_engine(..., connect_args={"connect_timeout": ...})` 或 SQLAlchemy `Connection.execute(text("SELECT 1"))` 设置超时。
   - `/reverse-engineer` 抽取过程设置总超时。

10. **补充单元测试**
    - `url_builder` 的编码与组装逻辑。
    - `/test-connection` 与 `/reverse-engineer` 的字段互斥校验。
    - 各错误码映射。

---

## 9. 已知风险与注意事项

1. **密码安全**
   - 前端表单输入的密码仅在内存中保存，**不建议持久化到 localStorage**。
   - 如需“保存连接”，建议仅保存非敏感字段，密码每次重新输入；或对接后端加密存储（超出本次范围）。
   - 请求体中的密码以明文传输，生产环境必须使用 HTTPS。

2. **SQL 注入风险**
   - 分字段输入最终组装为 SQLAlchemy URL，不会直接拼接 SQL，但仍需对 `database`、`username`、`password` 等做长度与字符校验。
   - 禁止用户在 `options` 中传入任意 URL 片段，应解析为键值对并做白名单校验。

3. **网络暴露风险**
   - `/reverse-engineer` 可能连接任意数据库，若部署在公网且无鉴权，存在被滥用的风险。
   - 建议后续增加 API 鉴权（如 JWT、API Key）或限制部署环境为内网/私有网络。

4. **CORS 配置风险**
   - 生产环境使用 `allow_origins=["*"]` 配合 `allow_credentials=True` 会导致安全隐患。
   - 必须按第 7.3 节改造。

5. **连接 URL 解析歧义**
   - Oracle Service Name 中可能包含 `/`，编码/解码顺序需与组装算法严格对应。
   - 建议增加 URL 组装后的二次解析校验，确保最终 URL 能被 `urlparse` 正确解析。

6. **超时与资源占用**
   - `/reverse-engineer` 对大型数据库可能耗时较长，前端需显示加载状态并提供取消请求能力（AbortController）。
   - 后端需考虑连接池泄漏问题，每次请求使用短连接并确保 `engine.dispose()`。

7. **方言驱动依赖**
   - 后端仅安装了 `sqlalchemy`，实际连接 PostgreSQL / MySQL / SQL Server / Oracle 需要额外安装对应驱动（见 `pyproject.toml` 的 `optional-dependencies`）。
   - `/dialects` 返回的是后端已注册的方言列表，不代表驱动一定可用；连接失败时需给出清晰的驱动缺失提示。

8. **前端依赖选择**
   - 当前未使用 `axios`，若使用原生 `fetch` 封装，需自行处理取消请求、上传进度、请求序列化等。
   - 建议先使用 `fetch` + `AbortController` 实现 MVP，后续根据需求再决定是否引入 `axios`。

---

## 10. 后续可扩展点

- 连接历史管理：后端保存最近使用的连接字段（脱敏），前端展示连接列表。
- 多数据源切换：一个项目支持同时维护多个数据源，按 schema 切换视图。
- 连接模板：为常用数据库（AWS RDS、阿里云 RDS、本地 Docker）提供预设模板。
- SSL/TLS 配置：在 `connection_fields` 中增加 `ssl` 对象，支持证书上传。
- 导入进度：大 schema 抽取改为异步任务 + WebSocket/SSE 进度推送。
