# ERBeauti 数据源逆向生成 PRD

## 1. 功能概述与价值

### 1.1 功能概述

数据源逆向生成能力允许用户在 ERBeauti 中动态配置数据库连接信息，连接真实数据库后，由后端 `/reverse-engineer` 接口提取表、字段、主外键等元数据，并自动在前端渲染为 ER 图。该功能与已有的 SQL DDL / DBML / Prisma 文本导入形成互补，覆盖"已有线上数据库 → 可视化 ER 图"的完整场景。

### 1.2 产品价值

| 价值维度 | 说明 |
|---------|------|
| 降低使用门槛 | 用户无需手动导出 DDL 或维护文本文件，直接连接数据库即可生成图表。 |
| 提升同步效率 | 数据库结构变更后，可重新连接并刷新 ER 图，减少人工复制粘贴。 |
| 增强工具完整性 | 补齐 ER 图工具从"文本导入"到"数据库直连"的关键一环，与竞品能力对齐。 |
| 可复用连接配置 | 保存常用数据源后，团队内可快速切换开发/测试/生产环境。 |

---

## 2. 用户故事

### 用户故事 1：首次连接数据库生成 ER 图
> 作为 一名后端开发，
> 我希望 在 ERBeauti 中输入数据库连接信息并一键生成 ER 图，
> 从而 在不导出 DDL 的情况下快速查看现有数据库结构。

**验收要点：**
- 支持通过连接 URL 或分字段（方言、主机、端口、用户名、密码、数据库名）两种方式输入。
- 连接成功后 5 秒内返回 schema 并在画布上渲染。
- 渲染结果与手动导入 SQL 的表、字段、关系保持一致。

### 用户故事 2：保存并管理常用数据源
> 作为 一名 DBA/架构师，
> 我希望 保存多个数据库连接配置并在列表中快速切换，
> 从而 避免每次重复输入连接信息。

**验收要点：**
- 数据源配置可持久化存储（本地 localStorage）。
- 支持对数据源进行新增、编辑、删除、重命名。
- 删除前需要二次确认，避免误操作。

### 用户故事 3：连接前验证配置正确性
> 作为 一名 QA 工程师，
> 我希望 在正式生成 ER 图前先测试连接是否可用，
> 从而 减少因连接信息错误导致的长时间等待。

**验收要点：**
- 提供独立的"测试连接"按钮。
- 测试连接响应时间不超过 3 秒（超时视为失败）。
- 测试失败时给出明确错误提示（网络不可达、认证失败、数据库不存在等）。

### 用户故事 4：按 schema/库名过滤生成范围
> 作为 一名数据分析师，
> 我希望 在连接 PostgreSQL/MySQL 时指定目标 schema/database，
> 从而 避免一次性加载全实例所有表导致画布过载。

**验收要点：**
- 表单提供可选的 "Schema / Database" 字段。
- 不填写时默认使用用户默认库，行为与后端当前实现一致。

---

## 3. 功能范围

### 3.1 In Scope（范围内）

1. 前端新增"数据库连接"导入入口。
2. 数据源配置表单，支持两种输入模式：
   - 连接 URL 模式（原始字符串）。
   - 分字段模式（方言、主机、端口、用户名、密码、数据库名、schema）。
3. 数据源列表管理：新增、编辑、删除、重命名、选择。
4. 本地持久化存储数据源配置（localStorage）。
5. 连接测试功能（需后端新增 `/test-connection` 接口）。
6. 调用后端 `/reverse-engineer` 接口生成 ERSchema，并复用现有 `useLayoutSchema` 完成布局渲染。
7. 错误处理与友好提示（连接失败、权限不足、网络超时等）。
8. 密码等敏感字段前端脱敏显示（输入框 type="password"）。

### 3.2 Out of Scope（范围外）

1. 后端数据库驱动自动安装与依赖管理（用户需自行保证后端环境已安装对应驱动）。
2. 云端数据源同步 / 多设备共享（本次仅本地存储）。
3. SSH 隧道、SSL 证书、Kerberos 等高级连接方式。
4. 数据库写操作（本功能为只读读取元数据）。
5. 定时自动同步 / 增量刷新。
6. 连接信息加密存储（本次仅浏览器 localStorage 明文/简单编码）。
7. 支持非 SQLAlchemy 支持的其它协议。

---

## 4. 核心功能详细说明

### 4.1 数据源配置入口位置

