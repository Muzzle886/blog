# Muzzle's Blog

一个界面极简、接口遵循 RESTful 规范的博客系统。基于 Next.js 14 App Router、
Prisma 与 MySQL 构建，**未引入任何 UI 组件库**——所有组件都是 Tailwind 手写的。

```
首页 · 文章详情 · 标签 · 归档 · 全文搜索 · 评论（两级） · Markdown 编辑器
注册 / 登录（httpOnly 会话） · 文章管理 · 账号设置 · 浅色 / 深色主题
```

---

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env      # 按需修改 DATABASE_URL

# 3. 创建数据库（若已存在可跳过）
pnpm db:init

# 4. 建表 + 写入演示数据
pnpm db:migrate
pnpm db:seed

# 5. 启动
pnpm dev                  # http://localhost:3000
```

`db:seed` 会创建两个演示账号（一个管理员、一个普通用户）并打印它们的用户名与口令。
口令可用环境变量覆盖，部署前务必覆盖：

```bash
SEED_ADMIN_PASSWORD='...' SEED_READER_PASSWORD='...' pnpm db:seed
```

> 种子口令不出现在本文件里（避免把它提交进公开仓库）。
> 忘记时重跑一次 `pnpm db:seed` 即可看到，或直接设置上面的变量。

> 全新数据库上，**第一个注册的用户会自动成为管理员**，方便自建博客初始化。

---

## 技术选型

| 层面 | 选择 | 说明 |
| --- | --- | --- |
| 框架 | Next.js 14.2.35 (App Router) | 服务端组件渲染页面，路由处理器提供 API |
| 数据库 | MySQL 8 + Prisma 5 | 迁移文件随代码入库，类型安全的数据访问 |
| 样式 | Tailwind CSS 3 | 手写设计系统，无组件库依赖 |
| 富文本 | marked + highlight.js + DOMPurify | 服务端渲染 + 白名单清洗 |
| 校验 | zod | 一份 schema 同时用于 API 校验与错误明细 |
| 密码哈希 | Node `crypto.scrypt` | 内置实现，无需编译原生模块 |
| 会话 | MySQL 会话表 + httpOnly Cookie | 可服务端撤销，无需管理密钥 |

首屏共享 JS 约 **87 kB**（旧版 antd 方案约 700 kB）。

---

## 目录结构

```
app/
├── (site)/                  # 公开页面（共用报头与页脚）
│   ├── page.tsx             #   首页：特写 + 近期文章
│   ├── writing/             #   文章总览（可按主题筛选、分页）
│   ├── posts/[slug]/        #   文章详情（左 meta 栏 + 阅读列）
│   ├── topics/              #   主题总览与主题详情
│   ├── timeline/            #   时间线（按年/月）
│   ├── search/              #   全文搜索（URL 驱动）
│   ├── users/[username]/    #   作者主页
│   ├── about/               #   关于
│   └── settings/            #   账号设置（layout 鉴权）
├── (auth)/                  # 登录 / 注册
├── admin/                   # 我的文章（layout 鉴权）
├── write/                   # Markdown 编辑器（layout 鉴权）
├── api/                     # REST API（见下）
├── sitemap.ts               # 动态站点地图
└── robots.txt               # 位于 public/，屏蔽写作区与管理区
components/                  # UI 组件（ui/ 为通用控件）
lib/                         # 类型、校验、错误、鉴权、Markdown、API 客户端
server/                      # 业务服务层（post / tag / comment / user）
prisma/                      # schema、迁移、种子数据
scripts/                     # 建库、端到端测试、设计验收、截图
```

**信息架构**：`/` 首页特写 → `/writing` 全部文章 → `/posts/:slug` 正文；
`/topics` 与 `/timeline` 是两种不同的浏览方式（按主题 / 按时间）。
文章详情页采用非对称两栏：左栏常驻 meta（日期/作者/时长/主题），右栏是阅读列。

**分层约定**：`route → validation → service → prisma`。
路由处理器只做「校验 + 调用服务 + 序列化」，业务规则全部在 `server/` 中，
服务层失败时抛 `AppError`，由 `lib/http.ts` 统一转换为 HTTP 响应。

---

## API 设计

### 响应格式

成功：

```json
{ "data": { ... }, "meta": { "pagination": { "page": 1, "pageSize": 10, "total": 8, "totalPages": 1 } } }
```

失败（业务错误码与 HTTP 状态码解耦，前端可按 `code` 精确分支）：

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "参数校验失败",
    "details": [{ "path": "email", "message": "邮箱格式不正确" }]
  }
}
```

