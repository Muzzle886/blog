#!/usr/bin/env bash
# 端到端 API 验收脚本：注册 -> 登录 -> 发文 -> 评论 -> 更新 -> 删除 -> 权限校验
# 用法：bash scripts/e2e.sh [base_url]
set -uo pipefail

BASE="${1:-http://localhost:3000}"
JAR_A=$(mktemp)   # 作者会话
JAR_B=$(mktemp)   # 第二个用户会话
JAR_ANON=$(mktemp) # 未登录
PASS=0
FAIL=0

cleanup() { rm -f "$JAR_A" "$JAR_B" "$JAR_ANON"; }
trap cleanup EXIT

req() { # req <jar> <method> <path> [json]
  local jar="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$BASE$path" -b "$jar" -c "$jar" \
      -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -s -X "$method" "$BASE$path" -b "$jar" -c "$jar" -w '\n%{http_code}'
  fi
}

check() { # check <label> <expected_status> <actual_status> [extra]
  if [ "$2" = "$3" ]; then
    printf '  \033[32m✓\033[0m %-52s %s\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31m✗\033[0m %-52s 期望 %s，实际 %s %s\n' "$1" "$2" "$3" "${4:-}"
    FAIL=$((FAIL + 1))
  fi
}

body_of() { echo "$1" | sed '$d'; }
status_of() { echo "$1" | tail -n1; }

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

STAMP=$(date +%s)
USER_A="e2e_author_$STAMP"
USER_B="e2e_reader_$STAMP"

section "1. 鉴权 —— 注册 / 登录 / 会话"

R=$(req "$JAR_A" POST /api/auth/register "{\"username\":\"$USER_A\",\"email\":\"$USER_A@example.com\",\"password\":\"Passw0rd123\",\"nickname\":\"E2E 作者\"}")
check "POST /api/auth/register 创建用户" 201 "$(status_of "$R")" "$(body_of "$R" | head -c 160)"

R=$(req "$JAR_ANON" POST /api/auth/register "{\"username\":\"$USER_A\",\"email\":\"x@example.com\",\"password\":\"Passw0rd123\",\"nickname\":\"重复\"}")
check "POST /api/auth/register 重名 -> 409" 409 "$(status_of "$R")"

R=$(req "$JAR_ANON" POST /api/auth/register '{"username":"ab","email":"bad","password":"123","nickname":""}')
check "POST /api/auth/register 参数非法 -> 422" 422 "$(status_of "$R")"

R=$(req "$JAR_ANON" POST /api/auth/login "{\"identifier\":\"$USER_A\",\"password\":\"wrongpass1\"}")
check "POST /api/auth/login 密码错误 -> 401" 401 "$(status_of "$R")"

R=$(req "$JAR_B" POST /api/auth/register "{\"username\":\"$USER_B\",\"email\":\"$USER_B@example.com\",\"password\":\"Passw0rd123\",\"nickname\":\"E2E 读者\"}")
check "POST /api/auth/register 第二个用户" 201 "$(status_of "$R")"

R=$(req "$JAR_A" GET /api/users/me)
check "GET  /api/users/me 已登录" 200 "$(status_of "$R")"
check "     -> 返回用户不含 passwordHash" 0 "$(body_of "$R" | grep -c passwordHash)"

R=$(req "$JAR_ANON" GET /api/users/me)
check "GET  /api/users/me 未登录 -> 401" 401 "$(status_of "$R")"

section "2. 文章 —— 创建 / 读取 / 分页 / 搜索"

R=$(req "$JAR_A" POST /api/posts "{\"title\":\"E2E 测试草稿\",\"content\":\"## 草稿正文\\n\\n这是测试内容。\",\"status\":\"DRAFT\",\"tags\":[\"E2E\",\"测试\"]}")
check "POST /api/posts 创建草稿 -> 201" 201 "$(status_of "$R")"
DRAFT_SLUG=$(body_of "$R" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["slug"])' 2>/dev/null)
echo "     草稿 slug = $DRAFT_SLUG"

R=$(req "$JAR_ANON" GET "/api/posts/$DRAFT_SLUG")
check "GET  /api/posts/:slug 游客读草稿 -> 404" 404 "$(status_of "$R")"

R=$(req "$JAR_B" GET "/api/posts/$DRAFT_SLUG")
check "GET  /api/posts/:slug 他人读草稿 -> 404" 404 "$(status_of "$R")"

R=$(req "$JAR_A" GET "/api/posts/$DRAFT_SLUG?view=edit")
check "GET  /api/posts/:slug?view=edit 作者读草稿" 200 "$(status_of "$R")"

