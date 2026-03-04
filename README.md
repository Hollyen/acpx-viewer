# acpx Session Viewer

一个用于查看本地 [acpx](https://github.com/openclaw/acpx) 所有 Session 信息的 Web UI 工具。

## 效果预览

- 左侧边栏列出所有 Session，显示状态（活跃/非活跃）和最后使用时间
- 右侧四个标签页：**Info**（元数据）、**Messages**（对话历史）、**Events**（事件流）、**Raw JSON**

## 前置条件

- 已安装并使用过 [acpx](https://github.com/openclaw/acpx)，本地存在 `~/.acpx/sessions/` 目录
- Node.js（无需安装任何额外依赖）

## 启动

```bash
cd acpx-viewer
node server.js
```

默认监听 `http://localhost:7749`，可通过环境变量修改端口：

```bash
PORT=8080 node server.js
```

## API

服务器同时提供 REST API，可直接访问：

| 路径 | 说明 |
|------|------|
| `GET /api/sessions` | 列出所有 Session（按更新时间倒序） |
| `GET /api/sessions/:id` | 获取单个 Session 详情 |
| `GET /api/sessions/:id/events` | 获取 Session 的 ndjson 事件流 |
| `GET /api/queues` | 队列锁文件信息 |
| `GET /api/config` | acpx 全局配置（`~/.acpx/config.json`） |

## 数据来源

读取 `~/.acpx/` 下的以下文件：

```
~/.acpx/
├── config.json                          # 全局配置
├── sessions/
│   ├── <sessionId>.json                 # Session 元数据
│   └── <sessionId>.stream.ndjson       # JSON-RPC 事件流
└── queues/
    └── <sessionId>.lock                 # 进程锁信息
```
