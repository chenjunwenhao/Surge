<p align="center">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' rx='16' fill='%232563eb'/%3E%3Cellipse cx='36' cy='46' rx='17' ry='4' fill='%231d4ed8' opacity='0.5'/%3E%3Crect x='19' y='25' width='34' height='21' fill='%23ffffff'/%3E%3Cellipse cx='36' cy='25' rx='17' ry='4' fill='%23eff6ff'/%3E%3Cellipse cx='36' cy='46' rx='17' ry='4' fill='none' stroke='%23bfdbfe' stroke-width='1.5'/%3E%3C/svg%3E" width="76" />
</p>

<h1 align="center">Surge <sub>/sɜːrdʒ/</sub></h1>

<p align="center">
  <strong>MySQL 管理工具，就该这么快。</strong>
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
  <a href="./README.en.md">English</a>
</p>

---

<p align="center">
  <strong>不做 PostgreSQL。不做 SQLite。只做 MySQL。</strong><br>
  一个干净到极致的 MySQL 桌面客户端 —— 搜索快、SQL 美、操作零门槛。
</p>

---

## 下载

<p align="center">
  <table align="center">
    <tr>
      <td align="center" width="280">
        <strong>macOS</strong><br><sub>Apple Silicon · DMG 安装包</sub><br><br>
        <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases/download/v2.0.3/Surge-2.0.3-arm64.dmg">
          <img src="https://img.shields.io/badge/下载_DMG-117_MB-0ea5e9?style=for-the-badge&logo=apple" />
        </a>
      </td>
      <td align="center" width="280">
        <strong>Windows</strong><br><sub>x64 · 便携版，解压即用</sub><br><br>
        <a href="https://github.com/chenjunwenhao/MySQL-Explorer/releases/download/v2.0.0/Surge-2.0.0-portable-win-x64.zip">
          <img src="https://img.shields.io/badge/下载_便携版-133_MB-0ea5e9?style=for-the-badge&logo=windows" />
        </a>
      </td>
    </tr>
  </table>
</p>

> 也可从源码运行：`git clone` → `npm install` → `npm run dev` → 打开 `http://localhost:5173`

## 三个让你回不去的理由

<table>
<tr>
<td width="33%" valign="top">
<h4 align="center">搜得飞快</h4>
<p>侧边栏就像 Spotlight —— 打几个字，库、表、字段即时过滤。全拼、模糊匹配，一秒定位。不再 point-and-click 翻层级。</p>
</td>
<td width="33%" valign="top">
<h4 align="center">SQL 有美感</h4>
<p>400 行手写格式化引擎，零依赖。SELECT 列对齐、JOIN 层级缩进、子查询括号包裹、CASE/WHEN 语块分明、UNION 空行分隔。不是机器式的关键字换行，是给人看的排版。</p>
</td>
<td width="33%" valign="top">
<h4 align="center">告别手写 CRUD</h4>
<p>双击表名直接看数据行，展开即见列结构和 COMMENT。编辑单元格 → 修改高亮 → 批量保存。零 SQL 操作数据库，像用 Excel 一样自然。</p>
</td>
</tr>
</table>

## 帮助文档

### 键盘快捷键

| 快捷键 | 作用 | 说明 |
|---|---|---|
| `Ctrl+Enter` | 执行 SQL | 编辑器内运行当前查询或选中文本 |
| `Ctrl+Shift+Enter` | EXPLAIN | 查看查询执行计划 |
| `Ctrl+Space` | 触发补全 | 手动弹出自动补全菜单 |
| `Ctrl+F` | 搜索树 | 聚焦侧边栏搜索（不在编辑器时） |
| `Ctrl+W` | 关闭标签 | 关闭当前 Tab（不在编辑器时） |
| `Ctrl+H` | 查询历史 | 打开/关闭 History 面板 |
| `Ctrl+Shift+T` | 恢复标签 | 重新打开最近关闭的 Tab |
| `Escape` | 多场景 | 关闭 History 面板 / 取消单元格编辑 / 清除搜索 |
| `Enter` | 确认编辑 | 提交当前单元格修改 |

### 连接管理

- **新建连接**：支持 Host、Port、User、Password、Database，一键测试
- **保存连接**：常用连接持久化保存，双击重连
- **多实例**：同时连接多台 MySQL，连接池复用，掉线自动重连
- **断开确认**：断开连接前弹窗确认，防止误操作

### 数据库浏览器（侧边栏）

