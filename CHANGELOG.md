# Changelog

## [2.4.5] — 2026-07-24

### Fixed
- **修复更新下载超时**：GitHub Release 下载从请求到 CDN 重定向耗时较长，原 30s 超时太短。提升到 120s。

## [2.4.4] — 2026-07-24

### Changed
- **自定义复选框替换原生控件**：查询结果和 Edit Data 的选择框替换为自定义样式（accent 色填充 + hover 光晕），点击不再因事件冒泡导致无效。

## [2.4.3] — 2026-07-24

### Fixed
- **修复右上角版本号显示不一致**：当有更新提示未清除时，`updateInfo.current`（旧版本号）会覆盖 `APP_VERSION`（真实版本号），导致右上角显示错误版本。改为始终显示 `APP_VERSION`，关闭更新弹窗时同步清除状态。

## [2.4.2] — 2026-07-24

### Fixed
- **修复自动更新"Blocked redirect to untrusted host"**：GitHub 将 Release 资产 CDN 域名从 `objects.githubusercontent.com` 迁移到 `release-assets.githubusercontent.com`，白名单正则未覆盖新域名导致下载被拦截。改为通配 `*.githubusercontent.com` 子域名，未来扩展无需再改。

## [2.4.1] — 2026-07-23

### Fixed
- **修复端口冲突导致启动无响应**：`startServer(0)` 传入的端口 0 被 JavaScript `||` 运算符当成 falsy 回退到 3000，导致端口被占用时静默崩溃。改为 `??` 运算符，真正启用自动找空闲端口。

## [2.4.0] — 2026-07-14

### Added
- **Dump/Export 导出确认弹窗**：右键导出前先查 `information_schema` 预估行数和文件大小，弹窗显示预估信息并提供三个选项——导出前 10 万行 / 导出全部 / 仅结构，防止大表 OOM
- **Dump 默认行数上限**：服务端默认 `maxDataRows=100000`，超出截断时在 SQL 输出中标注 WARNING
- **结果面板行数状态增强**：行数用千分位格式化，超过 10 万行标橙色 "large result" 标签
- **事务超时保护**：事务空闲超 5 分钟 / 15 分钟弹出 Toast 警告，超 30 分钟服务端自动回滚
- **应用退出优雅清理**：退出前自动回滚所有活跃事务、关闭所有连接池

### Changed
- **右键菜单视口自适应**：实测菜单真实尺寸后翻转定位，不再因估算偏差导致菜单远离点击位置
- **右键菜单 CSS 防溢出**：`max-height: 85vh; overflow-y: auto` 双重保险
- **ConfirmDialog 组件增强**：支持 `children` 自定义内容体和 `buttons` 多按钮模式

## [2.3.2] — 2026-07-14

### Fixed
- **错误提示全面优化**：修复多处 Toast 提示模糊不准确的问题
  - `saveRow` / `deleteRows` 失败时明确展示后端返回的具体错误原因（如 "Data too long for column"），不再仅显示 "Saved 0, 1 failed"
  - 全部失败时显示 `Save failed: {错误原因}` 而非模糊的计数
  - `loadCols` / `loadDDL` / `loadIdx` / `loadRoutineDDL` / `loadTriggerDDL` 错误提示增加操作上下文（表名、对象类型）
  - `loadSaved` 错误提示增加 "Failed to load saved connections" 前缀
  - `disconnectInst` 错误时显示具体失败原因

## [2.3.1] — 2026-06-25

### Fixed
- **修复 Save Row 失败**：只更新真正被修改的列，避免 GENERATED / 计算列导致 UPDATE 报错
- **修复跨库 UPDATE**：`/api/edit` 接口 SQL 加上数据库前缀，支持操作非默认库的表
- **错误信息明确化**：保存失败时 toast 展示具体 MySQL 错误原因

## [2.3.0] — 2026-06-24

### Added
- **存储过程 & 函数支持**：侧边栏展示 Procedures / Functions 分组，右键查看 DDL
- **触发器支持**：侧边栏展示 Triggers 分组，右键查看 DDL
- **表节点 SQL 快捷生成**：点击表名旁的 SQL 图标，一键生成 SELECT / INSERT / UPDATE / DELETE 模板到编辑器
- **导出 Dump 子菜单**：右键导出支持 Structure Only / Data Only / Structure + Data 三种模式
- **XLSX 导出**：结果集支持导出为 Excel (.xlsx) 格式