#### 入口 1：顶部 Header 导入下拉菜单
- 位置：`/Library/workfile/react-project/ERBeauti/src/components/Header.tsx` 中现有的"导入" Dropdown。
- 变更：在原有三个选项（导入 SQL / 导入 DBML / 导入 Prisma）下方新增分隔线与选项：
  - **从数据库导入...**
- 点击后打开导入弹窗，并自动切换到"数据库连接" Tab。

#### 入口 2：导入弹窗 Tab
- 位置：`/Library/workfile/react-project/ERBeauti/src/components/ImportDialog.tsx`。
- 变更：在 `tabs` 数组中新增一个 Tab：
  - id: `'database'`（需扩展 `ImportFormat` 类型或新增独立类型）
  - label: `'数据库连接'`
  - icon: `Plug` 或 `Server`（来自 lucide-react）
- 默认激活逻辑与现有 Tab 一致；打开弹窗时根据 `importDialogFormat` 自动选中。

### 4.2 数据源表单字段

表单支持两种输入模式，用户可通过切换开关选择。

#### 模式 A：连接 URL（推荐高级用户）

| 字段 | 类型 | 必填 | 示例 | 说明 |
|------|------|------|------|------|
| 连接名称 | text | 是 | "本地 PostgreSQL" | 用于在数据源列表中显示。 |
| 数据库方言 | select | 是 | postgresql | 下拉选项来自 `GET /dialects`。 |
| 连接 URL | password/text | 是 | `postgresql://user:pass@localhost:5432/db` | 包含凭据，输入框 type 为 password，但允许显示/隐藏。 |

#### 模式 B：分字段输入（推荐普通用户）

| 字段 | 类型 | 必填 | 示例 | 说明 |
|------|------|------|------|------|
| 连接名称 | text | 是 | "本地 PostgreSQL" | 同上。 |
| 数据库方言 | select | 是 | postgresql | 下拉选项来自 `GET /dialects`。 |
| 主机 | text | 是 | localhost |  |
| 端口 | number | 是 | 5432 | 根据方言给出默认值（postgresql:5432, mysql:3306, mssql:1433, oracle:1521, sqlite 无端口）。 |
| 用户名 | text | 是/否 | user | SQLite 等非认证数据库可禁用或隐藏。 |
| 密码 | password | 是/否 | pass | 同上。 |
| 数据库名 | text | 是 | db | 对应 PostgreSQL/MySQL 的 database；Oracle 的 SID/service_name；SQLite 为文件路径。 |
| Schema（可选） | text | 否 | public | 仅 PostgreSQL / SQL Server / Oracle 等支持 schema 的方言显示。 |

#### 字段联动规则

1. **方言切换时：**
   - 自动填充默认端口。
   - SQLite 模式下隐藏主机/端口/用户名/密码，仅显示"数据库文件路径"。
   - Oracle / SQL Server 显示 Schema 字段；MySQL / MariaDB 显示 Schema 字段但默认禁用（等同于 database）。
2. **URL 与分字段双向同步：**
   - 当用户在分字段模式填写时，实时拼接预览 URL（只读展示）。
   - 当用户切换到 URL 模式时，若之前已填写分字段，则自动将分字段转换为 URL 填充。
   - 当用户在 URL 模式填写时，尝试解析出主机/端口/用户名/数据库名等回填到分字段模式（解析失败不阻断）。

### 4.3 数据源列表管理（增删改查）

#### 存储结构

在 `erStore` 中新增数据源状态：

```ts
export interface DataSourceConfig {
  id: string
  name: string
  dialect: string
  // 模式标记
  inputMode: 'url' | 'fields'
  // URL 模式
  connectionUrl?: string
  // 分字段模式
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
  schema?: string
  // 元数据
  createdAt: number
  updatedAt: number
}
```

#### 管理界面

- 在导入弹窗的"数据库连接" Tab 内，左侧展示数据源列表，右侧展示表单。
- 列表项显示：名称、方言标签、最后更新时间。
- 操作：
  - **新增**：点击"新建连接"，清空表单，生成新 id。
  - **编辑**：点击列表项，右侧表单回填。
  - **删除**：hover 列表项出现删除图标，点击后弹二次确认；删除后若当前正在编辑该数据源，则清空表单。
  - **重命名**：在表单顶部修改"连接名称"后自动保存。
- 持久化：使用 `localStorage` 键名 `erbeauti:data-sources`，在状态变更时自动同步。
- 默认值：首次进入 Tab 时，若列表为空则自动展示空表单。

