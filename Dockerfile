# ============================================================================
# 生产镜像：多阶段构建 + Next.js standalone 输出
#
# 关键取舍：
#  - 用 Debian slim 而不是 Alpine：Prisma 的查询引擎在 musl 上需要额外的
#    兼容配置，debian 的 glibc 直接用官方预编译产物，少一类坑
#  - standalone 输出只带上真正被引用到的依赖，镜像明显小于整包 node_modules
#  - 三阶段：deps（装依赖）-> builder（构建）-> runner（只带运行所需产物）
# ============================================================================

# ---------------------------------- deps ----------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Prisma 需要 openssl；其余保持最小
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

# 先只拷贝清单文件，让依赖层能被 Docker 缓存复用
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# --------------------------------- builder --------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# 小内存机器上构建时用来限制 node 堆大小（默认无上限会被 OOM killer 干掉）
ARG NODE_OPTIONS=""
ENV NODE_OPTIONS=${NODE_OPTIONS}

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.9.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建期不需要真实数据库：Next 只做静态分析，
# Prisma Client 的生成依赖 schema 而不是连接。
# 这里给一个占位 URL，避免构建时因缺少 DATABASE_URL 直接失败。
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# --no-lint：ESLint 已在本地/CI 单独跑过（pnpm lint），构建期重复跑
# 只是把同一份工作再做一遍，在 1.7G 内存的目标机器上纯属浪费。
# 类型检查仍然保留 —— 那是构建产物正确性的一部分。
RUN pnpm exec prisma generate \
  && pnpm exec next build --no-lint

# --------------------------------- runner ---------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 运行
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 产物：含 node_modules 里被追踪到的依赖与 server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# standalone 不会自动带上这两项，必须显式拷贝
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 迁移所需的 schema 与迁移文件
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# prisma CLI 与它的依赖（含 schema engine）。
# 打进镜像而不是在启动时用 npx 下载 —— 容器启动不该依赖 npm 网络可用。
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# 种子脚本 + tsx：部署时用它写入初始账号。
# 放在镜像里而不是宿主机执行，保证 tsx 与依赖版本一致。
COPY --from=builder --chown=nextjs:nodejs /app/prisma/seed.ts ./prisma/seed.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/tsx ./node_modules/.bin/tsx

COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker/entrypoint.sh ./entrypoint.sh

USER nextjs

EXPOSE 3000

# Node 内置 fetch 做健康检查，不必为此装 curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/stats').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
