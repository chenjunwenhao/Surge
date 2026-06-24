# Surge 项目架构与开发规范

---

# 项目架构

## 1. 项目概述

**Surge** (/sɜːrdʒ/) 是一个极简、高性能的 MySQL 桌面客户端，基于 Electron + React + Express 构建，专注于 MySQL 单数据库的极致体验。不做 PostgreSQL，不做 SQLite，只做 MySQL。

- **前端**：React 18 + Vite 5 + Monaco Editor
- **后端**：Express + MySQL2 连接池
- **桌面**：Electron（内嵌 Express 服务）
- **发布**：electron-builder 打 DMG (macOS) / NSIS + portable (Windows)

## 2. 核心组件和职责

### 2.1 主要工作流程

```
用户交互 (BrowserWindow)
  ↓
React 前端 (Vite build → dist/)
  ├─→ [侧边栏] SidebarTree: 库/表/视图/例程/触发器树形浏览
  ├─→ [编辑器] TabContent + Monaco: SQL 编写、补全、格式化
  └─→ [结果面板] QueryResultTable / TableDataGrid / DDLViewer
  ↓ HTTP API (localhost:随机端口)
Express 后端 (server.js)
  ├─→ 连接管理: 多实例连接池、AES-256-GCM 密码加密
  ├─→ 查询执行: 批量 SQL 拆分、事务控制、查询取消
  ├─→ 数据操作: CRUD 编辑、CSV/JSON 导入、导出 Dump/XLSX
  └─→ 元数据: information_schema 查询（表、列、索引、外键、例程、触发器）
  ↓ MySQL 协议
MySQL 实例 (mysql2 连接池)
```

### 2.2 核心组件详解

| 组件 | 位置 | 职责 | 关键文件 |
|------|------|------|--------|
| **桌面入口** | `electron/` | Electron 窗口管理、单实例锁、内嵌 Express | `main.js`, `preload.js` |
| **API 服务** | 根目录 | RESTful API + 连接池 + 密码加密 | `server.js`, `db.js` |
| **主应用** | `src/App.jsx` | 全局状态编排、Tab 管理、布局控制 | `App.jsx` |
| **侧边栏** | `src/components/SidebarTree.jsx` | 数据库树形导航、搜索过滤、右键菜单 | `SidebarTree.jsx` |
| **编辑器** | `src/components/TabContent.jsx` | Monaco SQL 编辑器 + 工具栏 + 批量结果 | `TabContent.jsx` |
| **数据网格** | `src/components/TableDataGrid.jsx` | 表数据浏览、原地编辑、分页排序 | `TableDataGrid.jsx` |
| **结果表格** | `src/components/QueryResultTable.jsx` | 查询结果展示、CSV/JSON/XLSX 导出 | `QueryResultTable.jsx` |
| **DDL 查看** | `src/components/DDLViewer.jsx` | CREATE TABLE / VIEW / PROCEDURE DDL | `DDLViewer.jsx` |
| **索引查看** | `src/components/IndexesViewer.jsx` | 表索引信息展示 | `IndexesViewer.jsx` |
| **导入弹窗** | `src/components/ImportModal.jsx` | CSV/JSON 文件导入、列映射预览 | `ImportModal.jsx` |
| **SQL 生成** | `src/components/GenerateSqlModal.jsx` | INSERT/UPDATE 语句生成 | `GenerateSqlModal.jsx` |
| **查询选择** | `src/components/QueryPicker.jsx` | 查询收藏 Snippets 管理 | `QueryPicker.jsx` |
| **上下文菜单** | `src/components/ContextMenu.jsx` | 右键菜单组件 | `ContextMenu.jsx` |
| **Toast** | `src/components/Toast.jsx` | 消息通知组件 | `Toast.jsx` |
| **确认弹窗** | `src/components/ConfirmDialog.jsx` | 替代原生 alert 的自定义弹窗 | `ConfirmDialog.jsx` |

### 2.3 自定义 Hooks

| Hook | 位置 | 职责 |
|------|------|------|
| `useConnections` | `src/hooks/useConnections.js` | 连接 CRUD、测试、连接池状态 |
| `useSidebar` | `src/hooks/useSidebar.js` | 侧边栏树数据加载、搜索过滤、右键菜单动作 |
| `useQueryExecution` | `src/hooks/useQueryExecution.js` | SQL 执行、批量拆分、历史记录、事务控制 |
| `useMonacoAutocomplete` | `src/hooks/useMonacoAutocomplete.js` | Monaco 上下文智能补全（表名、列名、关键字、函数） |

### 2.4 工具模块

