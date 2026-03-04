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

---

## 优化 Roadmap

> 以下为基于当前项目现状提出的系统性优化建议，按阶段划分，各项标注优先级（🔴 高 / 🟡 中 / 🟢 低）。

---

### Phase 1 — 基础加固（1~2 周）

**目标：** 在不改变技术栈的前提下，修复潜在问题，提升稳定性与安全性。

#### 1.1 安全加固 🔴

- **路径穿越防护**：`server.js` 中静态文件服务直接使用请求路径拼接文件系统路径，未做规范化校验，存在路径穿越风险。需在 `serveFile` 中用 `path.resolve` + `startsWith` 验证最终路径在 `public/` 目录内。
  ```js
  // 建议修复方式
  const safePath = path.resolve(staticDir, pathname.slice(1));
  if (!safePath.startsWith(staticDir)) { res.writeHead(403); return; }
  ```
- **Session ID 注入**：`getSessionEvents` 接受 `sessionId` 后直接用于 `startsWith` 匹配文件名，需白名单校验格式（如仅允许 `[a-zA-Z0-9_-]`）。
- **信息泄露**：`/api/config` 直接暴露 `~/.acpx/config.json` 全量内容，应考虑过滤敏感字段或提供配置项选择性暴露。

#### 1.2 错误处理标准化 🔴

- 统一 API 错误响应格式：`{ "error": "...", "code": "..." }`。
- 服务器启动时检查 `~/.acpx/sessions/` 是否存在，若不存在则打印友好提示而非静默返回空数组。
- 捕获未处理异常（`process.on('uncaughtException', ...)` 和 `'unhandledRejection'`），防止进程意外退出。

#### 1.3 代码质量改进 🟡

- 将 `server.js` 中路由分发逻辑拆分为独立函数/模块，减少单文件行数膨胀风险。
- `readJson` / `readNdjson` 中 `catch` 静默吞掉错误，建议至少在 debug 模式下 `console.error` 输出，便于排查数据问题。
- `app.js` 中 `renderMessages` 的 HTML 拼接可抽象为模板函数，降低 XSS 误操作风险（当前已有 `escape()`，需确认所有插值点均经过转义）。

---

### Phase 2 — 功能增强（2~4 周）

**目标：** 补充核心使用场景所需功能，提升信息密度与可用性。

#### 2.1 会话列表增强 🔴

- **搜索与过滤**：在侧边栏顶部添加搜索框，支持按 Session ID、状态、时间范围过滤。
- **分页 / 虚拟滚动**：Session 数量大时，列表渲染性能下降，建议服务端支持 `?limit=&offset=` 分页参数，前端改为按需加载。
- **状态聚合统计**：侧边栏头部显示活跃/总数统计，如 `3 活跃 / 42 总计`。

#### 2.2 实时更新 🟡

- **轮询自动刷新**：为会话列表添加可配置的自动刷新间隔（默认 30s），无需手动点击刷新按钮。
- **SSE 推送（可选）**：服务端通过 `fs.watch` 监听 `sessions/` 目录变更，通过 Server-Sent Events 推送增量更新，实现真正实时感知新 Session 和状态变化。

#### 2.3 消息与事件视图增强 🟡

- **消息时间轴**：在 Messages 标签页中为每条消息显示时间戳，并以相对时间（"3 分钟前"）呈现。
- **事件类型过滤**：Events 标签页中按事件类型（`method`）分类过滤，方便聚焦特定事件。
- **Token 用量可视化**：若 Session 数据中包含 token 统计，以进度条或图表形式在 Info 标签页展示 prompt/completion token 分布。
- **Raw JSON 语法高亮**：当前 Raw JSON 仅为 `<pre>` 纯文本，可引入轻量 JSON 高亮渲染（如 `highlight.js` 的 JSON 子集，或自行实现简单正则着色）。

#### 2.4 导出与分享 🟢

- **导出会话**：提供将单个 Session 数据（JSON 或 Markdown 对话格式）下载到本地的按钮。
- **复制链接**：URL hash 路由支持（`#session/<id>`），刷新页面或分享 URL 后自动定位到指定 Session。

---

### Phase 3 — 架构演进（1~2 月，视需求决定是否实施）

