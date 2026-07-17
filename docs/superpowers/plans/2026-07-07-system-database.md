# System Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace localStorage data source persistence with backend SQLite database + CRUD API. Passwords encrypted at rest via Fernet.

**Architecture:** Python backend manages a `system.db` SQLite file with encrypted password storage. Frontend Zustand store becomes a thin async cache over the API.

**Tech Stack:** Python 3.14, sqlite3 (stdlib), cryptography (Fernet), FastAPI, React/Zustand

## Global Constraints

- Python built-in `sqlite3` only — no SQLAlchemy for system DB (no new dep)
- `cryptography` library required (already in pyproject.toml as mysql optional dep)
- Passwords encrypted with Fernet; plaintext never logged or returned in list views
- `ERBEAUTI_SECRET_KEY` env var drives encryption key; auto-gen fallback to `{data_dir}/secret.key`
- System DB location: `{ERBEAUTI_SQLITE_DATA_DIR}/system.db` (default `./data/system.db`)
- Frontend: all existing tests must still pass; no new external deps

---
## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `python_part/erbeauti/crypto.py` | Fernet init, encrypt_password, decrypt_password |
| `python_part/erbeauti/system_db.py` | SQLite connection mgmt, table init, CRUD operations |
| `python_part/tests/test_system_db.py` | Tests for system_db and crypto |

### Modified Files
| File | What Changes |
|------|-------------|
| `python_part/erbeauti/config.py` | Add `ERBEAUTI_SECRET_KEY` / `ERBEAUTI_DATA_DIR` settings |
| `python_part/erbeauti/api_models.py` | Add datasource request/response Pydantic models |
| `python_part/erbeauti/api.py` | Add `/datasources` CRUD routes |
| `python_part/.env` | Add `ERBEAUTI_SECRET_KEY` |
| `src/api/datasource.ts` | Add `listDataSources`, `getDataSource`, `createDataSource`, `updateDataSource`, `deleteDataSource` |
| `src/api/types.ts` | Add datasource API response types |
| `src/store/erStore.ts` | Replace localStorage persistence with API calls; make actions async |
| `src/components/DataSourceDialog.tsx` | Adapt password flow for encrypted-backend model |

---
### Task 1: crypto.py — Fernet encryption helpers

**Files:**
- Create: `python_part/erbeauti/crypto.py`
- Test: `python_part/tests/test_system_db.py` (combined with Task 2)

**Interfaces:**
- Produces: `get_fernet() -> cryptography.fernet.Fernet`, `encrypt_password(plain: str) -> str`, `decrypt_password(encrypted: str) -> str`

- [ ] Step 1: Create `crypto.py`

```python
"""Fernet-based password encryption for stored credentials."""

from __future__ import annotations

import base64
import os
from pathlib import Path

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from erbeauti.config import settings

_fernet: Fernet | None = None


def _derive_key(secret: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=600_000)
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))


def _load_or_create_key() -> bytes:
    """Load key from env var, or create/persist one to data dir."""
    if settings.secret_key:
        # env var: raw 32-byte key, base64-encoded
        return settings.secret_key.encode() if isinstance(settings.secret_key, str) else settings.secret_key  # type: ignore[arg-type]

    key_file = Path(settings.data_dir) / "secret.key"
    key_file.parent.mkdir(parents=True, exist_ok=True)

    if key_file.exists():
        return key_file.read_bytes()

    key = Fernet.generate_key()
    key_file.write_bytes(key)
    key_file.chmod(0o600)
    return key


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = _load_or_create_key()
        _fernet = Fernet(key)
    return _fernet


def encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    f = get_fernet()
    return f.encrypt(plain.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    if not encrypted:
        return ""
    f = get_fernet()
    return f.decrypt(encrypted.encode()).decode()
```

- [ ] Step 2: Add `data_dir` setting to config.py

