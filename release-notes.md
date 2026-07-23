## Fixed
- **修复 Save Row 失败**：只更新真正被修改的列，避免 GENERATED / 计算列导致 UPDATE 报错
- **修复跨库 UPDATE**：/api/edit 接口 SQL 加上数据库前缀，支持操作非默认库的表
- **错误信息明确化**：保存失败时 toast 展示具体 MySQL 错误原因
