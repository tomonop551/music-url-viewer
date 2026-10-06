#!/usr/bin/env bash
# Cloudflare アカウント層の一度きり初期化: music-url-viewer 用 IaC。
#
# やること:
#   1. D1 database 作成 (music_url_viewer: catalog + features + chat budget)
#   2. KV namespace 作成 (chat)
#   3. 作成された ID を wrangler.toml のプレースホルダへ自動反映
#
# 前提: `wrangler` が利用可能（`mise exec -- wrangler ...` 等）。ログイン済み
#       （`wrangler login`）。D1/KV は有料プランの一部で利用可（Workers Paid 推奨）。
# 実行: scripts/setup-cloudflare.sh
# 以後: `wrangler secret put <NAME>` でシークレットを設定してからデプロイ。

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
TOML="$ROOT/wrangler.toml"
W="wrangler"   # 必要なら `W="mise exec -- wrangler"` 等に差し替え

echo "==> 1/2 create D1: music_url_viewer"
OUT_D1=$("$W" d1 create music_url_viewer --json)
D1_ID=$(printf '%s' "$OUT_D1" | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['database_id'])" 2>/dev/null || printf '%s' "$OUT_D1" | grep -oE '[0-9a-f-]{36}')
echo "     database_id=$D1_ID"

echo "==> 2/2 create KV namespace: chat"
OUT_KV=$("$W" kv namespace create chat --json)
KV_ID=$(printf '%s' "$OUT_KV" | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['id'])" 2>/dev/null || printf '%s' "$OUT_KV" | grep -oE '[0-9a-f-]{32}')
echo "     kv_id=$KV_ID"

# ---- wrangler.toml のプレースホルダを置換 ----
python3 - "$TOML" "$D1_ID" "$KV_ID" <<'PY'
import sys
path, d1, kv = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path).read()
repl = [("{MUSIC_URL_VIEWER_D1_ID}", d1), ("{CHAT_KV_ID}", kv)]
for k, v in repl:
    if k not in s:
        print("WARN: placeholder not found:", k); continue
    s = s.replace(k, v)
open(path, "w").write(s)
print("==> wrangler.toml placeholders filled")
PY

echo ""
echo "次の手順:"
echo "  wrangler secret put MUSICBRAINZ_USER_AGENT   # 再掲（自動リロード不要）"
echo "  wrangler secret put APP_ORIGIN               # または wrangler.toml [vars] で管理"
echo "  wrangler deploy"