错误码：`BAD_REQUEST` `VALIDATION_FAILED` `UNAUTHORIZED` `FORBIDDEN`
`NOT_FOUND` `CONFLICT` `TOO_MANY_REQUESTS` `INTERNAL_ERROR`

### 端点一览

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | 注册并登录 | — |
| `POST` | `/api/auth/login` | 登录（用户名或邮箱） | — |
| `GET` | `/api/auth/public-key` | 取口令加密公钥（含 keyId） | — |
| `DELETE` | `/api/auth/session` | 退出登录 | — |
| `GET` | `/api/users/me` | 当前用户 | 需登录 |
| `PATCH` | `/api/users/me` | 更新昵称 / 邮箱 / 简介 | 需登录 |
| `PATCH` | `/api/users/me/password` | 修改密码（撤销该用户**全部**会话） | 需登录 |
| `GET` | `/api/users/me/sessions` | 列出有效登录会话（返回摘要，非令牌） | 需登录 |
| `DELETE` | `/api/users/me/sessions` | 退出其它所有设备（保留当前会话） | 需登录 |
| `GET` | `/api/users/:username` | 公开资料（不含 email / role） | — |
| `GET` | `/api/posts` | 文章列表 | — |
| `POST` | `/api/posts` | 新建文章 | 需登录 |
| `GET` | `/api/posts/:slug` | 文章详情 | — |
| `PATCH` | `/api/posts/:slug` | 局部更新 | 作者/管理员 |
| `PUT` | `/api/posts/:slug` | 全量更新 | 作者/管理员 |
| `DELETE` | `/api/posts/:slug` | 软删除 | 作者/管理员 |
| `GET` | `/api/posts/:slug/comments` | 评论列表 | — |
| `POST` | `/api/posts/:slug/comments` | 发表评论 / 回复 | 需登录 |
| `DELETE` | `/api/comments/:id` | 删除评论 | 评论者/文章作者/管理员 |
| `GET` | `/api/tags` | 标签列表（含文章数） | — |
| `GET` | `/api/stats` | 站点统计 | — |

### 列表查询参数

`GET /api/posts?page=1&pageSize=10&q=关键词&tag=<slug>&author=<username>&status=PUBLISHED&sort=latest`

| 参数 | 取值 | 默认 |
| --- | --- | --- |
| `page` / `pageSize` | 1–10000 / 1–50 | 1 / 10 |
| `q` | 标题、摘要、正文模糊匹配 | — |
| `tag` | 标签 slug | — |
| `author` | 用户名或昵称 | — |
| `status` | `PUBLISHED` \| `DRAFT` \| `ALL` | `PUBLISHED` |
| `sort` | `latest` \| `oldest` \| `popular` | `latest` |

### 两种分页策略

| 资源 | 方案 | 理由 |
| --- | --- | --- |
| `/api/posts` | 页码分页，返回 `meta.pagination` | 顺序稳定，需要跳页与总数 |
| `/api/posts/:slug/comments` | 游标分页，返回 `meta.cursor` | 实时新增，避免翻页时数据漂移 |

### 可见性规则

统一收敛在 `server/post-service.ts` 的 `visibilityWhere()`：

- 游客：仅 `PUBLISHED` 且未软删除
- 登录用户：`PUBLISHED` ∪ 自己的文章（含草稿）
- 管理员：全部未删除

### 状态码约定

> **约定：成功的写操作一律返回响应体**（删除返回 `{ deleted: true }`、
> 登出返回 `{ loggedOut: true }`）。不使用 204 空响应 —— 调用方需要明确的
> 确认信号，而不是只能靠状态码猜结果。

