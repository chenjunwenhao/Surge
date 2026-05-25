<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%231e2230'/%3E%3Cstop offset='100%25' stop-color='%2315181b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='url(%23bg)'/%3E%3Cellipse cx='32' cy='20' rx='13' ry='5.5' fill='none' stroke='%234a86f8' stroke-width='2.5'/%3E%3Cpath d='M19 20 L19 42 A13 5.5 0 0 0 45 42 L45 20' fill='none' stroke='%234a86f8' stroke-width='2.5'/%3E%3Cellipse cx='32' cy='42' rx='13' ry='5.5' fill='%234a86f833' stroke='%234a86f8' stroke-width='2.5'/%3E%3Cpath d='M22 18 A11 3.5 0 0 1 42 18' fill='none' stroke='%236ab0ff' stroke-width='1.2' opacity='0.4'/%3E%3C/svg%3E" width="72" />
</p>

<h1 align="center">MySQL Explorer</h1>

<p align="center"><strong>Only MySQL. Nothing else.</strong></p>

<p align="center">
  <a href="https://www.mysql.com"><img src="https://img.shields.io/badge/MySQL-Only-4479A1?logo=mysql&logoColor=white" /></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" /></a>
  <a href="https://vitejs.dev"><img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

一个干净利落的 MySQL 管理工具。不做 PostgreSQL，不做 SQLite —— 只专注 MySQL 一件事。

## 三个核心

<table>
<tr>
<td width="33%" valign="top">
<h4 align="center">即时搜索</h4>
<p>在侧边栏输入字符，即时过滤库、表、字段，不用一层层展开查找。支持全拼和模糊匹配，瞬间定位目标。</p>
</td>
<td width="33%" valign="top">
<h4 align="center">手写格式化引擎</h4>
<p>400 行纯逻辑，零第三方依赖。按人类阅读习惯排版：SELECT 列对齐、JOIN 层级缩进、子查询括号包裹、CASE/WHEN 语块分明、UNION 空行分隔。不是机器式的关键字换行。</p>
</td>
<td width="33%" valign="top">
<h4 align="center">零 SQL 数据操作</h4>
<p>双击表名直接看数据行，展开即见列结构和 COMMENT 注释。编辑单元格、修改后保存回数据库，一行 SQL 都不用写。</p>
</td>
</tr>
</table>

## 功能一览

| 分类 | 能力 |
|:---|:---|
| **DDL & 元数据** | 右键表 → View DDL，Monaco 编辑器语法高亮展示完整 `CREATE TABLE`（列、索引、约束）；树节点显示 `TABLE_COMMENT`，列显示类型徽章 + 主键标识 + 行数统计 |
| **索引浏览** | 一键查看表的所有索引：名称、列、唯一性、类型、序位 |
| **智能补全** | Monaco 上下文感知：`FROM` 后提示表名、`SELECT` 后提示列名、`table.` 后提示该表字段、100+ SQL 关键字和函数 |
| **实时 SQL 检查** | 编辑器自动检测全角字符 / 中文符号误用、拼写错误的关键字，波浪线标记 |
| **批量结果** | 多条 SQL 同时执行，结果分组展示，每段标注用时和行数 |
| **数据编辑** | 双击单元格直接修改，修改行高亮，批量保存回数据库 |
| **CSV / JSON 导出** | 查询结果一键下载 |
| **查询历史** | 自动记录 50 条 SQL，带时间戳，可搜索复用 |
| **事务支持** | `BEGIN` / `COMMIT` / `ROLLBACK` 全程可视 |
| **多实例 & 连接池** | 同时连多个 MySQL 服务器，连接池复用、断线自动重连 |
| **暗 / 亮双主题** | DataGrip 风格暗色 + 明亮模式，持久化记忆 |
| **键盘优先** | `Ctrl+F` 搜库表 · `Ctrl+Enter` 执行 · `Ctrl+Shift+F` 格式化 · `Ctrl+W` 关标签 · `Ctrl+Shift+R` 恢复关闭的标签 |

## 桌面应用打包

不仅能在浏览器里用，还能打包成原生桌面应用。

```bash
# macOS (.dmg)
npm run electron:build:mac

# Windows (.exe)
npm run electron:build:win

# 全平台
npm run electron:build:all
```

基于 Electron，内嵌 Express 后端，双击即用，不依赖浏览器。

## 快速开始

```bash
git clone git@github.com:chenjunwenhao/MySQL-Explorer.git
cd MySQL-Explorer
npm install
npm run dev
```

打开 `http://localhost:5173`，填入连接信息即可使用。

## 项目结构

```
src/
  ├── App.jsx         主应用 · 状态管理 · 连接逻辑
  ├── components/     侧边栏树 · 编辑器 · 表格 · DDL · 索引 · 上下文菜单
  └── utils/          SQL 格式化器 · 检查器 · 图标 · API 客户端
server.js             Express 后端（20+ API 端点 + 连接池）
electron/             Electron 桌面壳
```

## 技术栈

| 层 | 技术 |
|:---|:---|
| **前端** | React 18 · Vite 5 · Monaco Editor |
| **后端** | Express · MySQL2 · 连接池 |
| **桌面** | Electron |

---

<p align="center">
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/blob/main/LICENSE">MIT License</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/issues">提交 Issue</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer">Star 一下</a>
</p>
