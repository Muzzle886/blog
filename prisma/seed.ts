/**
 * 种子数据：创建一个管理员、一个普通用户、若干标签与文章、两级评论。
 *
 *   pnpm db:seed
 *
 * 幂等：使用 upsert / 先清空再写入，可重复执行。
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'

const prisma = new PrismaClient()
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

/**
 * 演示账号密码。默认值仅供本地演示，部署前请用环境变量覆盖：
 *   SEED_ADMIN_PASSWORD=... SEED_READER_PASSWORD=... pnpm db:seed
 */
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Blog@2024'
const READER_PASSWORD = process.env.SEED_READER_PASSWORD || 'Reader@2024'

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

/** 简化的标签 slug（与 lib/slug.ts 保持一致的行为） */
function tagSlug(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '-')
  if (/[\u4e00-\u9fa5]/.test(normalized)) {
    let h = 5381
    for (let i = 0; i < name.length; i += 1) h = (h * 33) ^ name.charCodeAt(i)
    return `${encodeURIComponent(normalized)}-${(h >>> 0).toString(36).slice(0, 6)}`
  }
  return normalized.replace(/[^a-z0-9-]/g, '')
}

function slug(seed: string): string {
  return `${seed}${randomBytes(3).toString('hex')}`
}

const ARTICLES: {
  title: string
  summary: string
  tags: string[]
  daysAgo: number
  views: number
  content: string
}[] = [
  {
    title: '把博客从 Next.js 14 重写一遍：架构与取舍',
    summary:
      '旧项目用了 antd + 手写 SQL 服务层，API 语义混乱。这次重写聚焦三件事：RESTful 的接口契约、可撤销的会话方案、以及不依赖组件库的极简 UI。',
    tags: ['Next.js', '架构设计', 'REST'],
    daysAgo: 1,
    views: 328,
    content: `## 为什么要重写

旧版本能用，但有几处结构性问题：

- 接口语义混乱：\`PUT /api/post\` 用来创建文章，\`POST /api/post/:id\` 用来更新
- 服务层直接吞掉异常，错误信息以中文裸字符串返回，前端无法分流处理
- 没有鉴权，任何请求都能写文章
- 依赖 antd，一个博客为此付出了 500KB+ 的体积

重写的目标很明确：**接口先设计好，再写实现**。

## 接口契约的三个原则

### 1. 资源用名词，行为用 HTTP 方法

\`\`\`text
GET    /api/posts          列表（分页）
POST   /api/posts          创建
GET    /api/posts/:slug    详情
PATCH  /api/posts/:slug    局部更新
DELETE /api/posts/:slug    删除
\`\`\`

不再出现 \`/api/post/list\` 这种把动词塞进路径的写法。

### 2. 响应结构统一

成功返回 \`{ data, meta? }\`，失败返回 \`{ error: { code, message, details? } }\`。
前端只需要写一次解析逻辑：

\`\`\`ts
if (!response.ok) {
  const { error } = await response.json()
  // error.code 是稳定的字符串枚举，可直接做分支
}
\`\`\`

### 3. 错误码与 HTTP 状态码解耦

HTTP 状态码表达「传输层」语义，业务错误码表达「领域」语义。
比如「用户名已占用」是 \`409\` + \`CONFLICT\`，前端可以据此把焦点定位到用户名输入框。

## 会话方案：为什么不用 JWT

JWT 的问题在于不可撤销。用户改密码后，旧 token 在过期前依然有效。

这里改用**服务端会话表**：

| 维度 | JWT | 服务端会话 |
| --- | --- | --- |
| 撤销 | 需黑名单 | 删一行即可 |
| 密钥管理 | 需要 | 不需要 |
| 数据库查询 | 无 | 每次请求 1 次 |
| 列出登录设备 | 做不到 | 天然支持 |

对一个博客来说，每请求一次索引查询完全可以接受。

## UI：不引入组件库

antd 的价值在于复杂交互（表格、穿梭框、级联选择）。博客的交互是输入框、按钮、
分页和弹窗——都是几十行代码能写完的东西。

最终只用 Tailwind 写了一套约 10 个组件，配合 \`darkMode: 'class'\` 实现主题切换，
首屏 JS 体积下降了 60%。

## 小结

重写的收益不在功能变多，而在于**结构变得可预测**：
新加一个功能，只需要照着 \`route -> validation -> service -> prisma\` 的链条往下写。`,
  },
  {
    title: 'Prisma 软删除的正确姿势',
    summary:
      '中间件式软删除会污染所有查询，且容易在关联查询里漏掉。更稳的做法是把可见性规则收敛成显式条件，并在服务层统一注入。',
    tags: ['Prisma', '数据库'],
    daysAgo: 4,
    views: 512,
    content: `## 旧写法的问题

旧项目用 \`prisma.$use\` 中间件拦截 \`findMany\`、\`update\`、\`delete\`，
自动往 \`where\` 里塞 \`deleted: false\`。看起来很优雅，实际埋了三个坑。

### 坑一：关联查询不生效

\`\`\`ts
prisma.post.findMany({
  include: { comments: true }, // 这里不会经过中间件的 where 注入
})
\`\`\`

中间件只处理顶层查询，\`include\` 出来的关联数据依然包含已删除记录。

### 坑二：计数器被污染

\`count()\` 和 \`aggregate()\` 需要单独处理，漏掉一处统计数字就是错的。

### 坑三：调试困难

代码里看不到这个条件，排查问题时需要记住「有个中间件在改 where」。

## 更稳的做法

把「能看见什么」定义成一个纯函数，显式传给查询：

\`\`\`ts
function visibilityWhere(viewer?: PublicUser | null): Prisma.PostWhereInput {
  if (viewer?.role === 'ADMIN') return { deletedAt: null }
  if (viewer) {
    return {
      deletedAt: null,
      OR: [{ status: 'PUBLISHED' }, { authorId: viewer.id }],
    }
  }
  return { deletedAt: null, status: 'PUBLISHED' }
}
\`\`\`

好处：

1. 规则集中在一处，改权限只需要改这个函数
2. 关联查询显式加 \`where: { deletedAt: null }\`，不会漏
3. 阅读查询代码时能直接看到过滤条件

## 软删除字段怎么选

- \`deleted Boolean\`：省 7 字节，但拿不到删除时间，做数据恢复和审计时不够用
- \`deletedAt DateTime?\`：多 7 字节，换来删除时间与「是否删除」两个信息

选 \`deletedAt\`。判断条件写 \`deletedAt: null\`，语义清晰。

> 如果查询量大，记得给 \`deletedAt\` 建索引——它出现在绝大多数 \`where\` 里。`,
  },
  {
    title: 'Next.js App Router 的缓存陷阱与取舍',
    summary:
      'App Router 默认会尽力缓存，这在一个内容随时会变的博客里是灾难。记录几个实际踩到的缓存问题，以及最终的配置取舍。',
    tags: ['Next.js', '缓存'],
    daysAgo: 8,
    views: 764,
    content: `## 默认行为并不总是你想要的

App Router 里，路由段会尝试静态化。对一个博客，这听起来很棒——
直到你发现刷新页面看到的还是五分钟前的内容。

### 陷阱一：Route Handler 被缓存

\`\`\`ts
// app/api/posts/route.ts
export async function GET() {
  return Response.json(await listPosts()) // 可能被静态化
}
\`\`\`

GET 类型的 Route Handler 如果没用到动态 API（cookies、headers、searchParams），
Next.js 会在构建时执行一次并把结果固化下来。

修复方式是在文件顶部显式声明：

\`\`\`ts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
\`\`\`

### 陷阱二：cookies() 让整棵树变成动态渲染

一旦在某个 layout 里调用 \`cookies()\`（比如读取登录态），
该 layout 下所有页面都会变成动态渲染。

这是**预期行为**，但要有意识：博客的头部需要展示登录态，
所以主页必然是动态的。此时与其对抗，不如接受——
真正的性能优化应该放在数据库索引上。

### 陷阱三：fetch 的默认缓存

\`fetch\` 在服务端组件里默认\`force-cache\`。对于实时性要求高的数据，
需要显式关闭：

\`\`\`ts
const res = await fetch(url, { cache: 'no-store' })
\`\`\`

## 最终采用的策略

| 数据 | 策略 | 理由 |
| --- | --- | --- |
| 文章列表 / 详情 | 动态渲染 | 内容随时可能更新 |
| 标签列表 | 动态渲染 | 数据量小，查询便宜 |
| 静态资源 | 长缓存 | 内容哈希命名 |

在博客这个体量下，「所有页面动态渲染 + 数据库加索引」比
「精心设计缓存层级 + 处理失效」要简单得多，也更容易正确。

> 优化之前先测量。没有测量数据的缓存设计，本质上是在猜。`,
  },
  {
    title: '用 scrypt 而不是 bcrypt：一个被忽略的 Node 内置能力',
    summary:
      'bcrypt 需要编译原生模块，在 CI 与跨平台部署时经常出问题。Node 内置的 scrypt 同样是密码哈希的标准选择，而且零依赖。',
    tags: ['Node.js', '安全'],
    daysAgo: 12,
    views: 401,
    content: `## bcrypt 的部署痛点

\`bcrypt\` 是原生模块，安装时需要编译。这在下面几种情况下会出问题：

- CI 容器里没有构建工具链
- Alpine 镜像缺少 \`python3\` / \`make\` / \`g++
- 跨平台（开发 macOS / 部署 Linux）时 node_modules 不能直接复用
- 替代品 \`bcryptjs\` 是纯 JS 实现，但慢得多

## scrypt 是标准算法

scrypt 由 Colin Percival 设计，2016 年被 RFC 7914 收录。
它的特点是**内存硬**（memory-hard）：不仅消耗 CPU，还强制占用大量内存，
这让 GPU 和 ASIC 暴力破解的性价比大幅下降。

Node 从 v10 起就把 \`crypto.scrypt\` 内置了。

## 实现

\`\`\`ts
import { randomBytes, scrypt as cb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(cb) as (
  password: string, salt: Buffer, keylen: number
) => Promise<Buffer>

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64)
  return \\\`scrypt$\\\${salt.toString('hex')}$\\\${derived.toString('hex')}\\\`
}
\`\`\`

存储格式自带算法标识（\`scrypt$\`），未来迁移到 argon2 时可以按前缀分流，
不需要重置所有用户的密码。

## 校验必须用 timingSafeEqual

普通的 \`===\` 比较会在第一个不同的字节处提前返回，攻击者可以通过
响应时间差逐字节猜测哈希值：

\`\`\`ts
export async function verifyPassword(password: string, stored: string) {
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt') return false
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), 64)
  return timingSafeEqual(derived, Buffer.from(hashHex, 'hex'))
}
\`\`\`

注意：\`timingSafeEqual\` 在长度不等时会**直接抛异常**，
所以要先校验长度，否则会变成通过异常泄露长度信息。

## 小结

选择标准算法 + 内置实现，能同时拿到安全性和部署便利性。
除非有明确的性能基准要求，否则没有理由为此引入原生依赖。`,
  },
  {
    title: '设计一个极简博客的视觉系统',
    summary:
      '去掉所有装饰性元素后，层级只能靠留白、字重和 1px 边框来建立。记录这套设计系统的具体参数与决策过程。',
    tags: ['设计', 'Tailwind'],
    daysAgo: 17,
    views: 289,
    content: `## 起点：删掉阴影和圆角

大多数博客模板的问题不是不够好看，而是**元素太多**：

- 卡片有阴影
- 圆角 12px 以上
- 每个区块都有背景色
- 三种以上的强调色

扁平化不是「不要设计」，而是换一套手段建立层级。

## 三个可用手段

### 1. 留白

留白是最有效的分组工具。把列表项的行内边距设为 \`py-6\`（24px），
相邻项之间的间隔就足够形成分组，不需要分割线的颜色很重。

\`\`\`html
<article class="border-b border-ink-100 py-6">
  <!-- 内容 -->
</article>
\`\`\`

### 2. 字重与字号

只使用三档：

| 用途 | 字号 | 字重 |
| --- | --- | --- |
| 正文 | 15px | 400 |
| 小标题 | 18px | 600 |
| 元信息 | 12px | 400 + 弱化色 |

字号跨度不要小于 3px，否则视觉上分不清主次。

### 3. 1px 边框

用边框代替阴影来界定容器：

\`\`\`css
.card {
  @apply rounded-lg border border-ink-200 bg-white;
}
\`\`\`

注意圆角只给 \`rounded-lg\`（8px）。再大就会显得「软」，破坏扁平感。

## 色彩：一套中性色 + 一个强调色

中性色阶用 11 级（50 ~ 950），强调色只保留一个蓝色用于链接和焦点态。

深色模式不是简单反色：背景用 \`#111214\` 而不是纯黑，
因为纯黑与文字对比过强，长时间阅读会疲劳。边框也要相应调整为 \`ink-800\`。

## 交互反馈不能省

扁平化最容易犯的错是把 hover 反馈也去掉。用户需要确认「这里可以点」：

- 链接 hover 变强调色
- 列表项 hover 显示浅背景
- 按钮 hover 变色，且过渡时间 150ms

过渡时间太短会显得生硬，太长（>300ms）会觉得迟钝。

## 检查清单

设计完成后，用这几个问题自查：

1. 把页面转成灰度，层级还清楚吗？
2. 只用键盘 Tab，能否看清焦点在哪？
3. 深色模式下有没有出现纯黑或纯白？
4. 去掉所有标签和图标，信息是否依然可以理解？`,
  },
  {
    title: '分页还是游标？先看数据会不会漂移',
    summary:
      '文章列表适合页码分页，评论列表适合游标分页。区别不在数据量，而在「翻页期间数据是否可能变化」。',
    tags: ['REST', 'API 设计'],
    daysAgo: 23,
    views: 356,
    content: `## 问题的本质

假设每页 10 条，用户正在看第 2 页。
此时有人在列表顶部插入了一条新数据，于是：

- 原来的第 10 条被挤到第 2 页
- 用户翻到第 3 页时，这条数据已经在第 2 页出现过了
- 结果：**同一条数据被看到两次**

反向的情况（删除数据）则会导致**数据被跳过**。

## 页码分页

\`\`\`http
GET /api/posts?page=2&pageSize=10
\`\`\`

**优点**：可以跳页，用户能直接去第 5 页；UI 上能显示「共 23 页」。
**缺点**：数据漂移；\`OFFSET\` 在深分页时性能下降（要扫描并丢弃前 N 行）。

**适用**：文章列表、搜索结果这类「按稳定顺序浏览」的场景。
博客文章的顺序（发布时间）基本不变，漂移影响很小。

## 游标分页

\`\`\`http
GET /api/posts/xxx/comments?cursor=128&limit=20
\`\`\`

游标指向一个**稳定的锚点**，通常是单调递增的主键：

\`\`\`ts
where: { id: { lt: cursor } }
orderBy: { createdAt: 'desc' }
\`\`\`

**优点**：不会重复或跳过；\`WHERE id < n\` 可以直接走索引，深分页不退化。
**缺点**：不能跳页；无法直接告诉用户总页数（只能另外 \`count\`）。

**适用**：评论、动态流、日志——「持续加载更多」的场景。

## 一个容易忽略的细节

游标分页必须保证**排序键与游标键一致**。用 \`createdAt\` 排序却用 \`id\` 做游标，
在时间戳相同时（同一秒内插入多条）顺序就不确定了，依然会漏数据。

稳妥做法是排序和游标都用主键，或使用复合游标 \`(createdAt, id)\`。

## 项目中的实际选择

| 资源 | 方案 | 理由 |
| --- | --- | --- |
| \`/api/posts\` | 页码分页 | 顺序稳定，需要跳页与总数 |
| \`/api/posts/:slug/comments\` | 游标分页 | 实时新增，顺序敏感 |

响应里分别返回不同的 meta 结构，前端据此决定渲染分页条还是「加载更多」按钮：

\`\`\`ts
// 页码分页
meta: { pagination: { page, pageSize, total, totalPages } }
// 游标分页
meta: { cursor: { nextCursor, hasMore, total } }
\`\`\``,
  },
  {
    title: '错误处理的分层：从 Prisma 到 HTTP 响应',
    summary:
      '服务层抛领域异常，API 层统一转换，前端按错误码分流。三层各司其职，避免 try/catch 散落在业务代码里。',
    tags: ['架构设计', 'Node.js'],
    daysAgo: 31,
    views: 445,
    content: `## 反模式：在服务层返回错误对象

\`\`\`ts
// ✗ 调用方必须记得检查 ok 字段，漏一次就是 bug
async function getPost(id) {
  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return { ok: false, message: '文章不存在' }
  return { ok: true, data: post }
}
\`\`\`

问题在于**类型系统无法强制调用方检查**，而且业务代码里会充斥 \`if (!result.ok)\`。

## 分层方案

### 第一层：领域异常

定义一个承载 HTTP 语义的异常类：

\`\`\`ts
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCodeValue,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message)
  }
}

export const notFound = (msg = '资源不存在') =>
  new AppError(404, ErrorCode.NOT_FOUND, msg)
\`\`\`

服务层只管 \`throw notFound('文章不存在')\`，不关心 HTTP。

### 第二层：路由包装器

把所有异常收敛到一个地方：

\`\`\`ts
export function route(handler) {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}
\`\`\`

于是每个 handler 都是纯业务逻辑，没有 try/catch：

\`\`\`ts
export const GET = route(async (request, { params }) => {
  const post = await postService.getBySlug(params.slug)
  return ok(post)
})
\`\`\`

### 第三层：数据库错误映射

Prisma 的错误码要翻译成领域语义，避免把 \`P2002\` 泄露给前端：

\`\`\`ts
if (error.code === 'P2002') return fail(409, 'CONFLICT', '资源已存在')
if (error.code === 'P2025') return fail(404, 'NOT_FOUND', '资源不存在')
\`\`\`

## 前端怎么用

错误码是稳定的字符串枚举，前端可以做精确分支：

\`\`\`ts
try {
  await api.post('/api/auth/register', form)
} catch (error) {
  if (error instanceof ApiError) {
    if (error.code === 'CONFLICT') {
      setFieldError('username', error.message)  // 定位到具体字段
    } else if (error.details) {
      applyFieldErrors(error.details)           // 422 字段级报错
    }
  }
}
\`\`\`

## 收益

改造后新增一个接口的模板固定为：

\`\`\`text
route.ts    -> 校验 + 调用服务 + 返回 ok()/created()
validation  -> zod schema
service     -> 业务规则，失败时 throw
\`\`\`

不需要思考「这个错误该怎么返回」，因为答案只有一个。`,
  },
  {
    title: '写完第一个可用的版本之后，我删掉了什么',
    summary:
      '功能列表越长，维护成本越高。记录这次重写中主动砍掉的功能，以及砍掉它们之后得到了什么。',
    tags: ['产品思考', '架构设计'],
    daysAgo: 38,
    views: 233,
    content: `## 砍掉的功能清单

### 1. 富文本编辑器

原计划用所见即所得编辑器。实际实现后发现两个问题：

- 编辑器体积普遍在 300KB 以上
- 富文本产出的 HTML 不可控，清洗规则要写很多

改为 **Markdown + 实时预览**：

\`\`\`text
左栏写 Markdown  ->  右栏实时渲染
\`\`\`

体积从 300KB 降到约 40KB，而且存进数据库的是纯文本，
迁移和备份都简单得多。

### 2. 阅读量防刷

本来想按 IP + 时间窗做去重。但仔细想：

- 博客的阅读量是给自己看的参考值，不是关键指标
- 防刷要引入 Redis 或额外的表
- 幂等处理的复杂度远大于收益

最后就是简单的 \`views: { increment: 1 }\`，且**失败不影响正文展示**：

\`\`\`ts
prisma.post.update({ ... }).catch((error) =>
  console.warn('[post] increment views failed:', error)
)
\`\`\`

### 3. 多级嵌套评论

原本设计无限层级回复。但：

- 层级超过 2 层后，缩进会把内容挤成一列
- 移动端几乎无法阅读

改为**两级**：回复「回复」时自动挂到同一个顶层评论下。
数据结构保留 \`parentId\` 自关联，未来要扩展也只是改一个判断。

### 4. 点赞

点赞需要：防重复、计数一致性、以及「谁赞过」的存储。
这三件事的复杂度加起来，换来的是一个用户几乎不会注意到的数字。

### 5. 分类与标签并存

两者语义重叠严重。保留标签就够了——一篇文章可以打多个标签，
而且标签天然是扁平的，不需要维护一棵分类树。

## 砍掉之后的收益

| 维度 | 砍之前 | 砍之后 |
| --- | --- | --- |
| 数据表 | 9 张 | 6 张 |
| API 端点 | 24 个 | 15 个 |
| 首屏 JS | ~700KB | ~230KB |
| 需要维护的第三方依赖 | 14 个 | 8 个 |

数字上的收益是次要的。真正的收益是**每一个功能都能说清楚为什么存在**——
当需求不明确时，「不做」是成本最低的选择。

## 什么时候应该加回来

不是永远不加。判断标准是：**这个功能是否解决了反复出现的真实痛点**。

比如草稿功能最后保留了，因为写长文时确实需要「先存下来，明天再改」。
而点赞始终没有出现这个信号。`,
  },
]