#### 与现有弹窗的兼容

- `ImportDialog` 的底部按钮区域在 database Tab 下显示：
  - 左侧："测试连接"按钮。
  - 右侧："取消"、"生成 ER 图"按钮。
- 生成 ER 图后关闭弹窗，与现有文本导入行为一致。

### 4.4 连接测试

#### 前端行为

- 按钮："测试连接"，位于表单底部左侧。
- 点击后：
  1. 校验必填字段。
  2. 根据 inputMode 构造最终连接 URL。
  3. 调用后端 `POST /test-connection`。
  4. 按钮进入 loading 状态，文案变为"测试中..."，禁用重复点击。
  5. 超时时间：5 秒。
- 结果反馈：
  - 成功：toast.success('连接成功')，并在表单下方显示绿色提示。
  - 失败：toast.error(message)，并在表单下方显示红色错误详情。

#### 后端接口建议（需后端工程师实现）

```http
POST /test-connection
Content-Type: application/json

{
  "connection_url": "postgresql://user:pass@localhost:5432/db"
}
```

响应：

```json
{
  "success": true,
  "error": null
}
```

失败示例：

```json
{
  "success": false,
  "error": "Connection refused: localhost:5432"
}
```

实现建议：复用 `extract_schema` 中的 engine 连接逻辑，仅执行 `connect()` / `disconnect()`，不执行任何元数据查询，保证快速与轻量。

### 4.5 逆向生成 ER 图流程

#### 流程图

```
用户打开 ImportDialog → 选择"数据库连接" Tab
        │
        ▼
选择/新建数据源 → 填写连接信息
        │
        ├─ 点击"测试连接" ──→ 调用 POST /test-connection ──→ 反馈结果
        │
        ▼
点击"生成 ER 图"
        │
        ▼
前端组装 ReverseEngineerRequest
{
  connection_url: string,
  schema_name?: string,
  infer_relationships: true
}
        │
        ▼
调用 POST /reverse-engineer
        │
        ▼
获取 ERSchema → 调用 layoutSchema → setLayoutResult
        │
        ▼
关闭 ImportDialog → toast 提示成功
```

#### 请求构造规则

1. 若 `inputMode === 'url'`，直接使用 `connectionUrl`。
2. 若 `inputMode === 'fields'`，按 SQLAlchemy URL 格式拼接：
   - 通用：`{dialect}://{username}:{password}@{host}:{port}/{database}`
   - SQLite：`sqlite:///{database}`（数据库名为绝对路径时前加 `/`）
   - Oracle：`oracle+{driver}://...` 视后端支持情况而定。
3. `schema_name`：优先使用用户填写的 Schema；未填写时传 `null`。
4. `infer_relationships`：固定传 `true`，与现有文本导入的推断能力保持一致。

#### 与现有布局能力的复用

- 成功后拿到的 `ERSchema` 直接调用 `useLayoutSchema` 中的 `layoutFromSchema(schema)`。
- 失败时保持弹窗打开，显示错误信息，不修改当前画布状态。

---

## 5. 异常流程与错误处理

### 5.1 前端校验错误

| 场景 | 处理方式 |
|------|----------|
| 连接名称为空 | 表单 inline error："请输入连接名称" |
| 方言未选择 | 表单 inline error："请选择数据库方言" |
| URL 模式连接 URL 为空 | 表单 inline error："请输入连接 URL" |
| 分字段模式必填项为空 | 对应字段 inline error |
| 端口非法 | 表单 inline error："端口范围 1-65535" |

### 5.2 后端错误映射

| 后端返回/HTTP 状态 | 前端提示 |
|-------------------|----------|
| 400 Bad Request | "连接 URL 格式错误：{detail}" |
| 401/403 认证失败 | "数据库用户名或密码错误" |
| 404 数据库不存在 | "数据库不存在，请检查数据库名" |
| 422 方言不支持 | "当前后端不支持该数据库方言：{dialect}" |
| 500 通用错误 | "生成失败：{detail}" |
| 网络超时 (>5s) | "连接超时，请检查网络或数据库是否可达" |
| 后端未启动 | "无法连接到 ERBeauti 后端服务，请确认服务已启动" |

### 5.3 特殊场景

