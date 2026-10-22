## Fixed
- **修复 JSON 列显示为 [object Object]**：mysql2 驱动会把 JSON 列自动解析成 JS 对象，前端 `String()` 渲染时变成 `[object Object]`。在 `db.execute()` 返回处将对象值统一序列化回 JSON 文本，查询结果、Edit Data、CSV/JSON 导出、筛选排序均显示真实数据。BLOB 与 DML 结果集不受影响。

**完整 Changelog**: https://github.com/chenjunwenhao/Surge/blob/main/CHANGELOG.md