### Changed
- 编辑器字体大小调节持久化到 localStorage
- Tab 会话恢复增强，重启后自动恢复上次标签页结构
- 侧边栏键盘导航（方向键移动焦点，Enter 激活）

## [2.2.0] — 2026-06-24

### Added
- **AI 开发辅助文档**：新增 `CLAUDE.md` 和 `AGENTS.md`，提供完整的项目架构说明、API 端点清单、数据流示例和开发规范，方便 AI 辅助工具理解项目结构

## [2.1.0] — 2026-06-13

### Added
- **数据导入（CSV/JSON）**：右键表 → Import Data，拖拽 CSV/JSON 文件即可批量导入。支持列映射预览、拖拽上传、进度显示、分批 INSERT 写入
- **查询收藏（Snippets）**：编辑器工具栏新增保存/加载按钮，SQL 片段持久化到 localStorage，按名称或内容搜索
- **外键展示**：展开表节点可查看 Foreign Keys 分组，显示引用的表和列
- **标签页会话恢复**：关闭应用后重新打开自动恢复上次的 Tab 结构
- **编辑器字体大小**：工具栏 + / – 按钮调节 Monaco 编辑区字号（10-24px），设置持久化
- **光标处执行语句**：未选中文本时自动识别光标所在 SQL 语句边界，只执行当前语句
- **结果右键 Copy as INSERT**：查询结果表格右键 → Copy Row as INSERT 一键复制整行数据的 INSERT 语句
- **侧边栏键盘导航**：方向键 ↑↓ 在数据库树节点间移动，Enter 激活当前节点
- **导出 Dump (.sql)**：右键表或数据库 → Export Dump，生成包含 CREATE TABLE + INSERT INTO 的完整 SQL 导出文件
- **导出 Excel (.xlsx)**：结果面板新增 XLSX 按钮，支持将查询/表数据导出为 Excel 格式
- **SQL 语句生成**：查询结果面板新增 `SQL` 按钮，支持一键生成 INSERT 或 UPDATE 语句，弹窗预览并复制到剪贴板
- 表名列自动填充、WHERE 列勾选（INSERT/UPDATE 模式切换）

### Changed
- **架构重构**：App.jsx 从 1228 行精简至 654 行（-47%）
  - 抽取 4 个自定义 Hook：`useMonacoAutocomplete`、`useSidebar`、`useConnections`、`useQueryExecution`
  - 代码模块化，职责清晰，可维护性大幅提升
- 仓库更名为 **Surge**（原 MySQL-Explorer），GitHub 地址更新为 `github.com/chenjunwenhao/Surge`

### Fixed
- 修复 SQL 生成弹窗 `setMResult` 缺失导致崩溃
- 修复 TabContent 组件 `generateDml` / `toast` props 丢失导致按钮无响应
- 清理 App.jsx 废 import（`scheduleLint`）

---

## [2.0.4] — 2026-06-12

### Added
- 自定义确认弹窗替换原生 `alert`（`ConfirmDialog` 组件）
- 查询历史增加复制 SQL 按钮
- README 添加完整帮助文档

### Changed
- 历史面板交互全面优化（搜索、删除、复用时保留上下文）
- 表头排序增加第三态恢复原始顺序
- 表头列名/类型分行展示

### Fixed
- API 请求空响应导致 JSON parse 崩溃
- EXPLAIN 只取首条语句发送
- 查询计时器与终止按钮状态修复
- Tab 快捷关闭、刷新/断开交互优化
- TableDataGrid 表头列名类型分行展示未生效
- TabContent 缺少 `running` prop 导致崩溃
- 编辑器/结果面板拆分使用 flex-grow 布局自适应
- DDL 执行后自动刷新侧边栏树
- README 下载链接文件名更正

---

## [2.0.0] — 2026-06-11

### Added
- 初始版本发布
- MySQL 连接管理（多实例、连接池、自动重连）
- 数据库浏览器（实例 → 数据库 → 表/视图树）
- SQL 编辑器（Monaco + 上下文智能补全 + 实时检查 + 格式化）
- 查询执行（批量执行、EXPLAIN、事务控制）
- 表数据编辑（单元格原地编辑、批量保存）
- DDL / Indexes 查看
- CSV / JSON 导出
- 查询历史记录
- 暗色/亮色主题
- 侧边栏与结果面板拖拽调整大小
