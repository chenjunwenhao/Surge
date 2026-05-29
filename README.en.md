<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' rx='16' fill='%232563eb'/%3E%3Cellipse cx='36' cy='46' rx='17' ry='4' fill='%231d4ed8' opacity='0.5'/%3E%3Crect x='19' y='25' width='34' height='21' fill='%23ffffff'/%3E%3Cellipse cx='36' cy='25' rx='17' ry='4' fill='%23eff6ff'/%3E%3Cellipse cx='36' cy='46' rx='17' ry='4' fill='none' stroke='%23bfdbfe' stroke-width='1.5'/%3E%3C/svg%3E" width="76" />
</p>

<h1 align="center">Surge <sub>/sɜːrdʒ/</sub></h1>

<p align="center">
  <strong>MySQL desktop client — as fast as it should be.</strong>
</p>

<p align="center">
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases"><img src="https://img.shields.io/badge/Download-v2.0.3-0ea5e9?style=for-the-badge" /></a>
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
        <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases/download/v2.0.3/Surge-2.0.3-arm64.dmg">
          <img src="https://img.shields.io/badge/Download_DMG-117_MB-0ea5e9?style=for-the-badge&logo=apple" />
        </a>
      </td>
      <td align="center" width="280">
        <strong>Windows</strong><br><sub>x64 · Portable, unzip and run</sub><br><br>
        <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases/download/v2.0.0/Surge-2.0.0-portable-win-x64.zip">
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

## Features

| Feature | In one line |
|:---|:---|
| **DDL at a glance** | Right-click → View DDL, Monaco syntax-highlights the full `CREATE TABLE` with columns, indexes, and constraints |
| **Metadata rich** | Tree nodes show `TABLE_COMMENT`, columns show type badges + primary key indicators + row counts |
| **Index browser** | Name, columns, uniqueness, type, cardinality — all in one panel |
| **Context-aware autocomplete** | `FROM` suggests tables, `SELECT` suggests columns, `table.` suggests that table's fields, 100+ keywords |
| **Real-time SQL linting** | Full-width characters, Chinese punctuation in keywords — squiggly underline before you even run |
| **Batch execution** | Run multiple statements at once, results grouped with per-block timing and row counts |
| **In-place data editing** | Double-click any cell, changes highlighted, batch write-back to the database |
| **CSV / JSON export** | One-click download of query results |
| **Query history** | Auto-saves 50 queries with timestamps, searchable and reusable |
| **Transaction visualization** | `BEGIN` / `COMMIT` / `ROLLBACK` with full visibility |
| **Multi-instance & connection pool** | Connect to multiple MySQL servers at once, pooled connections with auto-reconnect |
| **Dark / Light themes** | DataGrip-inspired dark mode + bright mode, persisted across sessions |
| **Keyboard first** | `Ctrl+F` search · `Ctrl+Enter` run · `Ctrl+Shift+F` format · `Ctrl+W` close tab · `Ctrl+Shift+R` reopen tab |

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
