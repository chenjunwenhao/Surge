<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%231e2230'/%3E%3Cstop offset='100%25' stop-color='%2315181b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='url(%23bg)'/%3E%3Cellipse cx='32' cy='20' rx='13' ry='5.5' fill='none' stroke='%234a86f8' stroke-width='2.5'/%3E%3Cpath d='M19 20 L19 42 A13 5.5 0 0 0 45 42 L45 20' fill='none' stroke='%234a86f8' stroke-width='2.5'/%3E%3Cellipse cx='32' cy='42' rx='13' ry='5.5' fill='%234a86f833' stroke='%234a86f8' stroke-width='2.5'/%3E%3Cpath d='M22 18 A11 3.5 0 0 1 42 18' fill='none' stroke='%236ab0ff' stroke-width='1.2' opacity='0.4'/%3E%3C/svg%3E" width="72" />
</p>

<h3 align="center">MySQL Explorer</h3>
<p align="center">Only MySQL. Nothing else.</p>

<p align="center">
  <img src="https://img.shields.io/badge/MySQL-Only-4479A1?logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite" />
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

一个干净利落的 MySQL 管理工具。不做 PostgreSQL，不做 SQLite —— 只专注 MySQL 一件事。

### 三个核心

**搜索快。** 在侧边栏输入字符，即时过滤库、表、字段，不用一层层点开找。支持全拼和模糊匹配。

**格式化好。** 手写 SQL 格式化引擎，按人类阅读习惯排版。不是机器式的关键字换行，SELECT 列对齐、JOIN 层级缩进、子查询括号包裹、CASE/WHEN 语块分明、UNION 空行分隔 —— 400 行纯逻辑，不依赖任何第三方库。

**直通数据。** 双击表名直接看数据行，展开即见列结构和 COMMENT 注释。编辑单元格、修改后保存回数据库，无需写一条 SQL。

### 亮点

| 能力 | |
|---|---|
| **DDL 一目了然** | 右键表 → View DDL，Monaco 编辑器语法高亮展示完整 `CREATE TABLE`，包括所有列、索引、约束 |
| **表注释 & 列元数据** | 树节点显示 `TABLE_COMMENT`，列显示类型徽章 + 主键标识，行数统计 |
| **索引浏览** | 一键查看表的所有索引：名称、列、唯一性、类型、序位 |
| **Monaco 智能补全** | 上下文感知：FROM 后提示表名、SELECT 后提示列名、`table.` 后提示该表字段、100+ SQL 关键字和函数 |
| **实时 SQL 检查** | 编辑器自动检测全角字符/中文符号误用、拼写错误的关键字，波浪线标记 |
| **批量结果** | 多条 SQL 一起执行，结果分组展示，每段标注用时和行数 |
| **数据编辑** | 双击单元格直接修改，修改行高亮，批量保存回数据库 |
| **CSV / JSON 导出** | 查询结果一键下载 |
| **查询历史** | 自动记录 50 条 SQL，时间戳，可搜索复用 |
| **事务支持** | BEGIN / COMMIT / ROLLBACK 全程可视 |
| **多实例 & 连接池** | 同时连多个 MySQL 服务器，连接池复用、断线自动重连 |
| **暗 / 亮双主题** | DataGrip 风格暗色 + 明亮模式，持久化记忆 |
| **键盘优先** | `Ctrl+F` 搜库表 · `Ctrl+Enter` 执行 · `Ctrl+Shift+F` 格式化 · `Ctrl+W` 关标签 · `Ctrl+Shift+R` 恢复关闭的标签 |
| **Electron 桌面版** | 打包为 macOS / Windows 原生应用 |

### 快速开始

```bash
git clone git@github.com:chenjunwenhao/MySQL-Explorer.git
cd MySQL-Explorer
npm install
npm run dev
```

打开 `http://localhost:5173`，填入连接信息。

### 项目结构

```
src/              React 前端（10 个组件）
  ├── App.jsx     主应用 · 状态管理 · 连接逻辑
  ├── components/ 侧边栏树 · 编辑器 · 表格 · DDL · 索引 · 上下文菜单
  └── utils/      SQL 格式化器 · 检查器 · 图标 · API 客户端
server.js         Express 后端（20 个 API 端点 + 连接池）
electron/         Electron 桌面壳
```

### 技术栈

React 18 · Vite 5 · Monaco Editor · Express · MySQL2 · Electron

---

MIT · [提交 Issue](https://github.com/chenjunwenhao/MySQL-Explorer/issues) · [Star 一下](https://github.com/chenjunwenhao/MySQL-Explorer)