| 场景 | 状态码 |
| --- | --- |
| 查询 / 更新 / 删除 / 退出成功 | 200 |
| 创建成功 | 201 |
| 参数格式非法、非法 JSON | 400 / 422 |
| 未登录 | 401 |
| 已登录但无权操作 | 403 |
| 资源不存在，或存在但不可见 | 404 |
| 唯一约束冲突（用户名 / 邮箱 / 标签） | 409 |
| 未预期异常 | 500 |

---

## 数据模型

```
User ──┬── Post ──┬── PostTag ── Tag
       │          └── Comment ──┐
       ├── Comment ─────────────┘（自关联 parentId，两级回复）
       └── Session
```

- **软删除**：`User` / `Post` / `Comment` 用 `deletedAt DateTime?`，
  既表达「已删除」又保留删除时间，便于审计与恢复。
- **文章 URL**：对外用 `slug`（时间戳 base36 + 随机后缀），不暴露自增 id。
- **删除顶层评论**时，其回复一并软删除，避免出现「回复了不存在的评论」。

---

## 数据库

### 连接串注意事项

密码中的特殊字符必须做百分号编码，否则连接串会被解析错误：

| 字符 | 编码 |
| --- | --- |
| `/` | `%2F` |
| `@` | `%40` |
| `:` | `%3A` |
| `#` | `%23` |

```bash
# 密码为 mySecret/Path1 时：
DATABASE_URL="mysql://user:mySecret%2FPath1@127.0.0.1:3306/blog"
```

> 这个坑踩过一次：`new URL('mysql://user:mySecret/Path1@host:3306/db')` 会抛
> `Invalid URL`，因为路径分隔符 `/` 出现在密码中且未转义。

### 常用命令

```bash
pnpm db:init       # 创建数据库（utf8mb4 / utf8mb4_unicode_ci）
pnpm db:migrate    # 生成并应用迁移
pnpm db:seed       # 写入演示数据（幂等，会清空现有数据）
pnpm db:studio     # 打开 Prisma Studio
pnpm db:reset      # 重置数据库并重跑迁移与种子
```

### 远程数据库

`DATABASE_URL` 直接指向远程实例即可，无需隧道：

```bash
DATABASE_URL="mysql://user:pass@db-host:3306/blog"
```

只需注意密码的百分号转义（见上一节）。若数据库仅对内网开放，
可在内网机器上执行迁移与播种，应用进程本身不做特殊处理。

---

## 验收

项目自带五个可重复执行的验收脚本。**启动服务后**运行：

```bash
pnpm test:case      # 大小写一致性检查（无需服务）
pnpm test:api       # 41 项 API 契约与权限断言（curl）
pnpm test:design    # 99 项设计系统与交互断言（无头浏览器）
pnpm test:security  # 55 项安全断言（会话、限流、清洗、响应头、数据暴露）
pnpm test           # 四个套件连跑（case → security → api → design）
pnpm shots          # 逐页截图到 .screenshots/，供人工核对视觉
```

`test:case` 覆盖：校验每条 `@/` 与相对路径 import 的每一段大小写是否与磁盘一致。
**macOS/Windows 的文件系统不区分大小写**，`import '@/components/Header'`
指向磁盘上的 `header.tsx` 在本地完全正常，但部署到 Linux（CI、Docker）
会直接 `Module not found`。这个检查抓的正是这一类只在部署时才暴露的问题。

`test:api` 覆盖：状态码、响应结构、字段级校验、软删除可见性、
越权拦截（非作者改/删、游客读草稿）、游标分页、会话失效。
脚本启动前会先探测数据库连通性 —— 数据库不可达时会有大量 500，
与代码缺陷极易混淆，预检能直接把它区分出来。

`test:design` 覆盖：**编辑风格专项**（标题必须是衬线体、底色必须是暖白、
圆角上限、无装饰性阴影）、色板收敛、深色模式对比度 ≥ 7:1、
320–1440px 无横向溢出、单一 h1、控件可读名称、Tab 焦点可见、
搜索防抖、表单校验错误展示。