**目标：** 应对更复杂的使用场景，提升可扩展性和长期维护性。

#### 3.1 技术架构优化 🟡

- **引入构建工具（可选）**：若前端逻辑持续增长（>1000 行），可考虑引入 Vite + 原生 JS 或 Preact，保持轻量的同时获得模块化、热更新和 Tree-shaking 能力。
- **TypeScript 渐进迁移**：为 `server.js` 添加 JSDoc 类型注解（`@param`、`@returns`），或迁移至 TypeScript，提升 IDE 提示和重构安全性。
- **配置文件支持**：支持 `.acpx-viewer.json` 配置文件，允许自定义端口、acpx 目录路径、刷新间隔等，避免用户只能靠环境变量覆盖。

#### 3.2 性能优化 🟡

- **内存缓存**：`getSessions()` 每次请求都全量读取磁盘，会话数量多时延迟明显。可在内存中维护一份 Session 列表缓存，并通过 `fs.watch` 或定时 TTL 失效，减少不必要的 I/O。
- **流式响应大文件**：大型 `.ndjson` 文件（事件流）目前整体读入内存后返回，建议改为 `fs.createReadStream` 流式传输，降低内存峰值。
- **ETag / 304 缓存**：为静态文件响应添加 `ETag` 或 `Last-Modified` 头，利用浏览器缓存减少重复传输。

#### 3.3 用户体验提升 🟡

- **键盘导航**：支持 `↑/↓` 方向键在 Session 列表中切换，`Tab` 在标签页间切换，`/` 聚焦搜索框。
- **响应式布局改进**：当前在窄屏下侧边栏和主内容区可能重叠，需增加移动端断点下的抽屉式侧边栏。
- **主题切换**：提供亮色/暗色主题切换按钮，持久化到 `localStorage`。
- **加载骨架屏**：会话列表和详情区域在加载中时显示骨架屏占位，避免内容跳动。
- **空状态优化**：Session 为空或 acpx 目录不存在时，展示更友好的引导界面（如安装步骤链接）。

---

### Phase 4 — 部署与运维（可选，视使用场景）

**目标：** 支持更多安装和运行方式，降低使用门槛。

#### 4.1 多种安装方式 🟢

- **npx 一键启动**：在 `package.json` 中配置 `bin` 字段，发布到 npm 后支持 `npx acpx-viewer` 零安装启动。
- **Homebrew Tap**：提供 Homebrew formula，`brew install hollyen/tap/acpx-viewer`。
- **Docker 镜像**：提供 `Dockerfile`，挂载 `~/.acpx` 目录，适合在容器环境下运行。

#### 4.2 CI/CD 🟢

- 添加 GitHub Actions workflow，在 PR 时运行基本健康检查（语法检查、`node --check server.js`）。
- 配置自动版本发布到 npm（tag 触发）。

#### 4.3 可观测性 🟢

- 添加简单的访问日志（请求路径、耗时、状态码），输出到 stdout，便于排查问题。
- 提供 `/health` 端点，返回服务状态和 `sessions/` 目录是否可读。

---

### 优先级汇总

| 优先级 | 项目 | 阶段 |
|--------|------|------|
| 🔴 高 | 路径穿越安全修复 | Phase 1 |
| 🔴 高 | Session ID 格式校验 | Phase 1 |
| 🔴 高 | 错误处理标准化 | Phase 1 |
| 🔴 高 | 会话搜索与过滤 | Phase 2 |
| 🟡 中 | 实时轮询刷新 | Phase 2 |
| 🟡 中 | 消息时间轴与事件过滤 | Phase 2 |
| 🟡 中 | 内存缓存减少磁盘 I/O | Phase 3 |
| 🟡 中 | 键盘导航 | Phase 3 |
| 🟡 中 | 响应式布局改进 | Phase 3 |
| 🟡 中 | 配置文件支持 | Phase 3 |
| 🟢 低 | Raw JSON 语法高亮 | Phase 2 |
| 🟢 低 | 导出/分享功能 | Phase 2 |
| 🟢 低 | npx 一键启动 | Phase 4 |
| 🟢 低 | Docker 镜像 | Phase 4 |
| 🟢 低 | CI/CD & 健康检查端点 | Phase 4 |