R=$(req "$JAR_A" PATCH "/api/posts/$DRAFT_SLUG" '{"status":"PUBLISHED"}')
check "PATCH /api/posts/:slug 发布草稿" 200 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts/$DRAFT_SLUG")
check "GET  /api/posts/:slug 发布后游客可读" 200 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts?pageSize=3&page=1")
check "GET  /api/posts 列表分页" 200 "$(status_of "$R")"
check "     -> meta.pagination 存在" 1 "$(body_of "$R" | grep -c '"pagination"')"

R=$(req "$JAR_ANON" GET "/api/posts?q=E2E")
check "GET  /api/posts?q= 关键词搜索" 200 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts?status=DRAFT")
check "GET  /api/posts?status=DRAFT 游客 -> 403" 403 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts?pageSize=999")
check "GET  /api/posts?pageSize=999 越界 -> 422" 422 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts/not-a-real-slug")
check "GET  /api/posts/:slug 不存在 -> 404" 404 "$(status_of "$R")"

section "3. 写权限 —— 越权拦截"

R=$(req "$JAR_B" PATCH "/api/posts/$DRAFT_SLUG" '{"title":"篡改标题"}')
check "PATCH /api/posts/:slug 非作者 -> 403" 403 "$(status_of "$R")"

R=$(req "$JAR_B" DELETE "/api/posts/$DRAFT_SLUG")
check "DELETE /api/posts/:slug 非作者 -> 403" 403 "$(status_of "$R")"

R=$(req "$JAR_ANON" POST /api/posts '{"title":"x","content":"y"}')
check "POST /api/posts 未登录 -> 401" 401 "$(status_of "$R")"

section "4. 评论 —— 创建 / 回复 / 游标分页 / 删除"

R=$(req "$JAR_B" POST "/api/posts/$DRAFT_SLUG/comments" '{"content":"E2E 顶层评论"}')
check "POST /api/posts/:slug/comments 发表 -> 201" 201 "$(status_of "$R")"
ROOT_ID=$(body_of "$R" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["id"])' 2>/dev/null)

R=$(req "$JAR_A" POST "/api/posts/$DRAFT_SLUG/comments" "{\"content\":\"E2E 回复\",\"parentId\":$ROOT_ID}")
check "POST /api/posts/:slug/comments 回复" 201 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts/$DRAFT_SLUG/comments?limit=10")
check "GET  /api/posts/:slug/comments 游标分页" 200 "$(status_of "$R")"
check "     -> meta.cursor 存在" 1 "$(body_of "$R" | grep -c '"cursor"')"

R=$(req "$JAR_ANON" POST "/api/posts/$DRAFT_SLUG/comments" '{"content":"游客评论"}')
check "POST comments 未登录 -> 401" 401 "$(status_of "$R")"

R=$(req "$JAR_B" DELETE "/api/comments/$ROOT_ID")
check "DELETE /api/comments/:id 作者删自己的" 204 "$(status_of "$R")"

R=$(req "$JAR_B" DELETE "/api/comments/999999")
check "DELETE /api/comments/:id 不存在 -> 404" 404 "$(status_of "$R")"

section "5. 标签与其他"

R=$(req "$JAR_ANON" GET /api/tags)
check "GET  /api/tags" 200 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET /api/tags?include=stats)
check "GET  /api/tags?include=stats" 200 "$(status_of "$R")"
check "     -> meta.stats 存在" 1 "$(body_of "$R" | grep -c '"stats"')"

R=$(req "$JAR_ANON" GET /api/stats)
check "GET  /api/stats" 200 "$(status_of "$R")"

R=$(req "$JAR_A" PATCH /api/users/me '{"bio":"E2E 更新后的简介"}')
check "PATCH /api/users/me 更新资料" 200 "$(status_of "$R")"

R=$(req "$JAR_A" PATCH /api/users/me '{"email":"not-an-email"}')
check "PATCH /api/users/me 非法邮箱 -> 422" 422 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/users/$USER_A")
check "GET  /api/users/:username 公开资料" 200 "$(status_of "$R")"

R=$(req "$JAR_A" DELETE "/api/posts/$DRAFT_SLUG")
check "DELETE /api/posts/:slug 作者删除 -> 204" 204 "$(status_of "$R")"

R=$(req "$JAR_ANON" GET "/api/posts/$DRAFT_SLUG")
check "     -> 删除后前台不可见" 404 "$(status_of "$R")"

section "6. 退出登录"

R=$(req "$JAR_A" DELETE /api/auth/session)
check "DELETE /api/auth/session -> 204" 204 "$(status_of "$R")"

R=$(req "$JAR_A" GET /api/users/me)
check "     -> 会话失效" 401 "$(status_of "$R")"

printf '\n\033[1m结果：\033[0m \033[32m%d 通过\033[0m' "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf '，\033[31m%d 失败\033[0m\n' "$FAIL"
  exit 1
fi
printf '，0 失败\n'
