# 服务端迁移到 Go

目标：把数据访问、鉴权、业务规则和 REST API 从 Next.js 进程里拆到 Go。
页面、Markdown 编辑器和现有视觉仍然留在 Next.js。MySQL schema 与 Prisma 迁移不改，
两边读写同一套表。

## 为什么这样切

现在没有独立后端。`app/api/*` 和大约 15 个服务端组件都直接调用 `server/*` 与 Prisma。
一次性把 HTML 也换成 Go 模板，等于把编辑器、评论和主题一起重写。先替换 API 与数据层，
页面改成向 Go 取数，风险和回滚都更小。

## 契约（必须保持不变）

- 成功：`{ "data": ... }`，创建为 201，其余成功为 200，都带响应体。
- 失败：`{ "error": { "code", "message", "details?" } }`。
  错误码仍是 `BAD_REQUEST` `VALIDATION_FAILED` `UNAUTHORIZED` `FORBIDDEN`
  `NOT_FOUND` `CONFLICT` `TOO_MANY_REQUESTS` `INTERNAL_ERROR`。
- 会话 Cookie 名、httpOnly、SameSite=Lax、Path=/、绝对 14 天 + 空闲 7 天。
  库里只存令牌的 SHA-256。生产环境未设置 `COOKIE_SECURE=true` 时拒绝下发 Cookie。
- 口令信封仍是 `rsa-oaep-sha256:<keyId>:<base64>`，算法 RSA-OAEP / SHA-256。
- 密码哈希仍是 `scrypt$N$r$p$salt$hash`，当前参数 N=2^17, r=8, p=1，兼容旧的 N=2^14。
- 文章可见性、两级评论、软删除、标签随文章 upsert，规则与 `server/*.ts` 一致。

Go 进程默认听 `API_PORT`（3001），读同一份 `DATABASE_URL`。
不设置时 Next.js 继续使用自己的 `app/api`，现有站点行为不变。

## 阶段

1. **Go API（本次）**
   14 组现有路由、服务层、会话、口令加密、进程内限流、Markdown 渲染。
   验收：`go test ./...`，以及手动对登录 / 文章 / 评论打同一套 JSON。
2. **浏览器 API 切到 Go**
   `app/api` 与 Go 路由冲突，Next 的 rewrite 不会盖过已有文件路由。
   切换时在 middleware 里把 `/api/*` 反代到 Go，或删掉 `app/api` 后用 rewrite。
   客户端 `lib/api-client.ts` 不用改。
3. **服务端组件改取数**
   首页、文章、搜索、时间线、主题、关于、写作页、管理页现在直接 `import` 服务层。
   改成请求 Go（服务端 fetch，带上 Cookie）。完成后 Next 进程不再连接 MySQL。
4. **对齐与收尾**
   Markdown 清洗要逐条对上 `lib/sanitize-config.ts`（`data:` 白名单、高亮 class）。
   当前 Go 用 goldmark + bluemonday，安全方向更严，HTML 与 marked/highlight.js 不保证字节级一致。
   然后把 `scripts/e2e.sh` 和 `scripts/security-check.sh` 指到 Go 进程。

## 明确不做

- 不用 Go 重写页面。
- 不改表结构，不引入 Redis。限流仍是进程内滑动窗口，多实例额度放大的问题保持原样。
- 不在本次打开切换开关，避免 Go 没启动时把现有 API 打挂。
