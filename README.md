# ERBeauti

> Paste SQL, get beautiful ER diagrams in seconds — Modern entity-relationship diagram tool.

ERBeauti is an open-source ER diagram tool that generates beautiful entity-relationship diagrams from SQL DDL, DBML, and Prisma Schema, or by reverse-engineering existing databases (PostgreSQL, MySQL, SQLite, SQL Server, Oracle).

## Features

- **One-click import** — Paste SQL DDL, DBML, or Prisma Schema; automatically parse and generate ER diagrams
- **Database reverse engineering** — Connect to live databases and extract schemas automatically
- **Smart layout** — ELK-based automatic layout with manual drag-and-drop adjustment
- **Multiple notations** — Table view and Chen's notation support
- **Export** — Export diagrams as SVG, PNG
- **Command palette** — `Cmd+K` for quick actions
- **Data source management** — Save and manage multiple database connections
- **Schema inference** — Auto-infer relationships from naming conventions when physical foreign keys are missing
- **Interactive design** — Canvas tree for organizing multiple diagrams, full CRUD on data sources

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Diagrams | @xyflow/react (React Flow) |
| Layout | ELK (Eclipse Layout Kernel) |
| Backend | Python 3.14+, FastAPI, SQLAlchemy |
| Parsers | SQL (node-sql-parser), DBML (@dbml/core), Prisma |
| State | Zustand + Immer |
| Encryption | Fernet (cryptography) |

## Quick Start

### Prerequisites

