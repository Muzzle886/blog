#!/usr/bin/env bash
# ============================================================================
# 服务器端部署脚本：在目标机器上构建镜像并用 compose 起服务
#
# 在服务器上执行（而非本地），因为本机没有 Docker 且服务器无法访问外部数据库。
# 前提：已安装 docker + compose、已配置 registry 镜像加速、代码已 clone 到
#       APP_DIR。
#
# 用法：bash scripts/docker/deploy-remote.sh
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/blog}"
cd "$APP_DIR"

# ---------- 1. 生产环境变量（首次自动生成强口令）----------
ENV_FILE="$APP_DIR/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] 首次部署：生成 .env.production 与随机口令"

  gen_pw() {
    # 只用字母数字：避免 @ : / # 等字符在 DATABASE_URL 里需要百分号转义
    # （踩过这个坑：密码含 / 会让 new URL() 直接抛 Invalid URL）
    openssl rand -hex 24
  }

  MYSQL_ROOT_PASSWORD="$(gen_pw)"
  MYSQL_PASSWORD="$(gen_pw)"
  SEED_ADMIN_PASSWORD="$(openssl rand -hex 12)"
  SEED_READER_PASSWORD="$(openssl rand -hex 12)"

  cat > "$ENV_FILE" <<ENVEOF
# 由 deploy-remote.sh 自动生成于 $(date -Iseconds)
# 含真实凭据，切勿提交到版本库
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD}"
MYSQL_DATABASE="muzzle_blog"
MYSQL_USER="blog"
MYSQL_PASSWORD="${MYSQL_PASSWORD}"

APP_PORT="3000"
APP_IMAGE="blog:latest"

NEXT_PUBLIC_SITE_NAME="Muzzle's Blog"
NEXT_PUBLIC_SITE_URL="http://123.249.120.41:3000"

SESSION_COOKIE_NAME="blog_session"
SESSION_TTL_DAYS="14"
SESSION_IDLE_DAYS="7"

# 通过 http 直接暴露时只能为 false（见 README 的说明）
COOKIE_SECURE="false"

SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD}"
SEED_READER_PASSWORD="${SEED_READER_PASSWORD}"
ENVEOF

  chmod 600 "$ENV_FILE"
  echo "[deploy] .env.production 已写入（权限 600）"
else
  echo "[deploy] 复用已有 .env.production"
fi

# ---------- 2. 构建应用镜像 ----------
echo "[deploy] 构建应用镜像（Next 构建较吃内存，已限制 node 堆大小）"
export DOCKER_BUILDKIT=1
# 1.7G 内存的机器上给 node 设上限，避免构建期被 OOM killer 干掉
export NODE_OPTIONS="--max-old-space-size=1024"
docker build --build-arg NODE_OPTIONS="$NODE_OPTIONS" -t blog:latest .

# ---------- 3. 起数据库（先只起 db，等健康后再跑迁移）----------
echo "[deploy] 启动 MySQL"
docker compose --env-file "$ENV_FILE" up -d db

echo "[deploy] 等待 MySQL 健康…"
for i in $(seq 1 60); do
  status="$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose --env-file "$ENV_FILE" ps -q db)" 2>/dev/null || echo unknown)"
  if [ "$status" = "healthy" ]; then
    echo "[deploy] MySQL 已健康（第 ${i} 次探测）"
    break
  fi
  [ "$i" = "60" ] && { echo "[deploy] MySQL 未在预期时间内健康"; docker compose --env-file "$ENV_FILE" logs db | tail -20; exit 1; }
  sleep 3
done

# ---------- 4. 迁移与种子数据 ----------
echo "[deploy] 应用数据库迁移"
docker compose --env-file "$ENV_FILE" run --rm --entrypoint sh app -c \
  './node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma'

echo "[deploy] 写入种子数据（幂等：会清空并重建）"
docker compose --env-file "$ENV_FILE" run --rm --entrypoint sh app -c \
  'node_modules/.bin/tsx prisma/seed.ts --yes || echo "[deploy] 种子脚本跳过（镜像内可能未含 tsx）"'

# ---------- 5. 起应用 ----------
echo "[deploy] 启动应用"
docker compose --env-file "$ENV_FILE" up -d app

echo "[deploy] 等待应用就绪…"
for i in $(seq 1 40); do
  if curl -fsS -m 3 http://127.0.0.1:3000/api/stats >/dev/null 2>&1; then
    echo "[deploy] 应用已就绪"
    break
  fi
  [ "$i" = "40" ] && { echo "[deploy] 应用未就绪"; docker compose --env-file "$ENV_FILE" logs app | tail -30; exit 1; }
  sleep 3
done

echo
echo "=========== 部署完成 ==========="
docker compose --env-file "$ENV_FILE" ps
echo
echo "站点：http://123.249.120.41:3000"
echo "账号信息见 .env.production 中的 SEED_* 变量"