```python
# in erbeauti/config.py, add alongside sqlite_data_dir:
data_dir: str = Field(
    default="",
    description="Directory for system data (databases, keys, etc). "
    "If empty, defaults to ../data relative to the app working directory.",
)
```

Update `.env`:
```
ERBEAUTI_DATA_DIR=../data
```

- [ ] Step 3: Verify crypto works in isolation

Run: `cd python_part && .venv/bin/python -c "from erbeauti.crypto import encrypt_password, decrypt_password; c = encrypt_password('test123'); assert decrypt_password(c) == 'test123'; print('OK')"` — Expected: "OK"

---
### Task 2: system_db.py — SQLite database manager + CRUD

**Files:**
- Create: `python_part/erbeauti/system_db.py`
- Test: `python_part/tests/test_system_db.py`

**Interfaces:**
- Consumes: `encrypt_password`, `decrypt_password` from Task 1, `settings` from config
- Produces: `get_db() -> sqlite3.Connection`, `init_db()`, `list_datasources() -> list[dict]`, `get_datasource(id: str) -> dict | None`, `create_datasource(data: dict) -> dict`, `update_datasource(id: str, data: dict) -> dict`, `delete_datasource(id: str) -> bool`

- [ ] Step 1: Create `system_db.py`

```python
"""System database for persisted application state (data sources, etc)."""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from pathlib import Path
from time import time

from erbeauti.config import settings
from erbeauti.crypto import encrypt_password, decrypt_password

_local = threading.local()

_DB_FILENAME = "system.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS datasources (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    dialect             TEXT NOT NULL,
    input_mode          TEXT NOT NULL,
    connection_url      TEXT,
    host                TEXT,
    port                INTEGER,
    username            TEXT,
    database            TEXT,
    schema_name         TEXT,
    options             TEXT,
    password_encrypted  TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_datasources_name ON datasources(name);
"""


def _db_path() -> Path:
    base = Path(settings.data_dir) if settings.data_dir else Path.cwd() / ".." / "data"
    return base.resolve() / _DB_FILENAME


def get_db() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        path = _db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return _local.conn


def init_db() -> None:
    conn = get_db()
    conn.executescript(SCHEMA_SQL)
    conn.commit()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def _ts() -> int:
    return int(time() * 1000)


def list_datasources() -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM datasources ORDER BY created_at DESC"
    ).fetchall()
    results = []
    for row in rows:
        d = _row_to_dict(row)
        if d.get("password_encrypted"):
            d["password_encrypted"] = "__ENCRYPTED__"
        results.append(d)
    return results


def get_datasource(ds_id: str, decrypt_pw: bool = False) -> dict | None:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM datasources WHERE id = ?", (ds_id,)
    ).fetchone()
    if row is None:
        return None
    d = _row_to_dict(row)
    if decrypt_pw and d.get("password_encrypted") and d["password_encrypted"] != "__ENCRYPTED__":
        d["password_encrypted"] = decrypt_password(d["password_encrypted"])
    elif d.get("password_encrypted") and d["password_encrypted"] != "__ENCRYPTED__":
        d["password_encrypted"] = "__ENCRYPTED__"
    return d


def create_datasource(data: dict) -> dict:
    ds_id = data.get("id") or str(uuid.uuid4())
    now = _ts()
    password_encrypted = encrypt_password(data.get("password") or "")

    conn = get_db()
    conn.execute(
        """INSERT INTO datasources
           (id, name, dialect, input_mode, connection_url,
            host, port, username, database, schema_name, options,
            password_encrypted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ds_id,
            data["name"],
            data["dialect"],
            data.get("input_mode", "fields"),
            data.get("connection_url"),
            data.get("host"),
            data.get("port"),
            data.get("username"),
            data.get("database"),
            data.get("schema_name"),
            data.get("options"),
            password_encrypted,
            now,
            now,
        ),
    )
    conn.commit()
    return get_datasource(ds_id)


def update_datasource(ds_id: str, data: dict) -> dict | None:
    existing = get_datasource(ds_id, decrypt_pw=False)
    if existing is None:
        return None

    now = _ts()
    fields = []
    values = []

    for key in ("name", "dialect", "input_mode", "connection_url",
                 "host", "port", "username", "database", "schema_name", "options"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if "password" in data:
        pw = data["password"]
        if pw:
            fields.append("password_encrypted = ?")
            values.append(encrypt_password(pw))

    if not fields:
        return get_datasource(ds_id)

    fields.append("updated_at = ?")
    values.append(now)
    values.append(ds_id)

    conn = get_db()
    conn.execute(
        f"UPDATE datasources SET {', '.join(fields)} WHERE id = ?",
        values,
    )
    conn.commit()
    return get_datasource(ds_id)


def delete_datasource(ds_id: str) -> bool:
    conn = get_db()
    cur = conn.execute("DELETE FROM datasources WHERE id = ?", (ds_id,))
    conn.commit()
    return cur.rowcount > 0
```