| 模块 | 位置 | 职责 |
|------|------|------|
| API 客户端 | `src/utils/api.js` | 前端 HTTP 请求封装 |
| SQL 格式化 | `src/utils/sqlFormatter.js` | 手写 400 行格式化引擎，零依赖 |
| SQL 检查 | `src/utils/sqlLinter.js` | 全角字符、关键字拼写检查 |
| SQL 生成 | `src/utils/sqlGenerator.js` | INSERT/UPDATE 语句生成逻辑 |
| CSV 解析 | `src/utils/csvParser.js` | CSV 文件解析（引号、转义、多行） |
| 图标 | `src/utils/icons.js` | 树节点图标配置 |

---

## 3. 主要的包和类的组织方式

### 3.1 分层结构

```
表现层 (UI):
  ├─ App.jsx                  主应用编排
  ├─ hooks/                   状态与业务逻辑 Hook
  └─ components/              UI 组件

服务层 (Backend):
  ├─ server.js                Express API (30+ 端点)
  ├─ db.js                    连接池管理
  └─ electron/main.js         Electron 桌面壳

工具层 (Utilities):
  └─ src/utils/               SQL 格式化、检查、生成、CSV 解析、API 封装
```

### 3.2 API 端点一览

```
连接管理:
  GET    /api/connections          列出已保存连接
  POST   /api/connections          新增/更新连接
  PUT    /api/connections/:id      编辑连接
  DELETE /api/connections/:id      删除连接
  POST   /api/connect              建立数据库连接
  POST   /api/test-connection      测试连接
  POST   /api/disconnect           断开连接
  GET    /api/pool-status          连接池状态

元数据:
  GET    /api/databases            数据库列表
  GET    /api/tables               表/视图列表
  GET    /api/columns              列信息
  GET    /api/table-ddl            CREATE TABLE DDL
  GET    /api/table-indexes        索引信息
  GET    /api/table-fks            外键信息
  GET    /api/routines             存储过程/函数列表
  GET    /api/routine-ddl          存储过程/函数 DDL
  GET    /api/triggers             触发器列表
  GET    /api/trigger-ddl          触发器 DDL
  GET    /api/autocomplete         自动补全数据

查询执行:
  POST   /api/query                单条 SQL 执行
  POST   /api/query-batch          批量 SQL 执行（智能分号拆分）
  GET    /api/explain              EXPLAIN 查询
  POST   /api/cancel-query         取消正在运行的查询
  POST   /api/transaction          事务控制（begin/commit/rollback）

数据操作:
  POST   /api/edit                 UPDATE 单行（基于主键）
  POST   /api/insert               INSERT 单行
  POST   /api/delete               DELETE 单行（基于主键）
  POST   /api/import               批量导入（CSV/JSON）

导出:
  POST   /api/export               CSV/JSON/XLSX 导出
  POST   /api/dump                 SQL Dump 导出
```

### 3.3 关键依赖关系

```
App.jsx
├─ useConnections()          → 连接管理、连接池状态
├─ useSidebar()              → 树数据、搜索、右键菜单
├─ useQueryExecution()       → SQL 执行、事务、历史
├─ useMonacoAutocomplete()   → Monaco 补全提供者
├─ SidebarTree               → 左侧导航树
├─ TabContent (多个)         → 编辑器 + 结果面板
├─ ConnectionModal           → 新建/编辑连接弹窗
├─ ConfirmDialog             → 确认弹窗
└─ Toast                     → 消息通知

TabContent
├─ Monaco Editor             → SQL 编辑
├─ QueryResultTable          → 查询结果
├─ TableDataGrid             → 表数据编辑
├─ DDLViewer                 → DDL 展示
├─ IndexesViewer             → 索引展示
├─ GenerateSqlModal          → SQL 生成弹窗
├─ ImportModal               → 数据导入弹窗
└─ QueryPicker               → Snippets 面板

server.js
├─ db.js                     → 连接池管理
├─ crypto (AES-256-GCM)      → 密码加密
└─ xlsx                      → Excel 导出
```

---

## 4. 数据流示例

### 4.1 SQL 查询完整流程

```
用户在 Monaco 输入 "SELECT * FROM users WHERE id = 1"
  ↓
[编辑器层]
  useMonacoAutocomplete → 上下文感知补全（FROM 后提示表名）
  Ctrl+Enter 触发执行
  ↓
[前端层]
  useQueryExecution.execute()
    → api.executeQuery(instanceId, database, sql)
    → POST /api/query-batch { instanceId, database, sql }
  ↓
[服务层]
  server.js splitSQL() → 智能分号拆分（尊重字符串、注释、反引号）
  → 如果指定 database: USE `db` 前缀
  → db.execute(instanceId, sql, params)
    → mysql2 pool.getConnection()
    → connection.execute(sql, params)
    → 返回 { rows, fields }
  ↓
[响应]
  { ok: true, results: [{ sql, rows, fields, affectedRows, elapsed, isSelect }] }
  ↓
[前端渲染]
  TabContent → 更新 results 状态
  → QueryResultTable 渲染表格
  → 查询历史记录到 localStorage (最近 50 条)
```