`test:security` 覆盖：会话令牌明文不入库（直接查库核对摘要）、
改密码撤销全部会话、退出其它设备、伪造/畸形令牌、账号枚举提示一致性、
4 项安全响应头、口令传输加密（含明文被拒）、公开接口不泄露 `email`/`role`/`passwordHash`、
Markdown 清洗（含 `data:` URI 白名单）、速率限制生效且不可绕过、
畸形与边界输入不产生 5xx。

> 当前状态：`test:case` 206 条 import 全通过、`test:api` 41/41、
> `test:design` 99/99、`test:security` 65/65。

`test:api` 会在数据库中创建 `e2e_author_*` / `e2e_reader_*` 测试账号与临时文章
（文章在用例末尾删除，账号与软删除记录保留）。若要彻底清理：

```bash
pnpm db:seed   # 清空并重写演示数据
```

`db:seed` 会删除全部用户、文章、评论与会话，因此带了两道护栏：
`NODE_ENV=production` 下直接拒绝（需显式 `ALLOW_PROD_SEED=true`），
其它环境需要 `--yes`（`pnpm db:seed` 已内置）或交互式确认。
未设置 `SEED_ADMIN_PASSWORD` 时会打印警告说明用的是公开默认口令。

> ⚠️ `next build` 与 `next dev` 共用 `.next/` 目录，**不要同时运行**，
> 否则 dev server 会出现 `Cannot find module './NNN.js'`。
> 遇到该报错时删除 `.next/` 后重启即可。

---

## 安全

### 认证与会话

- **不使用 JWT**，采用服务端会话表 + httpOnly Cookie。理由是可服务端撤销：
  改密码、退出其它设备都能立即生效，且无需管理签名密钥。
- **会话令牌不明文入库**：Cookie 里是 256 位 CSPRNG 随机令牌（64 位十六进制），
  数据库只存它的 **SHA-256 摘要**。库被读走时拿到的是无法直接用于认证的摘要。
  这里用无盐 SHA-256 而非 scrypt —— 令牌本身已是 2^256 的均匀随机数，
  不存在弱口令可爆破，而会话查找必须能走索引。
  > 本次加固的副作用：查找方式从「按明文令牌查」改为「按摘要查」，
  > 因此**升级后所有既有会话一次性失效**，用户需要重新登录一次。
- **双重过期**：`expiresAt` 绝对超时（14 天）+ `lastUsedAt` 空闲超时（7 天）。
  过期会话在登录时机会性清理（服务进程内 10 分钟最多一次）。
- **撤销语义**：修改密码会撤销该用户的**全部**会话，而不只是当前这一个 ——
  否则账号被盗后受害者改密码并不能把攻击者踢下线。
  另有 `DELETE /api/users/me/sessions` 用于「退出其它设备」，
  `GET /api/users/me/sessions` 列出有效登录会话（返回的是摘要，不是令牌）。
- **Cookie 属性**：httpOnly + SameSite=Lax + Path=/；
  **生产环境未设置 `COOKIE_SECURE=true` 会直接启动失败**，而不是静默降级 ——
  14 天有效期的令牌经明文 HTTP 泄露等同于账号被接管，这种配置错误应该在部署时暴露。

### 密码

- `scrypt` 加盐哈希，参数 **N=2^17, r=8, p=1**（依据 OWASP Password Storage
  Cheat Sheet；内存约 134MB、单次约 240ms）。存储格式自描述参数：
  `scrypt$N$r$p$salt$hash`，旧格式在登录成功时静默升级，无需强制改密。
- 校验使用 `timingSafeEqual`（先校验长度，否则它会抛异常反而泄露长度）。
- 账号不存在时也会跑一次等价开销的哈希，抹平「存在则慢、不存在则快」的时间差。
- 登录/改密接口对密码长度设上限（128）—— 不限长时 scrypt 会成为
  CPU/内存放大器。
- 数据库中不存在任何明文口令（`test:security` 直接查库核对）。

### 速率限制

`lib/rate-limit.ts` 进程内滑动窗口，按维度区分：登录按账号（10 次/15 分钟）
与来源 IP（30 次/15 分钟）、注册按 IP（10 次/小时）、评论与发文按用户。
限流生效后**正确密码同样会被挡**，避免限流形同虚设。