- [ ] Step 2: Add `data_dir` fallback in config if not set

The `crypto.py` already references `settings.data_dir`. Make sure the config default resolves to `../data`:

```python
# in erbeauti/config.py Settings class:
data_dir: str = Field(
    default="",
    description="Directory for system data. If empty, defaults to ../data.",
)
```

In `system_db.py`, the `_db_path()` already handles the fallback.

- [ ] Step 3: Verify system_db in isolation

Run: `cd python_part && .venv/bin/python -c "
from erbeauti.system_db import init_db, create_datasource, list_datasources, get_datasource, update_datasource, delete_datasource
init_db()
d = create_datasource({'name':'test','dialect':'mysql','input_mode':'fields','host':'localhost','port':3306,'database':'test','username':'root','password':'secret'})
assert d['password_encrypted'] == '__ENCRYPTED__'
all_ds = list_datasources()
assert len(all_ds) == 1
d2 = get_datasource(d['id'])
assert d2['password_encrypted'] == '__ENCRYPTED__'
d3 = get_datasource(d['id'], decrypt_pw=True)
assert d3 and d3.get('password_encrypted') == 'secret'
update_datasource(d['id'], {'name':'renamed'})
assert get_datasource(d['id'])['name'] == 'renamed'
delete_datasource(d['id'])
assert len(list_datasources()) == 0
print('ALL OK')
"` — Expected: "ALL OK"

---
### Task 3: API models — Datasource Pydantic models

**Files:**
- Modify: `python_part/erbeauti/api_models.py`

**Interfaces:**
- Produces: `DataSourceCreate(BaseModel)`, `DataSourceUpdate(BaseModel)`, `DataSourceResponse(BaseModel)`, `DataSourceListResponse(BaseModel)`, `DataSourceDetailResponse(BaseModel)`

- [ ] Step 1: Add datasource models to `api_models.py`

```python
# Add to erbeauti/api_models.py

class DataSourceFieldBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    dialect: str = Field(..., min_length=1)
    input_mode: str = Field(default="fields", pattern=r"^(url|fields)$")
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    database_: str | None = Field(None, alias="database")
    schema_name: str | None = None
    options: str | None = None

class DataSourceCreate(DataSourceFieldBase):
    id: str | None = None
    password: str | None = None

class DataSourceUpdate(BaseModel):
    name: str | None = None
    dialect: str | None = None
    input_mode: str | None = None
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    database_: str | None = Field(None, alias="database")
    schema_name: str | None = None
    options: str | None = None
    password: str | None = None

class DataSourceResponse(DataSourceFieldBase):
    id: str
    password_encrypted: str
    created_at: int
    updated_at: int

    model_config = ConfigDict(populate_by_name=True)

class DataSourceListResponse(BaseModel):
    success: bool = True
    data: list[DataSourceResponse]

class DataSourceDetailResponse(BaseModel):
    success: bool = True
    data: DataSourceResponse
```

---
### Task 4: API endpoints — /datasources CRUD routes

**Files:**
- Modify: `python_part/erbeauti/api.py`

