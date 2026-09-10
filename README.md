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

演示账号（由 `db:seed` 创建）：

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `muzzle` | `Blog@2024` | 管理员 |
| `reader` | `Reader@2024` | 普通用户 |

> 默认密码仅供本地演示，部署前请覆盖：
> `SEED_ADMIN_PASSWORD=... SEED_READER_PASSWORD=... pnpm db:seed`

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
├── (site)/                  # 带站点头尾的公开页面
│   ├── page.tsx             #   首页（列表 + 分页 + 标签侧栏）
│   ├── posts/[slug]/        #   文章详情 + 评论区
│   ├── tags/                #   标签总览与标签详情
│   ├── archive/             #   按月归档
│   ├── search/              #   全文搜索（URL 驱动）
│   ├── users/[username]/    #   公开个人主页
│   ├── about/               #   关于（含 API 一览）
│   └── settings/            #   账号设置（layout 鉴权）
├── (auth)/                  # 登录 / 注册
├── admin/                   # 文章管理（layout 鉴权）
├── write/                   # Markdown 编辑器（layout 鉴权）
├── api/                     # REST API（见下）
├── sitemap.ts               # 动态站点地图（含文章与标签）
└── robots.txt               # 位于 public/，屏蔽写作区与管理区
components/                  # UI 组件（ui/ 为通用套件）
lib/                         # 类型、校验、错误、鉴权、Markdown、API 客户端
server/                      # 业务服务层（post / tag / comment / user）
prisma/                      # schema、迁移、种子数据
scripts/                     # 建库、端到端测试、设计验收、截图
```

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
| `DELETE` | `/api/auth/session` | 退出登录 | — |
| `GET` | `/api/users/me` | 当前用户 | 需登录 |
| `PATCH` | `/api/users/me` | 更新昵称 / 邮箱 / 简介 | 需登录 |
| `PATCH` | `/api/users/me/password` | 修改密码（成功后失效会话） | 需登录 |
| `GET` | `/api/users/:username` | 公开资料 | — |
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

| 场景 | 状态码 |
| --- | --- |
| 查询成功 / 更新成功 | 200 |
| 创建成功 | 201 |
| 删除成功、退出登录 | 204 |
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

### 通过 SSH 隧道访问内网数据库

```bash
ssh -N -L 33306:127.0.0.1:3306 <user>@<db-host> -p <ssh-port>
# 随后把 DATABASE_URL 指向 127.0.0.1:33306
```

---

## 验收

项目自带四个可重复执行的验收脚本。**启动服务后**运行：

```bash
pnpm test:case      # 大小写一致性检查（无需服务）
pnpm test:api       # 41 项 API 契约与权限断言（curl）
pnpm test:design    # 72 项设计系统与交互断言（无头浏览器）
pnpm test           # 三者连跑
pnpm shots          # 逐页截图到 .screenshots/，供人工核对视觉
```

`test:case` 覆盖：校验每条 `@/` 与相对路径 import 的每一段大小写是否与磁盘一致。
**macOS/Windows 的文件系统不区分大小写**，`import '@/components/Header'`
指向磁盘上的 `header.tsx` 在本地完全正常，但部署到 Linux（CI、Docker）
会直接 `Module not found`。这个检查抓的正是这一类只在部署时才暴露的问题。

`test:api` 覆盖：状态码、响应结构、字段级校验、软删除可见性、
越权拦截（非作者改/删、游客读草稿）、游标分页、会话失效。

`test:design` 覆盖：无装饰性阴影、容器圆角 ≤ 12px、色板收敛、
深色模式对比度 ≥ 7:1、320–1440px 无横向溢出、单一 h1、
控件可读名称、Tab 焦点可见、搜索防抖、表单校验错误展示。

> 当前状态：`test:case` 206 条 import 全通过、`test:api` 41/41、
> `test:design` 72/72（dev 与 production 构建均已验证）。

`test:api` 会在数据库中创建 `e2e_author_*` / `e2e_reader_*` 测试账号与临时文章
（文章在用例末尾删除，账号与软删除记录保留）。若要彻底清理：

```bash
pnpm db:seed   # 清空并重写演示数据（会删掉全部用户、文章、评论）
```

> ⚠️ `next build` 与 `next dev` 共用 `.next/` 目录，**不要同时运行**，
> 否则 dev server 会出现 `Cannot find module './NNN.js'`。
> 遇到该报错时删除 `.next/` 后重启即可。

---

## 安全

- **XSS**：Markdown 渲染经由 `marked` → `DOMPurify` 白名单清洗，
  `<script>` / `onerror` / `javascript:` / `<iframe>` / `<style>` 全部被剥离，
  正常排版（标题、加粗、代码块）保留。
- **密码**：`scrypt` 加盐哈希，校验使用 `timingSafeEqual` 防时序侧信道。
- **会话**：httpOnly + SameSite=Lax；生产环境设置 `COOKIE_SECURE=true`；
  修改密码后当前会话立即失效。
- **账号枚举**：登录失败时「账号不存在」与「密码错误」返回同一提示。
- **越权**：所有写操作在服务层校验资源归属，不依赖前端隐藏入口。
- **受保护路由**：`middleware.ts` 在 Edge 做廉价前置拦截（返回 307），
  layout 再做真实会话校验。

---

## 设计系统

刻意去掉阴影与装饰性元素，层级只靠三样东西建立：

1. **留白** —— 列表项 `py-6`，区块之间 40–64px
2. **字重与字号** —— 正文 15px/400、小标题 18px/600、元信息 12px/400
3. **1px 边框** —— 容器用 `border border-ink-200` 代替阴影，圆角统一 6–8px

色板为 11 级中性色（`ink`）+ 单一强调蓝（`accent`）+ 语义色（成功/警告/危险）。
深色模式背景用 `#111214` 而非纯黑，正文对比度 16.28:1。

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
2. 生产环境（HTTPS）务必设置 `COOKIE_SECURE=true`，否则 Cookie 会随明文请求发送。
3. 设置 `NEXT_PUBLIC_SITE_URL` 为真实域名，否则站点地图与 OG 元数据会指向 localhost。
4. 迁移用 `prisma migrate deploy`（而非 `migrate dev`），种子数据按需执行。
5. `pnpm build` 与 `pnpm dev` 不要同时运行，两者共用 `.next/` 目录。