> 局限：多实例部署时每个实例各算一份，实际额度是「单实例额度 × 实例数」。
> 需要严格限流时应换成 Redis 或网关层限流。

### 输入与输出

- **XSS**：Markdown 经 `marked` → `DOMPurify` 白名单清洗，
  `<script>` / `onerror` / `javascript:` / `<iframe>` / `<style>` 全部剥离，
  正常排版保留。清洗配置在 `lib/sanitize-config.ts` 单点定义，
  服务端渲染与编辑器预览共用，避免两处漂移。
  `data:` URI 只放行常见位图格式，`data:text/html` 与 `data:image/svg+xml` 会被移除。
- **SQL 注入**：全仓库无 `$queryRaw*` / `$executeRaw*`，所有访问都走 Prisma 查询构造器。
- **开放重定向**：登录后的 `?redirect=` 只接受站内相对路径
  （`lib/safe-redirect.ts`），`//host`、`/\host`、反斜杠与控制字符一律回退到 `/`。
- **字段级数据暴露**：公开接口（`GET /api/users/:username`）返回
  `toPublicProfile`，不含 `email` 与 `role`；需要邮箱的场景都是
  「返回调用者自己的数据」。`passwordHash` 从不出现在任何 DTO 中。
- **页面参数归一化**：Next 对重复 query 参数传数组、`Number('1e999')` 为
  `Infinity`，都会让页面直接 500。统一经 `lib/search-params.ts` 收口。

### 口令传输加密

登录、注册、改密的口令都在浏览器内用 **RSA-OAEP / SHA-256** 加密后再提交，
请求体里不含明文：

```
GET  /api/auth/public-key     # 取公钥（含 keyId）
POST /api/auth/login          # { password: "rsa-oaep-sha256:<keyId>:<base64>" }
```

- 私钥只存在于服务端内存，12 小时轮换一次；轮换后保留上一把私钥，
  避免缓存了旧公钥的页面立刻失效
- 密钥对挂在 `globalThis` 上 —— 否则 dev 模式 HMR 重载模块时会重新生成密钥，
  导致「取公钥」与「提交表单」之间只要发生一次重编译就失败
- **服务端强制**：明文口令直接拒绝（外壳不合规 422、密钥未知 400），
  不依赖前端自觉
- OAEP 每次填充随机，同一口令两次加密得到不同密文

> 边界要说清楚：它只能防「明文传输」，**不能替代 HTTPS** ——
> 中间人若替换公钥仍可解密；也不能防同页面内注入的脚本。
> 真正的传输安全仍然依赖 TLS。

### 传输与响应

- `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、
  `Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`，
  HTTPS 下自动附加 HSTS。
- **未下发 CSP**。曾实现过 nonce + `strict-dynamic` 方案，但副作用较大
  （dev 下 Next 不把 nonce 注入客户端 bundle，导致每个脚本都报属性不匹配；
  主题脚本要为它专门串 nonce；验收脚本还需按环境区分断言）。
  当前阶段收益用不上，故移除；需要时可从 git 历史取回。
- API 响应统一 `Cache-Control: no-store` + `Vary: Cookie`，
  避免共享缓存把 A 的登录态响应发给 B。

---

## 设计系统

**编辑／杂志风格（typography-first）**。与常见的「卡片 + 边框 + 阴影」式后台风格相反，
这里刻意不使用容器，层级完全由排版建立。

### 三条硬规则

1. **没有卡片**。内容不装进盒子，分组只靠一条 1px 细线（`.rule`）与留白。
   因此色板里没有阴影相关令牌，圆角只有 2–3px 一档。
2. **衬线标题 + 无衬线正文**。标题走宋体系（`Songti SC` / `Source Han Serif`），
   形成阅读型排版的骨架；正文与界面文案走无衬线，保证屏幕可读性。
3. **暖色调**。纸白底 `#faf8f5` + 暖墨字 `#191614` + 单一赭石强调色 `#b0512a`。
   避免纯白/纯黑（长时间阅读对比过强）与通用科技蓝。

### 排版与网格

