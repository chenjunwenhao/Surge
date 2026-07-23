## Added
- **Dump/Export 导出确认弹窗**：右键导出前先查 information_schema 预估行数和文件大小，弹窗提供三个选项——导出前 10 万行 / 导出全部 / 仅结构，防止大表 OOM
- **Dump 默认行数上限**：服务端默认 maxDataRows=100000，超出截断时在 SQL 输出中标注 WARNING
- **结果面板行数状态增强**：行数用千分位格式化，超过 10 万行标橙色 "large result" 标签
- **事务超时保护**：事务空闲超 5 分钟 / 15 分钟弹出 Toast 警告，超 30 分钟服务端自动回滚
- **应用退出优雅清理**：退出前自动回滚所有活跃事务、关闭所有连接池

## Changed
- **右键菜单视口自适应**：实测菜单真实尺寸后翻转定位，不再因估算偏差导致菜单远离点击位置
- **ConfirmDialog 组件增强**：支持 children 自定义内容体和 buttons 多按钮模式
## Fixed
- **修复 Save Row 失败**：只更新真正被修改的列，避免 GENERATED / 计算列导致 UPDATE 报错
- **修复跨库 UPDATE**：/api/edit 接口 SQL 加上数据库前缀，支持操作非默认库的表
- **错误信息明确化**：保存失败时 toast 展示具体 MySQL 错误原因