- 展开实例 → 数据库 → 表/视图（Tables/Views 分组）
- 展开表节点查看列（类型徽章、PK 标识、注释）和索引
- 侧边栏 **搜索框**（`Ctrl+F`），全拼/模糊匹配库表字段
- 每个数据库层级都有专属 **Console** 入口
- 刷新按钮 + 刷新时 **spinner 动画**反馈
- 断开连接按钮 + 确认弹窗

### 右键菜单

| 目标 | 菜单项 |
|---|---|
| 表 | Edit Data · View DDL · Show Indexes · Refresh · Copy Name · SELECT * FROM |
| 数据库/实例 | Open Console · Refresh · Copy Name · Disconnect（实例） |

### Tab 管理

- 查询 Tab 和表数据 Tab 并存
- 单 Tab 关闭（× 按钮 / `Ctrl+W`）
- 右键菜单：Close / Close Others / Close to Right / Close to Left / Close All / Reopen
- 超过 5 个 Tab 显示 ≡ 列表
- `Ctrl+Shift+T` 恢复关闭的 Tab（记住最近 20 个）

### SQL 编辑器（Monaco）

- **上下文智能补全**：
  - `FROM`/`JOIN`/`INTO` 后弹出表名（含 VIEW 标识）
  - `SELECT`/`WHERE`/`ON` 后弹出列名（含类型和来源表）
  - 输入 `table.` 精确提示该表字段
  - 100+ SQL 关键字 + 50+ 内置函数
- **实时语法检查**：全角字符、关键字拼写错误红色波浪线
- SQL 格式化（语义缩进、对齐、分隔）
- 代码折叠、换行、行号

### 编辑器工具栏

| 按钮 | 功能 |
|---|---|
| DB 选择器 | 带搜索下拉，为当前 Tab 切换数据库 |
| Begin / Commit / Rollback | 事务控制 |
| Cancel | 取消正在运行的查询 |
| History ⌛ | 查询历史面板（`Ctrl+H`），带数量徽章 |
| ↩ | 恢复关闭标签（`Ctrl+Shift+T`）|
| Format | SQL 格式化 |
| Explain | 查询执行计划（`Ctrl+Shift+Enter`）|
| Run | 执行查询（`Ctrl+Enter`）|

### 查询结果 & 批量执行

- **选中执行**：高亮部分 SQL 仅执行选中区域
- **批量执行**：多条 SQL 分号分隔，结果分组展示，每段标明行数/影响行数/耗时
- 批量结果可展开查看详细数据，支持 CSV/JSON 导出
- EXPLAIN 结果独立面板展示

### 查询历史

- 自动记录最近 50 条 SQL（localStorage 持久化）
- **搜索过滤**：头部输入框实时筛选
- **单击复用**：在新 Tab 中打开历史查询（保留原始数据库上下文）
- **单条删除**：hover 显示 × 按钮
- **全部清除**：Clear All 按钮
- 关闭方式：Escape / 点击面板外部

### 表数据编辑（零 SQL 操作）

- 双击表打开数据网格，三个子面板：Data / DDL / Indexes
- **Data 面板**：
  - 双击单元格原地编辑，修改行高亮
  - 批量保存（基于主键自动生成 UPDATE）
  - 分页（20/50/100/200 行）、列排序、文本过滤
  - Enter 确认 / Escape 取消编辑
  - NULL 值灰色斜体显示
- **DDL 面板**：Monaco 语法高亮展示 CREATE TABLE 完整语句
- **Indexes 面板**：名称、列、唯一性、类型一览

### 主题 & 布局

- 暗色 / 亮色主题切换（localStorage 持久化）
- 侧边栏宽度可拖拽（240-500px）
- 编辑器与结果面板高度可拖拽分割（20-80%）
- DDL/DML 操作后自动刷新侧边栏树

## 自行构建

```bash
# macOS (.dmg)
npm run electron:build:mac

# Windows (.exe)
npm run electron:build:win

# 全平台
npm run electron:build:all
```

## 技术栈

| 层 | 技术 |
|:---|:---|
| 前端 | React 18 · Vite 5 · Monaco Editor |
| 后端 | Express · MySQL2 · 连接池 |
| 桌面 | Electron |

## 项目结构

```
src/
  ├── App.jsx         主应用 · 状态管理 · 连接逻辑
  ├── components/     侧边栏树 · 编辑器 · 表格 · DDL · 索引 · 上下文菜单
  └── utils/          SQL 格式化器 · 检查器 · 图标 · API 客户端
server.js             Express 后端（20+ API 端点 + 连接池）
electron/             Electron 桌面壳
```

---

<p align="center">
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/blob/main/LICENSE">MIT License</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer/issues">提交 Issue</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/chenjunwenhao/MySQL-Explorer">Star ⭐</a>
</p>