async function main(): Promise<void> {
  console.log('▸ 清理旧数据…')
  await prisma.comment.deleteMany()
  await prisma.postTag.deleteMany()
  await prisma.post.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  console.log('▸ 创建用户…')
  const admin = await prisma.user.create({
    data: {
      username: 'muzzle',
      email: 'muzzle@example.com',
      nickname: 'Muzzle',
      bio: '写代码，也写关于写代码的东西。',
      role: 'ADMIN',
      passwordHash: await hashPassword(ADMIN_PASSWORD),
    },
  })

  const reader = await prisma.user.create({
    data: {
      username: 'reader',
      email: 'reader@example.com',
      nickname: '读者甲',
      bio: '长期潜水，偶尔冒泡。',
      role: 'USER',
      passwordHash: await hashPassword(READER_PASSWORD),
    },
  })

  console.log('▸ 创建标签与文章…')
  const tagCache = new Map<string, number>()
  const now = Date.now()

  const postIds: number[] = []
  for (const article of ARTICLES) {
    const publishedAt = new Date(now - article.daysAgo * 24 * 60 * 60 * 1000)

    // 依据正文自动生成摘要（若未显式提供则截断正文）
    const tagIds: number[] = []
    for (const name of article.tags) {
      let id = tagCache.get(name)
      if (!id) {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name, slug: tagSlug(name) },
        })
        id = tag.id
        tagCache.set(name, id)
      }
      tagIds.push(id)
    }

    const post = await prisma.post.create({
      data: {
        slug: slug('p'),
        title: article.title,
        summary: article.summary,
        content: article.content,
        status: 'PUBLISHED',
        views: article.views,
        publishedAt,
        createdAt: publishedAt,
        authorId: admin.id,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    })
    postIds.push(post.id)
  }

  // 一篇草稿，用于验证「游客不可见、作者可见」
  await prisma.post.create({
    data: {
      slug: slug('d'),
      title: '未完成的草稿：关于缓存失效的思考',
      summary: '这篇还没写完，用来验证草稿的可见性规则。',
      content: `## 草稿

缓存失效只有两件难事：命名，和失效。

- [x] 列出需要缓存的资源
- [ ] 设计失效策略
- [ ] 压测验证`,
      status: 'DRAFT',
      authorId: admin.id,
    },
  })

  console.log('▸ 创建评论…')
  const firstPostId = postIds[0]

  const root = await prisma.comment.create({
    data: {
      content: '写得很清楚，尤其是错误码与 HTTP 状态码解耦那一段。请问前端拿到 422 的 details 后是怎么渲染的？',
      postId: firstPostId,
      authorId: reader.id,
      createdAt: new Date(now - 20 * 60 * 60 * 1000),
    },
  })

  await prisma.comment.create({
    data: {
      content:
        '谢谢！422 的 details 是 [{ path, message }]，前端按 path 把 message 贴到对应输入框下面，不用再做映射表。',
      postId: firstPostId,
      authorId: admin.id,
      parentId: root.id,
      createdAt: new Date(now - 18 * 60 * 60 * 1000),
    },
  })

  await prisma.comment.create({
    data: {
      content: '软删除用 deletedAt 而不是 boolean，这点很关键，我们线上就吃过亏。',
      postId: postIds[1],
      authorId: reader.id,
      createdAt: new Date(now - 5 * 60 * 60 * 1000),
    },
  })

  const [users, posts, tags, comments] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.tag.count(),
    prisma.comment.count(),
  ])

  console.log(`
✓ 种子数据写入完成
  用户 ${users} · 文章 ${posts}（含 1 篇草稿） · 标签 ${tags} · 评论 ${comments}

  管理员账号：muzzle / ${ADMIN_PASSWORD}
  普通账号：  reader / ${READER_PASSWORD}
`)
}

main()
  .catch((error: unknown) => {
    console.error('✗ 种子数据写入失败：', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
