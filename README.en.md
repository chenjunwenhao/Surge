<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' rx='16' fill='%232563eb'/%3E%3Cellipse cx='36' cy='46' rx='17' ry='4' fill='%231d4ed8' opacity='0.5'/%3E%3Crect x='19' y='25' width='34' height='21' fill='%23ffffff'/%3E%3Cellipse cx='36' cy='25' rx='17' ry='4' fill='%23eff6ff'/%3E%3Cellipse cx='36' cy='46' rx='17' ry='4' fill='none' stroke='%23bfdbfe' stroke-width='1.5'/%3E%3C/svg%3E" width="76" />
</p>

<h1 align="center">Surge <sub>/sɜːrdʒ/</sub></h1>

<p align="center">
  <strong>MySQL desktop client — as fast as it should be.</strong>
</p>

<p align="center">
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases"><img src="https://img.shields.io/badge/Download-v2.0.4-0ea5e9?style=for-the-badge" /></a>
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases"><img src="https://img.shields.io/badge/Platform-macOS+Windows-blue?style=for-the-badge" /></a>
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer"><img src="https://img.shields.io/github/stars/chenjunwenhao/MySQL-Explorer?style=for-the-badge&color=fbbf24" /></a>
</p>

<p align="center" style="margin-top: 12px">
  <img src="https://img.shields.io/badge/MySQL-Only-4479A1?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

<p align="right">
  <a href="./README.md">中文</a>
</p>

---

<p align="center">
  <strong>No PostgreSQL. No SQLite. Just MySQL.</strong><br>
  A brutally clean MySQL desktop client — fast search, beautiful SQL formatting, zero-barrier data editing.
</p>

---

## Download

<p align="center">
  <table align="center">
    <tr>
      <td align="center" width="280">
        <strong>macOS</strong><br><sub>Apple Silicon · DMG installer</sub><br><br>
        <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases/download/v2.0.4/Surge-2.0.4-arm64.dmg">
          <img src="https://img.shields.io/badge/Download_DMG-117_MB-0ea5e9?style=for-the-badge&logo=apple" />
        </a>
      </td>
      <td align="center" width="280">
        <strong>Windows</strong><br><sub>x64 · Portable, unzip and run</sub><br><br>
        <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases/download/v2.0.4/Surge-2.0.4-portable-win-x64.zip">
          <img src="https://img.shields.io/badge/Download_Portable-133_MB-0ea5e9?style=for-the-badge&logo=windows" />
        </a>
      </td>
    </tr>
  </table>
</p>

> Or build from source: `git clone` → `npm install` → `npm run dev` → open `http://localhost:5173`

## Three reasons you won't go back

<table>
<tr>
<td width="33%" valign="top">
<h4 align="center">Search like Spotlight</h4>
<p>Type a few characters in the sidebar — databases, tables, and columns filter instantly. Full pinyin and fuzzy matching. No more point-and-click tree diving.</p>
</td>
<td width="33%" valign="top">
<h4 align="center">SQL that reads like prose</h4>
<p>400 lines of hand-written formatting engine. Zero dependencies. SELECT columns aligned, JOINs indented by depth, subqueries wrapped in brackets, CASE/WHEN blocks clearly separated, UNIONs split by blank lines. Not mechanical keyword-wrapping — formatted for humans.</p>
</td>
<td width="33%" valign="top">
<h4 align="center">Ditch hand-written CRUD</h4>
<p>Double-click a table to see its data. Expand a column to see its structure and COMMENT. Edit cells in place → changes highlighted → batch save back. Operate your database like a spreadsheet — zero SQL required.</p>
</td>
</tr>
</table>

## Help

### Keyboard Shortcuts

| Shortcut | Action | Note |
|---|---|---|
| `Ctrl+Enter` | Run SQL | Execute query or selected text in editor |
| `Ctrl+Shift+Enter` | EXPLAIN | Show query execution plan |
| `Ctrl+Space` | Trigger autocomplete | Manually open suggestion menu |
| `Ctrl+F` | Search tree | Focus sidebar search (when not in editor) |
| `Ctrl+W` | Close tab | Close current tab (when not in editor) |
| `Ctrl+H` | History | Toggle Query History panel |
| `Ctrl+Shift+T` | Reopen tab | Restore the last closed tab |
| `Escape` | Multi-purpose | Close History / cancel cell edit / clear search |
| `Enter` | Confirm edit | Commit current cell modification |

### Connection Management

