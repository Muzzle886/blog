#!/usr/bin/env bash
# 共享的口令加密辅助（供各验收脚本 source）
#
# 口令一律以 RSA-OAEP 信封提交，服务端会拒绝明文，因此测试也必须走同一条
# 链路。用 Node 原生 fetch + WebCrypto，不引入任何加密依赖。

# 用法：enc_pw <明文口令> [base_url]  ->  输出信封字符串
enc_pw() {
  BASE_URL="${2:-http://localhost:3000}" PW="$1" node --input-type=module -e '
const base = process.env.BASE_URL, pw = process.env.PW
const res = await fetch(base + "/api/auth/public-key")
if (!res.ok) { console.error("public-key HTTP " + res.status); process.exit(1) }
const { data } = await res.json()
const key = await crypto.subtle.importKey(
  "jwk", data.publicKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"],
)
const ct = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(pw))
let bin = ""
const bytes = new Uint8Array(ct)
for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
process.stdout.write("rsa-oaep-sha256:" + data.keyId + ":" + btoa(bin))
'
}

# 从 .env 读取一个变量（去引号）；读不到输出空
env_value() {
  python3 -c "
import re, sys
key = sys.argv[1]
try:
    for line in open('.env', encoding='utf-8'):
        m = re.match(r'\s*' + key + r'\s*=\s*(.*)\s*$', line)
        if m:
            v = m.group(1).strip().strip('\"').strip(chr(39))
            if v:
                print(v); break
except FileNotFoundError:
    pass
" "$1"
}