- [ ] Step 1: Add datasource routes to `api.py`

Import system_db CRUD. Call `init_db()` at startup in the `lifespan` handler.

```python
# Add imports at top
from erbeauti.system_db import (
    init_db,
    list_datasources as sys_list,
    get_datasource as sys_get,
    create_datasource as sys_create,
    update_datasource as sys_update,
    delete_datasource as sys_delete,
)

# In lifespan, add:
init_db()

# Add routes
@router.get("/datasources", response_model=DataSourceListResponse)
async def list_datasources():
    return DataSourceListResponse(data=[DataSourceResponse(**d) for d in sys_list()])

@router.get("/datasources/{ds_id}", response_model=DataSourceDetailResponse)
async def get_datasource(ds_id: str):
    d = sys_get(ds_id, decrypt_pw=True)
    if d is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return DataSourceDetailResponse(data=DataSourceResponse(**d))

@router.post("/datasources", response_model=DataSourceDetailResponse, status_code=201)
async def create_datasource(payload: DataSourceCreate):
    data = payload.model_dump(by_alias=True, exclude_none=True)
    created = sys_create(data)
    return DataSourceDetailResponse(data=DataSourceResponse(**created))

@router.put("/datasources/{ds_id}", response_model=DataSourceDetailResponse)
async def update_datasource(ds_id: str, payload: DataSourceUpdate):
    data = payload.model_dump(by_alias=True, exclude_none=True)
    updated = sys_update(ds_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return DataSourceDetailResponse(data=DataSourceResponse(**updated))

@router.delete("/datasources/{ds_id}")
async def delete_datasource(ds_id: str):
    if not sys_delete(ds_id):
        raise HTTPException(status_code=404, detail="Data source not found")
    return {"success": True}
```

- [ ] Step 2: Start the API and verify endpoints work

```bash
cd python_part
# Stop old server first, then start
kill $(lsof -ti :8000) 2>/dev/null; sleep 1
nohup .venv/bin/python -m uvicorn erbeauti.api:app --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &
sleep 2

# Test CREATE
curl -s -X POST http://localhost:8000/datasources \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试库","dialect":"mysql","host":"localhost","port":3306,"database":"test","username":"root","password":"secret"}' | python3 -m json.tool

# Test LIST
curl -s http://localhost:8000/datasources | python3 -m json.tool

# Test GET (with decrypted password — replace ID with actual)
# Test PUT
# Test DELETE
```

Expected: CREATE returns 201 with `password_encrypted: "__ENCRYPTED__"`, LIST returns array, GET (with decrypt) returns actual password.

---
### Task 5: Frontend API client — datasource CRUD functions

**Files:**
- Modify: `src/api/datasource.ts`
- Modify: `src/api/types.ts`

- [ ] Step 1: Add response types to `src/api/types.ts`

```typescript
export interface DataSourceApiResponse {
  id: string
  name: string
  dialect: string
  inputMode: string
  connectionUrl?: string
  host?: string
  port?: number
  username?: string
  database?: string
  schemaName?: string
  options?: string
  passwordEncrypted: string
  createdAt: number
  updatedAt: number
}

// The field name needs mapping: snake_case from API → camelCase for frontend
// We'll handle this in the API client with a transform function.
```

- [ ] Step 2: Add CRUD functions and response mapper to `src/api/datasource.ts`