| 场景 | 处理 |
|------|------|
| 生成过程中关闭弹窗 | 前端应取消请求或忽略后续回调，避免状态混乱。 |
| 生成成功但布局失败 | 提示"Schema 已获取，布局失败"，保留弹窗关闭但画布不更新。 |
| 当前画布已有 schema | 生成新 ER 图前不提示覆盖，直接替换并加入历史记录，支持撤销。 |
| localStorage 已满 | 保存数据源时捕获异常，toast 提示"存储空间不足，请删除部分连接"。 |

---

## 6. 验收标准

### 6.1 功能验收

| 编号 | 验收项 | 验收标准 | 优先级 |
|------|--------|----------|--------|
| AC-01 | Header 导入入口 | Header 下拉菜单新增"从数据库导入"选项，点击后打开弹窗并切换到 database Tab。 | P0 |
| AC-02 | 弹窗 Tab | ImportDialog 新增"数据库连接" Tab，UI 与现有三个 Tab 风格一致。 | P0 |
| AC-03 | 方言列表 | 表单中"数据库方言"下拉选项与 `GET /dialects` 返回一致，至少包含 postgresql、mysql、mariadb、sqlite、mssql、oracle。 | P0 |
| AC-04 | URL 模式 | 用户可输入连接名称、方言、连接 URL，并能生成 ER 图。 | P0 |
| AC-05 | 分字段模式 | 用户可通过主机、端口、用户名、密码、数据库名、schema 生成 ER 图。 | P0 |
| AC-06 | 模式切换 | URL 与分字段两种模式可互相切换，数据尽量保留/回填。 | P1 |
| AC-07 | 数据源列表 | 支持新增、编辑、删除、重命名数据源，列表即时更新。 | P0 |
| AC-08 | 持久化 | 数据源配置刷新页面后不丢失。 | P0 |
| AC-09 | 测试连接 | 点击"测试连接"后 5 秒内返回结果，成功/失败均有明确提示。 | P0 |
| AC-10 | 生成 ER 图 | 连接有效时，点击"生成 ER 图"后 10 秒内完成画布渲染。 | P0 |
| AC-11 | 结果一致性 | 同一数据库通过本功能生成的 ER 图，与导出 DDL 再导入的 ER 图在表、字段、关系数量上一致（±0）。 | P1 |
| AC-12 | 删除确认 | 删除数据源前需二次确认，防止误删。 | P1 |
| AC-13 | 密码脱敏 | 密码输入框默认不可见，支持显示/隐藏切换。 | P1 |

### 6.2 兼容性验收

| 编号 | 验收项 | 验收标准 |
|------|--------|----------|
| AC-14 | 浏览器兼容 | 功能在 Chrome 120+、Firefox 120+、Safari 17+ 正常运行。 |
| AC-15 | 暗色模式 | 表单与列表在 dark 主题下无样式异常。 |
| AC-16 | 响应式 | 弹窗在 1366×768 及以上分辨率完整展示，无遮挡。 |

### 6.3 性能验收

| 编号 | 验收项 | 验收标准 |
|------|--------|----------|
| AC-17 | 测试连接耗时 | 本地网络下，测试连接平均响应时间 ≤ 2s。 |
| AC-18 | 生成 ER 图耗时 | 100 张表以内的数据库，从点击生成到画布渲染完成 ≤ 10s。 |
| AC-19 | 列表加载 | 保存 20 个数据源时，列表渲染无卡顿。 |

---

## 7. 非功能性需求

### 7.1 性能

1. 测试连接接口应只做最小化连接验证，不查询元数据，避免重型数据库耗时过长。
2. 前端表单输入采用受控组件，但避免在每次输入时都写入 localStorage；建议在 blur 或 500ms debounce 后持久化。
3. 生成 ER 图时前端显示 loading 状态，防止用户重复提交。

### 7.2 安全

1. **密码存储**：本次使用 localStorage 存储，密码字段建议做 Base64 编码（非加密，仅防止肉眼直接读取），并在 UI 中默认隐藏。
2. **网络传输**：连接 URL 中包含密码，必须仅通过 `POST` 请求发送到后端，禁止在 URL query 中传递。
3. **后端安全**：后端接口不记录完整连接 URL，避免日志泄露密码。
4. **CORS**：后端当前 `allow_origins=["*"]`，建议在后续迭代中根据部署环境收紧。
5. **只读原则**：后端 `/reverse-engineer` 与 `/test-connection` 均不得执行任何数据写入或 schema 修改操作。

### 7.3 兼容性

