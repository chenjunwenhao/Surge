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

## 功能

| 能力 | 一句话 |
|:---|:---|
| **DDL 即视感** | 右键 View DDL，Monaco 语法高亮展示完整建表语句，含列、索引、约束 |
| **元数据到位** | 表节点显示 COMMENT 注释，列显示类型徽章 + 主键标识 + 行数 |
| **索引一览** | 名称、列、唯一性、类型、序位，一个面板全看清 |
| **上下文智能补全** | `FROM` 后弹表名、`SELECT` 后弹列名、`table.` 后弹该表字段，100+ 关键字 |
| **实时语法检查** | 全角字符误用、关键字拼错 —— 波浪线标记，写 SQL 不再踩坑 |
| **批量执行** | 多段 SQL 一起跑，结果分组展示，每段标执行时间和行数 |
| **原地编辑数据** | 双击单元格直接改，修改行高亮，批量写回数据库 |
| **CSV / JSON 导出** | 查询结果一键下载 |
| **查询历史** | 自动记录 50 条 SQL，带时间戳，可搜索复用 |
| **事务可视化** | `BEGIN` / `COMMIT` / `ROLLBACK` 全程可追踪 |
| **多实例 & 连接池** | 同时连多台 MySQL，池化复用，掉线自动重连 |
| **暗 / 亮双主题** | DataGrip 风暗色 + 明亮模式，持久记忆 |
| **键盘流** | `Ctrl+F` 搜库表 · `Ctrl+Enter` 执行 · `Ctrl+Shift+F` 格式化 · `Ctrl+W` 关标签 · `Ctrl+Shift+R` 恢复关闭标签 |

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