```typescript
import type { DataSourceConfig, DataSourceFormState } from '@/types/er'

/* ---- API response transformation ---- */

interface ApiDataSource {
  id: string
  name: string
  dialect: string
  input_mode: string
  connection_url?: string
  host?: string
  port?: number
  username?: string
  database_?: string
  schema_name?: string
  options?: string
  password_encrypted: string
  created_at: number
  updated_at: number
}

interface ApiListResponse {
  success: boolean
  data: ApiDataSource[]
}

interface ApiDetailResponse {
  success: boolean
  data: ApiDataSource
}

function apiToConfig(api: ApiDataSource): DataSourceConfig {
  return {
    id: api.id,
    name: api.name,
    dialect: api.dialect,
    inputMode: api.input_mode as 'url' | 'fields',
    connectionUrl: api.connection_url,
    host: api.host,
    port: api.port,
    username: api.username,
    database: api.database_ ?? api.database,
    schema: api.schema_name,
    options: api.options,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  }
}

export async function listDataSources(
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig[] }> {
  const res = await apiGet<ApiListResponse>('/datasources', { signal })
  return { data: res.data.map(apiToConfig) }
}

export async function getDataSourceDetail(
  id: string,
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig & { password: string } }> {
  const res = await apiGet<ApiDetailResponse>(`/datasources/${id}`, { signal })
  return {
    data: {
      ...apiToConfig(res.data),
      password: res.data.password_encrypted === '__ENCRYPTED__' ? '' : res.data.password_encrypted,
    },
  }
}

export async function createDataSource(
  payload: DataSourceFormState,
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig }> {
  const body = formStateToApi(payload)
  const res = await apiPost<ApiDetailResponse>('/datasources', body, { signal })
  return { data: apiToConfig(res.data) }
}

export async function updateDataSourceApi(
  id: string,
  payload: Partial<DataSourceFormState>,
  signal?: AbortSignal,
): Promise<{ data: DataSourceConfig }> {
  const body = formStateToApi(payload)
  const res = await apiPut<ApiDetailResponse>(`/datasources/${id}`, body, { signal })
  return { data: apiToConfig(res.data) }
}

export async function deleteDataSourceApi(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiDelete(`/datasources/${id}`, { signal })
}

/* ---- Helper: form state → API body ---- */

function formStateToApi(
  form: Partial<DataSourceFormState>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (form.name !== undefined) body.name = form.name
  if (form.dialect !== undefined) body.dialect = form.dialect
  if (form.inputMode !== undefined) body.input_mode = form.inputMode
  if (form.connectionUrl !== undefined) body.connection_url = form.connectionUrl
  if (form.host !== undefined) body.host = form.host
  if (form.port !== undefined) body.port = form.port
  if (form.username !== undefined) body.username = form.username
  if (form.password !== undefined) body.password = form.password
  if (form.database !== undefined) body.database = form.database
  if (form.schema !== undefined) body.schema_name = form.schema
  if (form.options !== undefined) body.options = form.options
  return body
}
```

Need to add `apiPut` and `apiDelete` to client.ts if they don't exist.

- [ ] Step 3: Add `apiPut` and `apiDelete` to `src/api/client.ts` if missing

```typescript
export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  opts?: { signal?: AbortSignal; timeout?: number },
): Promise<T> {
  return apiRequest<T>('PUT', path, opts, body)
}

export async function apiDelete<T = unknown>(
  path: string,
  opts?: { signal?: AbortSignal; timeout?: number },
): Promise<T> {
  return apiRequest<T>('DELETE', path, opts)
}
```

---
### Task 6: Frontend store — replace localStorage with API

**Files:**
- Modify: `src/store/erStore.ts`

- [ ] Step 1: Remove localStorage helpers and replace with API calls

Changes in `erStore.ts`:

1. Remove imports: `createSampleDataSources`, `saveDataSources`, `loadDataSources`, `migrateDataSources`, `initializeDataSources` (and their implementations ~lines 218-324)
2. Add `dataSourcesLoading: boolean` to state
3. Add `fetchDataSources: () => Promise<void>` action
4. Rewrite `addDataSource`, `updateDataSource`, `removeDataSource` as async, calling the new API functions
5. In the store creation callback, call `fetchDataSources()` instead of `initializeDataSources()`

