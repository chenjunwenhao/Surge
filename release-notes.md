## Fixed
- **修复更新下载超时**：GitHub Release 下载从请求到 CDN 重定向耗时较长，原 30s 超时太短。提升到 120s。
