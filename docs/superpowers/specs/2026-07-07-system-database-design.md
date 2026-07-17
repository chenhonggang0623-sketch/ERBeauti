# System Database — Data Source Persistence

## Motivation

Data source configurations are currently stored in browser `localStorage` via Zustand.
This means they are device-local, lost on cache clear, and cannot be shared across
sessions. A backend SQLite database provides centralized, persistent storage.

## Architecture

```
Browser (React)                    Python Backend
┌─────────────────┐              ┌──────────────────────────┐
│  Zustand Store   │──CRUD API──▶│  FastAPI                 │
│  (no localStorage│             │  /datasources/*          │
│   for datasource)│◀───JSON────│                          │
└─────────────────┘              │  sqlite3                 │
                                 │  ┌────────────────────┐  │
                                 │  │ {data_dir}/system.db│  │
                                 │  │ └ datasources      │  │
                                 │  └────────────────────┘  │
                                 └──────────────────────────┘
```

## Backend

### Database

- **Engine**: Python built-in `sqlite3` (no new dependency)
- **Location**: `{ERBEAUTI_SQLITE_DATA_DIR}/system.db` (defaults to `./data/system.db`)
- **Creation**: Auto-created on first use; tables created if not exist

### Table: `datasources`

| Column              | Type    | Constraints  | Notes                        |
|---------------------|---------|--------------|------------------------------|
| `id`                | TEXT    | PRIMARY KEY  | UUID v4                      |
| `name`              | TEXT    | NOT NULL     | User-given label             |
| `dialect`           | TEXT    | NOT NULL     | e.g. mysql, postgresql, ...  |
| `input_mode`        | TEXT    | NOT NULL     | 'url' or 'fields'            |
| `connection_url`    | TEXT    |              | URL mode value               |
| `host`              | TEXT    |              | Fields mode: hostname        |
| `port`              | INTEGER |              | Fields mode: port            |
| `username`          | TEXT    |              | Fields mode: username        |
| `database`          | TEXT    |              | Database name / file path    |
| `schema_name`       | TEXT    |              | Schema name (pg/mssql/oracle)|
| `options`           | TEXT    |              | Extra query-string params    |
| `password_encrypted`| TEXT    |              | Fernet-encrypted password    |
| `created_at`        | INTEGER | NOT NULL     | Unix timestamp in ms         |
| `updated_at`        | INTEGER | NOT NULL     | Unix timestamp in ms         |

Index: `CREATE INDEX IF NOT EXISTS idx_datasources_name ON datasources(name)`

### Password Encryption

- **Library**: `cryptography` (already a dependency via mysql optional deps)
- **Algorithm**: Fernet (AES-128-CBC with HMAC)
- **Key derivation**: `ERBEAUTI_SECRET_KEY` env var → base64-decoded → Fernet key.
  If `ERBEAUTI_SECRET_KEY` is unset, a key is auto-generated and written to
  `{data_dir}/secret.key`.
- **Usage on write**: Encrypt plaintext password → store `password_encrypted`
- **Usage on read**: `GET /datasources` returns `password_encrypted: "__ENCRYPTED__"`
  (boolean sentinel). `GET /datasources/{id}` for ER generation returns the real
  decrypted value.

### API Endpoints

All endpoints are prefixed under the FastAPI app.

#### `GET /datasources`
- Returns list of all data sources (sorted by `created_at` DESC)
- `password_encrypted` field is replaced with the string `"__ENCRYPTED__"`
- Response: `{ "success": true, "data": DataSourceConfig[] }`

#### `GET /datasources/{id}`
- Returns a single data source
- `password_encrypted` field is **decrypted** to plaintext password
- Used by ER generation flow (after user confirms)
- Response: `{ "success": true, "data": DataSourceConfigWithPassword }`

#### `POST /datasources`
- Request body includes plaintext `password` field
- Backend encrypts password and stores as `password_encrypted`
- Returns the created config (without password)
- Response: `{ "success": true, "data": DataSourceConfig }`

#### `PUT /datasources/{id}`
- Request body: partial update (all fields optional except `id`)
- If `password` is present and non-empty, re-encrypt and update
- If `password` is absent or empty, keep existing encrypted value
- Returns the updated config (without password)
- Response: `{ "success": true, "data": DataSourceConfig }`

#### `DELETE /datasources/{id}`
- Deletes the data source
- Response: `{ "success": true }`

### API Models

