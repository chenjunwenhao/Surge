## Fixed
- **修复自动更新"Blocked redirect to untrusted host"**：GitHub 将 Release 资产 CDN 域名从 `objects.githubusercontent.com` 迁移到 `release-assets.githubusercontent.com`，白名单正则未覆盖新域名导致下载被拦截。改为通配 `*.githubusercontent.com` 子域名。
## Fixed
- **修复端口冲突导致启动无响应**：`startServer(0)` 传入的端口 0 被 JavaScript `||` 运算符当成 falsy 回退到 3000，导致端口被占用时静默崩溃。改为 `??` 运算符，真正启用自动找空闲端口。
