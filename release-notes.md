## Fixed
- **修复右上角版本号显示不一致**：当有更新提示未清除时，`updateInfo.current`（旧版本号）会覆盖 `APP_VERSION`（真实版本号），导致右上角显示错误版本。改为始终显示 `APP_VERSION`，关闭更新弹窗时同步清除状态。