```python
class DataSourceCreate(BaseModel):
    id: str | None = None  # auto-generate if absent
    name: str
    dialect: str
    input_mode: str  # 'url' | 'fields'
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None  # plaintext, for encryption
    database: str | None = None
    schema_name: str | None = None
    options: str | None = None

class DataSourceUpdate(BaseModel):
    name: str | None = None
    dialect: str | None = None
    input_mode: str | None = None
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    password: str | None = None  # empty = keep, non-empty = re-encrypt
    database: str | None = None
    schema_name: str | None = None
    options: str | None = None

class DataSourceResponse(BaseModel):
    id: str
    name: str
    dialect: str
    input_mode: str
    connection_url: str | None = None
    host: str | None = None
    port: int | None = None
    username: str | None = None
    database: str | None = None
    schema_name: str | None = None
    options: str | None = None
    password_encrypted: str  # "__ENCRYPTED__" in list, plaintext in single-get
    created_at: int
    updated_at: int

class DataSourceListResponse(BaseModel):
    success: bool
    data: list[DataSourceResponse]

class DataSourceDetailResponse(BaseModel):
    success: bool
    data: DataSourceResponse
```

## Frontend

### Store Changes (`erStore.ts`)

- Remove localStorage helpers (`loadDataSources`, `saveDataSources`, etc.)
- Add `dataSourcesLoading: boolean` state
- Actions become async:

| Action | Old Behavior | New Behavior |
|--------|-------------|--------------|
| `addDataSource(cfg)` | `push` + `saveDataSources` | `POST /datasources` → push response |
| `updateDataSource(id, updater)` | find + mutate + `saveDataSources` | `PUT /datasources/{id}` → replace |
| `removeDataSource(id)` | filter + `saveDataSources` | `DELETE /datasources/{id}` → filter local |
| Init | `loadDataSources()` from localStorage | `GET /datasources` → set state |

- `stripPassword()` is no longer needed on save (password sent to backend);
  still needed for display in list/detail views.
- Add `reencrypt` helper that passes password through on ER diagram generation
  by calling `GET /datasources/{id}` which returns decrypted password.

### New API Client Functions

```typescript
// src/api/datasource.ts (additions)

export async function listDataSources(
  signal?: AbortSignal,
): Promise<{success: boolean; data: DataSourceConfig[]}>

export async function getDataSource(
  id: string,
  signal?: AbortSignal,
): Promise<{success: boolean; data: DataSourceConfig & {password: string}}>

export async function createDataSource(
  payload: DataSourceFormState,
  signal?: AbortSignal,
): Promise<{success: boolean; data: DataSourceConfig}>

export async function updateDataSource(
  id: string,
  payload: Partial<DataSourceFormState>,
  signal?: AbortSignal,
): Promise<{success: boolean; data: DataSourceConfig}>

export async function deleteDataSource(
  id: string,
  signal?: AbortSignal,
): Promise<{success: boolean}>
```

### Data Flow for ER Generation

1. User selects data source from list → password needed
2. Frontend calls `GET /datasources/{id}` which returns decrypted password
3. Password is filled into form → user confirms
4. Calls `POST /reverse-engineer` with `connection_fields` (includes password)
5. No manual password re-entry needed (backend handles it)

## Files Changed

### Backend (new/modified)

| File | Change |
|------|--------|
| `erbeauti/system_db.py` | **New** — SQLite manager: init, migrate, CRUD |
| `erbeauti/crypto.py` | **New** — Fernet encrypt/decrypt helpers |
| `erbeauti/api_models.py` | Add DataSourceCreate, DataSourceUpdate, response models |
| `erbeauti/api.py` | Add `/datasources` CRUD endpoints |
| `erbeauti/config.py` | Add `ERBEAUTI_SECRET_KEY` setting |
| `.env` | Add `ERBEAUTI_SECRET_KEY` |

### Frontend (modified)

| File | Change |
|------|--------|
| `src/api/datasource.ts` | Add CRUD API functions |
| `src/store/erStore.ts` | Replace localStorage with API calls |
| `src/components/DataSourceDialog.tsx` | Minor: password handling for ER gen |
| `src/utils/seedSampleDataSource.ts` | No longer needed (remove or disable) |

## Migration

On first API startup:
1. Check if `system.db` exists
2. Create tables if not exist
3. No migration from localStorage — users recreate data sources

On frontend first load:
1. Store initializes with empty `dataSources` array
2. Calls `GET /datasources` to populate
3. If API unavailable, show error state (no data sources)

## Testing

### Backend
- `tests/test_system_db.py` — CRUD operations, encryption round-trip
- `tests/test_api_datasources.py` — API endpoint tests via TestClient

### Frontend
- Update `DataSourceForm.test.tsx` — mock API calls instead of store

## Future Considerations

- Schema versioning in `system.db` for future migrations
- Multiple user profiles / workspaces
- Export/import of all data sources as JSON