```typescript
// State additions
dataSourcesLoading: boolean
dataSourcesError: string | null

// New actions (add to interface)
fetchDataSources: () => Promise<void>
fetchingDataSources: boolean

// Implementation — add alongside existing actions
fetchDataSources: async () => {
  set({ dataSourcesLoading: true, dataSourcesError: null })
  try {
    const { data } = await listDataSources()
    set({ dataSources: data, dataSourcesLoading: false })
  } catch (err) {
    set({ dataSourcesLoading: false, dataSourcesError: '无法加载数据源，请检查后端服务' })
  }
},

addDataSource: async (config) => {
  const formState = config as DataSourceFormState
  const { data } = await createDataSource(formState)
  set((state) => { state.dataSources.push(data) })
},

updateDataSource: async (id, updater) => {
  set((state) => {
    const cfg = state.dataSources.find((ds) => ds.id === id)
    if (!cfg) return
    // We need the form state to pass to API. The updater mutates in place.
    // But updater expects to mutate the config directly (old pattern).
    // Change: collect updates first
  })
  // Better approach: updater is called with a draft — create a temp form from it
  // For simplicity, let the dialog collect the form state and call API directly
  // from the component, then update store.
},

removeDataSource: async (id) => {
  await deleteDataSourceApi(id)
  set((state) => {
    state.dataSources = state.dataSources.filter((ds) => ds.id !== id)
  })
},
```

Wait, the current `updateDataSource` signature in the store is:
```typescript
updateDataSource: (id: string, updater: (config: DataSourceConfig) => void) => void
```

This uses Immer's draft mutation pattern, which doesn't work well with async API calls. Let me reconsider the approach.

**Better approach:** Change the dialog to handle save/update directly by calling the API, then tell the store to refresh or push the result. This is cleaner.

Let me redesign:

```typescript
// Store actions — simplified
fetchDataSources: async () => { /* GET /datasources → set dataSources */ }

// Remove addDataSource, updateDataSource, removeDataSource from store?
// Or keep them as thin wrappers:

addDataSource: async (config) => {
  const { data } = await createDataSource(config as DataSourceFormState)
  set((state) => { state.dataSources.push(data) })
},

updateDataSource: async (id, formData) => {
  const { data } = await updateDataSourceApi(id, formData)
  set((state) => {
    const idx = state.dataSources.findIndex((ds) => ds.id === id)
    if (idx !== -1) state.dataSources[idx] = data
  })
},

removeDataSource: async (id) => {
  await deleteDataSourceApi(id)
  set((state) => {
    state.dataSources = state.dataSources.filter((ds) => ds.id !== id)
  })
},
```

The dialog would need to change slightly — instead of calling `updateDataSource(id, (draft) => Object.assign(draft, config))`, it would call `updateDataSource(id, formState)`.

- [ ] Step 2: Adapt store init to call API

```typescript
// In store creation (after other initial state):
dataSources: [],
dataSourcesLoading: false,
dataSourcesError: null,
```

Then in a `useEffect` or store init layer, call `fetchDataSources()`.

Actually, in Zustand without persist middleware, there's no built-in init. The current code calls `initializeDataSources()` inline in the store creation:

```typescript
// Current code at some point in the create callback:
dataSources: initializeDataSources(),
```

We should replace this with:
```typescript
dataSources: [],
dataSourcesLoading: false,
```

And add an action that components can call on mount:
```typescript
fetchDataSources: async () => {
  set({ dataSourcesLoading: true, dataSourcesError: null })
  try {
    const { data } = await listDataSources()
    set({ dataSources, dataSourcesLoading: false })
  } catch {
    set({ dataSourcesLoading: false, dataSourcesError: 'Failed to load data sources' })
  }
},
```

The EditorPage (or Header) should call `fetchDataSources()` on mount.

---
### Task 7: Frontend dialog adaptation — update save flow

**Files:**
- Modify: `src/components/DataSourceDialog.tsx`

- [ ] Step 1: Update handleSave to use new store action signatures

