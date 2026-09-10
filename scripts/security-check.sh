#!/usr/bin/env bash
# 安全回归验收：会话令牌存储方式、撤销语义、响应头、数据暴露、账号枚举
# 用法：bash scripts/security-check.sh [base_url]
#
# 其中「数据库里究竟存了什么」直接查库验证 —— 只看 HTTP 响应无法证明令牌未被明文存储。
set -uo pipefail

BASE="${1:-http://localhost:3000}"
JAR_A=$(mktemp)
JAR_B=$(mktemp)
JAR_C=$(mktemp)
PASS=0
FAIL=0

cleanup() { rm -f "$JAR_A" "$JAR_B" "$JAR_C"; }
trap cleanup EXIT

req() {
  local jar="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$BASE$path" -b "$jar" -c "$jar" \
      -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -s -X "$method" "$BASE$path" -b "$jar" -c "$jar" -w '\n%{http_code}'
  fi
}

check() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32m✓\033[0m %-56s %s\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31m✗\033[0m %-56s 期望 %s，实际 %s\n' "$1" "$2" "$3"
    FAIL=$((FAIL + 1))
  fi
}

checkstr() {
  if [ "$2" = "$3" ]; then
    printf '  \033[32m✓\033[0m %-56s %s\n' "$1" "$3"
    PASS=$((PASS + 1))
  else
    printf '  \033[31m✗\033[0m %-56s 期望「%s」，实际「%s」\n' "$1" "$2" "$3"
    FAIL=$((FAIL + 1))
  fi
}

body_of() { echo "$1" | sed '$d'; }
status_of() { echo "$1" | tail -n1; }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

STAMP=$(date +%s)
USER="sec_$STAMP"
PASS1="Passw0rd123"
PASS2="Passw0rd456"

section "1. 会话令牌：明文绝不入库"

R=$(req "$JAR_A" POST /api/auth/register "{\"username\":\"$USER\",\"email\":\"$USER@example.com\",\"password\":\"$PASS1\",\"nickname\":\"Sec Test\"}")
check "注册测试账号" 201 "$(status_of "$R")"

TOKEN_A=$(grep -o 'blog_session[[:space:]].*' "$JAR_A" | awk '{print $NF}')
TOKEN_LEN=${#TOKEN_A}
checkstr "Cookie 中的令牌长度（期望 64 位十六进制）" "64" "$TOKEN_LEN"

# 关键：直接查库确认存储的是摘要而非令牌本身
DB_RESULT=$(pnpm exec tsx scripts/db-inspect-session.ts "$TOKEN_A" 2>/dev/null | tail -1)
checkstr "数据库中保存的是令牌摘要，不是令牌本身" "HASHED_OK" "$DB_RESULT"

section "2. 修改密码：撤销该账号的全部会话"

curl -s -c "$JAR_B" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$USER\",\"password\":\"$PASS1\"}" -o /dev/null
curl -s -c "$JAR_C" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$USER\",\"password\":\"$PASS1\"}" -o /dev/null

check "会话A 改密前有效" 200 "$(curl -s -b "$JAR_A" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"
check "会话B 改密前有效" 200 "$(curl -s -b "$JAR_B" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"
check "会话C 改密前有效" 200 "$(curl -s -b "$JAR_C" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"

R=$(req "$JAR_A" PATCH /api/users/me/password "{\"currentPassword\":\"$PASS1\",\"newPassword\":\"$PASS2\"}")
check "修改密码" 200 "$(status_of "$R")"

check "会话A（发起改密）已失效" 401 "$(curl -s -b "$JAR_A" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"
check "会话B（其它设备）已失效 ★关键" 401 "$(curl -s -b "$JAR_B" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"
check "会话C（其它设备）已失效 ★关键" 401 "$(curl -s -b "$JAR_C" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"

section "3. 退出其它设备 / 会话列表"

curl -s -c "$JAR_A" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$USER\",\"password\":\"$PASS2\"}" -o /dev/null
curl -s -c "$JAR_B" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$USER\",\"password\":\"$PASS2\"}" -o /dev/null

R=$(req "$JAR_A" GET /api/users/me/sessions)
check "GET  /api/users/me/sessions" 200 "$(status_of "$R")"
SESS_BODY=$(body_of "$R")
checkstr "会话列表不泄露令牌本身（无 64 位裸令牌）" "0" \
  "$(echo "$SESS_BODY" | grep -c "$TOKEN_A" || true)"

R=$(req "$JAR_A" DELETE /api/users/me/sessions)
check "DELETE /api/users/me/sessions 退出其它设备" 200 "$(status_of "$R")"
check "当前会话仍有效" 200 "$(curl -s -b "$JAR_A" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"
check "其它设备已被踢出" 401 "$(curl -s -b "$JAR_B" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"

section "4. 未认证 / 伪造令牌"

check "无 Cookie 访问 /api/users/me" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/users/me")"
check "伪造令牌访问 /api/users/me" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: blog_session=$(printf 'a%.0s' {1..64})" "$BASE/api/users/me")"
check "长度异常的令牌" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: blog_session=short" "$BASE/api/users/me")"

section "5. 账号枚举与错误信息"

R=$(req "$(mktemp)" POST /api/auth/login '{"identifier":"no_such_user_xyz","password":"Whatever123"}')
MSG_NOUSER=$(body_of "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["error"]["message"])' 2>/dev/null)
R=$(req "$(mktemp)" POST /api/auth/login "{\"identifier\":\"$USER\",\"password\":\"WrongPass999\"}")
MSG_WRONG=$(body_of "$R" | python3 -c 'import sys,json;print(json.load(sys.stdin)["error"]["message"])' 2>/dev/null)
checkstr "账号不存在与密码错误的提示一致（防枚举）" "$MSG_WRONG" "$MSG_NOUSER"

section "6. 安全响应头"

HDRS=$(curl -s -D- -o /dev/null "$BASE/")
for h in "content-security-policy" "x-content-type-options" "x-frame-options" "referrer-policy" "permissions-policy"; do
  if echo "$HDRS" | grep -qi "^$h:"; then
    printf '  \033[32m✓\033[0m %-56s 存在\n' "$h"
    PASS=$((PASS + 1))
  else
    printf '  \033[31m✗\033[0m %-56s 缺失\n' "$h"
    FAIL=$((FAIL + 1))
  fi
done

CSP=$(echo "$HDRS" | grep -i "^content-security-policy:" | head -1)
checkstr "CSP 使用 nonce 而非 unsafe-inline（script-src）" "0" \
  "$(echo "$CSP" | grep -c "script-src[^;]*unsafe-inline" || true)"
checkstr "CSP 禁止内嵌框架（frame-ancestors none）" "1" \
  "$(echo "$CSP" | grep -c "frame-ancestors 'none'" || true)"
checkstr "CSP 禁止 object（object-src none）" "1" \
  "$(echo "$CSP" | grep -c "object-src 'none'" || true)"

# API 响应同样需要安全头
APIHDRS=$(curl -s -D- -o /dev/null "$BASE/api/stats")
checkstr "API 响应也带 x-content-type-options" "1" \
  "$(echo "$APIHDRS" | grep -ci "^x-content-type-options:" || true)"

section "7. 数据暴露：公开接口不泄露敏感字段"

for path in "/api/posts?pageSize=1" "/api/tags" "/api/stats" "/api/users/muzzle"; do
  BODY=$(curl -s "$BASE$path")
  LEAK=0
  for field in passwordHash password deletedAt ip userAgent expiresAt; do
    echo "$BODY" | grep -q "\"$field\"" && LEAK=$((LEAK + 1))
  done
  if [ "$LEAK" -eq 0 ]; then
    printf '  \033[32m✓\033[0m %-56s 无敏感字段\n' "$path"
    PASS=$((PASS + 1))
  else
    printf '  \033[31m✗\033[0m %-56s 泄露 %s 个敏感字段\n' "$path" "$LEAK"
    FAIL=$((FAIL + 1))
  fi
done

# 错误响应不应泄露堆栈或 SQL
ERRS=$(curl -s "$BASE/api/posts/definitely-not-a-slug")
checkstr "错误响应不含堆栈/Prisma 内部信息" "0" \
  "$(echo "$ERRS" | grep -ciE "prisma|at Object|node_modules|SELECT|stack" || true)"

section "8. Markdown 清洗（XSS / 危险 URI）"

# 建一篇含攻击载荷的文章，通过真实渲染管线验证清洗结果。
# 凭据从环境变量/.env 读取，脚本里不内置任何口令。
if [ -z "${SEED_ADMIN_PASSWORD:-}" ]; then
  SSLUG=$(python3 -c "
import re,sys
try:
    for line in open('.env', encoding='utf-8'):
        m = re.match(r'\s*SEED_ADMIN_PASSWORD\s*=\s*(.*)\s*$', line)
        if m: print(m.group(1).strip().strip('\"').strip(\"'\")); break
except FileNotFoundError: pass
")
  SEED_ADMIN_PASSWORD="${SSLUG:-}"
fi
ADMIN_USER="${SEED_ADMIN_USER:-muzzle}"

if [ -z "$SEED_ADMIN_PASSWORD" ]; then
  printf '  \033[33m!\033[0m 未设置 SEED_ADMIN_PASSWORD，跳过 Markdown 清洗用例\n'
  printf '    可在 .env 中设置该变量后重跑\n'
else
  JAR_X=$(mktemp)
  curl -s -c "$JAR_X" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"identifier\":\"$ADMIN_USER\",\"password\":\"$SEED_ADMIN_PASSWORD\"}" -o /dev/null
  XLOGIN=$(curl -s -b "$JAR_X" -o /dev/null -w '%{http_code}' "$BASE/api/users/me")
  if [ "$XLOGIN" != "200" ]; then
    printf '  \033[33m!\033[0m 管理员登录失败（%s），跳过 Markdown 清洗用例\n' "$XLOGIN"
    SEED_ADMIN_PASSWORD=""
  fi
fi

if [ -n "$SEED_ADMIN_PASSWORD" ]; then

PAYLOAD=$(python3 - <<'PYEOF'
import json
content = """# XSS 与 URI 清洗验证

<script>window.__pwned=1</script>

<img src=x onerror="window.__pwned2=1">

<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">

<img src="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+">

<img src="data:image/png;base64,iVBORw0KGgo=">

[点我](javascript:alert(1))

<iframe src="https://evil.example"></iframe>

<style>body{display:none}</style>

正常段落 **加粗** 与 `代码`。
"""
print(json.dumps({"title": "安全验收 XSS 用例", "content": content, "status": "PUBLISHED", "tags": ["安全验收"]}))
PYEOF
)

XSLUG=$(curl -s -b "$JAR_X" -X POST "$BASE/api/posts" -H 'Content-Type: application/json' -d "$PAYLOAD" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["slug"])' 2>/dev/null)

if [ -z "$XSLUG" ]; then
  printf '  \033[31m✗\033[0m 无法创建 XSS 测试文章（跳过本组）\n'
  FAIL=$((FAIL + 1))
else
  curl -s "$BASE/posts/$XSLUG" -o /tmp/xss-check.html
  # 只检查正文区块，排除页面自带脚本
  python3 - <<'PYEOF'
import re, sys
html = open('/tmp/xss-check.html', encoding='utf-8').read()
start = html.find('class="markdown-body"')
end = html.find('id="comments"')
block = html[start:end] if start != -1 and end != -1 else html

checks = [
    ('<script> 标签',        block.count('<script')),
    ('onerror/onclick 属性', len(re.findall(r'\son\w+\s*=', block))),
    ('iframe 标签',          block.count('<iframe')),
    ('<style> 标签',         block.count('<style')),
    ('javascript: 协议',     block.count('javascript:')),
    ('data:text/html',       block.count('data:text/html')),
    ('data:image/svg+xml',   block.count('data:image/svg+xml')),
    ('正常内容保留（加粗）',  0 if '<strong>加粗</strong>' in block else 1),
    ('正常内容保留（代码）',  0 if '<code>代码</code>' in block else 1),
    ('安全的 data:image/png 保留', 0 if 'data:image/png' in block else 1),
]
bad = 0
for label, count in checks:
    ok = count == 0
    if not ok:
        bad += 1
    print(f"  {'\033[32m✓\033[0m' if ok else '\033[31m✗\033[0m'} {label:<34} {count}")
print(f"__BAD__={bad}")
PYEOF
  XBAD=$(grep -o '__BAD__=[0-9]*' /tmp/xss-check.html 2>/dev/null | cut -d= -f2)
  PASS=$((PASS + 10))
  if [ "${XBAD:-0}" != "0" ]; then FAIL=$((FAIL + XBAD)); fi

  curl -s -b "$JAR_X" -X DELETE "$BASE/api/posts/$XSLUG" -o /dev/null
fi

rm -f "$JAR_X"
fi  # end of SEED_ADMIN_PASSWORD guard

section "9. 速率限制（防撞库 / 资源耗尽）"

# 用专项账号测试，避免影响其它用例的会话。
# 登录限流按「账号」与「来源 IP」两个维度，这里测账号维度。
RL_USER="rl_$STAMP"
curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$RL_USER\",\"email\":\"$RL_USER@example.com\",\"password\":\"$PASS1\",\"nickname\":\"RL\"}" \
  -o /dev/null

RL_HIT=""
for i in $(seq 1 13); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"identifier\":\"$RL_USER\",\"password\":\"definitelywrong\"}")
  if [ "$CODE" = "429" ] && [ -z "$RL_HIT" ]; then RL_HIT="$i"; fi
done

if [ -n "$RL_HIT" ]; then
  printf '  \033[32m✓\033[0m %-56s 第 %s 次触发 429\n' "连续错误密码触发限流" "$RL_HIT"
  PASS=$((PASS + 1))
else
  printf '  \033[31m✗\033[0m %-56s 13 次均未限流\n' "连续错误密码触发限流"
  FAIL=$((FAIL + 1))
fi

# 限流生效后正确密码也必须被挡住，否则限流形同虚设
RL2=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"identifier\":\"$RL_USER\",\"password\":\"$PASS1\"}")
check "限流生效后正确密码同样被挡（不可绕过）" 429 "$RL2"

section "10. 畸形与边界输入（不应 5xx）"

# 服务端渲染页面若直接用 searchParams（Next 对重复参数会传数组），
# `?q=a&q=b` 这类输入会让 .trim() 抛 TypeError 变成 500。
for probe in "/search?q=a&q=b" "/?tag=x&tag=y" "/?page=1&page=2" "/?page=1e999" \
             "/search?q=a&page=-1" "/tags/rest?page=1e999"; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$probe")
  check "页面 $probe 不返回 5xx" 200 "$CODE"
done

# 畸形 Cookie 曾在未捕获的 URIError 上变成 500
check "畸形 Cookie (%) 视为未登录而非 500" 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' -H 'Cookie: blog_session=%' "$BASE/api/users/me")"

section "11. 受保护路由"

check "未登录访问 /settings 重定向" 307 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/settings")"
check "未登录访问 /admin/posts 重定向" 307 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/posts")"
check "未登录访问 /write 重定向" 307 "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/write")"

printf '\n\033[1m结果：\033[0m \033[32m%d 通过\033[0m' "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf '，\033[31m%d 失败\033[0m\n' "$FAIL"
  exit 1
fi
printf '，0 失败\n'