- **New Connection**: Host, Port, User, Password, Database — test before connecting
- **Saved Connections**: Persistent storage, double-click to reconnect
- **Multi-instance**: Connect to multiple MySQL servers simultaneously with pooled connections and auto-reconnect
- **Disconnect confirmation**: Dialog prompt to prevent accidental disconnects

### Database Explorer (Sidebar)

- Expand instance → databases → tables/views (grouped: Tables / Views)
- Expand a table to see columns (type badges, PK indicators, comments) and indexes
- Sidebar **search box** (`Ctrl+F`) with pinyin and fuzzy matching
- Each database level has a dedicated **Console** entry point
- Refresh button with **spinner animation** feedback
- Disconnect button with confirmation dialog

### Context Menu

| Target | Menu Items |
|---|---|
| Table | Edit Data · View DDL · Show Indexes · Refresh · Copy Name · SELECT * FROM |
| Database/Instance | Open Console · Refresh · Copy Name · Disconnect (instance) |

### Tab Management

- Query and table data tabs coexist
- Close single tab (× button / `Ctrl+W`)
- Right-click menu: Close / Close Others / Close to Right / Close to Left / Close All / Reopen
- ≡ dropdown for 5+ tabs
- `Ctrl+Shift+T` reopens closed tabs (remembers last 20)

### SQL Editor (Monaco)

- **Context-aware autocomplete**:
  - After `FROM`/`JOIN`/`INTO` → table names (with VIEW indicator)
  - After `SELECT`/`WHERE`/`ON` → column names (with type and source table)
  - Type `table.` → precise column suggestions for that table
  - 100+ SQL keywords + 50+ built-in functions
- **Real-time SQL linting**: Full-width characters, keyword misspellings highlighted with red squiggly lines
- SQL Formatting (semantic indentation, alignment, separation)
- Code folding, word wrap, line numbers

### Editor Toolbar

| Button | Function |
|---|---|
| DB Selector | Searchable dropdown to switch database for current tab |
| Begin / Commit / Rollback | Transaction control |
| Cancel | Cancel running query |
| History ⌛ | Query History panel (`Ctrl+H`), with count badge |
| ↩ | Reopen closed tab (`Ctrl+Shift+T`) |
| Format | SQL formatting |
| Explain | Query execution plan (`Ctrl+Shift+Enter`) |
| Run | Execute query (`Ctrl+Enter`) |

### Query Results & Batch Execution

- **Selection execution**: Highlight text to run only the selection
- **Batch execution**: Multiple SQL statements separated by semicolons, results grouped per statement with row count / affected rows / elapsed time
- Batch results expandable for detailed data view, CSV/JSON export
- EXPLAIN results shown in separate panel

### Query History

- Auto-saves last 50 queries (persisted in localStorage)
- **Search/filter**: Real-time filtering via header input
- **Click to reuse**: Opens query in a new tab with original database context
- **Single item delete**: Hover to reveal × button
- **Clear all**: Clear All button
- Close on Escape or click outside

### Table Data Editing (Zero-SQL CRUD)

- Double-click a table to open data grid, three sub-tabs: Data / DDL / Indexes
- **Data panel**:
  - Double-click cell for inline editing, dirty rows highlighted
  - Batch save (auto-generates UPDATE via primary key)
  - Pagination (20/50/100/200 rows), column sorting, text filter
  - Enter to confirm / Escape to cancel edit
  - NULL values shown in gray italic
- **DDL panel**: Monaco syntax-highlighted CREATE TABLE
- **Indexes panel**: Name, columns, uniqueness, type at a glance

### Themes & Layout

- Dark / Light theme toggle (persisted in localStorage)
- Resizable sidebar (240-500px)
- Resizable editor/result panel split (20-80%)
- Auto-refresh sidebar tree after DDL/DML operations

## Build from source

```bash
# macOS (.dmg)
npm run electron:build:mac

# Windows (.exe)
npm run electron:build:win

# All platforms
npm run electron:build:all
```

## Tech stack

| Layer | Technology |
|:---|:---|
| Frontend | React 18 · Vite 5 · Monaco Editor |
| Backend | Express · MySQL2 · Connection pool |
| Desktop | Electron |

## Project structure

```
src/
  ├── App.jsx         Main app · state management · connection logic
  ├── components/     Sidebar tree · editor · data grid · DDL · indexes · context menu
  └── utils/          SQL formatter · linter · icons · API client
server.js             Express backend (20+ API endpoints + connection pool)
electron/             Electron desktop shell
```

---

<p align="center">
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/blob/main/LICENSE">MIT License</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/issues">Submit an Issue</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer">Star ⭐</a>
</p>
