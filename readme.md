# MySQL CLI UI

轻量级 MySQL 管理界面，使用 React + Monaco 编辑器构建，并通过 Express 提供后端 API。

## 安装依赖

```bash
cd mysql-cli
npm install
```

## 开发模式

开发时可同时启动前端和后端：

```bash
npm run dev
```

默认前端开发服务器监听 `http://localhost:5173`，并通过代理将 `/api` 请求转发到后端服务。

## 构建与运行

构建生产前端资源：

```bash
npm run build
```

构建完成后启动后端服务：

```bash
npm start
```

默认服务监听 `http://localhost:3000`。

如果端口已被占用，可通过环境变量启动：

```bash
PORT=3001 npm start
```

## 后台守护进程运行

```bash
npm run start:daemon
```

## 停止服务

```bash
npm run stop
```

## 日志查看

```bash
tail -f server.log
```

## API 验证

示例连接测试：

```bash
curl -X POST http://localhost:3000/api/connect \
  -H "Content-Type: application/json" \
  -d '{"host":"localhost","user":"root","password":"pwd","database":"test"}'
```

获取数据库表显示：

```bash
curl http://localhost:3000/api/tables?database=test
```