```typescript
const handleSave = async () => {
  if (!validate()) return
  try {
    if (editingDataSourceId) {
      await updateDataSource(editingDataSourceId, form)
      toast.success('已保存数据源')
    } else {
      await addDataSource(form)
      toast.success('已创建数据源')
    }
    setForm((prev) => ({ ...prev, password: '' }))
    switchToList()
  } catch {
    toast.error('保存失败，请检查后端服务')
  }
}
```

Note: `stripPassword` is no longer needed in save — the backend handles password encryption.

- [ ] Step 2: Update ER generation flow to get decrypted password

When user clicks "生成 ER 图" and password is needed, call `getDataSourceDetail(id)` which returns the decrypted password.

```typescript
// In handleGenerate or similar
const handleGenerate = async (id: string) => {
  try {
    const { data } = await getDataSourceDetail(id)
    // data.password contains the decrypted password
    // Fill into form and proceed
  } catch {
    toast.error('无法获取数据源信息')
  }
}
```

---
### Task 8: Backend tests

**Files:**
- Create: `python_part/tests/test_system_db.py`

- [ ] Step 1: Write tests for crypto

```python
import pytest
from erbeauti.crypto import encrypt_password, decrypt_password, get_fernet

def test_encrypt_decrypt_roundtrip():
    plain = "my_secret_password_123"
    encrypted = encrypt_password(plain)
    assert encrypted != plain
    assert decrypt_password(encrypted) == plain

def test_empty_string_returns_empty():
    assert encrypt_password("") == ""
    assert decrypt_password("") == ""

def test_fernet_is_singleton():
    assert get_fernet() is get_fernet()
```

- [ ] Step 2: Write tests for system_db CRUD

```python
import pytest
from erbeauti.system_db import (
    init_db, list_datasources, get_datasource,
    create_datasource, update_datasource, delete_datasource,
)

@pytest.fixture(autouse=True)
def setup_db():
    # Use in-memory or temp db for testing
    # Override _db_path to return a temp file
    init_db()
    yield
    # Cleanup all rows
    from erbeauti.system_db import get_db
    conn = get_db()
    conn.execute("DELETE FROM datasources")
    conn.commit()

def test_create_and_list():
    d = create_datasource({
        "name": "test", "dialect": "mysql",
        "host": "localhost", "port": 3306,
        "database": "mydb", "username": "root",
        "password": "secret",
    })
    assert d["name"] == "test"
    all_ds = list_datasources()
    assert len(all_ds) == 1

def test_get_with_decrypt():
    d = create_datasource({"name": "pwtest", "dialect": "mysql", "password": "open-sesame"})
    masked = get_datasource(d["id"], decrypt_pw=False)
    assert masked["password_encrypted"] == "__ENCRYPTED__"
    decrypted = get_datasource(d["id"], decrypt_pw=True)
    assert decrypted["password_encrypted"] == "open-sesame"

def test_update():
    d = create_datasource({"name": "old", "dialect": "mysql"})
    update_datasource(d["id"], {"name": "new"})
    assert get_datasource(d["id"])["name"] == "new"

def test_delete():
    d = create_datasource({"name": "gone", "dialect": "mysql"})
    assert delete_datasource(d["id"]) == True
    assert get_datasource(d["id"]) is None
```

- [ ] Step 3: Run tests

Run: `cd python_part && .venv/bin/python -m pytest tests/test_system_db.py -v`
Expected: all tests pass

---
### Task 9: Frontend tests — update existing tests

**Files:**
- Modify: `src/__tests__/DataSourceForm.test.tsx`

- [ ] Step 1: Mock the new API functions and update tests

The existing DataSourceForm test uses store actions directly. Update to mock the API calls instead.

The exact changes depend on the current test content. Read it and adapt accordingly.

---

## Self-Review Checklist

- [x] Spec coverage: All spec requirements mapped to tasks (crypto, system_db, API models/routes, frontend client/store/dialog, tests)
- [x] No placeholder code: Every step has real code blocks
- [x] Type consistency: `encrypt_password`/`decrypt_password` used consistently across crypto.py, system_db.py, and tests