### 4.2 表数据编辑流程

```
双击表节点 → 打开 TableDataGrid
  ↓
[加载数据]
  GET /api/query → SELECT * FROM table LIMIT 20 OFFSET 0
  GET /api/columns → 列元数据（类型、PK、NULL约束）
  GET /api/table-indexes → 索引信息
  GET /api/table-fks → 外键信息
  ↓
[用户编辑]
  双击单元格 → 进入编辑模式
  修改值 → 行高亮标记 dirty
  Enter → 确认修改（本地状态更新）
  ↓
[批量保存]
  点击 Save Changes
  → 遍历 dirtyRows
  → POST /api/edit { table, pk: {id: 1}, updates: {name: "new"} }
  → server.js 构造 UPDATE `table` SET `col` = ? WHERE `pk` = ?
  → 清除 dirty 标记，刷新数据
```

### 4.3 数据导入流程

```
右键表 → Import Data → 打开 ImportModal
  ↓
[文件解析]
  拖拽 CSV/JSON 文件
  → csvParser.js 解析 CSV（引号、转义、多行字段）
  → 或 JSON.parse 解析 JSON 数组
  ↓
[列映射预览]
  自动检测表头 → 展示列名可编辑 + 前 10 行预览
  ↓
[批量写入]
  点击 Import
  → 分批 POST /api/import { database, table, columns, rows: batch }
  → 每批 200 行，实时进度
  → server.js INSERT INTO table (cols) VALUES (...)
  → 完成显示统计
```

---

# 5. 开发规范

## 5.1 技术栈约定

- **包管理**：npm（不使用 yarn/pnpm）
- **前端构建**：Vite 5，输出到 `dist/`
- **代码风格**：JSX 文件使用函数组件 + Hooks，禁止 class 组件
- **CSS**：单文件 `src/styles.css`，CSS 变量主题切换（暗色/亮色）
- **状态管理**：React useState/useContext，无第三方状态库

## 5.2 命名规范

- **组件文件**：PascalCase，如 `SidebarTree.jsx`, `TableDataGrid.jsx`
- **Hook 文件**：`use` 前缀，如 `useConnections.js`, `useSidebar.js`
- **工具文件**：camelCase，如 `sqlFormatter.js`, `csvParser.js`
- **API 端点**：kebab-case，如 `/api/query-batch`, `/api/table-ddl`
- **CSS 类名**：kebab-case，如 `.sidebar-tree`, `.tab-bar`

## 5.3 开发命令

```bash
npm run dev               # 开发模式（Express + Vite 热更新）
npm run build             # 仅构建前端
npm run electron:dev      # 构建前端 + 启动 Electron
npm run electron:build:mac   # 构建前端 + 打包 macOS DMG
npm run electron:build:win   # 构建前端 + 打包 Windows
npm run electron:build:all   # 构建前端 + 全平台打包
```

## 5.4 打包与发布流程

1. **升级版本号**：修改 `package.json` 中的 `version`
2. **更新 CHANGELOG**：在 `CHANGELOG.md` 顶部添加新版本条目
3. **更新 README 下载链接**：修改 `README.md` 和 `README.en.md` 中的版本号和文件名
4. **提交代码**：`git add -A && git commit -m "vX.Y.Z" && git tag vX.Y.Z`
5. **构建全平台包**：`npm run electron:build:all`（输出到 `release/`）
6. **创建 GitHub Release**：上传 `release/*.dmg` 和 `release/*.exe` 等资产
7. **推送**：`git push origin main --tags`

## 5.5 注意事项

### 前端
- 使用 `useCallback` 时注意函数声明顺序，避免 TDZ（Temporal Dead Zone）错误
- `useMemo` 依赖数组必须包含所有使用的状态变量，遗漏会导致渲染失效
- 侧边栏树节点按需渲染（Tables/Views/Routines/Triggers/Foreign Keys 分组独立加载）
- 快速搜索采用双边模糊匹配（匹配首字母和任意位置子串）
- 表格选中模式：选中任意单元格即进入多选模式，选中行号进入单选模式

### 后端
- 连接类操作必须有完整的 try-catch 错误处理
- 密码使用 AES-256-GCM 加密后持久化
- SQL 标识符使用反引号转义（`` `table` ``）
- 批量 SQL 拆分必须正确处理字符串引号、注释、反引号内的分号
- 所有 API 返回统一格式 `{ ok: true/false, ... }`

### 数据库对象交互
- MySQL 例程（存储过程/函数）和触发器的 DDL 使用 `SHOW CREATE` 获取，只读展示，不支持直接修改
- SQL 模板字段必须完整，不可遗漏列

### SQL 生成
- 左侧表节点支持快捷 SQL 生成：右键菜单 → SELECT * FROM / INSERT INTO / UPDATE / DELETE
- 从查询结果可一键生成 INSERT 或 UPDATE 语句