| 用途 | 取值 |
| --- | --- |
| 正文 | 17px / 行高 1.75，阅读列最宽 38rem（中文约 38–42 字） |
| 页面标题 | 28–56px 衬线体，字距 −0.015em |
| 栏目名 | 11px 全大写、加宽字距，左侧带一小段赭石竖线 |
| 元信息 | 12px 弱化色 |
| 版面 | 12 栏非对称网格；内容列从第 5 栏起，左侧 3 栏放栏目名或 meta |

文章详情页是这套网格的典型应用：左栏常驻日期／作者／时长／主题，右栏是阅读列，
标题因此可以从元信息里「解放」出来，做得更大更干净。

### 交互

只改文字颜色与下划线，不用背景块或阴影；操作项（编辑/删除/回复）默认透明，
hover 或键盘聚焦才出现。主按钮是页面上唯一「重」的元素（实心墨色）。

深色模式为暖调深色（`#141210`），不是简单反色，也不是纯黑。

### 断言

`pnpm test:design` 会把上面这些规则当作断言执行：无装饰性阴影、圆角上限、
色板收敛（实测全站只有 `rgb(176, 81, 42)` 一个高饱和色）、标题必须是衬线体、
底色必须是暖白、320–1440px 无横向溢出、深色模式对比度 ≥ 7:1 等。

---

## 已知取舍

- **不含富文本编辑器**：Markdown + 实时预览，体积小且产出可控。
- **评论只支持两级**：回复「回复」时自动提升到同一顶层评论下，移动端可读性更好。
- **阅读量不做防刷**：直接 `views + 1`，且失败不影响正文展示。
- **Redis 未启用**：`.env` 中保留了 `REDIS_URL` 以备缓存 / 限流，当前版本未使用。
- **搜索用 `LIKE`**：数据量小时足够；如需分词与相关度排序，
  可替换为 MySQL FULLTEXT 或外部搜索引擎。
- **站点地图每次请求实时查询**：文章量大时应改为定时生成或加缓存。
- **无图片上传**：Markdown 中的图片需填写外链地址，未接入对象存储。
- **Next.js 固定在 14.2.x**：14.2.7 存在中间件授权绕过
  （[CVE-2025-29927](https://dependabot.ecosyste.ms/advisories/CVE-2025-29927)，
  通过 `x-middleware-subrequest` 头跳过中间件），已升级到 **14.2.35**。
  本项目即使被绕过也不泄露数据——中间件只做「有无 Cookie」的廉价前置拦截，
  真实鉴权在 layout 与 API 路由中——但仍应保持该版本以上。
  仓库另有若干来自开发工具链（eslint / jsdom）的传递依赖告警，
  不影响生产运行时，未逐个升级以避免引入不必要的变更。

---

## 部署注意

1. `.env` 不入库（已 gitignore），部署时单独注入；模板见 `.env.example`。
2. 生产环境（HTTPS）**必须**设置 `COOKIE_SECURE=true`。
   未设置时会 **fail-closed**：登录与登出直接返回 500，并在服务端日志打印
   「生产环境必须设置 COOKIE_SECURE=true…」。这是有意的 —— 宁可不发 Cookie，
   也不用一个会在明文 HTTP 上泄露的 Cookie。
   注意 `NODE_ENV=production` 下即使只是本机 `pnpm start` 跑在 http:// 上，
   也会命中这条断言；那种场景请用 `pnpm dev`，或显式接受风险后再设置。
3. 设置 `NEXT_PUBLIC_SITE_URL` 为真实域名，否则站点地图与 OG 元数据会指向 localhost。
4. 迁移用 `prisma migrate deploy`（而非 `migrate dev`），种子数据按需执行。
   `db:seed` 会清空全部数据，生产环境默认拒绝执行（需 `ALLOW_PROD_SEED=true`）。
5. `pnpm build` 与 `pnpm dev` 不要同时运行，两者共用 `.next/` 目录。
6. 速率限制是**进程内**的：多实例部署时每个实例各算一份额度。
   需要严格限流时应改用 Redis 或网关层限流。
7. 反向代理后部署时，请确保 `x-forwarded-for` 由代理注入并剥离客户端自带值，
   否则限流维度与「登录设备」里的 IP 都可被伪造。