1. 前端新增类型需与 `src/types/er.ts` 中现有 `ERSchema` 模型兼容。
2. `ImportFormat` 类型需要扩展或新增独立枚举；若扩展，需确保现有 parser 不受影响。
3. 后端新增 `/test-connection` 接口应保持与 `/reverse-engineer` 一致的响应结构（`success/error`）。

### 7.4 可维护性

1. 数据源相关逻辑建议抽离到独立 hook：`useDataSources()`，避免 ImportDialog 过于臃肿。
2. 连接 URL 的拼接/解析逻辑抽离到工具函数 `src/utils/connectionUrl.ts`，便于单元测试。
3. 新增数据源 API 调用抽离到 `src/api/dataSource.ts`，统一管理 baseURL 与错误处理。

---

## 8. 待确认问题清单

| 编号 | 问题 | 建议方案 | 负责人 | 状态 |
|------|------|----------|--------|------|
| Q1 | 后端是否实现 `/test-connection` 接口？ | 建议新增，复用现有连接逻辑，仅验证连通性。 | 后端工程师 | 待确认 |
| Q2 | 连接 URL 中的密码是否需要在后端日志中脱敏？ | 建议不打印完整 URL 或进行正则脱敏。 | 后端工程师 | 待确认 |
| Q3 | 数据源配置是否支持导出/导入（如 JSON 文件）？ | 本次 Out of Scope，后续可扩展。 | 产品经理 | 待确认 |
| Q4 | 是否支持连接信息加密存储（如使用主密码）？ | 本次 Out of Scope，MVP 阶段使用 localStorage。 | 产品经理 | 待确认 |
| Q5 | SQLite 数据库路径是否支持文件选择器？ | 建议先支持文本路径输入，后续再支持 `<input type="file">`。 | 前端工程师 | 待确认 |
| Q6 | 生成 ER 图时，如果数据库表数量过大（>500），是否需要分页或按 schema 过滤？ | 建议先支持 schema 过滤；超大数据集在后续迭代优化。 | 产品经理/架构师 | 待确认 |
| Q7 | 是否需要记录最近使用的数据源并置顶？ | 建议 V1 不做，后续根据用户反馈迭代。 | 产品经理 | 待确认 |
| Q8 | 后端是否已有 API baseURL 配置方案？前端当前未调用任何 API，需要确定 baseURL（如 `/api` 或 `http://localhost:8000`）。 | 建议通过 Vite proxy 或环境变量配置。 | 前端工程师 | 待确认 |

---

## 9. 附录

### 9.1 相关文件索引

| 文件 | 说明 |
|------|------|
| `/Library/workfile/react-project/ERBeauti/src/components/ImportDialog.tsx` | 导入弹窗主组件，需新增 database Tab。 |
| `/Library/workfile/react-project/ERBeauti/src/components/Header.tsx` | 顶部操作栏，需新增"从数据库导入"入口。 |
| `/Library/workfile/react-project/ERBeauti/src/store/erStore.ts` | 全局状态管理，需新增数据源状态与持久化。 |
| `/Library/workfile/react-project/ERBeauti/src/types/er.ts` | 数据模型定义，需扩展 ImportFormat 或新增类型。 |
| `/Library/workfile/react-project/ERBeauti/src/hooks/useLayoutSchema.ts` | 布局 Hook，复用 `layoutFromSchema` 渲染 ER 图。 |
| `/Library/workfile/react-project/ERBeauti/python_part/erbeauti/api.py` | 后端 API，建议新增 `/test-connection` 接口。 |
| `/Library/workfile/react-project/ERBeauti/python_part/erbeauti/models.py` | ERSchema Pydantic 模型。 |

### 9.2 建议新增文件

| 文件 | 说明 |
|------|------|
| `/Library/workfile/react-project/ERBeauti/src/hooks/useDataSources.ts` | 数据源 CRUD 与持久化逻辑。 |
| `/Library/workfile/react-project/ERBeauti/src/utils/connectionUrl.ts` | 连接 URL 拼接与解析工具函数。 |
| `/Library/workfile/react-project/ERBeauti/src/api/dataSource.ts` | 后端 API 调用封装。 |
| `/Library/workfile/react-project/ERBeauti/src/components/DataSourceForm.tsx` | 数据源配置表单组件。 |
| `/Library/workfile/react-project/ERBeauti/src/components/DataSourceList.tsx` | 数据源列表组件。 |

---

*文档版本：v1.0*
*编写日期：2026-07-03*
*作者：产品经理*