- **Node.js** >= 20
- **Python** >= 3.14
- **npm** or **pnpm**
- [uv](https://docs.astral.sh/uv/) (recommended for Python package management)

### Setup

```bash
# Install frontend dependencies
npm install

# Install Python backend
cd python_part
uv sync --all-extras --dev
cd ..
```

### Start

```bash
# Linux / macOS
bash scripts/start.sh

# Windows
scripts\start.bat
```

This starts:
- **Backend** (FastAPI) at http://localhost:8000
- **Frontend** (Vite) at http://localhost:5173

### Stop

```bash
# Linux / macOS
bash scripts/end.sh

# Windows
scripts\end.bat
```

## Manual Start

```bash
# Terminal 1: Backend
cd python_part
uv run uvicorn erbeauti.api:app --reload --port 8000

# Terminal 2: Frontend
npm run dev
```

## Project Structure

```
ERBeauti/
├── src/                        # React frontend
│   ├── components/             # UI components
│   │   ├── canvas/             # Canvas rendering (TableNode, RelationshipEdge, Chen nodes)
│   │   ├── command-palette/    # Cmd+K command palette
│   │   ├── common/             # Shared UI primitives
│   │   ├── dialogs/            # Import, export, settings dialogs
│   │   ├── home/               # Home page components
│   │   └── ui/                 # Low-level UI components
│   ├── pages/                  # HomePage, EditorPage
│   ├── parser/                 # SQL / DBML / Prisma parsers
│   ├── layout/                 # ELK layout engine + path routing
│   ├── store/                  # Zustand state management
│   ├── api/                    # Backend API client functions
│   ├── types/                  # TypeScript type definitions (ERSchema)
│   ├── hooks/                  # Custom React hooks
│   ├── workers/                # Web workers
│   └── data/                   # Sample data / constants
├── python_part/                # Python backend
│   ├── erbeauti/
│   │   ├── api.py              # FastAPI server (REST endpoints)
│   │   ├── cli.py              # CLI tool (erbeauti-cli)
│   │   ├── extract.py          # Normalize raw metadata → ERSchema
│   │   ├── models.py           # Pydantic ERSchema models
│   │   ├── api_models.py       # Request/response models
│   │   ├── config.py           # Environment-based configuration
│   │   ├── crypto.py           # Fernet password encryption
│   │   ├── system_db.py        # SQLite-backed application state
│   │   ├── exceptions.py       # Domain exception hierarchy
│   │   └── db/                 # Database dialect adapters
│   │       ├── base.py         # Abstract dialect
│   │       ├── factory.py      # URL → dialect resolution
│   │       ├── sqlite.py       # SQLite adapter
│   │       ├── postgres.py     # PostgreSQL adapter
│   │       ├── mysql.py        # MySQL adapter
│   │       ├── sqlserver.py    # SQL Server adapter
│   │       └── oracle.py       # Oracle adapter
│   ├── tests/                  # Backend test suite
│   └── pyproject.toml
├── scripts/                    # Start/stop scripts
│   ├── start.sh                # Linux / macOS
│   ├── end.sh
│   ├── start.bat               # Windows
│   ├── end.bat
│   ├── init-demo-db.ts         # Sample database seeder
│   └── extract-samples.ts      # Sample data generator
├── data/                       # Runtime data
│   ├── system.db               # Application state (data sources, canvas tree)
│   ├── secret.key              # Encryption key (auto-generated)
│   ├── blog.db                 # Sample database: blog platform
│   ├── demo.db                 # Sample database: product showcase
│   ├── ecommerce.db            # Sample database: e-commerce
│   └── logs/                   # Server logs
└── docs/                       # Documentation assets
```

## Input Formats

ERBeauti supports creating diagrams from:

| Format | Example |
|--------|---------|
| **SQL DDL** | `CREATE TABLE users (id INT PRIMARY KEY, name TEXT);` |
| **DBML** | `Table users { id int [pk] name varchar }` |
| **Prisma Schema** | `model User { id Int @id @default(autoincrement()) }` |
| **Database URL** | `postgresql://user:pass@host/db` (reverse engineering) |

## Import Methods

1. **Paste directly** — Click the import button or use `Cmd+K` → "Import SQL/DBML"
2. **Connect to database** — Enter a connection URL or fill in connection fields to reverse-engineer a live database
3. **Sample databases** — Pre-loaded sample databases (Blog, E-commerce, Product Showcase) for quick testing

## Database Reverse Engineering

| Database | Connection URL Example |
|------------|---------------------|
| PostgreSQL | `postgresql://user:pass@localhost:5432/dbname` |
| MySQL | `mysql+pymysql://user:pass@localhost:3306/dbname` |
| SQLite | `sqlite:///path/to/db.sqlite` |
| SQL Server | `mssql+pyodbc://user:pass@dsn` |
| Oracle | `oracle+oracledb://user:pass@localhost:1521/FREEPDB1` |

## API Endpoints

The backend exposes the following REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/dialects` | List supported database dialects |
| GET | `/sample-databases` | List sample SQLite databases |
| POST | `/test-connection` | Test database connectivity |
| POST | `/tables` | List tables in a database |
| POST | `/reverse-engineer` | Extract full schema from a database |
| GET | `/datasources` | List saved data source connections |
| POST | `/datasources` | Save a new data source |
| GET | `/datasources/{id}` | Get a saved data source |
| PUT | `/datasources/{id}` | Update a data source |
| DELETE | `/datasources/{id}` | Delete a data source |
| GET | `/canva-tree` | List canvas tree (diagram organizer) |
| POST | `/canva-tree` | Create a canvas/folder node |
| PUT | `/canva-tree/{id}` | Update a canvas/folder node |
| DELETE | `/canva-tree/{id}` | Delete a canvas/folder node |

See `python_part/README.md` for detailed API documentation including error codes and configuration reference.

## Development

```bash
# Frontend dev server
npm run dev

# Backend dev server (hot reload)
cd python_part
uv run uvicorn erbeauti.api:app --reload --port 8000

# Run tests
npm test                    # Frontend (Vitest)
cd python_part && uv run pytest  # Backend (pytest)

# Lint
npm run lint                # Frontend (oxlint)
cd python_part && uv run ruff check  # Backend (ruff)

# Type check
cd python_part && uv run mypy erbeauti  # Backend (mypy)

# Build
npm run build
```

## Configuration

Key environment variables (set in `.env` at project root or `python_part/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ERBEAUTI_API_HOST` | `0.0.0.0` | API server bind address |
| `ERBEAUTI_API_PORT` | `8000` | API server port |
| `ERBEAUTI_DATA_DIR` | `./data` | System data directory |
| `ERBEAUTI_ALLOW_PRIVATE_NETWORKS` | `true` | Allow private IP connections (set `false` in production) |
| `ERBEAUTI_SECRET_KEY` | auto-generated | Fernet encryption key (32-byte base64) |

## Security

- **SSRF Protection**: Blocks connections to private/reserved IP ranges in production
- **SQLite Path Validation**: Prevents directory traversal attacks
- **Password Redaction**: Passwords are never logged or returned in API responses
- **Encrypted Storage**: Data source passwords encrypted with Fernet at rest
- Run with a read-only database user with minimal privileges when possible

## License

MIT
